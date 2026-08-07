import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeOperationError,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';
import RequestUtils from './RequestUtils';
import BitableMediaUploadUtils from './BitableMediaUploadUtils';
import NodeUtils from './NodeUtils';

type FeishuRequestContext = IExecuteFunctions | ILoadOptionsFunctions;

export interface IBitableFieldMeta {
	field_id?: string;
	field_name: string;
	ui_type: string;
	type?: number;
	property?: IDataObject;
}

const READ_ONLY_FIELD_TYPES = new Set([
	'CreatedTime',
	'ModifiedTime',
	'CreatedUser',
	'ModifiedUser',
	'AutoNumber',
	'Formula',
	'Lookup',
]);

const FIELD_TYPE_LABELS: Record<string, string> = {
	Text: 'text',
	Barcode: 'text',
	Number: 'number',
	Progress: 'number',
	Currency: 'number',
	Rating: 'number',
	SingleSelect: 'select',
	MultiSelect: 'multiSelect',
	DateTime: 'dateTime',
	Checkbox: 'boolean',
	User: 'user',
	GroupChat: 'groupChat',
	Phone: 'text',
	Url: 'url',
	Attachment: 'attachment',
	SingleLink: 'link',
	DuplexLink: 'link',
	Location: 'location',
	CreatedTime: 'dateTime',
	ModifiedTime: 'dateTime',
	CreatedUser: 'user',
	ModifiedUser: 'user',
	AutoNumber: 'number',
	Formula: 'formula',
	Lookup: 'lookup',
};

const EMPTY_VALUE_OPERATORS = new Set(['isEmpty', 'isNotEmpty']);

const SINGLE_MATCH_OPERATORS = new Set(['is', 'isNot']);

const DATE_FIELD_TYPES = new Set(['DateTime', 'CreatedTime', 'ModifiedTime']);

const DATE_FILTER_OPERATORS = new Set(['is', 'isEmpty', 'isNotEmpty', 'isGreater', 'isLess']);

const DATE_VALUE_TYPE_DEFS: Array<{ name: string; value: string }> = [
	{ name: 'Exact Date', value: 'ExactDate' },
	{ name: 'Today', value: 'Today' },
	{ name: 'Tomorrow', value: 'Tomorrow' },
	{ name: 'Yesterday', value: 'Yesterday' },
	{ name: 'Current Week', value: 'CurrentWeek' },
	{ name: 'Last Week', value: 'LastWeek' },
	{ name: 'Current Month', value: 'CurrentMonth' },
	{ name: 'Last Month', value: 'LastMonth' },
	{ name: 'Last 7 Days', value: 'TheLastWeek' },
	{ name: 'Next 7 Days', value: 'TheNextWeek' },
	{ name: 'Last 30 Days', value: 'TheLastMonth' },
	{ name: 'Next 30 Days', value: 'TheNextMonth' },
];

const DATE_RELATIVE_VALUES = new Set(
	DATE_VALUE_TYPE_DEFS.filter(({ value }) => value !== 'ExactDate').map(({ value }) => value),
);

/** 飞书筛选运算符定义，与 open.feishu.cn 文档一致 */
const BITABLE_FILTER_OPERATOR_DEFS: Array<{
	name: string;
	value: string;
	supported: boolean;
	supportsDateField: boolean;
}> = [
	{ name: '等于', value: 'is', supported: true, supportsDateField: true },
	{ name: '不等于', value: 'isNot', supported: true, supportsDateField: false },
	{ name: '包含', value: 'contains', supported: true, supportsDateField: false },
	{ name: '不包含', value: 'doesNotContain', supported: true, supportsDateField: false },
	{ name: '为空', value: 'isEmpty', supported: true, supportsDateField: true },
	{ name: '不为空', value: 'isNotEmpty', supported: true, supportsDateField: true },
	{ name: '大于', value: 'isGreater', supported: true, supportsDateField: true },
	{ name: '大于等于', value: 'isGreaterEqual', supported: true, supportsDateField: false },
	{ name: '小于', value: 'isLess', supported: true, supportsDateField: true },
	{ name: '小于等于', value: 'isLessEqual', supported: true, supportsDateField: false },
];

/** 文本类字段（与飞书 UI 一致） */
const TEXT_FILTER_OPERATORS = new Set([
	'is',
	'isNot',
	'contains',
	'doesNotContain',
	'isEmpty',
	'isNotEmpty',
]);

/** 数字类字段 */
const NUMBER_FILTER_OPERATORS = new Set([
	'is',
	'isNot',
	'isGreater',
	'isGreaterEqual',
	'isLess',
	'isLessEqual',
	'isEmpty',
	'isNotEmpty',
]);

/** 单选/多选/人员/关联等可多值匹配字段 */
const MULTI_VALUE_FILTER_OPERATORS = new Set([
	'is',
	'isNot',
	'contains',
	'doesNotContain',
	'isEmpty',
	'isNotEmpty',
]);

const TEXT_FIELD_TYPES = new Set(['Text', 'Barcode', 'Phone', 'Url', 'Email', 'Location']);

