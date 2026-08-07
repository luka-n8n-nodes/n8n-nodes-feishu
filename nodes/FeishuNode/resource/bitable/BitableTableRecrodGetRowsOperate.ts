import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from 'n8n-workflow';
import { ResourceOperations } from '../../../help/type/IResource';
import BitableFieldUtils from '../../../help/utils/BitableFieldUtils';
import { searchAllRecords } from '../../../help/utils/BitableRecordBatchUtils';
import {
	BITABLE_GET_ROWS_OPERATION,
	bitableAutomaticFieldsOption,
	bitableFieldNamesOption,
	bitableOptionalMatchProperties,
	bitableSortOption,
	bitableTableBaseProperties,
	bitableTransformDataOption,
} from '../../../help/utils/bitableUpsertProperties';
import { paginationOptions, timeoutOption, userIdTypeOption } from '../../../help/utils/sharedOptions';

export default {
	name: '多维表格 - Get row(s)',
	value: BITABLE_GET_ROWS_OPERATION,
	description: '按条件查询多维表格中的记录，可限制返回数量。可选将结果转为更易读的字段格式。',
	order: 2,
	options: [
		...bitableTableBaseProperties,
		...bitableOptionalMatchProperties,
		paginationOptions.returnAll,
		paginationOptions.limit(500),
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				userIdTypeOption,
				bitableAutomaticFieldsOption,
				bitableFieldNamesOption,
				bitableSortOption,
				bitableTransformDataOption,
				timeoutOption,
			],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject[]> {
		const app_token = this.getNodeParameter('app_toke', index) as string;
		const table_id = this.getNodeParameter('table_id', index) as string;
		const combineConditions = this.getNodeParameter('combineConditions', index, 'or') as string;
		const match = this.getNodeParameter('match', index, {}) as {
			conditions?: Array<{ fieldName?: string; condition?: string; value?: string }>;
		};
		const options = this.getNodeParameter('options', index, {}) as {
			user_id_type?: string;
			automatic_fields?: boolean;
			field_names?: string[];
			sort?: {
				items?: Array<{ field_name?: string; desc?: boolean }>;
			};
			transformData?: boolean;
			timeout?: number;
		};
		const user_id_type = options.user_id_type ?? 'open_id';
		const automatic_fields = options.automatic_fields ?? false;
		const field_names = (options.field_names ?? [])
			.map((selection) => BitableFieldUtils.parseFilterFieldSelection(selection).fieldName)
			.filter((fieldName) => fieldName.length > 0);
		const sort = (options.sort?.items ?? [])
			.map((item) => ({
				field_name: BitableFieldUtils.parseFilterFieldSelection(item.field_name ?? '')
					.fieldName,
				desc: item.desc ?? false,
			}))
			.filter((item) => item.field_name.length > 0);
		const transformData = options.transformData ?? false;
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 50) as number;

		const conditions = match.conditions ?? [];
		const filter = await BitableFieldUtils.buildFilterFromConditions(
			this,
			app_token,
			table_id,
			combineConditions,
			conditions,
			options.timeout,
		);
		const records = await searchAllRecords(this, app_token, table_id, filter, {
			user_id_type,
			automatic_fields,
			field_names,
			sort,
			returnAll,
			limit,
			timeout: options.timeout,
		});

		if (!transformData) {
			return records;
		}

		const fieldMetaList = await BitableFieldUtils.listFields(
			this,
			app_token,
			table_id,
			undefined,
			options.timeout,
		);
		const fieldMetaMap = BitableFieldUtils.buildFieldMetaMap(fieldMetaList);

		return BitableFieldUtils.transformRecordsToSimple(records, fieldMetaMap);
	},
} as ResourceOperations;
