import { IDataObject, IExecuteFunctions, INodeProperties, IHttpRequestOptions } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const SpaceUnsubscribeOperate: ResourceOperations = {
	name: '取消云文档事件订阅',
	value: 'space:unsubscribe',
	order: 180,
	description: '该接口用于取消订阅云文档的通知事件。',
	options: [
		{
			displayName: '文档Token',
			name: 'file_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description: '云文档的 token。',
		},
		{
			displayName: '云文档类型',
			name: 'file_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{ name: '旧版文档（已不推荐使用）', value: 'doc' },
				{ name: '新版文档', value: 'docx' },
				{ name: '电子表格', value: 'sheet' },
				{ name: '多维表格', value: 'bitable' },
				{ name: '文件', value: 'file' },
				{ name: '文件夹', value: 'folder' },
				{ name: '幻灯片', value: 'slides' },
			],
			required: true,
			default: 'docx',
			description: '云文档类型。',
		},
		{
			displayName: '事件类型',
			name: 'event_type',
			type: 'string',
			default: 'file.created_in_folder_v1',
			description: '事件类型。file_type 为 folder（文件夹）时必填 file.created_in_folder_v1。',
			displayOptions: {
				show: {
					file_type: ['folder'],
				},
			},
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
		const file_token = this.getNodeParameter('file_token', index) as string;
		const file_type = this.getNodeParameter('file_type', index) as string;
		const event_type = this.getNodeParameter('event_type', index, '') as string;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const qs: IDataObject = {
			file_type,
		};

		// 如果是 folder 类型且提供了 event_type，则添加到查询参数
		if (file_type === 'folder' && event_type) {
			qs.event_type = event_type;
		}

		// 构建请求选项
		const requestOptions: IHttpRequestOptions = {
			method: 'DELETE',
			url: `/open-apis/drive/v1/files/${file_token}/delete_subscribe`,
			qs: qs,
		};

		// 添加超时配置
		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default SpaceUnsubscribeOperate;