const NUMBER_FIELD_TYPES = new Set([
	'Number',
	'Currency',
	'Progress',
	'Rating',
	'AutoNumber',
]);

const MULTI_VALUE_FIELD_TYPES = new Set([
	'SingleSelect',
	'MultiSelect',
	'User',
	'CreatedUser',
	'ModifiedUser',
	'GroupChat',
	'SingleLink',
	'DuplexLink',
]);

const ATTACHMENT_FILTER_OPERATORS = new Set(['isEmpty', 'isNotEmpty']);

const CHECKBOX_FILTER_OPERATORS = new Set(['is']);

const FILTER_FIELD_UI_TYPE_SEPARATOR = '::';

export interface IBitableFilterCondition {
	fieldName?: string;
	condition?: string;
	value?: string;
	valuePreset?: string;
	dateValueType?: string;
}

const FIELD_TYPE_NUMBER_MAP: Record<number, string> = {
	1: 'Text',
	2: 'Number',
	3: 'SingleSelect',
	4: 'MultiSelect',
	5: 'DateTime',
	7: 'Checkbox',
	11: 'User',
	13: 'Phone',
	15: 'Url',
	17: 'Attachment',
	18: 'SingleLink',
	19: 'Lookup',
	20: 'Formula',
	21: 'DuplexLink',
	22: 'Location',
	23: 'GroupChat',
	1001: 'CreatedTime',
	1002: 'ModifiedTime',
	1003: 'CreatedUser',
	1004: 'ModifiedUser',
	1005: 'AutoNumber',
};

class BitableFieldUtils {
	static encodeFilterFieldOptionValue(uiType: string, fieldName: string): string {
		return `${uiType}${FILTER_FIELD_UI_TYPE_SEPARATOR}${fieldName}`;
	}

	static parseFilterFieldSelection(value: string): { fieldName: string; uiType?: string } {
		if (!value) {
			return { fieldName: value };
		}

		const separatorIndex = value.indexOf(FILTER_FIELD_UI_TYPE_SEPARATOR);
		if (separatorIndex <= 0) {
			return { fieldName: value };
		}

		const uiType = value.slice(0, separatorIndex);
		const fieldName = value.slice(separatorIndex + FILTER_FIELD_UI_TYPE_SEPARATOR.length);
		if (!fieldName) {
			return { fieldName: value };
		}

		return { uiType, fieldName };
	}

	static async resolveFilterFieldUiType(
		context: FeishuRequestContext,
		fieldSelection: string,
		appToken?: string,
		tableId?: string,
	): Promise<string | undefined> {
		const { fieldName, uiType } = this.parseFilterFieldSelection(fieldSelection);
		if (uiType) {
			return uiType;
		}

		if (!fieldName || !appToken || !tableId) {
			return undefined;
		}

		try {
			const fields = await this.listFields(context, appToken, tableId);
			const field = fields.find((item) => item.field_name === fieldName);
			return field ? this.getEffectiveUiType(field) : undefined;
		} catch {
			return undefined;
		}
	}

	static async resolveFilterFieldMeta(
		context: FeishuRequestContext,
		fieldSelection: string,
		appToken?: string,
		tableId?: string,
	): Promise<IBitableFieldMeta | undefined> {
		const { fieldName, uiType } = this.parseFilterFieldSelection(fieldSelection);
		if (!fieldName) {
			return undefined;
		}

		if (appToken && tableId) {
			try {
				const fields = await this.listFields(context, appToken, tableId);
				const field = fields.find((item) => item.field_name === fieldName);
				if (field) {
					return field;
				}
			} catch {
				// fall through to embedded ui type
			}
		}

		if (uiType) {
			return {
				field_name: fieldName,
				ui_type: uiType,
			};
		}

		return undefined;
	}

	static getFilterConditionDescription(fieldUiType?: string): string {
		if (!fieldUiType) {
			return '根据 Column Name or ID 的字段类型动态加载可用运算符。';
		}

		if (fieldUiType === 'Attachment') {
			return '附件字段仅支持：为空、不为空。';
		}

		if (fieldUiType === 'Checkbox') {
			return '复选框字段仅支持：等于。';
		}

		if (this.isDateFieldType(fieldUiType)) {
			return '日期字段仅支持：等于、为空、不为空、大于、小于。';
		}

		if (TEXT_FIELD_TYPES.has(fieldUiType)) {
			return '文本字段支持：等于、不等于、包含、不包含、为空、不为空。';
		}

		if (NUMBER_FIELD_TYPES.has(fieldUiType)) {
			return '数字字段支持：等于、不等于、大于、大于等于、小于、小于等于、为空、不为空。';
		}

		return '当前字段类型支持常规比较运算符（不含 LIKE、IN）。';
	}

	static isDateFieldType(uiType: string): boolean {
		return DATE_FIELD_TYPES.has(uiType);
	}

	private static toFilterOperatorOptions(allowed: Set<string>): INodePropertyOptions[] {
		return BITABLE_FILTER_OPERATOR_DEFS.filter(
			(operator) => operator.supported && allowed.has(operator.value),
		).map(({ name, value }) => ({ name, value }));
	}

