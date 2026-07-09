/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionTypes,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';
import { decryptFeishuEvent } from '../help/utils/FeishuDecryptUtils';
import { triggerEventProperty } from '../help/utils/properties';
import { ANY_EVENT } from '../help/utils/feishu-sdk/consts';
import { Credentials } from '../help/type/enums';

export class FeishuWebhookTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: '飞书 Webhook Trigger',
		name: 'feishuWebhookTrigger',
		icon: 'file:icon.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '=已订阅 {{$parameter["events"].length}} 个事件',
		description: '通过 Webhook 接收飞书事件回调，自动解密并处理 URL 验证',
		defaults: {
			name: '飞书 Webhook Trigger',
		},
		usableAsTool: undefined,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: Credentials.FeishuCredentialsApi,
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: '={{$parameter["responseMode"]}}',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'将下方生成的 Webhook URL 配置到飞书开放平台「事件与回调 - 订阅方式」中，选择「将回调发送至开发者服务器」。<a href="https://open.feishu.cn/document/event-subscription-guide/callback-subscription/step-1-choose-a-subscription-mode/send-callbacks-to-developers-server" target="_blank">参考文档</a>',
				name: 'feishuWebhookNotice',
				type: 'notice',
				default: '',
			},
			{
				...triggerEventProperty,
				default: [ANY_EVENT],
			},
			{
				displayName: 'Encrypt Key',
				name: 'encryptKey',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description:
					'飞书开放平台应用的 Encrypt Key。若在飞书后台开启了加密推送，则必须填写此项用于解密请求体中的 encrypt 字段；若未开启加密可留空。',
			},
			{
				displayName: '验证应用标识',
				name: 'verifyToken',
				type: 'boolean',
				default: false,
				description: 'Whether to verify the Verification Token in the callback data. When enabled, the token is required and each request is validated, otherwise no verification is performed.',
			},
			{
				displayName: 'Verification Token',
				name: 'verificationToken',
				type: 'string',
				typeOptions: {
					password: true,
				},
				required: true,
				default: '',
				description:
					'飞书开放平台应用的 Verification Token，用于校验回调数据中的 token 是否匹配。',
				displayOptions: {
					show: {
						verifyToken: [true],
					},
				},
			},
			{
				displayName: '响应模式',
				name: 'responseMode',
				type: 'options',
				options: [
					{
						name: 'Immediately',
						value: 'onReceived',
						description: '事件触发后立即响应',
					},
					{
						name: "Using '飞书响应' Node",
						value: 'responseNode',
						description: '使用飞书响应节点同步返回响应',
					},
				],
				default: 'onReceived',
				description: '选择何时向飞书发送响应',
			},
			{
				displayName:
					'请在工作流中使用「飞书响应」节点返回数据。官方「Respond to Webhook」节点仅支持 n8n 内置 Webhook，不支持本触发器。',
				name: 'feishuResponseNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						responseMode: ['responseNode'],
					},
				},
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const res = this.getResponseObject();
		const body = this.getBodyData() as IDataObject;

		const encryptKey = ((this.getNodeParameter('encryptKey', '') as string) || '').trim();
		const verifyToken = this.getNodeParameter('verifyToken', false) as boolean;
		const verificationToken = verifyToken
			? ((this.getNodeParameter('verificationToken', '') as string) || '').trim()
			: '';

		// 1. 解密：若请求体包含 encrypt 字段，则使用 Encrypt Key 解密；否则视为明文推送
		let payload: IDataObject;
		if (typeof body.encrypt === 'string') {
			if (!encryptKey) {
				throw new NodeOperationError(
					this.getNode(),
					'请求体已加密（包含 encrypt 字段），但未配置 Encrypt Key，无法解密',
				);
			}

			const decrypted = decryptFeishuEvent(encryptKey, body.encrypt);
			if (!decrypted) {
				throw new NodeOperationError(
					this.getNode(),
					'解密失败，请检查 Encrypt Key 是否与飞书后台配置一致',
				);
			}

			try {
				payload = JSON.parse(decrypted) as IDataObject;
			} catch (error) {
				throw new NodeOperationError(this.getNode(), '解密后的数据不是有效的 JSON 格式');
			}
		} else {
			payload = body;
		}

		// 2. Verification Token 校验（兼容 schema 1.0 顶层 token 与 2.0 header.token）
		if (verifyToken && verificationToken) {
			const header = (payload.header as IDataObject) || {};
			const token = (payload.token as string) ?? (header.token as string);
			if (token !== verificationToken) {
				res.status(200).json({ msg: 'invalid verification token' });
				return { noWebhookResponse: true };
			}
		}

		// 3. URL 验证：飞书在配置回调地址时会推送 url_verification，需要原样返回 challenge
		if (payload.type === 'url_verification') {
			res.status(200).json({ challenge: payload.challenge });
			return { noWebhookResponse: true };
		}

		const credentials = await this.getCredentials(Credentials.FeishuCredentialsApi);
		const credentialAppId = ((credentials.appid as string) || '').trim();

		// 4. app_id 校验：schema 2.0 取 header.app_id，schema 1.0 取 event.app_id
		const header = (payload.header as IDataObject) || {};
		const event = (payload.event as IDataObject) || {};
		const payloadAppId =
			payload.schema === '2.0' ? (header.app_id as string) : (event.app_id as string);

		if (!credentialAppId || !payloadAppId || payloadAppId !== credentialAppId) {
			res.status(200).json({ msg: 'success' });
			return { noWebhookResponse: true };
		}

		// 5. 事件类型匹配：schema 2.0 取 header.event_type，schema 1.0 取 event.type
		const eventType =
			payload.schema === '2.0' ? (header.event_type as string) : (event.type as string);

		const events = this.getNodeParameter('events', []) as string[];
		const isAnyEvent = events.includes(ANY_EVENT);
		const isMatched = isAnyEvent || (!!eventType && events.includes(eventType));

		// 未匹配的事件：返回 200 确认收到，但不触发工作流
		if (!isMatched) {
			res.status(200).json({ msg: 'success' });
			return { noWebhookResponse: true };
		}

		// 6. 匹配的事件：将解密后的数据传入工作流
		const responseMode = this.getNodeParameter('responseMode', 'onReceived') as string;

		// Immediately 模式：立即返回 200 确认收到，再异步执行工作流
		if (responseMode === 'onReceived') {
			res.status(200).json({ msg: 'success' });
			return {
				workflowData: [[{ json: payload }]],
				noWebhookResponse: true,
			};
		}

		// responseNode 模式：等待「飞书响应」节点通过 sendResponse 返回数据
		return {
			workflowData: [[{ json: payload }]],
		};
	}
}
