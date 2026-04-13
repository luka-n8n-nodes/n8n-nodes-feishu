import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import {
	binaryPropertyNameOption,
	fileNameOption,
	mimeTypeOption,
	batchingOption,
	timeoutOption,
} from '../../../help/utils/sharedOptions';

const SpaceFileDownloadOperate: ResourceOperations = {
	name: '下载文件',
	value: 'space:fileDownload',
	order: 100,
	description: '下载云空间中的文件，如 PDF 文件。不包含飞书文档、电子表格以及多维表格等在线文档',
	options: [
		{
			displayName: '文件Token',
			name: 'file_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description: '文件的 token，获取方式见文件概述',
		},
		binaryPropertyNameOption,
		{
			displayName: '选项',
			name: 'options',
			type: 'collection',
			placeholder: '添加选项',
			default: {},
			options: [
				fileNameOption,
				mimeTypeOption,
				batchingOption,
				timeoutOption,
			],
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const file_token = this.getNodeParameter('file_token', index) as string;
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			file_name?: string;
			fileName?: string; // 兼容旧数据
			mimeType?: string;
			timeout?: number;
		};

		const buffer = await RequestUtils.request.call(this, {
			method: 'GET',
			url: `/open-apis/drive/v1/files/${file_token}/download`,
			encoding: 'arraybuffer',
			json: false,
			timeout: options.timeout || undefined,
		});

		// 兼容旧数据：优先使用 file_name，其次使用 fileName
		const fileName = (options.file_name || options.fileName)?.trim() || undefined;
		const mimeType = options.mimeType?.trim() || undefined;

		const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, mimeType);

		return {
			binary: {
				[binaryPropertyName]: binaryData,
			},
			json: binaryData,
		};
	},
};

export default SpaceFileDownloadOperate;