	static getFilterOperatorOptions(fieldUiType?: string): INodePropertyOptions[] {
		if (fieldUiType === 'Attachment') {
			return this.toFilterOperatorOptions(ATTACHMENT_FILTER_OPERATORS);
		}

		if (fieldUiType === 'Checkbox') {
			return this.toFilterOperatorOptions(CHECKBOX_FILTER_OPERATORS);
		}

		if (fieldUiType && this.isDateFieldType(fieldUiType)) {
			return this.toFilterOperatorOptions(DATE_FILTER_OPERATORS);
		}

		if (fieldUiType && TEXT_FIELD_TYPES.has(fieldUiType)) {
			return this.toFilterOperatorOptions(TEXT_FILTER_OPERATORS);
		}

		if (fieldUiType && NUMBER_FIELD_TYPES.has(fieldUiType)) {
			return this.toFilterOperatorOptions(NUMBER_FILTER_OPERATORS);
		}

		if (fieldUiType && MULTI_VALUE_FIELD_TYPES.has(fieldUiType)) {
			return this.toFilterOperatorOptions(MULTI_VALUE_FILTER_OPERATORS);
		}

		// 未知类型：展示全部已支持运算符，并标注不支持日期的项
		return BITABLE_FILTER_OPERATOR_DEFS.filter((operator) => operator.supported).map(
			({ name, value, supportsDateField }) => ({
				name,
				value,
				...(supportsDateField ? {} : { description: '不支持日期字段' }),
			}),
		);
	}

	static getDateValueTypeOptions(
		fieldUiType?: string,
		operator?: string,
	): INodePropertyOptions[] {
		const exactDateOnly = [{ name: 'Exact Date', value: 'ExactDate' }];

		if (!fieldUiType || !this.isDateFieldType(fieldUiType)) {
			return exactDateOnly;
		}

		if (!operator || EMPTY_VALUE_OPERATORS.has(operator)) {
			return exactDateOnly;
		}

		if (operator === 'isGreater' || operator === 'isLess') {
			return exactDateOnly;
		}

		if (operator === 'is') {
			return DATE_VALUE_TYPE_DEFS.map(({ name, value }) => ({ name, value }));
		}

		return exactDateOnly;
	}

	static filterConditionFields(fields: IBitableFieldMeta[]): IBitableFieldMeta[] {
		return fields.filter((field) => {
			const uiType = this.getEffectiveUiType(field);
			return uiType !== 'Formula' && uiType !== 'Lookup';
		});
	}

	static getFieldTypeLabel(uiType: string): string {
		return FIELD_TYPE_LABELS[uiType] ?? uiType.toLowerCase();
	}

	static async listFields(
		context: FeishuRequestContext,
		appToken: string,
		tableId: string,
		viewId?: string,
		timeout?: number,
	): Promise<IBitableFieldMeta[]> {
		const allFields: IBitableFieldMeta[] = [];
		let pageToken: string | undefined;

		do {
			const qs: IDataObject = {
				page_size: 100,
			};

			if (viewId) {
				qs.view_id = viewId;
			}

			if (pageToken) {
				qs.page_token = pageToken;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
				qs,
			};

			if (timeout) {
				requestOptions.timeout = timeout;
			}

			const response = (await RequestUtils.request.call(
				context as IExecuteFunctions,
				requestOptions,
			)) as {
				items?: IDataObject[];
				page_token?: string;
				has_more?: boolean;
			};

			for (const item of response.items ?? []) {
				if (typeof item.field_name === 'string') {
					allFields.push({
						field_id:
							typeof item.field_id === 'string' && item.field_id.length > 0
								? item.field_id
								: undefined,
						field_name: item.field_name,
						ui_type: (item.ui_type as string) ?? 'Text',
						type: item.type as number | undefined,
						property: item.property as IDataObject | undefined,
					});
				}
			}

			pageToken = response.has_more ? response.page_token : undefined;
		} while (pageToken);

		return allFields;
	}

	static filterMustMatchFields(fields: IBitableFieldMeta[]): IBitableFieldMeta[] {
		return fields.filter((field) => {
			const uiType = this.getEffectiveUiType(field);
			return uiType !== 'Attachment' && !READ_ONLY_FIELD_TYPES.has(uiType);
		});
	}

	static buildFieldMetaMap(fields: IBitableFieldMeta[]): Map<string, IBitableFieldMeta> {
		return new Map(fields.map((field) => [field.field_name, field]));
	}

	static toResourceMapperField(field: IBitableFieldMeta): ResourceMapperField {
		const uiType = this.getEffectiveUiType(field);
		const readOnly = READ_ONLY_FIELD_TYPES.has(uiType);

		// Do not set `type` or `options` — n8n only runs resourceMapper
		// validation when field.type is present (see node-helpers.ts).
		return {
			id: field.field_name,
			displayName: `${field.field_name} (${this.getFieldTypeLabel(uiType)})`,
			required: false,
			defaultMatch: false,
			display: true,
			readOnly,
			removed: false,
		};
	}

