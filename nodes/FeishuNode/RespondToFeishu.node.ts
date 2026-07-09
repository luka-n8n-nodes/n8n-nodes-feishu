/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	IDataObject,
	IN8nHttpFullResponse,
	NodeOperationError,
} from 'n8n-workflow';
import { configuredOutputs } from '../help/utils/outputs';

/** 同步响应模式 */
const MODE_WEBSOCKET = 'websocket';
const MODE_WEBHOOK = 'webhook';

export class RespondToFeishu implements INodeType {
	description: INodeTypeDescription = {
		displayName: '飞书响应',
		name: 'respondToFeishu',
		icon: 'file:icon.svg',
		group: ['output'],
		version: 1,
		usableAsTool: undefined,
		subtitle:
			'={{$parameter["respondWith"] === "noResponse" ? "不返回任何响应" : "返回自定义 JSON 数据"}}',
		description: '同步响应飞书 Trigger 或飞书 Webhook Trigger 的请求',
		defaults: {
			name: '飞书响应',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: `={{(${configuredOutputs})($nodeVersion, $parameter)}}`,
		properties: [
			{
				displayName: '同步响应模式',
				name: 'mode',
				type: 'options',
				options: [
					{
						name: '长链接同步响应',
						value: 'websocket',
						description:
							'通过长链接（WebSocket）同步返回响应，需配合「飞书 Trigger」（长链接触发器）使用',
					},
					{
						name: 'Webhook 同步响应',
						value: 'webhook',
						description:
							'通过 Webhook 的 HTTP 响应同步返回，需配合「飞书 Webhook Trigger」（Webhook 触发器）使用',
					},
				],
				default: 'websocket',
				description:
					'选择同步响应的方式：「长链接同步响应」需使用「飞书 Trigger」（长链接触发器）；「Webhook 同步响应」需使用「飞书 Webhook Trigger」（Webhook 触发器）。请确保此处选择与工作流中使用的触发器类型一致。',
			},
			{
				displayName: '响应内容',
				name: 'respondWith',
				type: 'options',
				options: [
					{
						name: 'No Data',
						value: 'noResponse',
						description: 'Respond with an empty body',
					},
					{
						name: 'JSON',
						value: 'json',
						description: 'Respond with a custom JSON body',
					},
				],
				default: 'noResponse',
				description: '选择响应类型',
			},
			{
				displayName: '自定义响应 JSON',
				name: 'responseJson',
				type: 'json',
				default: JSON.stringify(
					{
						toast: {
							type: 'success',
							content: '卡片交互成功',
							i18n: {
								zh_cn: '卡片交互成功',
								en_us: 'card action success',
							},
						},
					},
					null,
					2,
				),
				description: '自定义返回给飞书的 JSON 数据',
				displayOptions: {
					show: {
						respondWith: ['json'],
					},
				},
			},
			{
				displayName: '启用响应输出分支',
				name: 'enableResponseOutput',
				type: 'boolean',
				default: false,
				description:
					'Whether to provide an additional output branch with the response sent to Feishu',
				isNodeSetting: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const mode = this.getNodeParameter('mode', 0, MODE_WEBSOCKET) as string;
		const respondWith = this.getNodeParameter('respondWith', 0) as string;
		const enableResponseOutput = this.getNodeParameter('enableResponseOutput', 0, false) as boolean;

		const responseItems: INodeExecutionData[] = [];
		// 第一个 item 的响应数据，用于通过 sendResponse 同步返回给飞书（与官方 Respond to Webhook 行为一致：只取第一个响应）
		let firstResponseData: IDataObject | undefined;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			// 构建响应数据
			let responseData: IDataObject = {};

			if (respondWith === 'json') {
				const responseJson = this.getNodeParameter('responseJson', itemIndex) as string;
				try {
					responseData = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), '无效的 JSON 格式', { itemIndex });
				}
			}

			if (firstResponseData === undefined) {
				firstResponseData = responseData;
			}

			// 响应输出项直接等于返回给飞书的 JSON 内容（不再额外包裹标记字段）
			responseItems.push({
				json: responseData,
			});
		}

		const feishuResponseBody = (firstResponseData ?? {}) as IDataObject;

		// 通过 n8n 的 sendResponse 生命周期机制将响应同步返回给触发器。
		// 两种模式的底层机制不同，负载格式也不同：
		// - 长链接模式：飞书 Trigger 内部用 emit(data, responsePromise)，sendResponse 的「原始值」
		//   会被直接返回给飞书，因此发送「裸的飞书 JSON」。
		// - Webhook 模式：走 n8n 核心的 setupResponseNodePromise，期望 IN8nHttpFullResponse
		//   （{ body, headers, statusCode }），核心会把 body 以固定 200 状态码写回 HTTP 响应。
		//   在 queue mode / 多 main / 多 webhook 部署下，worker 的 sendResponse 会经 Redis 路由回
		//   持有 HTTP res 的 main 实例，由核心解析该 responsePromise——只要发送的格式正确即可可靠工作。
		if (mode === MODE_WEBHOOK) {
			const httpResponse: IN8nHttpFullResponse = {
				body: feishuResponseBody,
				headers: {},
				statusCode: 200,
			};
			this.sendResponse(httpResponse);
		} else {
			this.sendResponse(feishuResponseBody);
		}

		// 根据是否启用响应输出分支返回不同的输出（保持原有数据结构不变）
		if (enableResponseOutput) {
			// 输出分支 1: Input Data（原始输入）
			// 输出分支 2: Response（与返回给飞书的 JSON 内容一致）
			return [items, responseItems];
		}

		// 单输出：返回与飞书响应 JSON 内容一致的数据
		return [responseItems];
	}
}
