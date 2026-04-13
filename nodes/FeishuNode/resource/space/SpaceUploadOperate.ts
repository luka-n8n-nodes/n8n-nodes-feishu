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

export default {
	name: '上传素材',
	value: 'space:upload',
	order: 130,
	description: '将文件、图片、视频等素材上传到指定云文档中。素材将显示在对应云文档中，在云空间中不会显示。文件大小不得超过 20 MB',
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

		fileFieldNameOption,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				{
					...fileNameOption,
					description: '带后缀的文件名，例如：test.pdf。不填则使用原始文件名',
				},
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
		const parent_type = this.getNodeParameter('parent_type', index) as string;
		const parent_node = this.getNodeParameter('parent_node', index) as string;
		const fileFieldName = this.getNodeParameter('fileFieldName', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			file_name?: string;
			checksum?: string;
			extra?: string;
			timeout?: number;
		};

		const file = (await NodeUtils.buildUploadFileData.call(this, fileFieldName, index)) as any;

		if (!file || !file.value) {
			throw new NodeOperationError(
				this.getNode(),
				'未找到文件数据，请检查二进制文件字段名是否正确',
			);
		}

		// 检查文件大小限制（20 MB）
		const maxFileSize = 20 * 1024 * 1024; // 20 MB
		if (file.value.length > maxFileSize) {
			throw new NodeOperationError(
				this.getNode(),
				`文件大小超过限制。素材大小不得超过 20 MB，当前文件大小为 ${(file.value.length / 1024 / 1024).toFixed(2)} MB`,
			);
		}

		// 使用 options 中的文件名，如果没有则使用原始文件名
		const fileName = options.file_name || file.options?.filename || 'file';

		const formData = new FormData();
		formData.append('file_name', fileName);
		formData.append('parent_type', parent_type);
		formData.append('parent_node', parent_node);
		formData.append('size', file.value.length);
		formData.append('file', file.value);

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
