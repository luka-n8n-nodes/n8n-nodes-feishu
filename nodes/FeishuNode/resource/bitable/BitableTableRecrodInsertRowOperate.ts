import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import { ResourceOperations } from '../../../help/type/IResource';
import BitableFieldUtils from '../../../help/utils/BitableFieldUtils';
import {
	batchCreateRecords,
	buildRecordFieldsForItem,
} from '../../../help/utils/BitableRecordBatchUtils';
import { createBitableAutoMapExcludeFieldsProperty, parseBitableAutoMapExcludeFields } from '../../../help/utils/BitableAutoMapUtils';
import {
	BITABLE_INSERT_ROW_OPERATION,
	bitableInsertValuesProperty,
	bitableRecordOptionsProperties,
	bitableTableBaseProperties,
} from '../../../help/utils/bitableUpsertProperties';
import { timeoutOption } from '../../../help/utils/sharedOptions';

export default {
	name: '多维表格 - Insert row',
	value: BITABLE_INSERT_ROW_OPERATION,
	description: '向多维表格批量新增记录，支持字段映射和附件上传。',
	order: 5,
	options: [
		...bitableTableBaseProperties,
		bitableInsertValuesProperty,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				...bitableRecordOptionsProperties,
				createBitableAutoMapExcludeFieldsProperty('insertFieldValues'),
				timeoutOption,
			],
		},
	] as INodeProperties[],
	async executeAll(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		if (items.length === 0) {
			return [returnData];
		}

		const app_token = this.getNodeParameter('app_toke', 0) as string;
		const table_id = this.getNodeParameter('table_id', 0) as string;
		const options = this.getNodeParameter('options', 0, {}) as {
			user_id_type?: string;
			ignore_consistency_check?: boolean;
			excludeFields?: string | string[];
			timeout?: number;
		};

		const fieldMetaList = await BitableFieldUtils.listFields(
			this,
			app_token,
			table_id,
			undefined,
			options.timeout,
		);
		const fieldMetaMap = BitableFieldUtils.buildFieldMetaMap(fieldMetaList);
		const pendingItems: Array<{ itemIndex: number; fields: IDataObject }> = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const fields = await buildRecordFieldsForItem(
					this,
					itemIndex,
					app_token,
					fieldMetaMap,
					'insertFieldValues',
					{
						timeout: options.timeout,
						excludeFields: parseBitableAutoMapExcludeFields(options.excludeFields),
					},
				);
				pendingItems.push({ itemIndex, fields });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error;
			}
		}

		if (pendingItems.length === 0) {
			return [returnData];
		}

		const createdRecords = await batchCreateRecords(
			this,
			app_token,
			table_id,
			pendingItems.map((item) => ({ fields: item.fields })),
			options,
		);

		if (createdRecords.length !== pendingItems.length) {
			throw new NodeOperationError(this.getNode(), '批量插入返回的记录数量与请求不一致');
		}

		for (let index = 0; index < createdRecords.length; index++) {
			returnData.push({
				json: createdRecords[index],
				pairedItem: { item: pendingItems[index].itemIndex },
			});
		}

		return [returnData];
	},
} as ResourceOperations;
