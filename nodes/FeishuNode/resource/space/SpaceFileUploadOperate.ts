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

const SpaceFileUploadOperate: ResourceOperations = {
	name: '上传文件',
	value: 'space:fileUpload',
	order: 80,
	description: '上传文件指将本地环境的各类文件上传至云空间中，文件大小不超过20MB',
	options: [
		{
			displayName: '文件夹 Token',
			name: 'parent_node',
			type: 'string',
			required: true,
			default: '',
			description: '云空间中文件夹的 token，获取方式见飞书文档',
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
					displayName: '文件校验和',
					name: 'checksum',
					type: 'string',
					default: '',
					description: '文件的 Adler-32 校验和',
				},
				batchingOption,
				timeoutOption,
			],
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const parent_node = this.getNodeParameter('parent_node', index) as string;
		const fileFieldName = this.getNodeParameter('fileFieldName', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			file_name?: string;
			checksum?: string;
			timeout?: number;
		};

		const file = (await NodeUtils.buildUploadFileData.call(this, fileFieldName, index)) as any;

		if (!file || !file.value) {
			throw new NodeOperationError(
				this.getNode(),
				'未找到文件数据，请检查二进制文件字段名是否正确',
			);
		}

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

		const fileSize = file.value.length;
		if (fileSize > 20971520) {
			throw new NodeOperationError(
				this.getNode(),
				'文件大小不能超过20MB，如需上传更大文件请使用分片上传接口',
			);
		}

		const formData = new FormData();
		formData.append('file_name', file_name);
		formData.append('parent_type', 'explorer');
		formData.append('parent_node', parent_node);
		formData.append('size', fileSize);
		formData.append('file', file.value);

		// 添加可选的校验和参数
		if (options.checksum) {
			formData.append('checksum', options.checksum);
		}

		return RequestUtils.request.call(this, {
			method: 'POST',
			url: '/open-apis/drive/v1/files/upload_all',
			body: formData,
			timeout: options.timeout,
		} as IHttpRequestOptions);
	},
};

export default SpaceFileUploadOperate;
