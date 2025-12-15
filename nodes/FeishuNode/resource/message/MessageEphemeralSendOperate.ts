import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	sleep,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';

interface RequestOptions {
	batching?: { batch?: { batchSize?: number; batchInterval?: number } };
	timeout?: number;
}

const MessageEphemeralSendOperate: ResourceOperations = {
	name: '发送仅特定人可见的消息卡片',
	value: 'message:ephemeralSend',
	options: [
		{
			displayName: '群ID',
			name: 'chat_id',
			type: 'string',
			required: true,
			default: '',
			description:
				'目标群 ID。仅支持群模式为对话的普通群，不支持话题群。群 ID 获取方式参见群 ID 说明。',
		},
		{
			displayName: '用户ID类型',
			name: 'user_id_type',
			type: 'options',
			options: [
				{
					name: 'Open ID',
					value: 'open_id',
					description:
						'标识一个用户在某个应用中的身份。同一个用户在不同应用中的 Open ID 不同。推荐使用。',
				},
				{
					name: 'User ID',
					value: 'user_id',
					description:
						'标识一个用户在某个租户内的身份。同一个用户在租户 A 和租户 B 内的 User ID 是不同的。',
				},
				{
					name: 'Email',
					value: 'email',
					description: '可见卡片的用户邮箱地址。',
				},
			],
			required: true,
			default: 'open_id',
			description:
				'可见卡片的用户标识类型。open_id、email 或 user_id 三者只需填写其中之一，且不可同时为空。字段生效的顺序为 open_id > user_id > email。',
		},
		{
			displayName: '用户ID',
			name: 'user_id_value',
			type: 'string',
			required: true,
			default: '',
			description: '可见卡片的用户标识值，根据所选的用户ID类型填写对应的值。',
		},
		{
			displayName: '卡片内容',
			name: 'card',
			type: 'json',
			default:
				'{"elements":[{"tag":"div","text":{"content":"这是仅你可见的消息","tag":"plain_text"}}],"header":{"template":"blue","title":{"content":"私密消息","tag":"plain_text"}}}',
			description:
				'消息卡片的内容。支持卡片 JSON 或搭建工具构建的卡片模板。要使用卡片 JSON，参考卡片 JSON 结构。',
			required: true,
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				{
					displayName: 'Batching',
					name: 'batching',
					placeholder: 'Add Batching',
					type: 'fixedCollection',
					typeOptions: {
						multipleValues: false,
					},
					default: {
						batch: {},
					},
					options: [
						{
							displayName: 'Batching',
							name: 'batch',
							values: [
								{
									displayName: 'Items per Batch',
									name: 'batchSize',
									type: 'number',
									typeOptions: {
										minValue: -1,
									},
									default: 50,
									description:
										'输入将被分批处理以限制请求。 -1 表示禁用。0 将被视为 1。',
								},
								{
									displayName: 'Batch Interval (Ms)',
									name: 'batchInterval',
									type: 'number',
									typeOptions: {
										minValue: 0,
									},
									default: 1000,
									description: '每批请求之间的时间（毫秒）。0 表示禁用。',
								},
							],
						},
					],
				},
				{
					displayName: 'Timeout',
					name: 'timeout',
					type: 'number',
					typeOptions: {
						minValue: 0,
					},
					default: 0,
					description:
						'等待服务器发送响应头（并开始响应体）的时间（毫秒），超过此时间将中止请求。0 表示不限制超时。',
				},
			],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const chat_id = this.getNodeParameter('chat_id', index) as string;
		const user_id_type = this.getNodeParameter('user_id_type', index) as string;
		const user_id_value = this.getNodeParameter('user_id_value', index) as string;
		const card = this.getNodeParameter('card', index) as object;
		const options = this.getNodeParameter('options', index, {}) as RequestOptions;

		// 处理批次延迟
		const handleBatchDelay = async (): Promise<void> => {
			const batchSize = options.batching?.batch?.batchSize ?? -1;
			const batchInterval = options.batching?.batch?.batchInterval ?? 0;

			if (index > 0 && batchSize >= 0 && batchInterval > 0) {
				const effectiveBatchSize = batchSize > 0 ? batchSize : 1;
				if (index % effectiveBatchSize === 0) {
					await sleep(batchInterval);
				}
			}
		};

		await handleBatchDelay();

		const body: IDataObject = {
			chat_id,
			msg_type: 'interactive',
			card: typeof card === 'string' ? JSON.parse(card) : card,
		};

		// 根据用户ID类型设置对应的字段
		body[user_id_type] = user_id_value;

		// 构建请求选项
		const requestOptions: any = {
			method: 'POST',
			url: `/open-apis/ephemeral/v1/send`,
			body,
		};

		// 添加超时配置
		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default MessageEphemeralSendOperate;
