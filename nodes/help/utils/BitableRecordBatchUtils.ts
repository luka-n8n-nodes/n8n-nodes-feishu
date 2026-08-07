import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';
import RequestUtils from './RequestUtils';
import BitableFieldUtils, { IBitableFieldMeta } from './BitableFieldUtils';

export const BITABLE_RECORD_BATCH_SIZE = 500;

export interface IBitableSortItem {
	field_name: string;
	desc?: boolean;
}

export interface IBitableRecordRequestOptions {
	user_id_type?: string;
	timeout?: number;
	ignore_consistency_check?: boolean;
	automatic_fields?: boolean;
	field_names?: string[];
	sort?: IBitableSortItem[];
}

export function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

export function getMatchConditions(
	context: IExecuteFunctions,
	itemIndex: number,
	match: { conditions?: Array<{ fieldName?: string; condition?: string; value?: string }> },
	parameterLabel = 'Match',
): Array<{ fieldName?: string; condition?: string; value?: string }> {
	const conditions = match.conditions ?? [];

	if (conditions.length === 0) {
		throw new NodeOperationError(context.getNode(), `${parameterLabel} 至少需要添加一个匹配条件`, {
			itemIndex,
		});
	}

	return conditions;
}

export async function searchAllRecords(
	context: IExecuteFunctions,
	appToken: string,
	tableId: string,
	filter: IDataObject,
	options: IBitableRecordRequestOptions & { returnAll?: boolean; limit?: number },
): Promise<IDataObject[]> {
	const user_id_type = options.user_id_type ?? 'open_id';
	const returnAll = options.returnAll ?? false;
	const limit = options.limit ?? 50;
	const automatic_fields = options.automatic_fields ?? false;
	const field_names = options.field_names ?? [];
	const sort = options.sort ?? [];

	const fetchPage = async (pageToken: string | undefined, pageSize: number) => {
		const qs: IDataObject = {
			user_id_type,
			page_size: pageSize,
		};

		if (pageToken) {
			qs.page_token = pageToken;
		}

		const body: IDataObject = {
			automatic_fields,
			filter,
		};

		if (field_names.length > 0) {
			body.field_names = field_names;
		}

		if (sort.length > 0) {
			body.sort = sort;
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'POST' as IHttpRequestMethods,
			url: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
			qs,
			body,
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		const response = (await RequestUtils.request.call(context, requestOptions)) as {
			items?: IDataObject[];
			page_token?: string;
			has_more?: boolean;
		};

		return {
			items: response.items ?? [],
			pageToken: response.page_token,
			hasMore: response.has_more ?? false,
		};
	};

	if (returnAll) {
		let allResults: IDataObject[] = [];
		let pageToken: string | undefined;

		while (true) {
			const { items, pageToken: nextPageToken, hasMore } = await fetchPage(
				pageToken,
				BITABLE_RECORD_BATCH_SIZE,
			);
			allResults = allResults.concat(items);

			if (!hasMore || !nextPageToken) {
				break;
			}

			pageToken = nextPageToken;
		}

		return allResults;
	}

	const { items } = await fetchPage(undefined, limit);
	return items;
}

export async function hasMatchingRecords(
	context: IExecuteFunctions,
	appToken: string,
	tableId: string,
	filter: IDataObject,
	options: Pick<IBitableRecordRequestOptions, 'user_id_type' | 'timeout'>,
): Promise<boolean> {
	const user_id_type = options.user_id_type ?? 'open_id';

	const requestOptions: IHttpRequestOptions = {
		method: 'POST' as IHttpRequestMethods,
		url: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
		qs: {
			user_id_type,
			page_size: 1,
		},
		body: {
			automatic_fields: false,
			filter,
		},
	};

	if (options.timeout) {
		requestOptions.timeout = options.timeout;
	}

	const response = (await RequestUtils.request.call(context, requestOptions)) as {
		items?: IDataObject[];
		total?: number;
	};

	const matchedCount = response.total ?? response.items?.length ?? 0;
	return matchedCount > 0;
}

export async function batchCreateRecords(
	context: IExecuteFunctions,
	appToken: string,
	tableId: string,
	records: IDataObject[],
	options: IBitableRecordRequestOptions,
): Promise<IDataObject[]> {
	const user_id_type = options.user_id_type ?? 'open_id';
	const ignore_consistency_check = options.ignore_consistency_check ?? true;
	const createdRecords: IDataObject[] = [];

	for (const chunk of chunkArray(records, BITABLE_RECORD_BATCH_SIZE)) {
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
			qs: {
				user_id_type,
				ignore_consistency_check,
			},
			body: {
				records: chunk,
			},
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		const response = (await RequestUtils.request.call(context, requestOptions)) as {
			records?: IDataObject[];
		};

		createdRecords.push(...(response.records ?? []));
	}

	return createdRecords;
}

export async function batchUpdateRecords(
	context: IExecuteFunctions,
	appToken: string,
	tableId: string,
	records: IDataObject[],
	options: IBitableRecordRequestOptions,
): Promise<IDataObject[]> {
	const user_id_type = options.user_id_type ?? 'open_id';
	const ignore_consistency_check = options.ignore_consistency_check ?? true;
	const updatedRecords: IDataObject[] = [];

	for (const chunk of chunkArray(records, BITABLE_RECORD_BATCH_SIZE)) {
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
			qs: {
				user_id_type,
				ignore_consistency_check,
			},
			body: {
				records: chunk,
			},
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		const response = (await RequestUtils.request.call(context, requestOptions)) as {
			records?: IDataObject[];
		};

		updatedRecords.push(...(response.records ?? []));
	}

	return updatedRecords;
}

export async function batchDeleteRecords(
	context: IExecuteFunctions,
	appToken: string,
	tableId: string,
	recordIds: string[],
	options: Pick<IBitableRecordRequestOptions, 'timeout'>,
): Promise<IDataObject[]> {
	const deletedRecords: IDataObject[] = [];

	for (const chunk of chunkArray(recordIds, BITABLE_RECORD_BATCH_SIZE)) {
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`,
			body: {
				records: chunk,
			},
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		const response = (await RequestUtils.request.call(context, requestOptions)) as {
			records?: IDataObject[];
		};

		deletedRecords.push(...(response.records ?? []));
	}

	return deletedRecords;
}

export interface IBuildRecordFieldsOptions {
	timeout?: number;
	excludeFields?: string[];
}

export async function buildRecordFieldsForItem(
	context: IExecuteFunctions,
	itemIndex: number,
	appToken: string,
	fieldMetaMap: Map<string, IBitableFieldMeta>,
	fieldsParameterName: string,
	buildOptions: IBuildRecordFieldsOptions = {},
): Promise<IDataObject> {
	const { timeout, excludeFields = [] } = buildOptions;
	const fieldsToWrite = BitableFieldUtils.getUpsertFieldValues(
		context,
		itemIndex,
		fieldsParameterName,
		excludeFields,
	);

	if (Object.keys(fieldsToWrite).length === 0) {
		throw new NodeOperationError(context.getNode(), '至少需要配置一个字段', {
			itemIndex,
		});
	}

	const fields = BitableFieldUtils.buildFieldsPayload(
		fieldsToWrite,
		fieldMetaMap,
		context,
		itemIndex,
	);
	const attachmentMappings = BitableFieldUtils.collectAttachmentMappings(
		context,
		itemIndex,
		fieldsToWrite,
		fieldMetaMap,
	);

	await BitableFieldUtils.applyAttachmentFieldMappings(
		context,
		appToken,
		fields,
		attachmentMappings,
		itemIndex,
		timeout,
	);

	if (Object.keys(fields).length === 0) {
		throw new NodeOperationError(context.getNode(), '至少需要配置一个有效字段值', {
			itemIndex,
		});
	}

	return fields;
}
