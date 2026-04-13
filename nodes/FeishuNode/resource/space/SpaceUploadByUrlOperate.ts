import { IDataObject, IExecuteFunctions, IHttpRequestOptions, NodeOperationError } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import FormData from 'form-data';
import {
	batchingOption,
	timeoutOption,
} from '../../../help/utils/sharedOptions';

export default {
	name: '上传素材通过Url',
	value: 'space:uploadByUrl',
	order: 150,
	description: '通过文件链接将文件、图片、视频等素材上传到指定云文档中。素材将显示在对应云文档中，在云空间中不会显示',
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
			default: 'docx_image',
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

		{
			displayName: '文件链接',
			name: 'url',
			type: 'string',
			default: '',
			required: true,
			description: '要下载并上传的文件链接',
		},
		{
			displayName: '文件名称',
			name: 'file_name',
			type: 'string',
			default: '',
			required: true,
			description: '带后缀的文件名，例如：test.pdf',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				{
					displayName: 'Checksum',
					name: 'checksum',
					type: 'string',
					default: '',
					description: '文件的 Adler-32 校验和。示例值："3248270248"',
				},
				{
					displayName: 'Extra',
					name: 'extra',
					type: 'string',
					default: '',
					description:
						'以下场景的上传点需通过该参数传入素材所在云文档的 token。extra 参数的格式为 {"drive_route_token":"素材所在云文档的 token"}。详情参考<a href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/introduction#3b8635d3">素材概述-extra 参数说明</a>',
				},
				batchingOption,
				timeoutOption,
			],
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const file_name = this.getNodeParameter('file_name', index) as string;
		const parent_type = this.getNodeParameter('parent_type', index) as string;
		const parent_node = this.getNodeParameter('parent_node', index) as string;
		const url = this.getNodeParameter('url', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			checksum?: string;
			extra?: string;
			timeout?: number;
		};

		// 从外部 URL 下载文件，确保正确处理二进制数据流并获取 Content-Type
		// 使用 encoding: 'arraybuffer' 确保以二进制流方式下载，避免字符编码转换导致乱码
		const response = (await this.helpers.httpRequest({
			method: 'GET',
			url,
			json: false,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		})) as { body: Buffer | ArrayBuffer; headers: Record<string, string | string[] | undefined> };

		// 确保响应体是 Buffer 格式
		// arraybuffer 编码会返回 ArrayBuffer，需要转换为 Buffer
		const file = Buffer.isBuffer(response.body)
			? response.body
			: Buffer.from(response.body as ArrayBuffer);

		// 检查文件大小限制（20 MB）
		const maxFileSize = 20 * 1024 * 1024; // 20 MB
		if (file.byteLength > maxFileSize) {
			throw new NodeOperationError(
				this.getNode(),
				`文件大小超过限制。素材大小不得超过 20 MB，当前文件大小为 ${(file.byteLength / 1024 / 1024).toFixed(2)} MB`,
			);
		}

		// 从响应头获取 Content-Type，如果没有则使用默认值
		let contentType: string = 'application/octet-stream';
		const contentTypeHeader = response.headers['content-type'] || response.headers['Content-Type'];
		if (typeof contentTypeHeader === 'string') {
			contentType = contentTypeHeader;
		} else if (Array.isArray(contentTypeHeader) && contentTypeHeader.length > 0) {
			contentType = contentTypeHeader[0];
		}

		// 清理 Content-Type（移除可能的参数，如 charset）
		const cleanContentType = contentType.split(';')[0].trim();

		const formData = new FormData();
		formData.append('file_name', file_name);
		formData.append('parent_type', parent_type);
		formData.append('parent_node', parent_node);
		formData.append('size', file.byteLength);
		formData.append('file', file, { contentType: cleanContentType, filename: file_name });

		// 添加可选参数
		if (options.checksum) {
			formData.append('checksum', options.checksum);
		}
		if (options.extra) {
			formData.append('extra', options.extra);
		}

		// 构建请求选项
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/drive/v1/medias/upload_all`,
			body: formData,
		};

		// 添加超时配置
		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
} as ResourceOperations;
