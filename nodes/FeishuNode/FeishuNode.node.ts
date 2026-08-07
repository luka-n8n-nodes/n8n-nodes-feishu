import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
	NodeConnectionTypes,
	NodeOperationError,
	sleep,
} from 'n8n-workflow';
import ResourceFactory from '../help/builder/ResourceFactory';
import { Credentials, OutputType } from '../help/type/enums';
import { OperationResult, OperationCallFunction } from '../help/type/IResource';
import BitableFieldUtils from '../help/utils/BitableFieldUtils';
import { BITABLE_UPSERT_OPERATION } from '../help/utils/bitableUpsertProperties';
import { ICommonOptionsValue } from '../help/utils/sharedOptions';

const resourceBuilder = ResourceFactory.build(__dirname);

/**
 * 批次配置接口
 */
interface IBatchConfig {
	/** 是否启用并发模式（用户是否显式添加了 Batching 选项） */
	enabled: boolean;
	/** 每批请求数量 */
	batchSize: number;
	/** 批次间隔（毫秒） */
	batchInterval: number;
}

/**
 * 多输出响应类型
 */
interface IMultipleOutputResponse {
	outputType: OutputType;
	outputData?: INodeExecutionData[][];
}

/**
 * 请求结果类型（用于并发执行）
 */
interface IRequestResult {
	itemIndex: number;
	result?: OperationResult;
	error?: Error;
}

/**
 * 从 options 参数中获取批次配置
 */
function getBatchConfig(context: IExecuteFunctions, operation: string): IBatchConfig {
	try {
		const options = context.getNodeParameter('options', 0, {}) as ICommonOptionsValue;
		const batch = options?.batching?.batch;

		if (operation === BITABLE_UPSERT_OPERATION) {
			const batchSize = batch?.batchSize ?? 10;
			const batchInterval = batch?.batchInterval ?? 1000;

			return {
				enabled: true,
				batchSize: batchSize === 0 ? 1 : batchSize,
				batchInterval,
			};
		}

		// 检查用户是否显式添加了 Batching 选项
		const batchingEnabled = batch !== undefined;
		const batchSize = batch?.batchSize ?? 50;
		const batchInterval = batch?.batchInterval ?? 0;

		return {
			enabled: batchingEnabled,
			// batchSize 为 0 时视为 1
			batchSize: batchSize === 0 ? 1 : batchSize,
			batchInterval,
		};
	} catch {
		// 如果获取参数失败（例如操作不支持 options），返回默认配置（串行模式）
		return { enabled: false, batchSize: 50, batchInterval: 0 };
	}
}

/**
 * 获取错误信息
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * 获取错误堆栈
 */
function getErrorStack(error: unknown): string | undefined {
	if (error instanceof Error) {
		return error.stack;
	}
	return undefined;
}

/**
 * 检查响应是否为多输出类型
 */
function isMultipleOutputResponse(response: OperationResult): response is IMultipleOutputResponse {
	return (
		response !== null &&
		typeof response === 'object' &&
		'outputType' in response &&
		(response as IMultipleOutputResponse).outputType !== undefined
	);
}

/**
 * 处理单个响应数据
 * @returns 处理后的执行数据，如果是特殊输出类型则返回 null
 */
function processResponseData(
	context: IExecuteFunctions,
	responseData: OperationResult,
	itemIndex: number,
): { data: INodeExecutionData[] | null; multipleOutput?: INodeExecutionData[][] } {
	// 检查是否有自定义输出类型
	if (isMultipleOutputResponse(responseData)) {
		const { outputType, outputData } = responseData;

		if (outputType === OutputType.Multiple && outputData) {
			// 多输出模式：返回输出数据
			return { data: null, multipleOutput: outputData };
		}

		if (outputType === OutputType.None) {
			return { data: null };
		}

		if (outputType === OutputType.PassThrough) {
			const inputItem = context.getInputData()[itemIndex];
			return {
				data: [
					{
						json: inputItem.json,
						binary: inputItem.binary,
						pairedItem: { item: itemIndex },
					},
				],
			};
		}
	}

	// 默认单输出模式
	const executionData = context.helpers.constructExecutionMetaData(
		context.helpers.returnJsonArray(responseData as IDataObject),
		{ itemData: { item: itemIndex } },
	);

	return { data: executionData };
}

/**
 * 创建错误输出数据
 */
function createErrorData(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): INodeExecutionData[] {
	return context.helpers.constructExecutionMetaData(
		context.helpers.returnJsonArray({ error: getErrorMessage(error) }),
		{ itemData: { item: itemIndex } },
	);
}

