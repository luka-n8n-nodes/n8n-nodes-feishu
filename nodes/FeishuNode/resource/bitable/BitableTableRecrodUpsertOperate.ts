import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	IHttpRequestMethods,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import BitableFieldUtils from '../../../help/utils/BitableFieldUtils';
import { createBitableAutoMapExcludeFieldsProperty, parseBitableAutoMapExcludeFields } from '../../../help/utils/BitableAutoMapUtils';
import { getMatchConditions } from '../../../help/utils/BitableRecordBatchUtils';
import { timeoutOption, userIdTypeOption } from '../../../help/utils/sharedOptions';
import {
	BITABLE_UPSERT_OPERATION,
	bitableUpsertBatchingOption,
	bitableMatchProperties,
	bitableUpsertValuesProperty,
	bitableTableBaseProperties,
} from '../../../help/utils/bitableUpsertProperties';

export default {
	name: '多维表格 - Upsert row(s)',
	value: BITABLE_UPSERT_OPERATION,
	description: '按条件查找记录：找到则更新，找不到则新建。',
	order: 7,
	options: [
		...bitableTableBaseProperties,
		...bitableMatchProperties,
		bitableUpsertValuesProperty,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				userIdTypeOption,
				bitableUpsertBatchingOption,
				createBitableAutoMapExcludeFieldsProperty('upsertFieldValues'),
				timeoutOption,
			],
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
			user_id_type?: string;
			excludeFields?: string | string[];
			timeout?: number;
		};

		const user_id_type = options.user_id_type ?? 'open_id';
		// 兼容旧工作流中的 Must Match 参数名
		let matchSource = match;
		if (!matchSource.conditions?.length) {
			try {
				const legacyMustMatch = this.getNodeParameter('mustMatch', index) as {
					conditions?: Array<{ fieldName?: string; condition?: string; value?: string }>;
				};
				if (legacyMustMatch?.conditions?.length) {
					matchSource = legacyMustMatch;
				}
			} catch {
				// 新节点无 mustMatch 参数时忽略
			}
		}
		const conditions = getMatchConditions(this, index, matchSource);
		const fieldsToUpsert = BitableFieldUtils.getUpsertFieldValues(
			this,
			index,
			'upsertFieldValues',
			parseBitableAutoMapExcludeFields(options.excludeFields),
		);

		if (Object.keys(fieldsToUpsert).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Values to Upsert 至少需要配置一个字段', {
				itemIndex: index,
			});
		}

		const fieldMetaList = await BitableFieldUtils.listFields(
			this,
			app_token,
			table_id,
			undefined,
			options.timeout,
		);
		const fieldMetaMap = BitableFieldUtils.buildFieldMetaMap(fieldMetaList);
		const fields = BitableFieldUtils.buildFieldsPayload(fieldsToUpsert, fieldMetaMap, this, index);
		const attachmentMappings = BitableFieldUtils.collectAttachmentMappings(
			this,
			index,
			fieldsToUpsert,
			fieldMetaMap,
		);

		const filter = BitableFieldUtils.buildFilter(combineConditions, conditions, fieldMetaMap);
		const searchBody: IDataObject = {
			automatic_fields: false,
			filter,
		};

		const searchOptions: IHttpRequestOptions = {
			method: 'POST' as IHttpRequestMethods,
			url: `/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records/search`,
			qs: {
				user_id_type,
				page_size: 2,
			},
			body: searchBody,
		};

		if (options.timeout) {
			searchOptions.timeout = options.timeout;
		}

		const searchResponse = (await RequestUtils.request.call(this, searchOptions)) as {
			items?: IDataObject[];
			total?: number;
		};

		const matchedItems = searchResponse.items ?? [];
		const matchedCount = searchResponse.total ?? matchedItems.length;

		await BitableFieldUtils.applyAttachmentFieldMappings(
			this,
			app_token,
			fields,
			attachmentMappings,
			index,
			options.timeout,
		);

		if (Object.keys(fields).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Values to Upsert 至少需要配置一个有效字段值', {
				itemIndex: index,
			});
		}

		if (matchedItems.length > 0) {
			const record_id = matchedItems[0].record_id as string;
			const updateOptions: IHttpRequestOptions = {
				method: 'PUT',
				url: `/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records/${record_id}`,
				qs: {
					user_id_type,
					ignore_consistency_check: true,
				},
				body: { fields },
			};

			if (options.timeout) {
				updateOptions.timeout = options.timeout;
			}

			const updateResult = (await RequestUtils.request.call(this, updateOptions)) as IDataObject;

			return {
				...updateResult,
				_upsert_action: 'update',
				_upsert_matched_count: matchedCount,
			};
		}

		const addOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records`,
			qs: {
				user_id_type,
				ignore_consistency_check: true,
			},
			body: { fields },
		};

		if (options.timeout) {
			addOptions.timeout = options.timeout;
		}

		const addResult = (await RequestUtils.request.call(this, addOptions)) as IDataObject;

		return {
			...addResult,
			_upsert_action: 'insert',
			_upsert_matched_count: 0,
		};
	},
} as ResourceOperations;
