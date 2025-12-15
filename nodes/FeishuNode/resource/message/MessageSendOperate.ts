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

const MessageSendOperate: ResourceOperations = {
	name: '发送消息',
	value: 'message:send',
	options: [
		{
			displayName: '用户ID类型',
			name: 'receive_id_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{
					name: 'Open ID',
					value: 'open_id',
					description:
						'标识一个用户在某个应用中的身份。同一个用户在不同应用中的 Open ID 不同',
				},
				{
					name: 'Union ID',
					value: 'union_id',
					description:
						'标识一个用户在某个应用开发商下的身份。同一用户在同一开发商下的应用中的 Union ID 是相同的',
				},
				{
					name: 'User ID',
					value: 'user_id',
					description:
						'标识一个用户在某个租户内的身份。同一个用户在租户 A 和租户 B 内的 User ID 是不同的',
				},
				{
					name: 'Email',
					value: 'email',
					description: '以用户的真实邮箱来标识用户',
				},
				{
					name: 'Chat ID',
					value: 'chat_id',
					description: '以群 ID 来标识群聊',
				},
			],
			required: true,
			default: 'open_id',
		},
		{
			displayName: '消息接收者的 ID',
			name: 'receive_id',
			type: 'string',
			required: true,
			default: '',
			description: 'ID 类型与查询参数 receive_id_type 的取值一致',
		},
		{
			displayName: '消息类型',
			name: 'msg_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{ name: '文本', value: 'text' },
				{ name: '富文本', value: 'post' },
				{ name: '图片', value: 'image' },
				{ name: '视频', value: 'media' },
				{ name: '语音', value: 'audio' },
				{ name: '文件', value: 'file' },
				{ name: '表情包', value: 'sticker' },
				{ name: '卡片', value: 'interactive' },
				{ name: '分享群名片', value: 'share_chat' },
				{ name: '分享个人名片', value: 'share_user' },
				{ name: '系统消息', value: 'system' },
			],
			description:
				'参考：https://open.feishu.cn/document/server-docs/im-v1/message-content-description/create_json',
			required: true,
			default: 'text',
		},
		// 文本消息 - text
		{
			displayName: '文本内容',
			name: 'text_content',
			type: 'string',
			typeOptions: {
				rows: 4,
			},
			required: true,
			default: '',
			description: '文本消息内容，支持 @用户 和 @所有人',
			displayOptions: {
				show: {
					msg_type: ['text'],
				},
			},
		},
		// 富文本消息 - post
		{
			displayName: '富文本内容',
			name: 'post_content',
			type: 'json',
			required: true,
			default: JSON.stringify({ zh_cn: { title: '标题', content: [[{ tag: 'text', text: '文本内容' }]] } }, null, 2),
			description: '富文本消息内容，JSON 格式',
			displayOptions: {
				show: {
					msg_type: ['post'],
				},
			},
		},
		// 图片消息 - image
		{
			displayName: 'Image Key',
			name: 'image_key',
			type: 'string',
			required: true,
			default: '',
			description: '图片的 Key，通过上传图片接口获取',
			displayOptions: {
				show: {
					msg_type: ['image'],
				},
			},
		},
		// 视频消息 - media
		{
			displayName: 'File Key（视频）',
			name: 'media_file_key',
			type: 'string',
			required: true,
			default: '',
			description: '视频文件的 Key，通过上传文件接口获取',
			displayOptions: {
				show: {
					msg_type: ['media'],
				},
			},
		},
		{
			displayName: 'Image Key（视频封面）',
			name: 'media_image_key',
			type: 'string',
			default: '',
			description: '视频封面图片的 Key（可选），通过上传图片接口获取',
			displayOptions: {
				show: {
					msg_type: ['media'],
				},
			},
		},
		// 语音消息 - audio
		{
			displayName: 'File Key（语音）',
			name: 'audio_file_key',
			type: 'string',
			required: true,
			default: '',
			description: '语音文件的 Key，通过上传文件接口获取（仅支持 opus 格式）',
			displayOptions: {
				show: {
					msg_type: ['audio'],
				},
			},
		},
		// 文件消息 - file
		{
			displayName: 'File Key（文件）',
			name: 'file_key',
			type: 'string',
			required: true,
			default: '',
			description: '文件的 Key，通过上传文件接口获取',
			displayOptions: {
				show: {
					msg_type: ['file'],
				},
			},
		},
		// 表情包消息 - sticker
		{
			displayName: 'File Key（表情包）',
			name: 'sticker_file_key',
			type: 'string',
			required: true,
			default: '',
			description: '表情包文件的 Key，通过上传文件接口获取',
			displayOptions: {
				show: {
					msg_type: ['sticker'],
				},
			},
		},
		// 卡片消息 - interactive
		{
			displayName: '卡片内容',
			name: 'interactive_content',
			type: 'json',
			required: true,
			default:
				JSON.stringify({ elements: [{ tag: 'div', text: { content: 'This is the content', tag: 'plain_text' } }], header: { template: 'blue', title: { content: 'This is the title', tag: 'plain_text' } } }, null, 2),
			description: '卡片消息内容，JSON 格式',
			displayOptions: {
				show: {
					msg_type: ['interactive'],
				},
			},
		},
		// 分享群名片 - share_chat
		{
			displayName: 'Chat ID（群名片）',
			name: 'share_chat_id',
			type: 'string',
			required: true,
			default: '',
			description: '要分享的群 ID',
			displayOptions: {
				show: {
					msg_type: ['share_chat'],
				},
			},
		},
		// 分享个人名片 - share_user
		{
			displayName: 'User ID（个人名片）',
			name: 'share_user_id',
			type: 'string',
			required: true,
			default: '',
			description: '要分享的用户 ID',
			displayOptions: {
				show: {
					msg_type: ['share_user'],
				},
			},
		},
		// 系统消息 - system
		{
			displayName: '系统消息内容',
			name: 'system_content',
			type: 'json',
			required: true,
			default: JSON.stringify({ type: 'divider' }, null, 2),
			description: '系统消息内容，JSON 格式',
			displayOptions: {
				show: {
					msg_type: ['system'],
				},
			},
		},
		{
			displayName: 'UUID',
			name: 'uuid',
			type: 'string',
			default: '',
			description: '自定义设置的唯一字符串序列，用于在发送消息时请求去重',
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
		const receive_id_type = this.getNodeParameter('receive_id_type', index) as string;
		const receive_id = this.getNodeParameter('receive_id', index) as string;
		const msg_type = this.getNodeParameter('msg_type', index) as string;
		const uuid = this.getNodeParameter('uuid', index) as string;
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

		// 根据消息类型构建 content
		let content: string;
		switch (msg_type) {
			case 'text': {
				const text_content = this.getNodeParameter('text_content', index) as string;
				content = JSON.stringify({ text: text_content });
				break;
			}
			case 'post': {
				const post_content = this.getNodeParameter('post_content', index);
				content =
					typeof post_content === 'string' ? post_content : JSON.stringify(post_content);
				break;
			}
			case 'image': {
				const image_key = this.getNodeParameter('image_key', index) as string;
				content = JSON.stringify({ image_key });
				break;
			}
			case 'media': {
				const media_file_key = this.getNodeParameter('media_file_key', index) as string;
				const media_image_key = this.getNodeParameter('media_image_key', index) as string;
				const mediaContent: IDataObject = { file_key: media_file_key };
				if (media_image_key) {
					mediaContent.image_key = media_image_key;
				}
				content = JSON.stringify(mediaContent);
				break;
			}
			case 'audio': {
				const audio_file_key = this.getNodeParameter('audio_file_key', index) as string;
				content = JSON.stringify({ file_key: audio_file_key });
				break;
			}
			case 'file': {
				const file_key = this.getNodeParameter('file_key', index) as string;
				content = JSON.stringify({ file_key });
				break;
			}
			case 'sticker': {
				const sticker_file_key = this.getNodeParameter('sticker_file_key', index) as string;
				content = JSON.stringify({ file_key: sticker_file_key });
				break;
			}
			case 'interactive': {
				const interactive_content = this.getNodeParameter('interactive_content', index);
				content =
					typeof interactive_content === 'string'
						? interactive_content
						: JSON.stringify(interactive_content);
				break;
			}
			case 'share_chat': {
				const share_chat_id = this.getNodeParameter('share_chat_id', index) as string;
				content = JSON.stringify({ chat_id: share_chat_id });
				break;
			}
			case 'share_user': {
				const share_user_id = this.getNodeParameter('share_user_id', index) as string;
				content = JSON.stringify({ user_id: share_user_id });
				break;
			}
			case 'system': {
				const system_content = this.getNodeParameter('system_content', index);
				content =
					typeof system_content === 'string' ? system_content : JSON.stringify(system_content);
				break;
			}
			default:
				content = '{}';
		}

		const body: IDataObject = {
			receive_id,
			msg_type,
			content,
		};
		if (uuid) {
			body.uuid = uuid;
		}

		// 构建请求选项
		const requestOptions: any = {
			method: 'POST',
			url: '/open-apis/im/v1/messages',
			qs: {
				receive_id_type,
			},
			body,
		};

		// 添加超时配置
		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default MessageSendOperate;
