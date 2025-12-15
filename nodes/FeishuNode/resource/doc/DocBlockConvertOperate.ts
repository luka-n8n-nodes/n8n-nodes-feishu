import { IDataObject, IExecuteFunctions, INodeProperties, sleep } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';

interface RequestOptions { batching?: { batch?: { batchSize?: number; batchInterval?: number } }; timeout?: number; }

const DocBlockConvertOperate: ResourceOperations = {
	name: 'Markdown/HTML 内容转换为文档块',
	value: 'doc:block:convert',
	options: [
		{
			displayName: '内容类型',
			name: 'content_type',
			type: 'options',
			required: true,
			default: 'markdown',
			options: [
				{
					name: 'Markdown',
					value: 'markdown',
					description: 'Markdown 格式',
				},
			{
				name: 'HTML',
				value: 'html',
				description: 'HTML 格式',
			},
		],
	},
		{
			displayName: '文本内容',
			name: 'content',
			type: 'string',
			typeOptions: {
				rows: 10,
			},
			required: true,
			default: '',
			description: '文本内容，长度范围 1 ~ 10485760 字符',
		},
		{
			displayName: '用户 ID 类型',
			name: 'user_id_type',
			type: 'options',
			default: 'open_id',
			options: [
				{
					name: 'Open_id',
					value: 'open_id',
					description: '标识一个用户在某个应用中的身份',
				},
				{
					name: 'Union_id',
					value: 'union_id',
					description: '标识一个用户在某个应用开发商下的身份',
				},
			{
				name: 'User_id',
				value: 'user_id',
				description: '标识一个用户在某个租户内的身份',
			},
		],
	},
		{ displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add option', default: {}, options: [{ displayName: 'Batching', name: 'batching', placeholder: 'Add Batching', type: 'fixedCollection', typeOptions: { multipleValues: false }, default: { batch: {} }, options: [{ displayName: 'Batching', name: 'batch', values: [{ displayName: 'Items per Batch', name: 'batchSize', type: 'number', typeOptions: { minValue: -1 }, default: 50, description: '输入将被分批处理以限制请求。 -1 表示禁用。0 将被视为 1。' }, { displayName: 'Batch Interval (Ms)', name: 'batchInterval', type: 'number', typeOptions: { minValue: 0 }, default: 1000, description: '每批请求之间的时间（毫秒）。0 表示禁用。' }] }] }, { displayName: 'Timeout', name: 'timeout', type: 'number', typeOptions: { minValue: 0 }, default: 0, description: '等待服务器发送响应头（并开始响应体）的时间（毫秒），超过此时间将中止请求。0 表示不限制超时。' }] },
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const content_type = this.getNodeParameter('content_type', index) as string;
		const content = this.getNodeParameter('content', index) as string;
		const user_id_type = this.getNodeParameter('user_id_type', index, 'open_id') as string;
		const options = this.getNodeParameter('options', index, {}) as RequestOptions;
		const handleBatchDelay = async (): Promise<void> => { const batchSize = options.batching?.batch?.batchSize ?? -1; const batchInterval = options.batching?.batch?.batchInterval ?? 0; if (index > 0 && batchSize >= 0 && batchInterval > 0) { const effectiveBatchSize = batchSize > 0 ? batchSize : 1; if (index % effectiveBatchSize === 0) await sleep(batchInterval); } };
		await handleBatchDelay();

		const qs: IDataObject = { user_id_type };
		const body: IDataObject = { content_type, content };

		const requestOptions: any = {
			method: 'POST',
			url: '/open-apis/docx/v1/documents/blocks/convert',
			qs,
			body,
		};
		if (options.timeout) requestOptions.timeout = options.timeout;

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default DocBlockConvertOperate;