	static toUpsertResourceMapperField(field: IBitableFieldMeta): ResourceMapperField {
		const mapperField = this.toResourceMapperField(field);
		const uiType = this.getEffectiveUiType(field);

		if (uiType !== 'Attachment') {
			return mapperField;
		}

		return {
			...mapperField,
			displayName: `${field.field_name} (attachment · 默认 data，多 Binary 字段用逗号分隔)`,
			defaultValue: 'data',
		};
	}

	static async getUpsertResourceMapperFields(
		context: FeishuRequestContext,
		appToken: string,
		tableId: string,
	): Promise<ResourceMapperFields> {
		if (!appToken || !tableId) {
			return {
				fields: [],
				emptyFieldsNotice: '请先填写多维表格 App 和数据表 ID',
			};
		}

		try {
			const fields = await this.listFields(context, appToken, tableId);

			return {
				fields: fields.map((field) => this.toUpsertResourceMapperField(field)),
			};
		} catch {
			return {
				fields: [],
				emptyFieldsNotice: '无法加载字段列表，请检查 App、数据表 ID 和凭证权限',
			};
		}
	}

	static getUpsertFieldValues(
		context: IExecuteFunctions,
		index: number,
		parameterName = 'upsertFieldValues',
		excludeFields: string[] = [],
	): IDataObject {
		const mappingMode = context.getNodeParameter(`${parameterName}.mappingMode`, index) as string;

		const rawValues =
			mappingMode === 'autoMapInputData'
				? ({ ...context.getInputData()[index].json } as IDataObject)
				: (context.getNodeParameter(`${parameterName}.value`, index, {}) as IDataObject);

		const excludeFieldSet = new Set(excludeFields);
		const fields: IDataObject = {};

		for (const [fieldName, value] of Object.entries(rawValues)) {
			if (mappingMode === 'autoMapInputData' && excludeFieldSet.has(fieldName)) {
				continue;
			}

			if (value !== null && value !== undefined && value !== '') {
				fields[fieldName] = value;
			}
		}

		return fields;
	}

	static buildFilter(
		combineConditions: string,
		conditions: IBitableFilterCondition[],
		fieldMetaMap?: Map<string, IBitableFieldMeta>,
	): IDataObject {
		const validConditions = conditions
			.filter((condition) => condition.fieldName && condition.condition)
			.map((condition) => {
				const operator = condition.condition as string;
				const { fieldName: actualFieldName, uiType: embeddedUiType } =
					this.parseFilterFieldSelection(condition.fieldName as string);
				let fieldMeta = fieldMetaMap?.get(actualFieldName);
				if (!fieldMeta && embeddedUiType) {
					fieldMeta = {
						field_name: actualFieldName,
						ui_type: embeddedUiType,
					};
				}
				const filterCondition: IDataObject = {
					field_name: actualFieldName,
					operator,
					value: this.buildFilterValue(
						condition.value,
						operator,
						fieldMeta,
						condition.dateValueType,
						condition.valuePreset,
					),
				};

				return filterCondition;
			});

		return {
			conjunction: combineConditions === 'and' ? 'and' : 'or',
			conditions: validConditions,
		};
	}

	static async buildFilterFromConditions(
		context: FeishuRequestContext,
		appToken: string,
		tableId: string,
		combineConditions: string,
		conditions: IBitableFilterCondition[],
		timeout?: number,
	): Promise<IDataObject> {
		const fields = await this.listFields(context, appToken, tableId, undefined, timeout);
		const fieldMetaMap = this.buildFieldMetaMap(fields);
		return this.buildFilter(combineConditions, conditions, fieldMetaMap);
	}

	static buildFilterValue(
		rawValue: unknown,
		operator: string,
		fieldMeta?: IBitableFieldMeta,
		dateValueType?: string,
		valuePreset?: string,
	): string[] {
		if (EMPTY_VALUE_OPERATORS.has(operator)) {
			return [];
		}

		const uiType = this.getEffectiveUiType(fieldMeta);
		const effectiveValue =
			valuePreset !== undefined && valuePreset !== '' ? valuePreset : rawValue;

		switch (uiType) {
			case 'Attachment':
				return [];

			case 'Checkbox':
				return [this.normalizeCheckboxFilterValue(effectiveValue)];

			case 'DateTime':
			case 'CreatedTime':
			case 'ModifiedTime':
				return this.buildDateFilterValue(effectiveValue, dateValueType);

			case 'Number':
			case 'Currency':
			case 'Progress':
			case 'Rating':
			case 'AutoNumber':
				return this.buildNumericStringFilterValue(effectiveValue);

			case 'Text':
			case 'Barcode':
			case 'Phone':
			case 'Url':
			case 'Location':
				return this.buildAtMostOneFilterValue(effectiveValue);

			case 'SingleSelect':
			case 'MultiSelect':
			case 'User':
			case 'CreatedUser':
			case 'ModifiedUser':
			case 'GroupChat':
			case 'SingleLink':
			case 'DuplexLink':
				return this.buildMultiCapableFilterValue(effectiveValue, operator);

			default:
				return this.buildAtMostOneFilterValue(effectiveValue);
		}
	}

