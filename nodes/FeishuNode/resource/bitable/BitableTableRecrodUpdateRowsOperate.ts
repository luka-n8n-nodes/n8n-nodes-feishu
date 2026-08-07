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
	batchUpdateRecords,
	buildRecordFieldsForItem,
} from '../../../help/utils/BitableRecordBatchUtils';
import { createBitableAutoMapExcludeFieldsProperty, parseBitableAutoMapExcludeFields } from '../../../help/utils/BitableAutoMapUtils';
import {
	BITABLE_UPDATE_ROWS_OPERATION,
	bitableRecordIdProperty,
	bitableRecordOptionsProperties,
	bitableTableBaseProperties,
	bitableUpdateValuesProperty,
} from '../../../help/utils/bitableUpsertProperties';
import { timeoutOption } from '../../../help/utils/sharedOptions';

export default {
	name: '多维表格 - Update row(s)',
	value: BITABLE_UPDATE_ROWS_OPERATION,
	description: '根据记录 ID 批量更新多维表格中的记录，支持字段映射和附件上传。',
	order: 6,
	options: [
		...bitableTableBaseProperties,
		bitableRecordIdProperty,
		bitableUpdateValuesProperty,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				...bitableRecordOptionsProperties,
				createBitableAutoMapExcludeFieldsProperty('updateFieldValues'),
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
		const recordsToUpdate: IDataObject[] = [];
		const itemIndexes: number[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const record_id = this.getNodeParameter('record_id', itemIndex) as string;

				if (!record_id) {
					throw new NodeOperationError(this.getNode(), 'Record ID 不能为空', {
						itemIndex,
					});
				}

				const fields = await buildRecordFieldsForItem(
					this,
					itemIndex,
					app_token,
					fieldMetaMap,
					'updateFieldValues',
					{
						timeout: options.timeout,
						excludeFields: parseBitableAutoMapExcludeFields(options.excludeFields),
					},
				);

				recordsToUpdate.push({
					record_id,
					fields,
				});
				itemIndexes.push(itemIndex);
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

		if (recordsToUpdate.length === 0) {
			return [returnData];
		}

		const updatedRecords = await batchUpdateRecords(
			this,
			app_token,
			table_id,
			recordsToUpdate,
			options,
		);

		for (let index = 0; index < updatedRecords.length; index++) {
			returnData.push({
				json: updatedRecords[index],
				pairedItem: { item: itemIndexes[index] },
			});
		}

		return [returnData];
	},
} as ResourceOperations;
