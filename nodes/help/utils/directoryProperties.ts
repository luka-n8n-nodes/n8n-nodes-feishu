import { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

/**
 * 组织架构员工 ID 类型
 */
export const employeeIdTypeOption: INodeProperties = {
	displayName: '员工 ID 类型',
	name: 'employee_id_type',
	type: 'options',
	options: [
		{
			name: 'Open ID',
			value: 'open_id',
			description: '标识一个用户在某个应用中的身份。同一个用户在不同应用中的 Open ID 不同',
		},
		{
			name: 'Union ID',
			value: 'union_id',
			description:
				'标识一个用户在某个应用开发商下的身份。同一用户在同一开发商下的应用中的 Union ID 是相同的',
		},
		{
			name: 'Employee ID',
			value: 'employee_id',
			description:
				'企业内在职员工的唯一标识。支持自定义，未自定义时系统自动生成。选择此项需开通 directory:employee.base.external_id:read 权限',
		},
	],
	default: 'open_id',
	description: '用户 ID 类型',
};

/**
 * 组织架构部门 ID 类型
 */
export const directoryDepartmentIdTypeOption: INodeProperties = {
	displayName: '部门 ID 类型',
	name: 'department_id_type',
	type: 'options',
	options: [
		{
			name: 'Open Department ID',
			value: 'open_department_id',
			description: '用来在具体某个应用中标识一个部门',
		},
		{
			name: 'Department ID',
			value: 'department_id',
			description: '用来标识租户内一个唯一的部门',
		},
	],
	default: 'open_department_id',
	description: '此次调用中使用的部门 ID 类型',
};

/**
 * 员工字段枚举（来自 directory-v1/field-enumeration）
 * 顺序与官方文档保持一致
 */
const employeeRequiredFieldOptions: INodePropertyOptions[] = [
	{
		name: '基础信息 · 全部字段',
		value: 'base_info.*',
		description: 'Field: base_info.*（通配符会获取全部字段，对接口性能有一定影响）',
	},
	{
		name: '基础信息 · 员工 ID',
		value: 'base_info.employee_id',
		description: 'Field: base_info.employee_id',
	},
	{
		name: '基础信息 · 姓名',
		value: 'base_info.name',
		description: 'Field: base_info.name',
	},
	{
		name: '基础信息 · 头像',
		value: 'base_info.avatar',
		description: 'Field: base_info.avatar',
	},
	{
		name: '基础信息 · 自定义背景图',
		value: 'base_info.background_image',
		description: 'Field: base_info.background_image',
	},
	{
		name: '基础信息 · 个性签名',
		value: 'base_info.description',
		description: 'Field: base_info.description',
	},
	{
		name: '基础信息 · 手机号',
		value: 'base_info.mobile',
		description: 'Field: base_info.mobile',
	},
	{
		name: '基础信息 · 工作邮箱',
		value: 'base_info.email',
		description: 'Field: base_info.email',
	},
	{
		name: '基础信息 · 企业邮箱',
		value: 'base_info.enterprise_email',
		description: 'Field: base_info.enterprise_email',
	},
	{
		name: '基础信息 · 企业邮箱别名',
		value: 'base_info.enterprise_email_alias',
		description: 'Field: base_info.enterprise_email_alias',
	},
	{
		name: '基础信息 · 性别',
		value: 'base_info.gender',
		description: 'Field: base_info.gender',
	},
	{
		name: '基础信息 · 部门内排序信息',
		value: 'base_info.employee_order_in_departments',
		description: 'Field: base_info.employee_order_in_departments',
	},
	{
		name: '基础信息 · 部门路径信息',
		value: 'base_info.department_path_infos',
		description: 'Field: base_info.department_path_infos',
	},
	{
		name: '基础信息 · 直属上级 ID',
		value: 'base_info.leader_id',
		description: 'Field: base_info.leader_id',
	},
	{
		name: '基础信息 · 虚线上级 ID',
		value: 'base_info.dotted_line_leader_ids',
		description: 'Field: base_info.dotted_line_leader_ids',
	},
	{
		name: '基础信息 · 账号活跃状态',
		value: 'base_info.active_status',
		description: 'Field: base_info.active_status',
	},
	{
		name: '基础信息 · 是否离职',
		value: 'base_info.is_resigned',
		description: 'Field: base_info.is_resigned',
	},
	{
		name: '基础信息 · 是否超级管理员',
		value: 'base_info.is_primary_admin',
		description: 'Field: base_info.is_primary_admin',
	},
	{
		name: '基础信息 · 是否普通管理员',
		value: 'base_info.is_admin',
		description: 'Field: base_info.is_admin',
	},
	{
		name: '基础信息 · 自定义字段',
		value: 'base_info.custom_field_values',
		description: 'Field: base_info.custom_field_values',
	},
	{
		name: '基础信息 · 离职时间',
		value: 'base_info.resign_time',
		description: 'Field: base_info.resign_time',
	},
	{
		name: '基础信息 · 数据来源',
		value: 'base_info.data_source',
		description: 'Field: base_info.data_source',
	},
	{
		name: '基础信息 · 数据驻留地',
		value: 'base_info.geo_name',
		description: 'Field: base_info.geo_name',
	},
	{
		name: '基础信息 · 席位 ID 列表',
		value: 'base_info.subscription_ids',
		description: 'Field: base_info.subscription_ids',
	},
	{
		name: '所属部门 · 全部字段',
		value: 'base_info.departments.*',
		description: 'Field: base_info.departments.*（通配符；仅返回 ID，详细信息需指定具体字段）',
	},
	{
		name: '所属部门 · 部门 ID',
		value: 'base_info.departments.department_id',
		description: 'Field: base_info.departments.department_id',
	},
	{
		name: '所属部门 · 部门名称',
		value: 'base_info.departments.name',
		description: 'Field: base_info.departments.name',
	},
	{
		name: '所属部门 · 父部门 ID',
		value: 'base_info.departments.parent_department_id',
		description: 'Field: base_info.departments.parent_department_id',
	},
	{
		name: '所属部门 · 部门负责人',
		value: 'base_info.departments.leaders',
		description: 'Field: base_info.departments.leaders',
	},
	{
		name: '所属部门 · 是否有子部门',
		value: 'base_info.departments.has_child',
		description: 'Field: base_info.departments.has_child',
	},
	{
		name: '所属部门 · 成员与子部门计数',
		value: 'base_info.departments.department_count',
		description: 'Field: base_info.departments.department_count',
	},
	{
		name: '所属部门 · 排序权重',
		value: 'base_info.departments.order_weight',
		description: 'Field: base_info.departments.order_weight',
	},
	{
		name: '所属部门 · 部门路径信息',
		value: 'base_info.departments.department_path_infos',
		description: 'Field: base_info.departments.department_path_infos',
	},
	{
		name: '所属部门 · 自定义字段',
		value: 'base_info.departments.custom_field_values',
		description: 'Field: base_info.departments.custom_field_values',
	},
	{
		name: '所属部门 · 数据来源',
		value: 'base_info.departments.data_source',
		description: 'Field: base_info.departments.data_source',
	},
	{
		name: '工作信息 · 全部字段',
		value: 'work_info.*',
		description: 'Field: work_info.*（通配符会获取全部字段，对接口性能有一定影响）',
	},
	{
		name: '工作信息 · 工作地国家/地区码',
		value: 'work_info.work_country_or_region',
		description: 'Field: work_info.work_country_or_region',
	},
	{
		name: '工作信息 · 工位',
		value: 'work_info.work_station',
		description: 'Field: work_info.work_station',
	},
	{
		name: '工作信息 · 工号',
		value: 'work_info.job_number',
		description: 'Field: work_info.job_number',
	},
	{
		name: '工作信息 · 分机号',
		value: 'work_info.extension_number',
		description: 'Field: work_info.extension_number',
	},
	{
		name: '工作信息 · 入职日期',
		value: 'work_info.join_date',
		description: 'Field: work_info.join_date',
	},
	{
		name: '工作信息 · 员工类型',
		value: 'work_info.employment_type',
		description: 'Field: work_info.employment_type',
	},
	{
		name: '工作信息 · 人事状态',
		value: 'work_info.staff_status',
		description: 'Field: work_info.staff_status',
	},
	{
		name: '工作信息 · 岗位信息',
		value: 'work_info.positions',
		description: 'Field: work_info.positions',
	},
	{
		name: '工作地点 · 全部字段',
		value: 'work_info.work_place.*',
		description: 'Field: work_info.work_place.*',
	},
	{
		name: '工作地点 · ID',
		value: 'work_info.work_place.place_id',
		description: 'Field: work_info.work_place.place_id',
	},
	{
		name: '工作地点 · 名称',
		value: 'work_info.work_place.place_name',
		description: 'Field: work_info.work_place.place_name',
	},
	{
		name: '工作地点 · 是否启用',
		value: 'work_info.work_place.is_enable',
		description: 'Field: work_info.work_place.is_enable',
	},
	{
		name: '工作地点 · 描述',
		value: 'work_info.work_place.description',
		description: 'Field: work_info.work_place.description',
	},
	{
		name: '职务 · 全部字段',
		value: 'work_info.job_title.*',
		description: 'Field: work_info.job_title.*',
	},
	{
		name: '职务 · ID',
		value: 'work_info.job_title.job_title_id',
		description: 'Field: work_info.job_title.job_title_id',
	},
	{
		name: '职务 · 名称',
		value: 'work_info.job_title.job_title_name',
		description: 'Field: work_info.job_title.job_title_name',
	},
	{
		name: '职务 · 是否启用',
		value: 'work_info.job_title.is_enable',
		description: 'Field: work_info.job_title.is_enable',
	},
	{
		name: '职务 · 描述',
		value: 'work_info.job_title.description',
		description: 'Field: work_info.job_title.description',
	},
	{
		name: '工作序列 · 全部字段',
		value: 'work_info.job_family.*',
		description: 'Field: work_info.job_family.*',
	},
	{
		name: '工作序列 · ID',
		value: 'work_info.job_family.job_family_id',
		description: 'Field: work_info.job_family.job_family_id',
	},
	{
		name: '工作序列 · 名称',
		value: 'work_info.job_family.job_family_name',
		description: 'Field: work_info.job_family.job_family_name',
	},
	{
		name: '工作序列 · 是否启用',
		value: 'work_info.job_family.is_enabled',
		description: 'Field: work_info.job_family.is_enabled',
	},
	{
		name: '工作序列 · 上级序列 ID',
		value: 'work_info.job_family.parent_job_family_id',
		description: 'Field: work_info.job_family.parent_job_family_id',
	},
	{
		name: '工作序列 · 描述',
		value: 'work_info.job_family.description',
		description: 'Field: work_info.job_family.description',
	},
];

/**
 * 需要查询的字段列表（required_fields）
 */
export const employeeRequiredFieldsOption: INodeProperties = {
	displayName: '查询字段',
	name: 'required_fields',
	type: 'multiOptions',
	required: true,
	options: employeeRequiredFieldOptions,
	default: ['base_info.employee_id', 'base_info.name'],
	description:
		'需要查询的字段列表。将按照传递的字段列表返回有权限的行、列数据。不传则不会返回任何字段。参考：https://open.feishu.cn/document/directory-v1/field-enumeration',
};
