import { IDataObject, INodeProperties } from 'n8n-workflow';
import { userIdTypeOption } from './sharedOptions';

export const bitableTableBaseProperties: INodeProperties[] = [
	{
		displayName: '多维表格 App 的唯一标识',
		name: 'app_toke',
		type: 'string',
		required: true,
		default: '',
		description:
			'多维表格 App 的唯一标识。不同形态的多维表格，其 app_token 的获取方式不同，参考<a href="https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/bitable-overview">多维表格 app_token 获取方式</a>获取。',
	},
	{
		displayName: '多维表格数据表的唯一标识',
		name: 'table_id',
		type: 'string',
		required: true,
		default: '',
		description: '你可通过多维表格 URL 获取 table_id',
	},
];

/** Match 匹配条件：Condition 按字段类型动态加载（Get/Delete/Upsert/If 共用） */
const matchConditionValues: INodeProperties[] = [
	{
		displayName: 'Column Name or ID',
		name: 'fieldName',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getBitableTableFields',
			loadOptionsDependsOn: ['app_toke', 'table_id'],
		},
		default: '',
		description:
			'Choose from the list, or specify using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. 列表选项 value 为「ui_type::字段名」，description 为字段 ui_type；表达式可填字段名或 ui_type::字段名。.',
	},
	{
		displayName: 'Condition',
		name: 'condition',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getBitableFilterConditions',
			// & 前缀：在 fixedCollection 内读取同条目的 sibling 参数
			loadOptionsDependsOn: ['&fieldName', 'app_toke', 'table_id'],
		},
		default: 'is',
		description:
			'根据 Column Name or ID 的字段类型动态加载可用运算符。文本字段为：等于、不等于、包含、不包含、为空、不为空。',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		default: '',
		displayOptions: {
			hide: {
				condition: ['isEmpty', 'isNotEmpty'],
			},
		},
	},
];

export const bitableUpsertMustMatchProperties: INodeProperties[] = [
	{
		displayName: 'Combine Conditions',
		name: 'combineConditions',
		type: 'options',
		options: [
			{ name: 'Any Condition', value: 'or' },
			{ name: 'All Conditions', value: 'and' },
		],
		default: 'or',
		description: 'How to combine the conditions defined below',
	},
	{
		displayName: 'Must Match',
		name: 'mustMatch',
		placeholder: 'Add Condition',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		options: [
			{
				displayName: 'Conditions',
				name: 'conditions',
				values: matchConditionValues,
			},
		],
	},
];

export const bitableOptionalMatchProperties: INodeProperties[] = [
	{
		displayName: 'Combine Conditions',
		name: 'combineConditions',
		type: 'options',
		options: [
			{ name: 'Any Condition', value: 'or' },
			{ name: 'All Conditions', value: 'and' },
		],
		default: 'or',
		description: 'How to combine the conditions defined below',
	},
	{
		displayName: 'Match',
		name: 'match',
		placeholder: 'Add Condition',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		description: '可选。不添加条件时将返回全部记录。',
		options: [
			{
				displayName: 'Conditions',
				name: 'conditions',
				values: matchConditionValues,
			},
		],
	},
];

export const bitableMatchProperties: INodeProperties[] = [
	{
		displayName: 'Combine Conditions',
		name: 'combineConditions',
		type: 'options',
		options: [
			{ name: 'Any Condition', value: 'or' },
			{ name: 'All Conditions', value: 'and' },
		],
		default: 'or',
		description: 'How to combine the conditions defined below',
	},
	{
		displayName: 'Match',
		name: 'match',
		placeholder: 'Add Condition',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		options: [
			{
				displayName: 'Conditions',
				name: 'conditions',
				values: matchConditionValues,
			},
		],
	},
];

export const bitableRecordIdProperty: INodeProperties = {
	displayName: 'Record ID',
	name: 'record_id',
	type: 'string',
	required: true,
	default: '',
	description: '要更新的记录 ID',
};

function createFieldValuesProperty(config: {
	name: string;
	displayName: string;
	valuesLabel: string;
}): INodeProperties {
	return {
		displayName: config.displayName,
		name: config.name,
		type: 'resourceMapper',
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		noDataExpression: true,
		typeOptions: {
			loadOptionsDependsOn: ['app_toke', 'table_id'],
			resourceMapper: {
				valuesLabel: config.valuesLabel,
				resourceMapperMethod: 'getBitableUpsertFields',
				mode: 'add',
				fieldWords: {
					singular: 'field',
					plural: 'fields',
				},
				addAllFields: true,
				multiKeyMatch: false,
				supportAutoMap: true,
				allowEmptyValues: true,
				hideNoDataError: true,
			},
		},
		description:
			'将多维表格字段映射为要写入的值。多选字段支持数组或英文逗号分隔的字符串。',
		hint: '附件 (attachment) 字段：填写上游节点的 Binary 字段名；支持多个字段，用英文逗号分隔（如 data,file2），默认 data。',
	};
}

export const bitableUpsertValuesProperty = createFieldValuesProperty({
	name: 'upsertFieldValues',
	displayName: 'Values to Upsert',
	valuesLabel: 'Values to Upsert',
});

export const bitableInsertValuesProperty = createFieldValuesProperty({
	name: 'insertFieldValues',
	displayName: 'Values to Insert',
	valuesLabel: 'Values to Insert',
});

export const bitableUpdateValuesProperty = createFieldValuesProperty({
	name: 'updateFieldValues',
	displayName: 'Values to Update',
	valuesLabel: 'Values to Update',
});

export const bitableTransformDataOption: INodeProperties = {
	displayName: '转换数据',
	name: 'transformData',
	type: 'boolean',
	default: false,
	description:
		'Whether to transform records into a simplified flat format with field names and values at the same level, for easier use in downstream nodes',
};