/**
 * 串行执行模式（原有逻辑，向后兼容）
 */
async function executeSerial(
	context: IExecuteFunctions,
	items: INodeExecutionData[],
	callFunc: OperationCallFunction,
	resource: string,
	operation: string,
): Promise<INodeExecutionData[][]> {
	const returnData: INodeExecutionData[][] = [[]];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			context.logger.debug('call function (serial)', {
				resource,
				operation,
				itemIndex,
			});

			const responseData = await callFunc.call(context, itemIndex);
			const processed = processResponseData(context, responseData, itemIndex);

			if (processed.multipleOutput) {
				// 多输出模式：直接返回
				return processed.multipleOutput;
			}

			if (processed.data === null && !processed.multipleOutput) {
				continue;
			}

			if (processed.data) {
				returnData[0].push(...processed.data);
			}
		} catch (error) {
			context.logger.error('call function error (serial)', {
				resource,
				operation,
				itemIndex,
				errorMessage: getErrorMessage(error),
				stack: getErrorStack(error),
			});

			if (context.continueOnFail()) {
				returnData[0].push(...createErrorData(context, error, itemIndex));
				continue;
			}
			throw error;
		}
	}

	return returnData;
}

/**
 * 并发执行模式（类似 HttpRequest 节点）
 * 每批请求同时发送，批间有间隔
 */
async function executeParallel(
	context: IExecuteFunctions,
	items: INodeExecutionData[],
	callFunc: OperationCallFunction,
	batchConfig: IBatchConfig,
	resource: string,
	operation: string,
): Promise<INodeExecutionData[][]> {
	const { batchSize, batchInterval } = batchConfig;
	const requestPromises: Promise<IRequestResult>[] = [];
	const returnData: INodeExecutionData[][] = [[]];

	// 阶段1：创建所有请求 Promise（带批次延迟）
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		// 批次延迟：在每批开始前等待（第一批除外）
		if (itemIndex > 0 && batchSize > 0 && batchInterval > 0) {
			if (itemIndex % batchSize === 0) {
				await sleep(batchInterval);
			}
		}

		context.logger.debug('call function (parallel)', {
			resource,
			operation,
			itemIndex,
			batch: batchSize > 0 ? Math.floor(itemIndex / batchSize) : 0,
		});

		// 创建请求 Promise（立即开始执行，不等待）
		const requestPromise = callFunc
			.call(context, itemIndex)
			.then((result): IRequestResult => ({ itemIndex, result }))
			.catch((error): IRequestResult => ({ itemIndex, error: error as Error }));

		requestPromises.push(requestPromise);
	}

	// 阶段2：等待所有请求完成
	const promisesResponses = await Promise.allSettled(requestPromises);

	// 阶段3：按原始顺序处理结果
	for (let i = 0; i < promisesResponses.length; i++) {
		const response = promisesResponses[i];

		if (response.status === 'rejected') {
			// Promise 本身被 reject（不应该发生，因为我们在上面已经 catch 了）
			const error = response.reason as Error;
			context.logger.error('call function error (parallel - rejected)', {
				resource,
				operation,
				itemIndex: i,
				errorMessage: getErrorMessage(error),
			});

			if (context.continueOnFail()) {
				returnData[0].push(...createErrorData(context, error, i));
				continue;
			}
			throw error;
		}

		const { itemIndex, result, error } = response.value;

		if (error) {
			// 请求执行出错
			context.logger.error('call function error (parallel)', {
				resource,
				operation,
				itemIndex,
				errorMessage: error.message,
				stack: error.stack,
			});

			if (context.continueOnFail()) {
				returnData[0].push(...createErrorData(context, error, itemIndex));
				continue;
			}
			throw error;
		}

		if (result === undefined) {
			continue;
		}

		// 处理成功的响应
		const processed = processResponseData(context, result, itemIndex);

		if (processed.multipleOutput) {
			// 多输出模式：直接返回（注意：在并发模式下，多输出可能会有问题）
			return processed.multipleOutput;
		}

		if (processed.data === null && !processed.multipleOutput) {
			// 无输出模式：跳过
			continue;
		}

		if (processed.data) {
			returnData[0].push(...processed.data);
		}
	}

	return returnData;
}