	static getFilterValueHint(fieldUiType?: string, operator?: string): string {
		if (operator && EMPTY_VALUE_OPERATORS.has(operator)) {
			return '无需填写，API 将传 "value":[]';
		}

		switch (fieldUiType) {
			case 'Text':
				return '填写文本内容，列表最多 1 个元素，例如：文本内容';
			case 'Barcode':
				return '填写条码内容，列表最多 1 个元素';
			case 'Number':
			case 'Currency':
			case 'Progress':
			case 'Rating':
				return '填写数字的字符串形式，例如：23.4';
			case 'AutoNumber':
				return '填写自动编号值，例如：1';
			case 'SingleSelect':
			case 'MultiSelect':
				if (operator && SINGLE_MATCH_OPERATORS.has(operator)) {
					return '填写 1 个选项名称；可从 Preset Value 选择';
				}
				return '填写选项名称；多个值用英文逗号或 JSON 数组分隔；可从 Preset Value 选择';
			case 'DateTime':
			case 'CreatedTime':
			case 'ModifiedTime':
				return '使用 Date Value Type；Exact Date 时填毫秒时间戳或日期字符串';
			case 'Checkbox':
				return '填写 true 或 false，可从 Preset Value 选择';
			case 'User':
			case 'CreatedUser':
			case 'ModifiedUser':
				if (operator && SINGLE_MATCH_OPERATORS.has(operator)) {
					return '填写 1 个用户 ID（与 Options 中 User ID Type 一致，默认 open_id）';
				}
				return '填写用户 ID，多个用英文逗号或 JSON 数组分隔';
			case 'Phone':
				return '填写电话号码，列表最多 1 个元素';
			case 'Url':
				return '填写超链接显示名称（非 URL），列表最多 1 个元素';
			case 'Attachment':
				return '附件字段仅支持 Is Empty / Is Not Empty，value 为 []';
			case 'SingleLink':
			case 'DuplexLink':
				if (operator && SINGLE_MATCH_OPERATORS.has(operator)) {
					return '填写 1 个关联记录 ID，例如：recnVYsuqV';
				}
				return '填写关联记录 ID，多个用英文逗号或 JSON 数组分隔';
			case 'Location':
				return '填写地址文本，列表最多 1 个元素';
			case 'GroupChat':
				if (operator && SINGLE_MATCH_OPERATORS.has(operator)) {
					return '填写 1 个群组 ID';
				}
				return '填写群组 ID，多个用英文逗号或 JSON 数组分隔';
			default:
				return '根据字段类型填写目标值，详见飞书筛选文档';
		}
	}

	static getFilterValueOptions(fieldMeta?: IBitableFieldMeta): INodePropertyOptions[] {
		if (!fieldMeta) {
			return [];
		}

		const uiType = this.getEffectiveUiType(fieldMeta);

		if (uiType === 'Checkbox') {
			return [
				{ name: 'True', value: 'true' },
				{ name: 'False', value: 'false' },
			];
		}

		if (uiType === 'SingleSelect' || uiType === 'MultiSelect') {
			const property = fieldMeta.property;
			const optionsRaw = property?.options;
			if (!Array.isArray(optionsRaw)) {
				return [];
			}

			const options: INodePropertyOptions[] = [];

			for (const item of optionsRaw) {
				if (typeof item !== 'object' || item === null) {
					continue;
				}

				const option = item as IDataObject;
				const name = option.name;
				if (typeof name !== 'string' || !name.trim()) {
					continue;
				}

				options.push({
					name: name.trim(),
					value: name.trim(),
				});
			}

			return options;
		}

		return [];
	}