export const bitableAutomaticFieldsOption: INodeProperties = {
	displayName: 'Automatic Fields',
	name: 'automatic_fields',
	type: 'boolean',
	default: false,
	description:
		'Whether to automatically compute and return created_time, last_modified_time, created_by, and last_modified_by. Defaults to false.',
};

export const bitableFieldNamesOption: INodeProperties = {
	displayName: 'Field Names or IDs',
	name: 'field_names',
	type: 'multiOptions',
	typeOptions: {
		loadOptionsMethod: 'getBitableTableFields',
		loadOptionsDependsOn: ['app_toke', 'table_id'],
	},
	default: [],
	description:
		'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

export const bitableSortOption: INodeProperties = {
	displayName: 'Sort',
	name: 'sort',
	placeholder: 'Add Sort',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
	},
	default: {},
	description: '排序条件。field_name 数据源与 Match 的 Column Name or ID 一致（单选）。',
	options: [
		{
			displayName: 'Sort',
			name: 'items',
			values: [
				{
					displayName: 'Column Name or ID',
					name: 'field_name',
					type: 'options',
					typeOptions: {
						loadOptionsMethod: 'getBitableTableFields',
						loadOptionsDependsOn: ['app_toke', 'table_id'],
					},
					default: '',
					description:
						'Choose from the list, or specify using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. 列表选项 value 为「ui_type::字段名」。.',
				},
				{
					displayName: 'Descending',
					name: 'desc',
					type: 'boolean',
					default: false,
					description:
						'Whether to sort in descending order. Defaults to false (ascending).',
				},
			],
		},
	],
};

/** Upsert 操作标识，用于节点级批处理配置 */
export const BITABLE_UPSERT_OPERATION = 'bitable:table:record:upsert';

export const BITABLE_INSERT_ROW_OPERATION = 'bitable:table:record:insertRow';

export const BITABLE_UPDATE_ROWS_OPERATION = 'bitable:table:record:updateRows';

export const BITABLE_GET_ROWS_OPERATION = 'bitable:table:record:getRows';

export const BITABLE_DELETE_ROWS_OPERATION = 'bitable:table:record:deleteRows';

export const BITABLE_IF_ROW_EXISTS_OPERATION = 'bitable:table:record:ifRowExists';

export const BITABLE_IF_ROW_DOES_NOT_EXIST_OPERATION = 'bitable:table:record:ifRowDoesNotExist';

export const BITABLE_CREATE_DATA_TABLE_OPERATION = 'bitable:table:createDataTable';

/** 创建数据表：ui_type 与 type 的对应关系 */
export const BITABLE_CREATE_TABLE_FIELD_TYPES: Array<{
	uiType: string;
	type: number;
	label: string;
}> = [
	{ uiType: 'Text', type: 1, label: '文本' },
	{ uiType: 'Barcode', type: 1, label: '条码' },
	{ uiType: 'Email', type: 1, label: '邮箱' },
	{ uiType: 'Number', type: 2, label: '数字' },
	{ uiType: 'Progress', type: 2, label: '进度' },
	{ uiType: 'Currency', type: 2, label: '货币' },
	{ uiType: 'Rating', type: 2, label: '评分' },
	{ uiType: 'SingleSelect', type: 3, label: '单选' },
	{ uiType: 'MultiSelect', type: 4, label: '多选' },
	{ uiType: 'DateTime', type: 5, label: '日期' },
	{ uiType: 'Checkbox', type: 7, label: '复选框' },
	{ uiType: 'User', type: 11, label: '人员' },
	{ uiType: 'Phone', type: 13, label: '电话号码' },
	{ uiType: 'Url', type: 15, label: '超链接' },
	{ uiType: 'Attachment', type: 17, label: '附件' },
	{ uiType: 'SingleLink', type: 18, label: '单向关联' },
	{ uiType: 'Formula', type: 20, label: '公式' },
	{ uiType: 'DuplexLink', type: 21, label: '双向关联' },
	{ uiType: 'Location', type: 22, label: '地理位置' },
	{ uiType: 'GroupChat', type: 23, label: '群组' },
	{ uiType: 'CreatedTime', type: 1001, label: '创建时间' },
	{ uiType: 'ModifiedTime', type: 1002, label: '最后更新时间' },
	{ uiType: 'CreatedUser', type: 1003, label: '创建人' },
	{ uiType: 'ModifiedUser', type: 1004, label: '修改人' },
	{ uiType: 'AutoNumber', type: 1005, label: '自动编号' },
];

/** 创建数据表字段 UI 类型 → API type 数值 */
export const BITABLE_CREATE_TABLE_UI_TYPE_MAP: Record<string, number> = Object.fromEntries(
	BITABLE_CREATE_TABLE_FIELD_TYPES.map(({ uiType, type }) => [uiType, type]),
);

/** 创建数据表时第一个字段（索引字段）允许的 UI 类型 */
export const BITABLE_INDEX_FIELD_UI_TYPES = new Set([
	'Text',
	'Number',
	'DateTime',
	'Phone',
	'Url',
	'Formula',
	'Location',
]);

export const bitableCreateTableFieldTypeOptions: INodeProperties['options'] =
	BITABLE_CREATE_TABLE_FIELD_TYPES.map(({ uiType, label }) => ({
		name: `${uiType} ${label}`,
		value: uiType,
	}));

