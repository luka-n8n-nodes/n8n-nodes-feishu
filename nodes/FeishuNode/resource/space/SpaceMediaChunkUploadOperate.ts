import { IDataObject, IExecuteFunctions, IHttpRequestOptions, NodeOperationError } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import NodeUtils from '../../../help/utils/NodeUtils';
import FormData from 'form-data';
import {
	fileFieldNameOption,
	fileNameOption,
	batchingOption,
	timeoutOption,
} from '../../../help/utils/sharedOptions';

/**
 * 计算 Adler-32 校验和
 * 返回无符号 32 位整数
 */
function calculateAdler32(data: Buffer): number {
	const MOD_ADLER = 65521;
	let a = 1;
	let b = 0;

	for (let i = 0; i < data.length; i++) {
		a = (a + data[i]) % MOD_ADLER;
		b = (b + a) % MOD_ADLER;
	}

	// 使用 >>> 0 确保返回无符号 32 位整数
	return ((b << 16) | a) >>> 0;
}

/**
 * 并发控制执行器
 * @param tasks 任务数组
 * @param concurrency 最大并发数
 */
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

	// 创建指定数量的 worker
	const workers = Array(Math.min(concurrency, tasks.length))
		.fill(null)
		.map(() => worker());

	await Promise.all(workers);
	return results;
}