	private static splitFilterInputValue(rawValue: unknown): string[] {
		if (rawValue === null || rawValue === undefined) {
			return [];
		}

		if (Array.isArray(rawValue)) {
			return rawValue.map((item) => String(item).trim()).filter(Boolean);
		}

		const stringValue = String(rawValue).trim();
		if (!stringValue) {
			return [];
		}

		if (stringValue.startsWith('[')) {
			try {
				const parsed: unknown = JSON.parse(stringValue);
				if (Array.isArray(parsed)) {
					return parsed.map((item) => String(item).trim()).filter(Boolean);
				}
			} catch {
				// fall through
			}
		}

		return stringValue
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	private static buildAtMostOneFilterValue(rawValue: unknown): string[] {
		const values = this.splitFilterInputValue(rawValue);
		if (values.length === 0) {
			return [];
		}

		return [values[0]];
	}

	private static buildNumericStringFilterValue(rawValue: unknown): string[] {
		const values = this.splitFilterInputValue(rawValue);
		if (values.length === 0) {
			return [];
		}

		return [values[0]];
	}

	private static buildMultiCapableFilterValue(rawValue: unknown, operator: string): string[] {
		const values = this.splitFilterInputValue(rawValue);
		if (values.length === 0) {
			return [];
		}

		if (SINGLE_MATCH_OPERATORS.has(operator)) {
			return [values[0]];
		}

		return values;
	}

	private static normalizeCheckboxFilterValue(rawValue: unknown): string {
		const stringValue = String(rawValue ?? '')
			.trim()
			.toLowerCase();

		if (['false', '0', 'no'].includes(stringValue)) {
			return 'false';
		}

		return 'true';
	}

	private static buildDateFilterValue(rawValue: unknown, dateValueType?: string): string[] {
		const normalizedType = dateValueType?.trim();
		if (normalizedType && normalizedType !== 'ExactDate' && DATE_RELATIVE_VALUES.has(normalizedType)) {
			return [normalizedType];
		}

		const stringValue = String(rawValue ?? '').trim();
		if (!stringValue) {
			return ['ExactDate', '0'];
		}

		if (DATE_RELATIVE_VALUES.has(stringValue)) {
			return [stringValue];
		}

		if (stringValue.startsWith('ExactDate:')) {
			const exactValue = stringValue.slice('ExactDate:'.length).trim();
			if (!exactValue) {
				return ['ExactDate', '0'];
			}

			return this.buildExactDateFilterValue(exactValue);
		}

		return this.buildExactDateFilterValue(stringValue);
	}

	private static buildExactDateFilterValue(rawValue: string): string[] {
		if (/^\d+$/.test(rawValue)) {
			return ['ExactDate', rawValue];
		}

		if (/^\d{4}\/\d{2}\/\d{2}$/.test(rawValue)) {
			const timestamp = Date.parse(rawValue.replace(/\//g, '-'));
			if (!Number.isNaN(timestamp)) {
				return ['ExactDate', String(timestamp)];
			}

			return ['ExactDate', rawValue];
		}

		const parsedTimestamp = Date.parse(rawValue);
		if (!Number.isNaN(parsedTimestamp)) {
			return ['ExactDate', String(parsedTimestamp)];
		}

		return ['ExactDate', rawValue];
	}

	static getEffectiveUiType(fieldMeta: IBitableFieldMeta | undefined): string {
		if (!fieldMeta) {
			return 'Text';
		}
		if (fieldMeta.ui_type) {
			return fieldMeta.ui_type;
		}
		if (fieldMeta.type !== undefined && FIELD_TYPE_NUMBER_MAP[fieldMeta.type]) {
			return FIELD_TYPE_NUMBER_MAP[fieldMeta.type];
		}
		return 'Text';
	}

	static convertFieldValue(
		value: unknown,
		fieldMeta: IBitableFieldMeta | undefined,
	): unknown {
		if (value === undefined || value === null || value === '') {
			return undefined;
		}

		const uiType = this.getEffectiveUiType(fieldMeta);

		switch (uiType) {
			case 'Text':
			case 'Barcode':
			case 'Phone':
				return this.toTextValue(value);

			case 'Number':
			case 'Progress':
			case 'Currency':
			case 'Rating':
			case 'AutoNumber':
				return this.toNumberValue(value);

			case 'Checkbox':
				return this.toCheckboxValue(value);

			case 'DateTime':
			case 'CreatedTime':
			case 'ModifiedTime':
				return this.toDateTimeValue(value);

			case 'SingleSelect':
				return this.toTextValue(value);

			case 'MultiSelect':
				return this.toMultiSelectValue(value);

			case 'User':
			case 'CreatedUser':
			case 'ModifiedUser':
				return this.toUserValue(value);

			case 'GroupChat':
				return this.toGroupChatValue(value);

			case 'Url':
				return this.toUrlValue(value);

			case 'SingleLink':
			case 'DuplexLink':
				return this.toLinkValue(value);

			case 'Location':
				return this.toTextValue(value);

			case 'Attachment':
				return this.toAttachmentValue(value);

			default:
				return this.toTextValue(value);
		}
	}

	private static toTextValue(value: unknown): string {
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}

	private static toNumberValue(value: unknown): number | undefined {
		if (typeof value === 'number') {
			return Number.isNaN(value) ? undefined : value;
		}
		const num = Number(value);
		return Number.isNaN(num) ? undefined : num;
	}

	private static toCheckboxValue(value: unknown): boolean {
		if (typeof value === 'boolean') {
			return value;
		}
		if (typeof value === 'number') {
			return value === 1;
		}
		const normalized = String(value).trim().toLowerCase();
		return normalized === 'true' || normalized === '1' || normalized === 'yes';
	}

	private static toDateTimeValue(value: unknown): number | undefined {
		if (typeof value === 'number') {
			return Number.isNaN(value) ? undefined : value;
		}
		if (typeof value === 'string') {
			const timestamp = Date.parse(value);
			if (!Number.isNaN(timestamp)) {
				return timestamp;
			}
		}
		return this.toNumberValue(value);
	}

	private static toMultiSelectValue(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.map((item) => this.toTextValue(item));
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(trimmed) as unknown;
					if (Array.isArray(parsed)) {
						return parsed.map((item) => this.toTextValue(item));
					}
				} catch {
					// fall through
				}
			}
			return trimmed
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		}
		return [this.toTextValue(value)];
	}