export function buildBitableCreateTableFieldPayload(field: {
	field_name: string;
	ui_type: string;
	description_text?: string;
	disable_sync?: boolean;
	property?: unknown;
	number_property?: unknown;
	barcode_property?: unknown;
	currency_property?: unknown;
	progress_property?: unknown;
	rating_property?: unknown;
	single_select_property?: unknown;
	multi_select_property?: unknown;
	datetime_property?: unknown;
	user_property?: unknown;
	single_link_property?: unknown;
	duplex_link_property?: unknown;
	formula_property?: unknown;
	location_property?: unknown;
	group_property?: unknown;
	created_time_property?: unknown;
	modified_time_property?: unknown;
	auto_number_property?: unknown;
}): IDataObject {
	const uiType = field.ui_type;
	const type = BITABLE_CREATE_TABLE_UI_TYPE_MAP[uiType];

	if (type === undefined) {
		throw new Error(`不支持的字段类型：${uiType}`);
	}

	const payload: IDataObject = {
		field_name: field.field_name,
		type,
		ui_type: uiType,
	};

	const descriptionText = field.description_text?.trim();
	if (descriptionText) {
		payload.description = {
			text: descriptionText,
			disable_sync: field.disable_sync ?? true,
		};
	}

	const property = parseBitableCreateTableFieldProperty(field.property);

	if (uiType === 'Currency') {
		const currencyProperty = parseBitableCreateTableFieldProperty(
			field.currency_property ?? field.property,
		);
		payload.property = buildCurrencyFieldProperty(currencyProperty);
	} else if (uiType === 'Number') {
		const numberProperty = parseBitableCreateTableFieldProperty(
			field.number_property ?? field.property,
		);
		payload.property = buildNumberFieldProperty(numberProperty);
	} else if (uiType === 'Barcode') {
		const barcodeProperty = parseBitableCreateTableFieldProperty(
			field.barcode_property ?? field.property,
		);
		payload.property = buildBarcodeFieldProperty(barcodeProperty);
	} else if (uiType === 'Progress') {
		const progressProperty = parseBitableCreateTableFieldProperty(
			field.progress_property ?? field.property,
		);
		payload.property = buildProgressFieldProperty(progressProperty);
	} else if (uiType === 'Rating') {
		const ratingProperty = parseBitableCreateTableFieldProperty(
			field.rating_property ?? field.property,
		);
		payload.property = buildRatingFieldProperty(ratingProperty);
	} else if (uiType === 'SingleSelect') {
		const singleSelectProperty = parseBitableCreateTableFieldProperty(
			field.single_select_property ?? field.property,
		);
		payload.property = buildSingleSelectFieldProperty(singleSelectProperty);
	} else if (uiType === 'MultiSelect') {
		const multiSelectProperty = parseBitableCreateTableFieldProperty(
			field.multi_select_property ?? field.property,
		);
		payload.property = buildMultiSelectFieldProperty(multiSelectProperty);
	} else if (uiType === 'DateTime') {
		const dateTimeProperty = parseBitableCreateTableFieldProperty(
			field.datetime_property ?? field.property,
		);
		payload.property = buildDateTimeFieldProperty(dateTimeProperty);
	} else if (uiType === 'User') {
		const userProperty = parseBitableCreateTableFieldProperty(
			field.user_property ?? field.property,
		);
		payload.property = buildUserFieldProperty(userProperty);
	} else if (uiType === 'SingleLink') {
		const singleLinkProperty = parseBitableCreateTableFieldProperty(
			field.single_link_property ?? field.property,
		);
		payload.property = buildSingleLinkFieldProperty(singleLinkProperty);
	} else if (uiType === 'DuplexLink') {
		const duplexLinkProperty = parseBitableCreateTableFieldProperty(
			field.duplex_link_property ?? field.property,
		);
		payload.property = buildDuplexLinkFieldProperty(duplexLinkProperty);
	} else if (uiType === 'Formula') {
		const formulaProperty = parseBitableCreateTableFieldProperty(
			field.formula_property ?? field.property,
		);
		payload.property = buildFormulaFieldProperty(formulaProperty);
	} else if (uiType === 'Location') {
		const locationProperty = parseBitableCreateTableFieldProperty(
			field.location_property ?? field.property,
		);
		payload.property = buildLocationFieldProperty(locationProperty);
	} else if (uiType === 'GroupChat') {
		const groupProperty = parseBitableCreateTableFieldProperty(
			field.group_property ?? field.property,
		);
		payload.property = buildGroupFieldProperty(groupProperty);
	} else if (uiType === 'CreatedTime') {
		const createdTimeProperty = parseBitableCreateTableFieldProperty(
			field.created_time_property ?? field.property,
		);
		payload.property = buildDateFormatterFieldProperty(createdTimeProperty);
	} else if (uiType === 'ModifiedTime') {
		const modifiedTimeProperty = parseBitableCreateTableFieldProperty(
			field.modified_time_property ?? field.property,
		);
		payload.property = buildDateFormatterFieldProperty(modifiedTimeProperty);
	} else if (uiType === 'AutoNumber') {
		const autoNumberProperty = parseBitableCreateTableFieldProperty(
			field.auto_number_property ?? field.property,
		);
		payload.property = buildAutoNumberFieldProperty(autoNumberProperty);
	} else if (uiType !== 'Text' && property !== undefined) {
		payload.property = property;
	}

	return payload;
}

const BITABLE_CURRENCY_PROPERTY_DEFAULTS = {
	formatter: '0.00',
	currency_code: 'CNY',
} as const;

const BITABLE_CURRENCY_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_CURRENCY_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_NUMBER_FORMATTERS = new Set([
	'0',
	'0.0',
	'0.00',
	'0.000',
	'0.0000',
	'1,000',
	'1,000.00',
	'%',
	'0.00%',
	'¥',
	'¥0.00',
	'$',
	'$0.00',
]);

