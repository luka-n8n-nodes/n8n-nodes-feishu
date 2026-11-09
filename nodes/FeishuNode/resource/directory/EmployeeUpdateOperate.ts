import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import NodeUtils from '../../../help/utils/NodeUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';
import {
	directoryDepartmentIdTypeOption,
	employeeIdTypeOption,
} from '../../../help/utils/directoryProperties';

const I18N_SUPPORTED_KEYS = ['zh_cn', 'ja_jp', 'en_us'] as const;
const I18N_DEFAULT_VALUE_PRIORITY = ['zh_cn', 'en_us', 'ja_jp'] as const;
const I18N_VALUE_TEMPLATE = JSON.stringify(
	{
		zh_cn: '',
		ja_jp: '',
		en_us: '',
	},
	null,
	2,
);

function isPlainObject(value: unknown): value is IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target: IDataObject, source: IDataObject): IDataObject {
	const result: IDataObject = { ...target };

	for (const [key, value] of Object.entries(source)) {
		if (isPlainObject(value) && isPlainObject(result[key])) {
			result[key] = deepMerge(result[key] as IDataObject, value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * 解析并校验 i18n_value 对象
 */
function parseI18nValue(
	input: unknown,
	label: string,
	maxLength?: number,
): IDataObject {
	let parsed: unknown = input;

	if (typeof input === 'string') {
		const trimmed = input.trim();
		if (!trimmed) {
			throw new Error(`${label}至少需要填写一种语言`);
		}
		try {
			parsed = JSON.parse(trimmed);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`${label} JSON 格式解析失败: ${errorMessage}`);
		}
	}

	if (!isPlainObject(parsed)) {
		throw new Error(`${label}必须是 JSON 对象`);
	}

	const result: IDataObject = {};

	for (const [key, value] of Object.entries(parsed)) {
		if (!(I18N_SUPPORTED_KEYS as readonly string[]).includes(key)) {
			throw new Error(`${label}包含不支持的语言: ${key}，仅支持 zh_cn、ja_jp、en_us`);
		}

		if (value === null || value === undefined) {
			continue;
		}

		if (typeof value !== 'string') {
			throw new Error(`${label}的 ${key} 必须是字符串`);
		}

		const trimmedValue = value.trim();
		if (!trimmedValue) {
			continue;
		}

		if (maxLength !== undefined && trimmedValue.length > maxLength) {
			throw new Error(`${label}的 ${key} 最多 ${maxLength} 字符`);
		}

		result[key] = trimmedValue;
	}

	if (Object.keys(result).length === 0) {
		throw new Error(`${label}至少需要填写一种语言`);
	}

	return result;
}

function pickDefaultValueFromI18n(i18nValue: IDataObject): string | undefined {
	for (const key of I18N_DEFAULT_VALUE_PRIORITY) {
		const value = i18nValue[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
}

function ensureDefaultValue(target: IDataObject | undefined): IDataObject | undefined {
	if (!target || !isPlainObject(target)) {
		return target;
	}

	const i18nValue = target.i18n_value;
	if (!isPlainObject(i18nValue)) {
		return target;
	}

	const currentDefault = target.default_value;
	const hasDefault =
		typeof currentDefault === 'string' ? currentDefault.trim() !== '' : currentDefault != null;

	if (hasDefault) {
		return target;
	}

	const autoDefault = pickDefaultValueFromI18n(i18nValue);
	if (!autoDefault) {
		return target;
	}

	return {
		...target,
		default_value: autoDefault,
	};
}

function autofillEmployeeDefaultValues(employee: IDataObject): IDataObject {
	const result: IDataObject = { ...employee };

	if (isPlainObject(result.name)) {
		const nameObject: IDataObject = { ...(result.name as IDataObject) };
		if (isPlainObject(nameObject.name)) {
			nameObject.name = ensureDefaultValue(nameObject.name as IDataObject);
		}
		result.name = nameObject;
	}

	if (isPlainObject(result.work_station)) {
		result.work_station = ensureDefaultValue(result.work_station as IDataObject);
	}

	return result;
}

function buildEmployeeFromUpdateFields(updateFields: IDataObject): IDataObject {
	const employee: IDataObject = {};

	const name = updateFields.name as string | undefined;
	const anotherName = updateFields.another_name as string | undefined;
	const nameI18nValue =
		updateFields.name_i18n_value !== undefined
			? parseI18nValue(updateFields.name_i18n_value, '国际化姓名', 64)
			: undefined;

	if (name !== undefined || anotherName !== undefined || nameI18nValue !== undefined) {
		const nameObject: IDataObject = {};
		if (name !== undefined || nameI18nValue !== undefined) {
			const nameValue: IDataObject = {};
			if (name !== undefined) {
				nameValue.default_value = name;
			}
			if (nameI18nValue !== undefined) {
				nameValue.i18n_value = nameI18nValue;
			}
			nameObject.name = nameValue;
		}
		if (anotherName !== undefined) {
			nameObject.another_name = anotherName;
		}
		employee.name = nameObject;
	}

	const scalarFields = [
		'mobile',
		'custom_employee_id',
		'avatar_key',
		'background_image_key',
		'email',
		'enterprise_email',
		'description',
		'leader_id',
		'work_country_or_region',
		'work_place_id',
		'job_number',
		'extension_number',
		'join_date',
		'job_title_id',
		'job_level_id',
		'job_family_id',
		'resign_date',
		'resign_remark',
	] as const;

	for (const field of scalarFields) {
		if (updateFields[field] !== undefined) {
			employee[field] = updateFields[field];
		}
	}

	if (updateFields.gender !== undefined && updateFields.gender !== '') {
		employee.gender = Number(updateFields.gender);
	}

	if (updateFields.employment_type !== undefined && updateFields.employment_type !== '') {
		employee.employment_type = Number(updateFields.employment_type);
	}

	if (updateFields.resign_reason !== undefined && updateFields.resign_reason !== '') {
		employee.resign_reason = String(updateFields.resign_reason);
	}

	if (updateFields.resign_type !== undefined && updateFields.resign_type !== '') {
		employee.resign_type = String(updateFields.resign_type);
	}

	if (updateFields.is_frozen !== undefined) {
		employee.is_frozen = updateFields.is_frozen;
	}

	if (updateFields.dotted_line_leader_ids !== undefined) {
		employee.dotted_line_leader_ids = NodeUtils.parseStringList(
			updateFields.dotted_line_leader_ids,
			'虚线上级 ID',
		);
	}

	const workStation = updateFields.work_station as string | undefined;
	const workStationI18nValue =
		updateFields.work_station_i18n_value !== undefined
			? parseI18nValue(updateFields.work_station_i18n_value, '国际化工位')
			: undefined;

	if (workStation !== undefined || workStationI18nValue !== undefined) {
		const workStationObject: IDataObject = {};
		if (workStation !== undefined) {
			workStationObject.default_value = workStation;
		}
		if (workStationI18nValue !== undefined) {
			workStationObject.i18n_value = workStationI18nValue;
		}
		employee.work_station = workStationObject;
	}

	return employee;
}

const EmployeeUpdateOperate: ResourceOperations = {
	name: '更新员工信息',
	value: 'directory:employee:update',
	order: 10,
	options: [
		{
			displayName:
				'该接口仅支持企业自建应用。未添加的字段不会更新。参考：https://open.feishu.cn/document/directory-v1/employee/patch',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: '员工 ID',
			name: 'employee_id',
			type: 'string',
			required: true,
			default: '',
			description: '员工 ID，与员工 ID 类型保持一致。',
		},
		employeeIdTypeOption,
		directoryDepartmentIdTypeOption,
		{
			displayName: 'Update Fields',
			name: 'update_fields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			description:
				'需要更新的字段。仅在此处添加的字段会被更新：未添加 = 不修改；添加并留空 = 清空该字段；添加并填值 = 更新为该值。',
			options: [
				{
					displayName: '姓名',
					name: 'name',
					type: 'string',
					default: '',
					description:
						'员工的姓名（default_value），最多 64 字符。未填写时，会按 zh_cn、en_us、ja_jp 的顺序，取「国际化姓名」中第一个非空值。',
				},
				{
					displayName: '国际化姓名',
					name: 'name_i18n_value',
					type: 'json',
					default: I18N_VALUE_TEMPLATE,
					description:
						'员工姓名的多语言值，仅支持 zh_cn、ja_jp、en_us，每项最多 64 字符，空值会被忽略。',
				},
				{
					displayName: '别名',
					name: 'another_name',
					type: 'string',
					default: '',
					description: '别名，最多 64 字符。',
				},
				{
					displayName: '手机号',
					name: 'mobile',
					type: 'string',
					default: '',
					description:
						'员工的手机号。国际电话区号前缀必须包含加号 +，例如 +8613011111111。',
				},
				{
					displayName: '自定义员工 ID',
					name: 'custom_employee_id',
					type: 'string',
					default: '',
					description:
						'企业内在职员工的唯一标识。修改后可能导致引用该 ID 的业务受影响，请谨慎操作。',
				},
				{
					displayName: '头像 Key',
					name: 'avatar_key',
					type: 'string',
					default: '',
					description: '员工头像 key，可通过上传图片接口获取（图片类型选择用于设置头像）。',
				},
				{
					displayName: '背景图 Key',
					name: 'background_image_key',
					type: 'string',
					default: '',
					description: '背景图 key，可通过上传图片接口获取（图片类型选择用于发送消息）。',
				},
				{
					displayName: '工作邮箱',
					name: 'email',
					type: 'string',
					default: '',
					placeholder: 'name@email.com',
					description: '员工在工作中的邮箱。企业内在职员工中不可重复。',
				},
				{
					displayName: '企业邮箱',
					name: 'enterprise_email',
					type: 'string',
					default: '',
					placeholder: 'name@email.com',
					description: '员工的企业邮箱。需先在管理后台启用飞书邮箱服务。',
				},
				{
					displayName: '个性签名',
					name: 'description',
					type: 'string',
					default: '',
					description: '员工的个性签名。',
				},
				{
					displayName: '性别',
					name: 'gender',
					type: 'options',
					options: [
						{ name: '未知', value: '0' },
						{ name: '男', value: '1' },
						{ name: '女', value: '2' },
						{ name: '其他', value: '3' },
					],
					default: '0',
					description: '性别。',
				},
				{
					displayName: '直属上级 ID',
					name: 'leader_id',
					type: 'string',
					default: '',
					description: '员工的直属上级 ID，与员工 ID 类型保持一致。上级需为在职员工，且不可成环。',
				},
				{
					displayName: '虚线上级 ID',
					name: 'dotted_line_leader_ids',
					type: 'string',
					default: '',
					description:
						'虚线上级 ID 列表，支持逗号分隔或 JSON 数组，最多 10 个。与员工 ID 类型保持一致。',
				},
				{
					displayName: '工作地国家/地区码',
					name: 'work_country_or_region',
					type: 'string',
					default: '',
					description: '工作地国家/地区码。可通过分页批量查询国家/地区接口获取。',
				},
				{
					displayName: '工作地点 ID',
					name: 'work_place_id',
					type: 'string',
					default: '',
					description: '工作地点 ID。',
				},
				{
					displayName: '工位',
					name: 'work_station',
					type: 'string',
					default: '',
					description:
						'工位（default_value）。未填写时，会按 zh_cn、en_us、ja_jp 的顺序，取「国际化工位」中第一个非空值。',
				},
				{
					displayName: '国际化工位',
					name: 'work_station_i18n_value',
					type: 'json',
					default: I18N_VALUE_TEMPLATE,
					description: '工位的多语言值，仅支持 zh_cn、ja_jp、en_us，空值会被忽略。',
				},
				{
					displayName: '工号',
					name: 'job_number',
					type: 'string',
					default: '',
					description: '工号。企业内在职员工的工号不可重复。',
				},
				{
					displayName: '分机号',
					name: 'extension_number',
					type: 'string',
					default: '',
					description: '分机号，最多 99 字符。企业内所有员工的分机号不可重复。',
				},
				{
					displayName: '入职日期',
					name: 'join_date',
					type: 'string',
					default: '',
					description: '入职日期，固定格式 YYYY-MM-DD。',
				},
				{
					displayName: '员工类型',
					name: 'employment_type',
					type: 'options',
					options: [
						{ name: '未知', value: '0' },
						{ name: '全职', value: '1' },
						{ name: '实习', value: '2' },
						{ name: '外包', value: '3' },
						{ name: '劳务', value: '4' },
						{ name: '顾问', value: '5' },
					],
					default: '1',
					description: '员工类型。',
				},
				{
					displayName: '职务 ID',
					name: 'job_title_id',
					type: 'string',
					default: '',
					description: '职务 ID。',
				},
				{
					displayName: '职级 ID',
					name: 'job_level_id',
					type: 'string',
					default: '',
					description: '职级 ID。',
				},
				{
					displayName: '序列 ID',
					name: 'job_family_id',
					type: 'string',
					default: '',
					description: '序列 ID。',
				},
				{
					displayName: '离职日期',
					name: 'resign_date',
					type: 'string',
					default: '',
					description: '离职日期，固定格式 YYYY-MM-DD。',
				},
				{
					displayName: '离职原因',
					name: 'resign_reason',
					type: 'options',
					options: [
						{ name: '置空', value: '0' },
						{ name: '薪酬不符合预期', value: '1' },
						{ name: '工作时间过长', value: '2' },
						{ name: '不满意工作内容', value: '3' },
						{ name: '不认可上级或管理层', value: '4' },
						{ name: '职业发展机会有限', value: '5' },
						{ name: '对公司文化缺乏认同', value: '6' },
						{ name: '组织架构调整（主动离职）', value: '7' },
						{ name: '合同到期', value: '8' },
						{ name: '跳槽', value: '9' },
						{ name: '转行', value: '10' },
						{ name: '家庭原因', value: '11' },
						{ name: '健康状况不佳', value: '12' },
						{ name: '工作地点原因', value: '13' },
						{ name: '其他(主动离职)', value: '14' },
						{ name: '意外', value: '15' },
						{ name: '身故', value: '16' },
						{ name: '解雇', value: '17' },
						{ name: '试用期不通过', value: '18' },
						{ name: '工作表现不佳', value: '19' },
						{ name: '工作产出低', value: '20' },
						{ name: '组织架构调整（被动离职）', value: '21' },
						{ name: '违纪', value: '22' },
						{ name: '违法', value: '23' },
						{ name: '其他（被动离职）', value: '24' },
						{ name: '其他（其他）', value: '25' },
					],
					default: '0',
					description: '离职原因。',
				},
				{
					displayName: '离职备注',
					name: 'resign_remark',
					type: 'string',
					default: '',
					description: '离职备注信息，最多 255 字符。',
				},
				{
					displayName: '离职类型',
					name: 'resign_type',
					type: 'options',
					options: [
						{ name: '置空', value: '0' },
						{ name: '主动', value: '1' },
						{ name: '被动', value: '2' },
						{ name: '其他', value: '3' },
					],
					default: '0',
					description: '离职类型。',
				},
				{
					displayName: '冻结账号',
					name: 'is_frozen',
					type: 'boolean',
					default: false,
					description: 'Whether to freeze the employee account. True freezes, false restores.',
				},
			],
		},
		{
			displayName: '其他请求体参数',
			name: 'body',
			type: 'json',
			default: '{}',
			description:
				'其他请求体参数，作为 employee 对象的基础部分（如 employee_order_in_departments、custom_field_values）。可直接粘贴 { "employee": {...} }，会自动去掉外层。与 Update Fields 同名字段时以 Update Fields 为准。',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				{
					displayName: 'UAT 鉴权身份',
					name: 'user_auth_type',
					type: 'options',
					options: [
						{ name: '普通员工', value: 'user' },
						{ name: '管理员身份', value: 'admin_user' },
					],
					default: 'admin_user',
					description: 'UAT 鉴权身份，默认管理员。仅使用用户授权凭证时生效。',
				},
				batchingOption,
				timeoutOption,
			],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const employeeId = this.getNodeParameter('employee_id', index) as string;
		const employeeIdType = this.getNodeParameter('employee_id_type', index, 'open_id') as string;
		const departmentIdType = this.getNodeParameter(
			'department_id_type',
			index,
			'open_department_id',
		) as string;
		const updateFields = this.getNodeParameter('update_fields', index, {}) as IDataObject;
		const bodyInput = NodeUtils.getNodeJsonData(this, 'body', index, {}) as IDataObject;
		const options = this.getNodeParameter('options', index, {}) as {
			user_auth_type?: string;
			timeout?: number;
		};

		let baseEmployee: IDataObject = {};
		if (isPlainObject(bodyInput.employee)) {
			baseEmployee = bodyInput.employee as IDataObject;
		} else if (Object.keys(bodyInput).length > 0) {
			baseEmployee = bodyInput;
		}

		let employee: IDataObject;
		try {
			const updateEmployee = buildEmployeeFromUpdateFields(updateFields);
			employee = autofillEmployeeDefaultValues(deepMerge(baseEmployee, updateEmployee));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new NodeOperationError(this.getNode(), message, { itemIndex: index });
		}

		if (Object.keys(employee).length === 0) {
			throw new NodeOperationError(this.getNode(), '请至少添加一个需要更新的字段', {
				itemIndex: index,
			});
		}

		const qs: IDataObject = {
			employee_id_type: employeeIdType,
			department_id_type: departmentIdType,
		};

		if (options.user_auth_type) {
			qs.user_auth_type = options.user_auth_type;
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'PATCH' as IHttpRequestMethods,
			url: `/open-apis/directory/v1/employees/${encodeURIComponent(employeeId)}`,
			qs,
			body: { employee },
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default EmployeeUpdateOperate;
