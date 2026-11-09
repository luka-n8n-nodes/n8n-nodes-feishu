import { IDataObject, IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

/**
 * 上传文件数据结构
 */
interface IUploadFileData {
	value: Buffer;
	options: {
		filename?: string;
		filelength?: number;
		contentType?: string;
	};
}

/**
 * 节点工具类
 */
class NodeUtils {
	/**
	 * 从数据对象中获取固定集合
	 * @param data 数据对象
	 * @param collectionName 集合名称
	 * @returns 集合数组
	 */
	static getNodeFixedCollection(data: IDataObject, collectionName: string): IDataObject[] {
		const collection = data[collectionName];
		if (Array.isArray(collection)) {
			return collection as IDataObject[];
		}
		return [];
	}

	/**
	 * 从固定集合中提取指定属性的值列表
	 * @param data 数据对象
	 * @param collectionName 集合名称
	 * @param propertyName 属性名称
	 * @returns 属性值数组
	 */
	static getNodeFixedCollectionList<T = unknown>(
		data: IDataObject,
		collectionName: string,
		propertyName: string,
	): T[] {
		const list = this.getNodeFixedCollection(data, collectionName);
		const result: T[] = [];

		for (const item of list) {
			if (item && typeof item === 'object' && propertyName in item) {
				result.push(item[propertyName] as T);
			}
		}

		return result;
	}

	/**
	 * 构建上传文件数据
	 * @param inputDataFieldName 输入数据字段名
	 * @param index 项目索引
	 * @returns 上传文件数据对象
	 */
	static async buildUploadFileData(
		this: IExecuteFunctions,
		inputDataFieldName: string,
		index = 0,
	): Promise<IUploadFileData> {
		const binaryData = this.helpers.assertBinaryData(index, inputDataFieldName);

		if (!binaryData) {
			throw new NodeOperationError(this.getNode(), '未找到二进制数据', { itemIndex: index });
		}

		const buffer = await this.helpers.getBinaryDataBuffer(index, inputDataFieldName);

		// 解析文件大小：fileSize 可能是字符串或数字
		let fileLength: number | undefined;
		if (binaryData.fileSize !== undefined) {
			fileLength =
				typeof binaryData.fileSize === 'string'
					? parseInt(binaryData.fileSize, 10)
					: binaryData.fileSize;
		}

		return {
			value: buffer,
			options: {
				filename: binaryData.fileName,
				filelength: fileLength,
				contentType: binaryData.mimeType,
			},
		};
	}

	/**
	 * 获取节点参数并解析为 JSON
	 * @param context 执行上下文
	 * @param propertyName 参数名称
	 * @param index 项目索引
	 * @param failValue 解析失败时的默认值
	 * @returns 解析后的 JSON 对象
	 */
	static getNodeJsonData<T = unknown>(
		context: IExecuteFunctions,
		propertyName: string,
		index: number,
		failValue?: T,
	): T {
		const text = context.getNodeParameter(propertyName, index, failValue);

		if (text === undefined || text === null || text === '') {
			return failValue as T;
		}

		// 如果已经是对象，直接返回
		if (typeof text === 'object') {
			return text as T;
		}

		// 尝试解析 JSON 字符串
		if (typeof text === 'string') {
			try {
				return JSON.parse(text) as T;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new NodeOperationError(
					context.getNode(),
					`无法解析字段 [${propertyName}] 的 JSON 数据: ${errorMessage}`,
					{ itemIndex: index },
				);
			}
		}

		// 其他类型直接返回
		return text as T;
	}

	/**
	 * 解析字符串列表，支持数组、JSON 数组字符串、逗号分隔字符串
	 * @param input 原始输入
	 * @param fieldName 字段名称，用于错误提示
	 * @returns 去空后的字符串数组
	 */
	static parseStringList(input: unknown, fieldName = '列表'): string[] {
		if (input === undefined || input === null || input === '') {
			return [];
		}

		if (Array.isArray(input)) {
			return input.map((id) => String(id).trim()).filter((id) => id);
		}

		const text = String(input).trim();
		if (!text) {
			return [];
		}

		if (text.startsWith('[')) {
			try {
				const parsed = JSON.parse(text);
				if (!Array.isArray(parsed)) {
					throw new Error('JSON 格式错误，期望数组');
				}
				return parsed.map((id: unknown) => String(id).trim()).filter((id: string) => id);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`${fieldName} JSON 格式解析失败: ${errorMessage}`);
			}
		}

		return text
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id);
	}
}

export default NodeUtils;