const BITABLE_TEXT_PROPERTY_DEFAULT_JSON = JSON.stringify({}, null, 2);

const BITABLE_NUMBER_PROPERTY_DEFAULTS = {
	formatter: '0.0',
} as const;

const BITABLE_NUMBER_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_NUMBER_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_BARCODE_ALLOWED_EDIT_MODES_DEFAULTS = {
	manual: true,
	scan: true,
} as const;

const BITABLE_BARCODE_PROPERTY_DEFAULTS = {
	allowed_edit_modes: BITABLE_BARCODE_ALLOWED_EDIT_MODES_DEFAULTS,
} as const;

const BITABLE_BARCODE_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_BARCODE_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_PROGRESS_PROPERTY_DEFAULTS = {
	formatter: '0%',
	range_customize: false,
} as const;

const BITABLE_PROGRESS_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_PROGRESS_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_RATING_PROPERTY_DEFAULTS = {
	formatter: '0',
	rating: {
		symbol: 'star',
	},
	min: 1,
	max: 5,
} as const;

const BITABLE_RATING_SYMBOLS = new Set([
	'star',
	'heart',
	'thumbsup',
	'fire',
	'smile',
	'lightning',
	'flower',
	'number',
]);

const BITABLE_RATING_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_RATING_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_SELECT_OPTIONS_PROPERTY_DEFAULTS = {
	options: [
		{ name: '选项1', color: 0 },
		{ name: '选项2', color: 1 },
	],
} as const;

const BITABLE_SINGLE_SELECT_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_SELECT_OPTIONS_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_MULTI_SELECT_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_SELECT_OPTIONS_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_DATETIME_DATE_FORMATTERS = new Set([
	'yyyy/MM/dd',
	'yyyy-MM-dd HH:mm',
	'MM-dd',
	'MM/dd/yyyy',
	'dd/MM/yyyy',
]);

const BITABLE_DATETIME_PROPERTY_DEFAULTS = {
	date_formatter: 'yyyy/MM/dd',
	auto_fill: false,
} as const;

const BITABLE_DATETIME_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_DATETIME_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_DATE_FORMATTER_PROPERTY_DEFAULTS = {
	date_formatter: 'yyyy/MM/dd',
} as const;

const BITABLE_CREATED_TIME_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_DATE_FORMATTER_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_MODIFIED_TIME_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_DATE_FORMATTER_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_USER_PROPERTY_DEFAULTS = {
	multiple: true,
} as const;

const BITABLE_USER_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_USER_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_GROUP_PROPERTY_DEFAULTS = {
	multiple: true,
} as const;

const BITABLE_GROUP_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_GROUP_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_AUTO_SERIAL_TYPES = new Set(['custom', 'auto_increment_number']);

const BITABLE_AUTO_SERIAL_OPTION_TYPES = new Set(['system_number', 'fixed_text', 'created_time']);

const BITABLE_AUTO_SERIAL_CREATED_TIME_FORMATS = new Set([
	'yyyyMMdd',
	'yyyyMM',
	'yyyy',
	'MMdd',
	'MM',
	'dd',
]);

const BITABLE_AUTO_NUMBER_PROPERTY_DEFAULTS = {
	auto_serial: {
		type: 'auto_increment_number',
		reformat_existing_records: false,
	},
} as const;

const BITABLE_AUTO_NUMBER_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_AUTO_NUMBER_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_SINGLE_LINK_PROPERTY_DEFAULTS = {
	multiple: true,
	table_id: '',
} as const;

const BITABLE_SINGLE_LINK_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_SINGLE_LINK_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_DUPLEX_LINK_PROPERTY_DEFAULTS = {
	multiple: true,
	table_id: '',
} as const;

const BITABLE_DUPLEX_LINK_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_DUPLEX_LINK_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_FORMULA_FORMATTERS = new Set([
	'0',
	'0.0',
	'0.00',
	'1,000',
	'1,000.00',
	'%',
	'0.00%',
	'¥',
	'¥0.00',
	'￥',
	'￥0.00',
	'$',
	'$0.00',
	'yyyy/MM/dd HH:mm',
	'yyyy/MM/dd',
	'yyyy-MM-dd',
	'MM-dd',
]);

const BITABLE_FORMULA_PROPERTY_DEFAULTS = {
	formatter: '0',
	formula_expression: '',
} as const;

const BITABLE_FORMULA_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_FORMULA_PROPERTY_DEFAULTS,
	null,
	2,
);

const BITABLE_LOCATION_INPUT_TYPES = new Set(['only_mobile', 'not_limit']);

const BITABLE_LOCATION_PROPERTY_DEFAULTS = {
	input_type: 'not_limit',
} as const;

const BITABLE_LOCATION_PROPERTY_DEFAULT_JSON = JSON.stringify(
	BITABLE_LOCATION_PROPERTY_DEFAULTS,
	null,
	2,
);

function buildCurrencyFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const formatter = merged.formatter;
	const currencyCode = merged.currency_code;

	merged.formatter =
		typeof formatter === 'string' && formatter.trim()
			? formatter.trim()
			: BITABLE_CURRENCY_PROPERTY_DEFAULTS.formatter;
	merged.currency_code =
		typeof currencyCode === 'string' && currencyCode.trim()
			? currencyCode.trim()
			: BITABLE_CURRENCY_PROPERTY_DEFAULTS.currency_code;

	return merged;
}

function buildNumberFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const formatter = merged.formatter;

	merged.formatter =
		typeof formatter === 'string' && BITABLE_NUMBER_FORMATTERS.has(formatter.trim())
			? formatter.trim()
			: BITABLE_NUMBER_PROPERTY_DEFAULTS.formatter;

	return merged;
}

function buildBarcodeFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const modesRaw = merged.allowed_edit_modes;
	const modes: IDataObject =
		typeof modesRaw === 'object' && modesRaw !== null && !Array.isArray(modesRaw)
			? { ...(modesRaw as IDataObject) }
			: {};

	if (modes.manual === undefined) {
		modes.manual = BITABLE_BARCODE_ALLOWED_EDIT_MODES_DEFAULTS.manual;
	}

	if (modes.scan === undefined) {
		modes.scan = BITABLE_BARCODE_ALLOWED_EDIT_MODES_DEFAULTS.scan;
	}

	merged.allowed_edit_modes = modes;

	return merged;
}

function buildProgressFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const formatter = merged.formatter;

	merged.formatter =
		typeof formatter === 'string' && formatter.trim()
			? formatter.trim()
			: BITABLE_PROGRESS_PROPERTY_DEFAULTS.formatter;

	if (merged.range_customize === undefined) {
		merged.range_customize = BITABLE_PROGRESS_PROPERTY_DEFAULTS.range_customize;
	}

	if (merged.range_customize === true) {
		if (merged.min === undefined || merged.max === undefined) {
			throw new Error('Progress 类型在 range_customize 为 true 时，property 中 min 与 max 为必填项');
		}
	}

	return merged;
}

function buildRatingFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };

	merged.formatter = '0';

	const ratingRaw = merged.rating;
	const rating: IDataObject =
		typeof ratingRaw === 'object' && ratingRaw !== null && !Array.isArray(ratingRaw)
			? { ...(ratingRaw as IDataObject) }
			: {};
	const symbol = rating.symbol;
	rating.symbol =
		typeof symbol === 'string' && BITABLE_RATING_SYMBOLS.has(symbol)
			? symbol
			: BITABLE_RATING_PROPERTY_DEFAULTS.rating.symbol;
	merged.rating = rating;

	const minValue = merged.min ?? BITABLE_RATING_PROPERTY_DEFAULTS.min;
	const maxValue = merged.max ?? BITABLE_RATING_PROPERTY_DEFAULTS.max;
	const min = typeof minValue === 'number' ? minValue : Number(minValue);
	const max = typeof maxValue === 'number' ? maxValue : Number(maxValue);

	if (min !== 0 && min !== 1) {
		throw new Error('Rating 类型 property.min 只能为 0 或 1');
	}

	if (!Number.isInteger(max) || max < 1 || max > 10) {
		throw new Error('Rating 类型 property.max 必须为 1～10 的整数');
	}

	if (min >= max) {
		throw new Error('Rating 类型 property.min 必须小于 max');
	}

	merged.min = min;
	merged.max = max;

	return merged;
}

function buildSelectOptionsFieldProperty(
	property: IDataObject | undefined,
	fieldTypeLabel: string,
	defaults: typeof BITABLE_SELECT_OPTIONS_PROPERTY_DEFAULTS,
): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const optionsRaw = merged.options;

	if (!Array.isArray(optionsRaw) || optionsRaw.length === 0) {
		merged.options = defaults.options.map((option) => ({ ...option }));
		return merged;
	}

	merged.options = optionsRaw.map((item, index) => {
		if (typeof item !== 'object' || item === null || Array.isArray(item)) {
			throw new Error(`${fieldTypeLabel} 类型 property.options[${index}] 须为对象`);
		}

		const option = item as IDataObject;
		const name = option.name;

		if (typeof name !== 'string' || !name.trim()) {
			throw new Error(`${fieldTypeLabel} 类型 property.options[${index}].name 为必填项`);
		}

		const normalized: IDataObject = {
			name: name.trim(),
		};

		if (typeof option.id === 'string' && option.id.trim()) {
			normalized.id = option.id.trim();
		}

		const colorValue = option.color;
		const color = typeof colorValue === 'number' ? colorValue : Number(colorValue);
		if (Number.isInteger(color) && color >= 0 && color <= 54) {
			normalized.color = color;
		} else {
			normalized.color = index;
		}

		return normalized;
	});

	return merged;
}

function buildSingleSelectFieldProperty(property?: IDataObject): IDataObject {
	return buildSelectOptionsFieldProperty(
		property,
		'SingleSelect',
		BITABLE_SELECT_OPTIONS_PROPERTY_DEFAULTS,
	);
}

function buildMultiSelectFieldProperty(property?: IDataObject): IDataObject {
	return buildSelectOptionsFieldProperty(
		property,
		'MultiSelect',
		BITABLE_SELECT_OPTIONS_PROPERTY_DEFAULTS,
	);
}

function buildDateFormatterFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const dateFormatter = merged.date_formatter;

	merged.date_formatter =
		typeof dateFormatter === 'string' &&
		BITABLE_DATETIME_DATE_FORMATTERS.has(dateFormatter.trim())
			? dateFormatter.trim()
			: BITABLE_DATE_FORMATTER_PROPERTY_DEFAULTS.date_formatter;

	return merged;
}

function buildDateTimeFieldProperty(property?: IDataObject): IDataObject {
	const merged = buildDateFormatterFieldProperty(property);

	if (merged.auto_fill === undefined) {
		merged.auto_fill = BITABLE_DATETIME_PROPERTY_DEFAULTS.auto_fill;
	}

	return merged;
}

function buildUserFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };

	if (merged.multiple === undefined) {
		merged.multiple = BITABLE_USER_PROPERTY_DEFAULTS.multiple;
	}

	return merged;
}

function buildGroupFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };

	if (merged.multiple === undefined) {
		merged.multiple = BITABLE_GROUP_PROPERTY_DEFAULTS.multiple;
	}

	return merged;
}

function buildSingleLinkFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const tableId = merged.table_id;

	if (typeof tableId !== 'string' || !tableId.trim()) {
		throw new Error('SingleLink（单向关联）类型 property.table_id 为必填项');
	}

	merged.table_id = tableId.trim();

	if (merged.multiple === undefined) {
		merged.multiple = BITABLE_SINGLE_LINK_PROPERTY_DEFAULTS.multiple;
	}

	return merged;
}

function buildDuplexLinkFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const tableId = merged.table_id;

	if (typeof tableId !== 'string' || !tableId.trim()) {
		throw new Error('DuplexLink（双向关联）类型 property.table_id 为必填项');
	}

	merged.table_id = tableId.trim();

	if (merged.multiple === undefined) {
		merged.multiple = BITABLE_DUPLEX_LINK_PROPERTY_DEFAULTS.multiple;
	}

	const backFieldName = merged.back_field_name;
	if (typeof backFieldName === 'string') {
		const trimmed = backFieldName.trim();
		if (trimmed) {
			merged.back_field_name = trimmed;
		} else {
			delete merged.back_field_name;
		}
	}

	return merged;
}

function buildFormulaFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const formatter = merged.formatter;

	merged.formatter =
		typeof formatter === 'string' && BITABLE_FORMULA_FORMATTERS.has(formatter.trim())
			? formatter.trim()
			: BITABLE_FORMULA_PROPERTY_DEFAULTS.formatter;

	const formulaExpression = merged.formula_expression;
	if (typeof formulaExpression === 'string') {
		const trimmed = formulaExpression.trim();
		if (trimmed) {
			merged.formula_expression = trimmed;
		} else {
			delete merged.formula_expression;
		}
	} else {
		delete merged.formula_expression;
	}

	return merged;
}

function buildLocationFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const inputType = merged.input_type;

	if (typeof inputType === 'string' && BITABLE_LOCATION_INPUT_TYPES.has(inputType.trim())) {
		merged.input_type = inputType.trim();
	} else if (inputType === undefined) {
		merged.input_type = BITABLE_LOCATION_PROPERTY_DEFAULTS.input_type;
	} else {
		throw new Error('Location（地理位置）类型 property.input_type 须为 only_mobile 或 not_limit');
	}

	const locationRaw = merged.location;
	if (
		locationRaw === undefined ||
		locationRaw === null ||
		(typeof locationRaw === 'object' &&
			!Array.isArray(locationRaw) &&
			Object.keys(locationRaw as IDataObject).length === 0)
	) {
		delete merged.location;
	} else if (typeof locationRaw === 'object' && !Array.isArray(locationRaw)) {
		merged.location = locationRaw;
	} else {
		throw new Error('Location（地理位置）类型 property.location 须为对象');
	}

	return merged;
}

function normalizeAutoSerialOption(item: unknown, index: number): IDataObject {
	if (typeof item !== 'object' || item === null || Array.isArray(item)) {
		throw new Error(`AutoNumber（自动编号）类型 property.auto_serial.options[${index}] 须为对象`);
	}

	const option = item as IDataObject;
	const optionType = option.type;

	if (typeof optionType !== 'string' || !BITABLE_AUTO_SERIAL_OPTION_TYPES.has(optionType.trim())) {
		throw new Error(
			`AutoNumber（自动编号）类型 property.auto_serial.options[${index}].type 须为 system_number、fixed_text 或 created_time`,
		);
	}

	const normalizedType = optionType.trim();
	const value = option.value;

	if (value === undefined || value === null || value === '') {
		throw new Error(
			`AutoNumber（自动编号）类型 property.auto_serial.options[${index}].value 为必填项`,
		);
	}

	if (normalizedType === 'system_number') {
		const digits = typeof value === 'number' ? value : Number(value);
		if (!Number.isInteger(digits) || digits < 1 || digits > 9) {
			throw new Error(
				`AutoNumber（自动编号）类型 property.auto_serial.options[${index}].value 须为 1～9 的整数`,
			);
		}

		return { type: normalizedType, value: String(digits) };
	}

	if (normalizedType === 'fixed_text') {
		const text = String(value).trim();
		if (!text || text.length > 20) {
			throw new Error(
				`AutoNumber（自动编号）类型 property.auto_serial.options[${index}].value 须为 1～20 字符的字符串`,
			);
		}

		return { type: normalizedType, value: text };
	}

	const format = String(value).trim();
	if (!BITABLE_AUTO_SERIAL_CREATED_TIME_FORMATS.has(format)) {
		throw new Error(
			`AutoNumber（自动编号）类型 property.auto_serial.options[${index}].value 须为 yyyyMMdd、yyyyMM、yyyy、MMdd、MM 或 dd`,
		);
	}

	return { type: normalizedType, value: format };
}

