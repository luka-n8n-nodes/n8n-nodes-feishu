import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import ResourceFactory from '../help/builder/ResourceFactory';
import { Credentials, OutputType } from '../help/type/enums';

const resourceBuilder = ResourceFactory.build(__dirname);

export class FeishuNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: '飞书',
		name: 'feishuNode',
		subtitle: '={{ $parameter.resource }}:{{ $parameter.operation }}',
		icon: 'file:icon.svg',
		group: ['transform'],
		version: [1],
		defaultVersion: 1,
		description: '飞书 API 集成，支持多种飞书功能',
		defaults: {
			name: '飞书',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: Credentials.FeishuCredentialsApi,
				displayName: '应用级别凭证',
				required: true,
				displayOptions: {
					show: {
						authentication: [Credentials.FeishuCredentialsApi],
					},
				},
			},
			{
				name: Credentials.FeishuOauth2Api,
				displayName: '用户级别凭证',
				required: true,
				displayOptions: {
					show: {
						authentication: [Credentials.FeishuOauth2Api],
					},
				},
			},
		],
		properties: [
			{
				displayName: '凭证类型',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: '用户级别凭证',
						value: Credentials.FeishuOauth2Api,
					},
					{
						name: '应用级别凭证',
						value: Credentials.FeishuCredentialsApi,
					},
				],
				default: Credentials.FeishuCredentialsApi,
			},
			...resourceBuilder.build(),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		// 使用数组初始化，支持多输出
		let returnData: INodeExecutionData[][] = Array.from({ length: 1 }, () => []);

		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		const callFunc = resourceBuilder.getCall(resource, operation);

		if (!callFunc) {
			throw new NodeOperationError(
				this.getNode(),
				'未实现方法: ' + resource + '.' + operation,
			);
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				this.logger.debug('call function', {
					resource,
					operation,
					itemIndex,
				});

				const responseData = await callFunc.call(this, itemIndex);

				// 检查是否有自定义输出类型
				if (responseData && typeof responseData === 'object' && 'outputType' in responseData) {
					const typedResponse = responseData as {
						outputType: OutputType;
						outputData?: INodeExecutionData[][];
					};
					const { outputType } = typedResponse;

					if (outputType === OutputType.Multiple && typedResponse.outputData) {
						// 多输出模式：直接使用返回的输出数据
						returnData = typedResponse.outputData;
					} else if (outputType === OutputType.None) {
						// 无输出模式
						return [];
					}
					// OutputType.Single 会走下面的默认处理
				} else {
					// 默认单输出模式
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(responseData as IDataObject),
						{ itemData: { item: itemIndex } },
					);
					returnData[0].push(...executionData);
				}
			} catch (error) {
				this.logger.error('call function error', {
					resource,
					operation,
					itemIndex,
					errorMessage: error.message,
					stack: error.stack,
				});

				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: itemIndex } },
					);
					returnData[0].push(...executionErrorData);
					continue;
				}
				throw error;
			}
		}

		return returnData;
	}
}
