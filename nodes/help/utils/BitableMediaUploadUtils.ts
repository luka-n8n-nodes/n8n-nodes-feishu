import FormData from 'form-data';
import { IDataObject, IExecuteFunctions, IHttpRequestOptions, NodeOperationError } from 'n8n-workflow';
import RequestUtils from './RequestUtils';

const MEDIA_UPLOAD_MAX_SIZE = 20 * 1024 * 1024;
const BITABLE_IMAGE_EXTENSIONS = new Set([
	'jpg',
	'jpeg',
	'png',
	'gif',
	'webp',
	'bmp',
	'svg',
	'ico',
	'heic',
	'heif',
	'tif',
	'tiff',
]);

interface IUploadFileData {
	value: Buffer;
	options: {
		filename?: string;
		contentType?: string;
	};
}

interface IUploadParams {
	parentType: string;
	parentNode: string;
	fileName: string;
	buffer: Buffer;
	timeout?: number;
}

function calculateAdler32(data: Buffer): number {
	const MOD_ADLER = 65521;
	let a = 1;
	let b = 0;

	for (let i = 0; i < data.length; i++) {
		a = (a + data[i]) % MOD_ADLER;
		b = (b + a) % MOD_ADLER;
	}

	return ((b << 16) | a) >>> 0;
}

async function runWithConcurrency<T>(
	tasks: (() => Promise<T>)[],
	concurrency: number,
): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	let currentIndex = 0;

	async function worker(): Promise<void> {
		while (currentIndex < tasks.length) {
			const index = currentIndex++;
			results[index] = await tasks[index]();
		}
	}

	await Promise.all(
		Array(Math.min(concurrency, tasks.length))
			.fill(null)
			.map(() => worker()),
	);

	return results;
}

class BitableMediaUploadUtils {
	private static resolveParentType(
		fileName?: string,
		mimeType?: string,
	): 'bitable_image' | 'bitable_file' {
		const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase();

		if (normalizedMime?.startsWith('image/')) {
			return 'bitable_image';
		}

		const extension = fileName?.split('.').pop()?.toLowerCase();

		if (extension && BITABLE_IMAGE_EXTENSIONS.has(extension)) {
			return 'bitable_image';
		}

		return 'bitable_file';
	}

	private static async uploadAll(
		context: IExecuteFunctions,
		params: IUploadParams,
	): Promise<string> {
		const formData = new FormData();
		formData.append('file_name', params.fileName);
		formData.append('parent_type', params.parentType);
		formData.append('parent_node', params.parentNode);
		formData.append('size', params.buffer.length);
		formData.append('file', params.buffer, {
			filename: params.fileName,
		});

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: '/open-apis/drive/v1/medias/upload_all',
			body: formData,
			json: false,
		};

		if (params.timeout) {
			requestOptions.timeout = params.timeout;
		}

		const response = (await RequestUtils.request.call(context, requestOptions)) as IDataObject;
		const fileToken = response.file_token as string | undefined;

		if (!fileToken) {
			throw new NodeOperationError(context.getNode(), '上传素材失败：未返回 file_token');
		}

		return fileToken;
	}

	private static async uploadChunked(
		context: IExecuteFunctions,
		params: IUploadParams,
	): Promise<string> {
		const fileSize = params.buffer.length;

		const prepareResponse = (await RequestUtils.request.call(context, {
			method: 'POST',
			url: '/open-apis/drive/v1/medias/upload_prepare',
			body: {
				file_name: params.fileName,
				parent_type: params.parentType,
				parent_node: params.parentNode,
				size: fileSize,
			},
			timeout: params.timeout,
		})) as IDataObject;

		const uploadId = prepareResponse.upload_id as string;
		const blockSize = prepareResponse.block_size as number;
		const blockNum = prepareResponse.block_num as number;

		if (!uploadId) {
			throw new NodeOperationError(context.getNode(), '分片上传预上传失败：未返回 upload_id');
		}

		const boundRequest = RequestUtils.request.bind(context);
		const uploadTasks = Array.from({ length: blockNum }, (_, seq) => {
			return async (): Promise<void> => {
				const start = seq * blockSize;
				const end = Math.min(start + blockSize, fileSize);
				const chunkBuffer = params.buffer.slice(start, end);

				const formData = new FormData();
				formData.append('upload_id', uploadId);
				formData.append('seq', seq);
				formData.append('size', chunkBuffer.length);
				formData.append('file', chunkBuffer);
				formData.append('checksum', calculateAdler32(chunkBuffer).toString());

				await boundRequest({
					method: 'POST',
					url: '/open-apis/drive/v1/medias/upload_part',
					body: formData,
					json: false,
					timeout: params.timeout,
				} as IHttpRequestOptions);
			};
		});

		await runWithConcurrency(uploadTasks, 5);

		const finishResponse = (await RequestUtils.request.call(context, {
			method: 'POST',
			url: '/open-apis/drive/v1/medias/upload_finish',
			body: {
				upload_id: uploadId,
				block_num: blockNum,
			},
			timeout: params.timeout,
		})) as IDataObject;

		const fileToken = finishResponse.file_token as string | undefined;

		if (!fileToken) {
			throw new NodeOperationError(context.getNode(), '分片上传完成失败：未返回 file_token');
		}

		return fileToken;
	}

	static async uploadBitableMedia(
		context: IExecuteFunctions,
		appToken: string,
		file: IUploadFileData,
		timeout?: number,
	): Promise<string> {
		const fileName = file.options.filename || 'file';
		const parentNode = appToken.trim();

		if (!parentNode) {
			throw new NodeOperationError(
				context.getNode(),
				'上传素材失败：parent_node 不能为空，请填写多维表格 App 的唯一标识（app_toke）',
			);
		}

		if (fileName.length > 250) {
			throw new NodeOperationError(context.getNode(), '文件名长度不能超过 250 字符');
		}

		const uploadParams: IUploadParams = {
			parentType: this.resolveParentType(fileName, file.options.contentType),
			parentNode,
			fileName,
			buffer: file.value,
			timeout,
		};

		if (file.value.length <= MEDIA_UPLOAD_MAX_SIZE) {
			return this.uploadAll(context, uploadParams);
		}

		return this.uploadChunked(context, uploadParams);
	}
}

export default BitableMediaUploadUtils;
export type { IUploadFileData };