export class FeishuNode implements INodeType {
	methods = {
		loadOptions: {
			async getBitableTableFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const app_token = this.getCurrentNodeParameter('app_toke') as string;
				const table_id = this.getCurrentNodeParameter('table_id') as string;

				if (!app_token || !table_id) {
					return [];
				}

				try {
					const fields = BitableFieldUtils.filterConditionFields(
						await BitableFieldUtils.listFields(this, app_token, table_id),
					);

					return fields.map((field) => {
						const uiType = BitableFieldUtils.getEffectiveUiType(field);

						return {
							name: `${field.field_name} (${BitableFieldUtils.getFieldTypeLabel(uiType)})`,
							value: BitableFieldUtils.encodeFilterFieldOptionValue(
								uiType,
								field.field_name,
							),
							description: uiType,
						};
					});
				} catch {
					return [];
				}
			},
			async getBitableFilterConditions(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				// &fieldName：fixedCollection 内读取同条件条目的 Column Name or ID
				const fieldSelection =
					(this.getCurrentNodeParameter('&fieldName') as string) ||
					(this.getCurrentNodeParameter('fieldName') as string);
				const app_token = this.getCurrentNodeParameter('app_toke') as string;
				const table_id = this.getCurrentNodeParameter('table_id') as string;

				const fieldUiType = await BitableFieldUtils.resolveFilterFieldUiType(
					this,
					fieldSelection,
					app_token,
					table_id,
				);

				return BitableFieldUtils.getFilterOperatorOptions(fieldUiType);
			},
			async getBitableDateValueTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const fieldSelection =
					(this.getCurrentNodeParameter('&fieldName') as string) ||
					(this.getCurrentNodeParameter('fieldName') as string);
				const condition =
					(this.getCurrentNodeParameter('&condition') as string) ||
					(this.getCurrentNodeParameter('condition') as string);
				const app_token = this.getCurrentNodeParameter('app_toke') as string;
				const table_id = this.getCurrentNodeParameter('table_id') as string;

				const fieldUiType = await BitableFieldUtils.resolveFilterFieldUiType(
					this,
					fieldSelection,
					app_token,
					table_id,
				);

				return BitableFieldUtils.getDateValueTypeOptions(fieldUiType, condition);
			},
			async getBitableFilterValueOptions(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const fieldSelection =
					(this.getCurrentNodeParameter('&fieldName') as string) ||
					(this.getCurrentNodeParameter('fieldName') as string);
				const condition =
					(this.getCurrentNodeParameter('&condition') as string) ||
					(this.getCurrentNodeParameter('condition') as string);
				const app_token = this.getCurrentNodeParameter('app_toke') as string;
				const table_id = this.getCurrentNodeParameter('table_id') as string;

				if (!fieldSelection) {
					return [];
				}

				const field = await BitableFieldUtils.resolveFilterFieldMeta(
					this,
					fieldSelection,
					app_token,
					table_id,
				);
				if (!field) {
					return [];
				}

				const fieldUiType = BitableFieldUtils.getEffectiveUiType(field);
				const presetOptions = BitableFieldUtils.getFilterValueOptions(field);

				if (presetOptions.length > 0) {
					return presetOptions.map((option) => ({
						...option,
						description: BitableFieldUtils.getFilterValueHint(fieldUiType, condition),
					}));
				}

				return [];
			},
		},
		resourceMapping: {
			async getBitableUpsertFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const app_token = this.getCurrentNodeParameter('app_toke') as string;
				const table_id = this.getCurrentNodeParameter('table_id') as string;

				return BitableFieldUtils.getUpsertResourceMapperFields(this, app_token, table_id);
			},
		},
	};

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
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				responseData: '',
				path: '={{ $nodeId }}',
				restartWebhook: true,
				isFullPath: true,
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

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const executeAllFunc = resourceBuilder.getExecuteAll(resource, operation);
		if (executeAllFunc) {
			try {
				return await executeAllFunc.call(this);
			} catch (error) {
				if (this.continueOnFail()) {
					return [
						this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray({
								error: getErrorMessage(error),
							}),
							{ itemData: { item: 0 } },
						),
					];
				}
				throw error;
			}
		}

		const callFunc = resourceBuilder.getCall(resource, operation);

		if (!callFunc) {
			throw new NodeOperationError(this.getNode(), `未实现方法: ${resource}.${operation}`);
		}

		// 获取批次配置
		const batchConfig = getBatchConfig(this, operation);

		// 根据操作与 Batching 选项选择执行策略：
		// - Upsert：默认并发批处理，约 10 次/秒
		// - 其他操作：显式添加 Batching 后启用并发；否则串行
		if (batchConfig.enabled) {
			// 并发模式：类似 HttpRequest 节点
			return executeParallel(this, items, callFunc, batchConfig, resource, operation);
		}

		// 串行模式：原有逻辑（向后兼容）
		return executeSerial(this, items, callFunc, resource, operation);
	}
}