function buildAutoNumberFieldProperty(property?: IDataObject): IDataObject {
	const merged: IDataObject = { ...(property ?? {}) };
	const autoSerialRaw = merged.auto_serial;

	const autoSerial: IDataObject =
		typeof autoSerialRaw === 'object' && autoSerialRaw !== null && !Array.isArray(autoSerialRaw)
			? { ...(autoSerialRaw as IDataObject) }
			: { ...BITABLE_AUTO_NUMBER_PROPERTY_DEFAULTS.auto_serial };

	const serialType = autoSerial.type;

	if (typeof serialType !== 'string' || !BITABLE_AUTO_SERIAL_TYPES.has(serialType.trim())) {
		if (serialType === undefined) {
			autoSerial.type = BITABLE_AUTO_NUMBER_PROPERTY_DEFAULTS.auto_serial.type;
		} else {
			throw new Error(
				'AutoNumber（自动编号）类型 property.auto_serial.type 须为 custom 或 auto_increment_number',
			);
		}
	} else {
		autoSerial.type = serialType.trim();
	}

	if (autoSerial.reformat_existing_records === undefined) {
		autoSerial.reformat_existing_records =
			BITABLE_AUTO_NUMBER_PROPERTY_DEFAULTS.auto_serial.reformat_existing_records;
	}

	if (autoSerial.type === 'custom') {
		const optionsRaw = autoSerial.options;
		if (optionsRaw !== undefined) {
			if (!Array.isArray(optionsRaw)) {
				throw new Error('AutoNumber（自动编号）类型 property.auto_serial.options 须为数组');
			}

			autoSerial.options = optionsRaw.map((item, index) => normalizeAutoSerialOption(item, index));
		}
	} else {
		delete autoSerial.options;
	}

	return { auto_serial: autoSerial };
}

function isEmptyPropertyObject(value: IDataObject): boolean {
	return Object.keys(value).length === 0;
}

function parseBitableCreateTableFieldProperty(value: unknown): IDataObject | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	if (typeof value === 'object' && !Array.isArray(value)) {
		const objectValue = value as IDataObject;
		return isEmptyPropertyObject(objectValue) ? undefined : objectValue;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed || trimmed === '{}') {
			return undefined;
		}

		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				throw new Error('Property 须为 JSON 对象');
			}

			const objectValue = parsed as IDataObject;
			return isEmptyPropertyObject(objectValue) ? undefined : objectValue;
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new Error(`Property JSON 解析失败：${error.message}`);
			}
			throw error;
		}
	}

	throw new Error('Property 须为 JSON 对象');
}

/** 创建数据表时隐藏通用 property 字段的 ui_type（含专用属性字段或无需 property 的类型） */
const BITABLE_CREATE_TABLE_TYPED_PROPERTY_UI_TYPES = [
	'Text',
	'Number',
	'Barcode',
	'Currency',
	'Progress',
	'Rating',
	'SingleSelect',
	'MultiSelect',
	'DateTime',
	'User',
	'SingleLink',
	'DuplexLink',
	'Formula',
	'Location',
	'GroupChat',
	'CreatedTime',
	'ModifiedTime',
	'AutoNumber',
] as const;

