import { INodePropertyOptions, INodeProperties, NodePropertyTypes } from 'n8n-workflow';
import {
	IResource,
	ResourceOperations,
	OperationCallFunction,
	OperationExecuteAllFunction,
	ResourceOptionWithoutOperations,
	OperationOptionWithoutDetails,
} from '../type/IResource';

/**
 * 资源构建器
 * 用于构建 n8n 节点的 resource/operation 结构
 */
class ResourceBuilder {
	/** 已注册的资源列表 */
	private resources: IResource[] = [];

	/**
	 * 添加资源
	 * @param resource 资源选项
	 */
	addResource(resource: INodePropertyOptions): void {
		this.resources.push({
			...resource,
			operations: [],
		});
	}

	/**
	 * 添加操作到指定资源
	 * @param resourceName 资源名称（value）
	 * @param operate 操作定义
	 */
	addOperate(resourceName: string, operate: ResourceOperations): void {
		const resource = this.resources.find((r) => r.value === resourceName);
		if (resource) {
			resource.operations.push(operate);
		}
	}

	/**
	 * 构建节点属性列表
	 * @returns 节点属性数组
	 */
	build(): INodeProperties[] {
		const properties: INodeProperties[] = [];

		// 添加 Resource 选择器
		properties.push(this.buildResourceProperty());

		// 为每个资源添加 Operation 选择器和参数
		for (const resource of this.resources) {
			if (resource.operations.length === 0) continue;

			properties.push(this.buildOperationProperty(resource));
			properties.push(...this.buildOperationOptions(resource));
		}

		return properties;
	}

	/**
	 * 构建 Resource 属性
	 */
	private buildResourceProperty(): INodeProperties {
		const resourceOptions: ResourceOptionWithoutOperations[] = this.resources.map((item) => ({
			...item,
			description: item.description || '',
			action: item.action || '',
			operations: null,
		}));

		return {
			displayName: 'Resource',
			name: 'resource',
			type: 'options' as NodePropertyTypes,
			noDataExpression: true,
			options: resourceOptions as INodePropertyOptions[],
			default: '',
		};
	}

	/**
	 * 构建 Operation 属性
	 */
	private buildOperationProperty(resource: IResource): INodeProperties {
		const operationOptions: OperationOptionWithoutDetails[] = resource.operations.map((item) => ({
			...item,
			description: item.description || '',
			action: item.action || item.name || '',
			options: null,
			call: undefined,
			executeAll: undefined,
			order: undefined,
		}));

		return {
			displayName: 'Operation',
			name: 'operation',
			type: 'options' as NodePropertyTypes,
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: [resource.value],
				},
			},
			options: operationOptions as INodePropertyOptions[],
			default: '',
		};
	}

	/**
	 * 构建操作的参数选项
	 */
	private buildOperationOptions(resource: IResource): INodeProperties[] {
		const options: INodeProperties[] = [];

		for (const operation of resource.operations) {
			for (const option of operation.options) {
				// 合并 displayOptions，添加 resource 和 operation 条件
				const mergedDisplayOptions = {
					...option.displayOptions,
					show: {
						...option.displayOptions?.show,
						resource: [resource.value],
						operation: [operation.value],
					},
				};

				options.push({
					...option,
					displayOptions: mergedDisplayOptions,
				});
			}
		}

		return options;
	}

	/**
	 * 获取操作的执行函数
	 * @param resourceName 资源名称
	 * @param operateName 操作名称
	 * @returns 操作执行函数或 undefined
	 */
	getCall(resourceName: string, operateName: string): OperationCallFunction | undefined {
		return this.getOperation(resourceName, operateName)?.call;
	}

	getExecuteAll(
		resourceName: string,
		operateName: string,
	): OperationExecuteAllFunction | undefined {
		return this.getOperation(resourceName, operateName)?.executeAll;
	}

	getOperation(resourceName: string, operateName: string): ResourceOperations | undefined {
		const resource = this.resources.find((item) => item.value === resourceName);
		if (!resource) {
			return undefined;
		}

		return resource.operations.find((item) => item.value === operateName);
	}
}

export default ResourceBuilder;
