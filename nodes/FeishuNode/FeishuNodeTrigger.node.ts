import {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	NodeConnectionTypes,
	NodeOperationError,
	IDataObject,
	IExecuteResponsePromiseData,
} from 'n8n-workflow';
import { Credentials } from '../help/type/enums';
import { WSClient } from '../help/utils/feishu-sdk/ws-client';
import { EventDispatcher } from '../help/utils/feishu-sdk/handler/event-handler';
import { createScopedLogger } from '../help/utils/feishu-sdk/logger';
import { triggerEventProperty } from '../help/utils/properties';

/**
 * 需要同步响应的事件类型集合
 * 飞书要求这些事件必须在 3 秒内返回响应数据，其他事件只需确认收到即可（fire-and-forget）
 */
const SYNC_RESPONSE_EVENTS = new Set([
	'card.action.trigger',
	'url.preview.get',
	'profile.view.get',
]);

export class FeishuNodeTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: '飞书 Trigger',
		name: 'feishuNodeTrigger',
		icon: 'file:icon.svg',
		group: ['trigger'],
		version: [1, 2, 3],
		defaultVersion: 3,
		subtitle: '=已订阅 {{$parameter["events"].length}} 个事件',
		description: '通过 WebSocket 监听飞书事件，当事件发生时启动工作流',
		defaults: {
			name: '飞书 Trigger',
		},
		usableAsTool: undefined,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: Credentials.FeishuCredentialsApi,
				required: true,
				displayOptions: {
					show: {
						authentication: [Credentials.FeishuCredentialsApi],
					},
				},
			},
		],
		properties: [
			{
				displayName: '认证方式',
				name: 'authentication',
				type: 'options',
				default: `${Credentials.FeishuCredentialsApi}`,
				options: [
					{
						name: 'Tenant Access Token',
						value: Credentials.FeishuCredentialsApi,
					},
				],
			},
			{
				displayName:
					'此 Trigger 使用 WebSocket 长连接方式接收事件。由于飞书 API 限制，每个飞书应用同时只能有一个 Trigger 在运行。',
				name: 'FeishuTriggerNotice',
				type: 'notice',
				default: '',
			},
			triggerEventProperty,
			{
				displayName: '响应模式',
				name: 'responseMode',
				type: 'options',
				options: [
					{
						name: 'Immediately',
						value: 'immediately',
						description: '事件触发后立即响应',
					},
					{
						name: "Using '飞书响应' Node",
						value: 'responseNode',
						description: '使用飞书响应节点同步返回响应',
					},
				],
				default: 'immediately',
				description: '选择何时向飞书发送响应',
			},
			{
				displayName: '选项',
				name: 'options',
				type: 'collection',
				placeholder: '添加选项',
				default: {},
				options: [
					{
						displayName: '回调提示信息',
						name: 'callbackToast',
						type: 'string',
						default: '',
						description:
							'设置回调触发时显示给用户的提示信息。如果不设置，则不显示任何提示。仅在 Immediately 模式下有效。',
						displayOptions: {
							show: {
								'/responseMode': ['immediately'],
							},
						},
					},
					{
						displayName: '响应超时时间',
						name: 'responseTimeout',
						type: 'number',
						default: 3000,
						description: '等待飞书响应节点响应的最大时间（毫秒），超时后将返回空响应',
						displayOptions: {
							show: {
								'/responseMode': ['responseNode'],
							},
						},
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const credentials = await this.getCredentials(Credentials.FeishuCredentialsApi);

		if (!(credentials.appid && credentials.appsecret && credentials.baseURL)) {
			throw new NodeOperationError(this.getNode(), '缺少必要的飞书凭证配置');
		}

		const responseMode = this.getNodeParameter('responseMode', 'immediately') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const callbackToast = (options.callbackToast as string) || undefined;
		// 使用与 UI 默认值一致的 3000ms
		const responseTimeout = (options.responseTimeout as number) || 3000;

		const appId = credentials['appid'] as string;
		const appSecret = credentials['appsecret'] as string;
		const baseUrl = credentials['baseURL'] as string;

		const workflowId = this.getWorkflow()?.id;
		const logger = createScopedLogger(this.logger, workflowId);

		const wsClient: WSClient = new WSClient({
			appId,
			appSecret,
			domain: `${baseUrl}`,
			logger,
			helpers: this.helpers,
		});

		const closeFunction = async () => {
			await wsClient.stop();
		};

		const startWsClient = async () => {
			const events = this.getNodeParameter('events', []) as string[];
			const isAnyEvent = events.includes('any_event');
			const handlers: Record<string, (data: IDataObject) => Promise<IDataObject>> = {};

		for (const event of events) {
			handlers[event] = async (data) => {
				// 对于 any_event，需要在运行时从数据中获取实际事件类型；否则用注册时的事件类型
				const actualEventType = isAnyEvent ? (data.event_type as string) : event;
				const isSyncEvent = SYNC_RESPONSE_EVENTS.has(actualEventType);

				const enrichedData = {
					...data,
					responseMode,
				};

				// 非同步事件：即发即忘，无需等待工作流完成也无需返回响应数据
				if (!isSyncEvent) {
					this.emit([this.helpers.returnJsonArray(enrichedData)]);
					return {};
				}

				// ── 以下仅处理需要同步响应的事件（card.action.trigger / url.preview.get / profile.view.get）──

				// immediately 模式：触发工作流后立即响应，不等待执行结果
				if (responseMode === 'immediately') {
					this.emit([this.helpers.returnJsonArray(enrichedData)]);
					if (callbackToast) {
						return {
							toast: {
								type: 'info',
								content: callbackToast,
							},
						};
					}
					return {};
				}

				// responseNode 模式：通过 responsePromise + sendResponse 机制同步获取响应。
				//
				// 关键点（解决多主 + 多 worker + 多 webhook 下无法响应的问题）：
				// - 这里把 responsePromise 作为 emit 的第 2 个参数传入，n8n 会将其注册到本次执行的响应通道。
				// - 「飞书响应」节点执行时调用 this.sendResponse(...)，触发 sendResponse 生命周期钩子。
				// - 在 queue mode 下，执行发生在 worker 进程，worker 会通过 Redis 把响应（respond-to-webhook 消息）
				//   路由回持有 WebSocket 连接的主实例（leader），由 ScalingService 解析此 responsePromise。
				// - 这与官方「Respond to Webhook」节点使用的是同一套跨进程机制，因此在分布式部署下可靠。
				//
				// 旧实现依赖 donePromise(IRun) 扫描节点输出中的标记，在 queue mode 下需要等待 worker 写库 +
				// Redis 通知 + 主实例读库，既慢（容易超过飞书 3 秒限制）又可能拿不到完整 runData，导致响应丢失。
				const responsePromise =
					this.helpers.createDeferredPromise<IExecuteResponsePromiseData>();
				this.emit([this.helpers.returnJsonArray(enrichedData)], responsePromise);

				let timeoutId: ReturnType<typeof setTimeout> | undefined;
				try {
					const response = await Promise.race([
						responsePromise.promise,
						new Promise<never>((_, reject) => {
							timeoutId = setTimeout(
								() => reject(new Error(`等待飞书响应节点超时 (${responseTimeout}ms)`)),
								responseTimeout,
							);
						}),
					]);

					clearTimeout(timeoutId);

					// response 即「飞书响应」节点通过 sendResponse 返回的数据（普通 JSON 对象）
					return (response as IDataObject) ?? {};
				} catch (error) {
					clearTimeout(timeoutId);
					const errorMessage = error instanceof Error ? error.message : String(error);
					logger.warn(
						`[飞书响应模式] 等待飞书响应节点超时或出错: ${errorMessage}。` +
							`请确认工作流中包含"飞书响应"节点，且能在 ${responseTimeout}ms 内执行到该节点。`,
					);
					return {};
				}
			};
		}

			const eventDispatcher = new EventDispatcher({ logger, isAnyEvent }).register(handlers);

			await wsClient.start({ eventDispatcher });
		};

		if (this.getMode() !== 'manual') {
			await startWsClient();
			return {
				closeFunction,
			};
		} else {
			const manualTriggerFunction = async () => {
				await startWsClient();
			};

			return {
				closeFunction,
				manualTriggerFunction,
			};
		}
	}
}