export const bitableCreateTableFieldProperties: INodeProperties[] = [
	{
		displayName: '字段/列',
		name: 'fields',
		placeholder: '添加字段/列',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
			sortable: true,
		},
		default: {
			field: [
				{
					field_name: '索引',
					ui_type: 'Text',
				},
			],
		},
		description: '数据表的初始字段。第一个字段为索引字段，仅支持 Text、Number、DateTime、Phone、URL、Formula 或 Location 类型。',
		options: [
			{
				displayName: '字段/列',
				name: 'field',
				values: [
					{
						displayName: '字段/列名称',
						name: 'field_name',
						type: 'string',
						default: '',
						required: true,
						description: '字段名称，长度 1～300 字符',
					},
					{
						displayName: '字段/列类型',
						name: 'ui_type',
						type: 'options',
						options: bitableCreateTableFieldTypeOptions,
						default: 'Text',
						description:
							'字段 UI 类型。参考<a href="https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table/create">飞书创建数据表 API</a>',
					},
					{
						displayName: '属性',
						name: 'property',
						type: 'json',
						default: BITABLE_TEXT_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							hide: {
								ui_type: [...BITABLE_CREATE_TABLE_TYPED_PROPERTY_UI_TYPES],
							},
						},
						description:
							'字段属性，JSON 格式，非必填。可配置 formatter、date_formatter、auto_fill、multiple、options（单选/多选选项）等，参考<a href="https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table/create">飞书创建数据表 API</a>',
					},
					{
						displayName: '属性',
						name: 'number_property',
						type: 'json',
						default: BITABLE_NUMBER_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Number'],
							},
						},
						description:
							'Number（数字）类型可配置 formatter。默认 formatter 为 0.0，支持整数、小数、千分位、百分比、货币等格式。',
					},
					{
						displayName: '属性',
						name: 'barcode_property',
						type: 'json',
						default: BITABLE_BARCODE_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Barcode'],
							},
						},
						description:
							'Barcode（条码）类型可配置 allowed_edit_modes。默认 manual 与 scan 均为 true，分别表示允许手动输入与移动端扫码。',
					},
					{
						displayName: '属性',
						name: 'currency_property',
						type: 'json',
						default: BITABLE_CURRENCY_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Currency'],
							},
						},
						description:
							'Currency 类型必填 formatter 与 currency_code。默认 formatter 为 0.00，currency_code 为 CNY。',
					},
					{
						displayName: '属性',
						name: 'progress_property',
						type: 'json',
						default: BITABLE_PROGRESS_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Progress'],
							},
						},
						description:
							'Progress 类型必填 formatter。默认 formatter 为 0%，range_customize 为 false。range_customize 为 true 时需填写 min 与 max。',
					},
					{
						displayName: '属性',
						name: 'rating_property',
						type: 'json',
						default: BITABLE_RATING_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Rating'],
							},
						},
						description:
							'Rating 类型必填 formatter、min、max。formatter 固定为 0；默认 rating.symbol 为 star，min 为 1，max 为 5。',
					},
					{
						displayName: '属性',
						name: 'single_select_property',
						type: 'json',
						default: BITABLE_SINGLE_SELECT_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['SingleSelect'],
							},
						},
						description:
							'SingleSelect 类型需配置 options 选项列表。默认包含「选项1」「选项2」，color 分别为 0、1。',
					},
					{
						displayName: '属性',
						name: 'multi_select_property',
						type: 'json',
						default: BITABLE_MULTI_SELECT_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['MultiSelect'],
							},
						},
						description:
							'MultiSelect 类型需配置 options 选项列表。默认包含「选项1」「选项2」，color 分别为 0、1。',
					},
					{
						displayName: '属性',
						name: 'datetime_property',
						type: 'json',
						default: BITABLE_DATETIME_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['DateTime'],
							},
						},
						description:
							'DateTime 类型可配置 date_formatter 与 auto_fill。默认 date_formatter 为 yyyy/MM/dd，auto_fill 为 false。',
					},
					{
						displayName: '属性',
						name: 'user_property',
						type: 'json',
						default: BITABLE_USER_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['User'],
							},
						},
						description:
							'User（人员）类型可配置 multiple。默认 multiple 为 true，表示允许添加多个成员。',
					},
					{
						displayName: '属性',
						name: 'single_link_property',
						type: 'json',
						default: BITABLE_SINGLE_LINK_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['SingleLink'],
							},
						},
						description:
							'SingleLink（单向关联）类型必填 table_id（关联的数据表 ID）。默认 multiple 为 true，表示允许关联多条记录。',
					},
					{
						displayName: '属性',
						name: 'duplex_link_property',
						type: 'json',
						default: BITABLE_DUPLEX_LINK_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['DuplexLink'],
							},
						},
						description:
							'DuplexLink（双向关联）类型必填 table_id（关联的数据表 ID）。可选 back_field_name 指定关联表中的反向字段名，默认 multiple 为 true。',
					},
					{
						displayName: '属性',
						name: 'formula_property',
						type: 'json',
						default: BITABLE_FORMULA_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Formula'],
							},
						},
						description:
							'Formula（公式）类型可配置 formatter 与 formula_expression。默认 formatter 为 0，formula_expression 为空。',
					},
					{
						displayName: '属性',
						name: 'location_property',
						type: 'json',
						default: BITABLE_LOCATION_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['Location'],
							},
						},
						description:
							'Location（地理位置）类型必填 input_type：only_mobile（仅移动端实时定位）或 not_limit（无限制）。可选 location 对象配置输入方式，默认 input_type 为 not_limit。',
					},
					{
						displayName: '属性',
						name: 'group_property',
						type: 'json',
						default: BITABLE_GROUP_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['GroupChat'],
							},
						},
						description:
							'GroupChat（群组）类型可配置 multiple。默认 multiple 为 true，表示允许添加多个群组。',
					},
					{
						displayName: '属性',
						name: 'created_time_property',
						type: 'json',
						default: BITABLE_CREATED_TIME_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['CreatedTime'],
							},
						},
						description:
							'CreatedTime（创建时间）类型可配置 date_formatter。默认 date_formatter 为 yyyy/MM/dd。',
					},
					{
						displayName: '属性',
						name: 'modified_time_property',
						type: 'json',
						default: BITABLE_MODIFIED_TIME_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['ModifiedTime'],
							},
						},
						description:
							'ModifiedTime（最后更新时间）类型可配置 date_formatter。默认 date_formatter 为 yyyy/MM/dd。',
					},
					{
						displayName: '属性',
						name: 'auto_number_property',
						type: 'json',
						default: BITABLE_AUTO_NUMBER_PROPERTY_DEFAULT_JSON,
						displayOptions: {
							show: {
								ui_type: ['AutoNumber'],
							},
						},
						description:
							'AutoNumber（自动编号）类型需配置 auto_serial。默认 type 为 auto_increment_number，reformat_existing_records 为 false。type 为 custom 时可配置 options 规则（system_number、fixed_text、created_time）。',
					},
					{
						displayName: '字段/列描述',
						name: 'description_text',
						type: 'string',
						default: '',
						description: '字段描述内容，支持换行 \\n，非必填',
					},
					{
						displayName: '禁用同步',
						name: 'disable_sync',
						type: 'boolean',
						default: true,
						description: 'Whether to disable syncing this description to the form question description. Defaults to true.',
					},
				],
			},
		],
	},
];

export const BITABLE_BATCH_ALL_ITEMS_OPERATIONS = new Set([
	BITABLE_INSERT_ROW_OPERATION,
	BITABLE_UPDATE_ROWS_OPERATION,
]);

/** Upsert 专用批处理：默认约 10 次/秒 */
export const bitableUpsertBatchingOption: INodeProperties = {
	displayName: 'Batching',
	name: 'batching',
	placeholder: 'Add Batching',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: false,
	},
	default: {
		batch: {
			batchSize: 10,
			batchInterval: 1000,
		},
	},
	options: [
		{
			displayName: 'Batching',
			name: 'batch',
			values: [
				{
					displayName: 'Items per Batch',
					name: 'batchSize',
					type: 'number',
					typeOptions: {
						minValue: 1,
					},
					default: 10,
					description:
						'每批并发请求数量，默认 10。与 Batch Interval 配合控制速率（默认约 10 次/秒）。0 将被视为 1。',
				},
				{
					displayName: 'Batch Interval (Ms)',
					name: 'batchInterval',
					type: 'number',
					typeOptions: {
						minValue: 0,
					},
					default: 1000,
					description:
						'每批请求之间的时间（毫秒），默认 1000。与 Items per Batch 配合控制速率（默认约 10 次/秒）。0 表示批次间无等待。',
				},
			],
		},
	],
};

export const bitableRecordOptionsProperties: INodeProperties[] = [
	userIdTypeOption,
	{
		displayName: '是否忽略一致性读写检查',
		name: 'ignore_consistency_check',
		type: 'boolean',
		default: true,
	},
];