const SpaceMediaChunkUploadOperate: ResourceOperations = {
	name: '分片上传素材',
	value: 'space:mediaChunkUpload',
	order: 140,
	description: '当上传的文件大于 20MB 时使用。将文件、图片、视频等素材分片上传到指定云文档中。平台固定以 4MB 的大小对素材进行分片。',
	options: [
		{
			displayName: '上传点的类型',
			name: 'parent_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{
					name: '旧版文档图片',
					value: 'doc_image',
				},
				{
					name: '新版文档图片',
					value: 'docx_image',
				},
				{
					name: '电子表格图片',
					value: 'sheet_image',
				},
				{
					name: '旧版文档文件',
					value: 'doc_file',
				},
				{
					name: '新版文档文件',
					value: 'docx_file',
				},
				{
					name: '电子表格文件',
					value: 'sheet_file',
				},
				{
					name: 'Vc 虚拟背景（灰度中，暂未开放）',
					value: 'vc_virtual_background',
				},
				{
					name: '多维表格图片',
					value: 'bitable_image',
				},
				{
					name: '多维表格文件',
					value: 'bitable_file',
				},
				{
					name: '同事圈（灰度中，暂未开放）',
					value: 'moments',
				},
				{
					name: '云文档导入文件',
					value: 'ccm_import_open',
				},
			],
			required: true,
			default: 'docx_file',
			description: '上传点的类型，你可根据上传的文件类型与云文档类型确定上传点类型',
		},
		{
			displayName: '上传点的 Token',
			name: 'parent_node',
			type: 'string',
			default: '',
			required: true,
			description:
				'上传点的 token，即要上传的云文档的 token，用于指定素材将要上传到的云文档或位置。参考<a href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/introduction">素材概述</a>了解上传点类型与上传点 token 的对应关系',
		},
		fileFieldNameOption,
		{
			displayName: '选项',
			name: 'options',
			type: 'collection',
			placeholder: '添加选项',
			default: {},
			options: [
				fileNameOption,
				{
					displayName: 'Extra',
					name: 'extra',
					type: 'string',
					default: '',
					description:
						'以下场景的上传点需通过该参数传入素材所在云文档的 token。extra 参数的格式为 {"drive_route_token":"素材所在云文档的 token"}。详情参考<a href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/introduction#3b8635d3">素材概述-extra 参数说明</a>',
				},
				{
					displayName: '计算校验和',
					name: 'enableChecksum',
					type: 'boolean',
					default: true,
					description: 'Whether to calculate and send Adler-32 checksum for each chunk',
				},
				{
					displayName: '并发数',
					name: 'concurrency',
					type: 'number',
					typeOptions: {
						minValue: 1,
						maxValue: 5,
					},
					default: 5,
					description: '分片上传的最大并发数，默认 5（飞书 API 限制 5 QPS）',
				},
				batchingOption,
				{
					...timeoutOption,
					description: '每个分片上传的超时时间（毫秒），超过此时间将中止请求。0 表示不限制超时。',
				},
			],
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const parent_type = this.getNodeParameter('parent_type', index) as string;
		const parent_node = this.getNodeParameter('parent_node', index) as string;
		const fileFieldName = this.getNodeParameter('fileFieldName', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			file_name?: string;
			extra?: string;
			enableChecksum?: boolean;
			concurrency?: number;
			timeout?: number;
		};

		const file = (await NodeUtils.buildUploadFileData.call(this, fileFieldName, index)) as any;

		if (!file || !file.value) {
			throw new NodeOperationError(
				this.getNode(),
				'未找到文件数据，请检查二进制文件字段名是否正确',
			);
		}

		// 获取文件缓冲区
		const fileBuffer: Buffer = file.value;
		const fileSize = fileBuffer.length;

		// 优先使用用户定义的文件名，否则从二进制数据中获取
		const file_name = options.file_name || file.options?.filename;
		if (!file_name) {
			throw new NodeOperationError(
				this.getNode(),
				'文件名不能为空，请在选项中指定文件名或确保二进制数据包含文件名',
			);
		}

		if (file_name.length > 250) {
			throw new NodeOperationError(this.getNode(), '文件名长度不能超过250字符');
		}

		const enableChecksum = options.enableChecksum !== false;
		const concurrency = options.concurrency || 5;
		const timeout = options.timeout || 0;

		// 构建请求选项
		const requestOptions: IHttpRequestOptions = { method: 'POST', url: '' };
		if (timeout) {
			requestOptions.timeout = timeout;
		}

		// 第一步：预上传，获取上传事务 ID 和分片策略
		const prepareBody: IDataObject = {
			file_name,
			parent_type,
			parent_node,
			size: fileSize,
		};

		// 添加可选的 extra 参数
		if (options.extra) {
			prepareBody.extra = options.extra;
		}

		const prepareResponse = await RequestUtils.request.call(this, {
			method: 'POST',
			url: '/open-apis/drive/v1/medias/upload_prepare',
			body: prepareBody,
		});

		const upload_id = prepareResponse.upload_id as string;
		const block_size = prepareResponse.block_size as number;
		const block_num = prepareResponse.block_num as number;

		if (!upload_id) {
			throw new NodeOperationError(this.getNode(), '预上传失败：未获取到 upload_id');
		}

		// 第二步：分片上传（并发执行，默认 5 QPS）
		// 绑定 request 方法到当前上下文
		const boundRequest = RequestUtils.request.bind(this);

		// 构建所有分片的上传任务
		const uploadTasks = Array.from({ length: block_num }, (_, seq) => {
			return async (): Promise<IDataObject> => {
				const start = seq * block_size;
				const end = Math.min(start + block_size, fileSize);
				const chunkBuffer = fileBuffer.slice(start, end);
				const chunkSize = chunkBuffer.length;

				// 构建分片上传表单数据
				const formData = new FormData();
				formData.append('upload_id', upload_id);
				formData.append('seq', seq);
				formData.append('size', chunkSize);
				formData.append('file', chunkBuffer);

				// 添加校验和（如果启用）
				if (enableChecksum) {
					const checksum = calculateAdler32(chunkBuffer);
					formData.append('checksum', checksum.toString());
				}

				// 上传分片
				const partResponse = await boundRequest({
					method: 'POST',
					url: '/open-apis/drive/v1/medias/upload_part',
					body: formData,
					timeout: requestOptions.timeout,
				} as IHttpRequestOptions);

				return {
					seq,
					size: chunkSize,
					response: partResponse,
				};
			};
		});

		// 并发执行上传任务
		const uploadedParts = await runWithConcurrency(uploadTasks, concurrency);

		// 第三步：完成上传
		const finishResponse = await RequestUtils.request.call(this, {
			method: 'POST',
			url: '/open-apis/drive/v1/medias/upload_finish',
			body: {
				upload_id,
				block_num,
			},
		});

		return {
			upload_id,
			block_size,
			block_num,
			file_name,
			file_size: fileSize,
			uploaded_parts: uploadedParts.length,
			file_token: finishResponse.file_token,
			finish_response: finishResponse,
		};
	},
};

export default SpaceMediaChunkUploadOperate;
