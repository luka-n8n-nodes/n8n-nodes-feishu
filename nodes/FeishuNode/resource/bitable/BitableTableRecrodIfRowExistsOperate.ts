import { IExecuteFunctions, INodeProperties, NodeOperationError } from 'n8n-workflow';
import { ResourceOperations } from '../../../help/type/IResource';
import { OutputType } from '../../../help/type/enums';
import BitableFieldUtils from '../../../help/utils/BitableFieldUtils';
import { hasMatchingRecords } from '../../../help/utils/BitableRecordBatchUtils';
import {
	BITABLE_IF_ROW_EXISTS_OPERATION,
	bitableTableBaseProperties,
	bitableUpsertMustMatchProperties,
} from '../../../help/utils/bitableUpsertProperties';
import { timeoutOption, userIdTypeOption } from '../../../help/utils/sharedOptions';

export default {
	name: '多维表格 - If row exists',
	value: BITABLE_IF_ROW_EXISTS_OPERATION,
	description: '检查是否存在符合条件的记录。存在则继续执行，不存在则跳过。',
	order: 3,
	options: [
		...bitableTableBaseProperties,
		...bitableUpsertMustMatchProperties,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [userIdTypeOption, timeoutOption],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number) {
		const app_token = this.getNodeParameter('app_toke', index) as string;
		const table_id = this.getNodeParameter('table_id', index) as string;
		const combineConditions = this.getNodeParameter('combineConditions', index, 'or') as string;
		const mustMatch = this.getNodeParameter('mustMatch', index, {}) as {
			conditions?: Array<{ fieldName?: string; condition?: string; value?: string }>;
		};
		const options = this.getNodeParameter('options', index, {}) as {
			user_id_type?: string;
			timeout?: number;
		};
		const user_id_type = options.user_id_type ?? 'open_id';

		const conditions = mustMatch.conditions ?? [];
		if (conditions.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Must Match 至少需要添加一个匹配条件', {
				itemIndex: index,
			});
		}

		const filter = await BitableFieldUtils.buildFilterFromConditions(
			this,
			app_token,
			table_id,
			combineConditions,
			conditions,
			options.timeout,
		);
		const exists = await hasMatchingRecords(this, app_token, table_id, filter, {
			user_id_type,
			timeout: options.timeout,
		});

		if (exists) {
			return { outputType: OutputType.PassThrough };
		}

		return { outputType: OutputType.None };
	},
} as ResourceOperations;
