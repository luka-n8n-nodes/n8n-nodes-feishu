import { IDataObject, IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import NodeUtils from '../../../help/utils/NodeUtils';

const MessageBatchSendOperate: ResourceOperations = {
	name: '批量发送消息',
	value: 'message:batchSend',
	options: [
		{
			displayName: '消息类型',
			name: 'msg_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{ name: '文本', value: 'text' },
				{ name: '富文本', value: 'post' },
				{ name: '图片', value: 'image' },
				{ name: '分享群名片', value: 'share_chat' },
				{ name: '卡片', value: 'interactive' },
			],
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
			default: JSON.stringify(
				{ zh_cn: { title: '标题', content: [[{ tag: 'text', text: '文本内容' }]] } },
				null,
				2,
			),
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
		// 卡片消息 - interactive
		{
			displayName: '卡片内容',
			name: 'card',
			type: 'json',
			required: true,
			default: JSON.stringify(
				{
					elements: [
						{ tag: 'div', text: { content: 'This is the content', tag: 'plain_text' } },
					],
					header: {
						template: 'blue',
						title: { content: 'This is the title', tag: 'plain_text' },
					},
				},
				null,
				2,
			),
			description:
				'卡片内容，JSON 格式。参考：https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card',
			displayOptions: {
				show: {
					msg_type: ['interactive'],
				},
			},
		},
		// 接收者配置
		{
			displayName: '部门 ID 列表',
			name: 'department_ids',
			type: 'json',
			default: '[]',
			description:
				'部门 ID 列表，支持 JSON 数组或逗号分隔的字符串。列表长度不能超过200。支持传入 department_id 和 open_department_id',
		},
		{
			displayName: '用户 Open ID 列表',
			name: 'open_ids',
			type: 'json',
			default: '[]',
			description: '用户 open_id 列表，支持 JSON 数组或逗号分隔的字符串。列表长度不能超过200',
		},
		{
			displayName: '用户 User ID 列表',
			name: 'user_ids',
			type: 'json',
			default: '[]',
			description: '用户 user_id 列表，支持 JSON 数组或逗号分隔的字符串。列表长度不能超过200',
		},
		{
			displayName: '用户 Union ID 列表',
			name: 'union_ids',
			type: 'json',
			default: '[]',
			description: '用户 union_id 列表，支持 JSON 数组或逗号分隔的字符串。列表长度不能超过200',
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const msg_type = this.getNodeParameter('msg_type', index) as string;
		const department_ids_input = this.getNodeParameter('department_ids', index);
		const open_ids_input = this.getNodeParameter('open_ids', index);
		const user_ids_input = this.getNodeParameter('user_ids', index);
		const union_ids_input = this.getNodeParameter('union_ids', index);

		// 解析 ID 列表，支持数组或逗号分隔的字符串
		const parseIds = (input: unknown, fieldName: string): string[] => {
			let ids: string[] = [];

			if (!input) return ids;

			if (Array.isArray(input)) {
				// 已经是数组
				ids = input.map((id) => String(id).trim()).filter((id) => id);
			} else if (typeof input === 'string') {
				const trimmed = input.trim();
				if (!trimmed) return ids;

				// 尝试解析为 JSON 数组
				if (trimmed.startsWith('[')) {
					try {
						const parsed = JSON.parse(trimmed);
						if (Array.isArray(parsed)) {
							ids = parsed.map((id) => String(id).trim()).filter((id) => id);
						}
					} catch {
						// 解析失败，当作逗号分隔的字符串处理
						ids = trimmed
							.split(',')
							.map((id) => id.trim())
							.filter((id) => id);
					}
				} else {
					// 逗号分隔的字符串
					ids = trimmed
						.split(',')
						.map((id) => id.trim())
						.filter((id) => id);
				}
			}

			// 验证长度不能超过200
			if (ids.length > 200) {
				throw new NodeOperationError(
					this.getNode(),
					`${fieldName} 列表长度不能超过200，当前长度: ${ids.length}`,
				);
			}

			return ids;
		};

		const department_ids = parseIds(department_ids_input, '部门 ID');
		const open_ids = parseIds(open_ids_input, '用户 Open ID');
		const user_ids = parseIds(user_ids_input, '用户 User ID');
		const union_ids = parseIds(union_ids_input, '用户 Union ID');

		const body: IDataObject = {
			msg_type,
		};

		// 根据消息类型构建 content 或 card
		if (msg_type === 'interactive') {
			const card = NodeUtils.getNodeJsonData(this, 'card', index, null) as object;
			body.card = card;
		} else {
			let content: IDataObject;
			switch (msg_type) {
				case 'text': {
					const text_content = this.getNodeParameter('text_content', index) as string;
					content = { text: text_content };
					break;
				}
				case 'post': {
					const post_content = this.getNodeParameter('post_content', index);
					content =
						typeof post_content === 'string'
							? JSON.parse(post_content)
							: (post_content as IDataObject);
					break;
				}
				case 'image': {
					const image_key = this.getNodeParameter('image_key', index) as string;
					content = { image_key };
					break;
				}
				case 'share_chat': {
					const share_chat_id = this.getNodeParameter('share_chat_id', index) as string;
					content = { chat_id: share_chat_id };
					break;
				}
				default:
					content = {};
			}
			body.content = content;
		}

		// 添加接收者列表
		if (department_ids.length > 0) {
			body.department_ids = department_ids;
		}
		if (open_ids.length > 0) {
			body.open_ids = open_ids;
		}
		if (user_ids.length > 0) {
			body.user_ids = user_ids;
		}
		if (union_ids.length > 0) {
			body.union_ids = union_ids;
		}

		return RequestUtils.request.call(this, {
			method: 'POST',
			url: '/open-apis/message/v4/batch_send/',
			body,
		});
	},
};

export default MessageBatchSendOperate;
