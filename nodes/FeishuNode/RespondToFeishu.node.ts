/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	IDataObject,
	IExecuteResponsePromiseData,
	NodeOperationError,
} from 'n8n-workflow';
import { configuredOutputs } from '../help/utils/outputs';

/**
 * 飞书自定义响应数据的标记键名
 * 用于在 IRun 执行结果中识别飞书响应节点的输出
 */
export const FEISHU_RESPONSE_KEY = 'customFeishuResponse';

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
		description: '同步响应飞书 Trigger 的请求',
		defaults: {
			name: '飞书响应',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: `={{(${configuredOutputs})($nodeVersion, $parameter)}}`,
		properties: [
			{
				displayName: '响应内容',
				name: 'respondWith',
				type: 'options',
				options: [
					{
						name: '无响应',
						value: 'noResponse',
						description: '不返回任何响应',
					},
					{
						name: '自定义 JSON',
						value: 'json',
						description: '返回自定义 JSON 数据',
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
		const respondWith = this.getNodeParameter('respondWith', 0) as string;
		const enableResponseOutput = this.getNodeParameter('enableResponseOutput', 0, false) as boolean;

		const responseItems: INodeExecutionData[] = [];
		// 第一个 item 的响应数据，用于通过 sendResponse 同步返回给飞书（与官方 Respond to Webhook 行为一致：只取第一个响应）
		let firstResponseData: IDataObject | undefined;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const json = item.json as IDataObject;

			// 检查 responseMode（可选，不报错）
			const responseMode = json.responseMode as string;
			if (responseMode && responseMode !== 'responseNode') {
				this.logger.warn(
					`飞书 Trigger 的响应模式不是 "Using '飞书响应' Node"，当前模式: ${responseMode}`,
				);
			}

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

			// 构建带有特殊标记的响应输出项（保持数据结构不变，供下游/调试使用）
			responseItems.push({
				json: {
					[FEISHU_RESPONSE_KEY]: responseData,
				},
			});
		}

		// 通过 n8n 的 sendResponse 生命周期机制将响应同步返回给飞书 Trigger。
		// 该机制与官方「Respond to Webhook」节点一致：在 queue mode（多 worker）/ 多主部署下，
		// Worker 会通过 Redis 把响应路由回持有 WebSocket 连接的主实例，从而正确解析 Trigger 侧的 responsePromise。
		// 在单实例模式下，sendResponse 钩子会被同进程直接触发。
		this.sendResponse((firstResponseData ?? {}) as IExecuteResponsePromiseData);

		// 清理输入数据（移除内部字段）
		const cleanedItems = items.map((item) => {
			const cleanedJson = { ...item.json };
			delete cleanedJson.responseMode;
			return {
				...item,
				json: cleanedJson,
			};
		});

		// 根据是否启用响应输出分支返回不同的输出（保持原有数据结构不变）
		if (enableResponseOutput) {
			// 输出分支 1: Input Data（原始输入）
			// 输出分支 2: Response（响应数据，包含特殊标记）
			return [cleanedItems, responseItems];
		}

		// 单输出：返回包含特殊标记的响应数据
		return [responseItems];
	}
}
