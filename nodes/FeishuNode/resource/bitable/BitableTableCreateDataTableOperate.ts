import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import {
	BITABLE_CREATE_DATA_TABLE_OPERATION,
	BITABLE_INDEX_FIELD_UI_TYPES,
	bitableCreateTableFieldProperties,
	buildBitableCreateTableFieldPayload,
} from '../../../help/utils/bitableUpsertProperties';
import { timeoutOption } from '../../../help/utils/sharedOptions';

interface ICreateTableField {
	field_name?: string;
	ui_type?: string;
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
}

const BitableTableCreateDataTableOperate: ResourceOperations = {
	name: '多维表格 - Create a Data Table',
	value: BITABLE_CREATE_DATA_TABLE_OPERATION,
	description: '在多维表格中新建数据表，可设置表名、默认视图和初始字段。',
	order: 8,
	options: [
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
			displayName: '数据表名',
			name: 'table_name',
			type: 'string',
			required: true,
			default: '',
			description: '数据表名称',
		},
		{
			displayName: '默认视图名称',
			name: 'default_view_name',
			type: 'string',
			default: '表格',
			description:
				'默认视图名称。填写后需同时配置字段/列。参考<a href="https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table/create">飞书创建数据表 API</a>',
		},
		...bitableCreateTableFieldProperties,
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
		const tableName = this.getNodeParameter('table_name', index) as string;
		const defaultViewName = this.getNodeParameter('default_view_name', index, '表格') as string;
		const fieldsRaw = this.getNodeParameter('fields', index, {}) as {
			field?: ICreateTableField[];
		};
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const fields = fieldsRaw.field ?? [];

		if (!tableName.trim()) {
			throw new NodeOperationError(this.getNode(), '数据表名不能为空', { itemIndex: index });
		}

		if (fields.length === 0) {
			throw new NodeOperationError(this.getNode(), '请至少添加一个字段', { itemIndex: index });
		}

		const apiFields: IDataObject[] = [];

		for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
			const field = fields[fieldIndex];
			const fieldName = field.field_name?.trim() ?? '';
			const uiType = field.ui_type;

			if (!fieldName) {
				throw new NodeOperationError(this.getNode(), `第 ${fieldIndex + 1} 个字段的名称不能为空`, {
					itemIndex: index,
				});
			}

			if (!uiType) {
				throw new NodeOperationError(this.getNode(), `字段「${fieldName}」未选择类型`, {
					itemIndex: index,
				});
			}

			if (fieldIndex === 0 && !BITABLE_INDEX_FIELD_UI_TYPES.has(uiType)) {
				throw new NodeOperationError(
					this.getNode(),
					`第一个字段「${fieldName}」为索引字段，仅支持 Text、Number、DateTime、Phone、Url、Formula 或 Location 类型`,
					{ itemIndex: index },
				);
			}

			try {
				apiFields.push(
					buildBitableCreateTableFieldPayload({
						field_name: fieldName,
						ui_type: uiType,
						description_text: field.description_text,
						disable_sync: field.disable_sync,
						property: field.property,
						number_property: field.number_property,
						barcode_property: field.barcode_property,
						currency_property: field.currency_property,
						progress_property: field.progress_property,
						rating_property: field.rating_property,
						single_select_property: field.single_select_property,
						multi_select_property: field.multi_select_property,
						datetime_property: field.datetime_property,
						user_property: field.user_property,
						single_link_property: field.single_link_property,
						duplex_link_property: field.duplex_link_property,
						formula_property: field.formula_property,
						location_property: field.location_property,
						group_property: field.group_property,
						created_time_property: field.created_time_property,
						modified_time_property: field.modified_time_property,
						auto_number_property: field.auto_number_property,
					}),
				);
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error.message : String(error),
					{ itemIndex: index },
				);
			}
		}

		const table: IDataObject = {
			name: tableName.trim(),
			fields: apiFields,
		};

		if (defaultViewName.trim()) {
			table.default_view_name = defaultViewName.trim();
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/bitable/v1/apps/${app_token}/tables`,
			body: {
				table,
			},
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default BitableTableCreateDataTableOperate;