	private static toUserValue(value: unknown): Array<{ id: string }> {
		if (Array.isArray(value)) {
			return value.map((item) => this.toUserEntry(item));
		}
		if (typeof value === 'object' && value !== null) {
			return [this.toUserEntry(value)];
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(trimmed) as unknown;
					if (Array.isArray(parsed)) {
						return parsed.map((item) => this.toUserEntry(item));
					}
				} catch {
					// fall through
				}
			}
			if (trimmed.startsWith('{')) {
				try {
					return [this.toUserEntry(JSON.parse(trimmed) as unknown)];
				} catch {
					// fall through
				}
			}
			return [{ id: trimmed }];
		}
		return [{ id: this.toTextValue(value) }];
	}

	private static toUserEntry(value: unknown): { id: string } {
		if (typeof value === 'object' && value !== null && 'id' in value) {
			return { id: this.toTextValue((value as IDataObject).id) };
		}
		return { id: this.toTextValue(value) };
	}

	private static toGroupChatValue(value: unknown): Array<{ id: string }> {
		return this.toUserValue(value);
	}

	private static toUrlValue(value: unknown): { link: string; text: string } {
		if (typeof value === 'object' && value !== null) {
			const urlValue = value as IDataObject;
			const link = urlValue.link ?? urlValue.url ?? urlValue.href;
			const text = urlValue.text ?? urlValue.name ?? link;
			if (link !== undefined) {
				return {
					link: this.toTextValue(link),
					text: this.toTextValue(text ?? link),
				};
			}
		}
		const text = this.toTextValue(value);
		return {
			link: text,
			text,
		};
	}

	private static toLinkValue(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.map((item) => this.toTextValue(item));
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(trimmed) as unknown;
					if (Array.isArray(parsed)) {
						return parsed.map((item) => this.toTextValue(item));
					}
				} catch {
					// fall through
				}
			}
			return trimmed
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		}
		return [this.toTextValue(value)];
	}

	private static toAttachmentValue(value: unknown): Array<{ file_token: string }> {
		if (Array.isArray(value)) {
			return value.map((item) => this.toAttachmentEntry(item));
		}
		if (typeof value === 'object' && value !== null) {
			return [this.toAttachmentEntry(value)];
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(trimmed) as unknown;
					if (Array.isArray(parsed)) {
						return parsed.map((item) => this.toAttachmentEntry(item));
					}
				} catch {
					// fall through
				}
			}
			return [{ file_token: trimmed }];
		}
		return [{ file_token: this.toTextValue(value) }];
	}

	private static toAttachmentEntry(value: unknown): { file_token: string } {
		if (typeof value === 'object' && value !== null && 'file_token' in value) {
			return { file_token: this.toTextValue((value as IDataObject).file_token) };
		}
		return { file_token: this.toTextValue(value) };
	}

	static buildFieldsPayload(
		fieldsToUpsert: IDataObject,
		fieldMetaMap: Map<string, IBitableFieldMeta>,
		context?: IExecuteFunctions,
		itemIndex?: number,
	): IDataObject {
		const fields: IDataObject = {};

		for (const [fieldName, rawValue] of Object.entries(fieldsToUpsert)) {
			const fieldMeta = fieldMetaMap.get(fieldName);

			if (fieldMeta && READ_ONLY_FIELD_TYPES.has(this.getEffectiveUiType(fieldMeta))) {
				continue;
			}

			if (
				fieldMeta &&
				this.getEffectiveUiType(fieldMeta) === 'Attachment' &&
				context !== undefined &&
				itemIndex !== undefined &&
				this.isBinaryFieldReference(context, itemIndex, rawValue)
			) {
				continue;
			}

			const convertedValue = this.convertFieldValue(rawValue, fieldMeta);

			if (convertedValue !== undefined) {
				fields[fieldName] = convertedValue;
			}
		}

		return fields;
	}

	static collectAttachmentMappings(
		context: IExecuteFunctions,
		itemIndex: number,
		fieldsToUpsert: IDataObject,
		fieldMetaMap: Map<string, IBitableFieldMeta>,
	): Array<{ fieldName: string; binaryFieldNames: string }> {
		const mappings: Array<{ fieldName: string; binaryFieldNames: string }> = [];

		for (const [fieldName, rawValue] of Object.entries(fieldsToUpsert)) {
			const fieldMeta = fieldMetaMap.get(fieldName);

			if (!fieldMeta || this.getEffectiveUiType(fieldMeta) !== 'Attachment') {
				continue;
			}

			if (!this.isBinaryFieldReference(context, itemIndex, rawValue)) {
				continue;
			}

			mappings.push({
				fieldName,
				binaryFieldNames: rawValue as string,
			});
		}

		return mappings;
	}

	private static parseBinaryFieldNames(value: string): string[] {
		return value
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean);
	}

	static hasBinaryProperty(
		context: IExecuteFunctions,
		itemIndex: number,
		propertyName: string,
	): boolean {
		const item = context.getInputData()[itemIndex];
		return !!item?.binary?.[propertyName];
	}

	static isBinaryFieldReference(
		context: IExecuteFunctions,
		itemIndex: number,
		value: unknown,
	): boolean {
		if (typeof value !== 'string') {
			return false;
		}

		const binaryFieldNames = this.parseBinaryFieldNames(value);

		if (binaryFieldNames.length === 0) {
			return false;
		}

		return binaryFieldNames.every((name) => this.hasBinaryProperty(context, itemIndex, name));
	}

	static simplifyFieldValue(value: unknown, uiType: string): unknown {
		if (value === null || value === undefined) {
			return value;
		}

		switch (uiType) {
			case 'Text':
			case 'Barcode':
			case 'Phone':
			case 'Location':
				if (typeof value === 'string') {
					return value;
				}
				if (Array.isArray(value)) {
					return value
						.map((item) => {
							if (typeof item === 'object' && item !== null && 'text' in item) {
								return this.toTextValue((item as IDataObject).text);
							}
							return this.toTextValue(item);
						})
						.join('');
				}
				return value;

			case 'Number':
			case 'Progress':
			case 'Currency':
			case 'Rating':
			case 'AutoNumber':
				return value;

			case 'Checkbox':
				return value;

			case 'DateTime':
			case 'CreatedTime':
			case 'ModifiedTime':
				if (typeof value === 'number') {
					return new Date(value).toISOString();
				}
				return value;

			case 'SingleSelect':
			case 'MultiSelect':
				return value;

			case 'User':
			case 'CreatedUser':
			case 'ModifiedUser':
			case 'GroupChat':
				if (Array.isArray(value)) {
					return value.map((item) => {
						if (typeof item === 'object' && item !== null) {
							const user = item as IDataObject;
							return user.id ?? user.name ?? user.en_name ?? user.email ?? item;
						}
						return item;
					});
				}
				return value;

			case 'Url':
				if (typeof value === 'object' && value !== null) {
					const urlValue = value as IDataObject;
					return urlValue.link ?? urlValue.text ?? value;
				}
				return value;

			case 'Attachment':
				if (Array.isArray(value)) {
					return value.map((item) => {
						if (typeof item === 'object' && item !== null) {
							const attachment = item as IDataObject;
							return attachment.file_token ?? attachment.name ?? item;
						}
						return item;
					});
				}
				return value;

			case 'SingleLink':
			case 'DuplexLink':
				return value;

			default:
				return value;
		}
	}

	static transformRecordToSimple(
		record: IDataObject,
		fieldMetaMap: Map<string, IBitableFieldMeta>,
	): IDataObject {
		const result: IDataObject = {
			record_id: record.record_id,
		};
		const fields = (record.fields as IDataObject) ?? {};

		for (const [fieldName, value] of Object.entries(fields)) {
			const fieldMeta = fieldMetaMap.get(fieldName);
			const uiType = fieldMeta ? this.getEffectiveUiType(fieldMeta) : 'Text';
			result[fieldName] = this.simplifyFieldValue(value, uiType) as IDataObject[string];
		}

		// 保留 search 接口 automatic_fields 返回的自动计算字段
		for (const key of [
			'created_time',
			'last_modified_time',
			'created_by',
			'last_modified_by',
		] as const) {
			if (record[key] !== undefined) {
				result[key] = record[key];
			}
		}

		return result;
	}

	static transformRecordsToSimple(
		records: IDataObject[],
		fieldMetaMap: Map<string, IBitableFieldMeta>,
	): IDataObject[] {
		return records.map((record) => this.transformRecordToSimple(record, fieldMetaMap));
	}

	static async applyAttachmentFieldMappings(
		context: IExecuteFunctions,
		appToken: string,
		fields: IDataObject,
		mappings: Array<{ fieldName: string; binaryFieldNames: string }>,
		itemIndex: number,
		timeout?: number,
	): Promise<void> {
		for (const mapping of mappings) {
			const binaryFieldNames = this.parseBinaryFieldNames(mapping.binaryFieldNames || 'data');

			if (binaryFieldNames.length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					`附件字段「${mapping.fieldName}」至少需要配置一个 Input Data Field Name`,
					{ itemIndex },
				);
			}

			const fileTokens: Array<{ file_token: string }> = [];

			for (const binaryFieldName of binaryFieldNames) {
				if (!this.hasBinaryProperty(context, itemIndex, binaryFieldName)) {
					throw new NodeOperationError(
						context.getNode(),
						`附件字段「${mapping.fieldName}」未找到二进制数据「${binaryFieldName}」。请确认上游节点已将文件输出到该 Binary 字段（默认 data）`,
						{ itemIndex },
					);
				}

				const file = await NodeUtils.buildUploadFileData.call(context, binaryFieldName, itemIndex);
				const fileToken = await BitableMediaUploadUtils.uploadBitableMedia(
					context,
					appToken,
					file,
					timeout,
				);
				fileTokens.push({ file_token: fileToken });
			}

			fields[mapping.fieldName] = fileTokens;
		}
	}
}

export default BitableFieldUtils;
