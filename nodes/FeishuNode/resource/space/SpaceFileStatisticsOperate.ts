import { IDataObject, IExecuteFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const SpaceFileStatisticsOperate: ResourceOperations = {
	name: '获取文件统计信息',
	value: 'space:fileStatistics',
	order: 50,
	description:
		'获取各类文件的流量统计信息和互动信息，包括阅读人数、阅读次数和点赞数。',
	options: [
		{
			displayName: '文件Token',
			name: 'file_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description: '文件 token',
		},
		{
			displayName: '文件类型',
			name: 'file_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{ name: '旧版文档', value: 'doc' },
				{ name: '新版文档', value: 'docx' },
				{ name: '电子表格', value: 'sheet' },
				{ name: '思维笔记', value: 'mindnote' },
				{ name: '多维表格', value: 'bitable' },
				{ name: '知识库文档', value: 'wiki' },
				{ name: '文件', value: 'file' },
			],
			required: true,
			default: 'docx',

		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [batchingOption, timeoutOption],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const fileToken = this.getNodeParameter('file_token', index) as string;
		const fileType = this.getNodeParameter('file_type', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: `/open-apis/drive/v1/files/${fileToken}/statistics`,
			qs: {
				file_type: fileType,
			},
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default SpaceFileStatisticsOperate;
