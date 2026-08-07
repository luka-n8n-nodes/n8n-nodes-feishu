import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from 'n8n-workflow';
import { ResourceOperations } from '../../../help/type/IResource';
import BitableFieldUtils from '../../../help/utils/BitableFieldUtils';
import {
	batchDeleteRecords,
	getMatchConditions,
	searchAllRecords,
} from '../../../help/utils/BitableRecordBatchUtils';
import {
	BITABLE_DELETE_ROWS_OPERATION,
	bitableMatchProperties,
	bitableTableBaseProperties,
} from '../../../help/utils/bitableUpsertProperties';
import { timeoutOption } from '../../../help/utils/sharedOptions';

export default {
	name: '多维表格 - Delete row(s)',
	value: BITABLE_DELETE_ROWS_OPERATION,
	description: '按条件查找并批量删除多维表格中的记录。',
	order: 1,
	options: [
		...bitableTableBaseProperties,
		...bitableMatchProperties,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [timeoutOption],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const app_token = this.getNodeParameter('app_toke', index) as string;
		const table_id = this.getNodeParameter('table_id', index) as string;
		const combineConditions = this.getNodeParameter('combineConditions', index, 'or') as string;
		const match = this.getNodeParameter('match', index, {}) as {
			conditions?: Array<{ fieldName?: string; condition?: string; value?: string }>;
		};
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const conditions = getMatchConditions(this, index, match);
		const filter = await BitableFieldUtils.buildFilterFromConditions(
			this,
			app_token,
			table_id,
			combineConditions,
			conditions,
			options.timeout,
		);
		const matchedRecords = await searchAllRecords(this, app_token, table_id, filter, {
			returnAll: true,
			timeout: options.timeout,
		});

		const recordIds = matchedRecords
			.map((record) => record.record_id)
			.filter((recordId): recordId is string => typeof recordId === 'string' && recordId.length > 0);

		if (recordIds.length === 0) {
			return {
				deleted_count: 0,
				records: [],
			};
		}

		const deletedRecords = await batchDeleteRecords(
			this,
			app_token,
			table_id,
			recordIds,
			options,
		);

		return {
			deleted_count: deletedRecords.length,
			records: deletedRecords,
		};
	},
} as ResourceOperations;
