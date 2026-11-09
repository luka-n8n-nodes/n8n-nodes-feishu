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
import {
	batchingOption,
	paginationOptions,
	timeoutOption,
} from '../../../help/utils/sharedOptions';
import {
	directoryDepartmentIdTypeOption,
	employeeIdTypeOption,
	employeeRequiredFieldsOption,
} from '../../../help/utils/directoryProperties';

const INT_FILTER_FIELDS = new Set(['work_info.staff_status']);

/**
 * 将用户填写的原始值转成接口要求的转义 JSON 字符串。
 * 若用户已填入转义后的值，则规范化后返回。
 */
function encodeFilterValue(field: string, operator: string, rawValue: string): string {
	const trimmed = rawValue.trim();
	if (!trimmed) {
		throw new Error('筛选条件的值不能为空');
	}

	// 已是合法转义 JSON 字符串时直接规范化
	try {
		const parsed = JSON.parse(trimmed);
		if (operator === 'eq') {
			if (INT_FILTER_FIELDS.has(field)) {
				if (typeof parsed === 'number') {
					return String(parsed);
				}
				if (typeof parsed === 'string' && /^-?\d+$/.test(parsed)) {
					return parsed;
				}
			} else if (typeof parsed === 'string') {
				return JSON.stringify(parsed);
			}
		}

		if (operator === 'in' && Array.isArray(parsed)) {
			if (INT_FILTER_FIELDS.has(field)) {
				return JSON.stringify(parsed.map((item) => Number(item)));
			}
			return JSON.stringify(parsed.map((item) => String(item)));
		}
	} catch {
		// 非 JSON，按原始值处理
	}

	if (operator === 'eq') {
		if (INT_FILTER_FIELDS.has(field)) {
			if (!/^-?\d+$/.test(trimmed)) {
				throw new Error(`字段 ${field} 的值应为数字，当前为: ${trimmed}`);
			}
			return trimmed;
		}
		return JSON.stringify(trimmed);
	}

	// operator === 'in'
	const items = NodeUtils.parseStringList(trimmed, '筛选条件值');
	if (items.length === 0) {
		throw new Error('筛选条件的值不能为空');
	}

	if (INT_FILTER_FIELDS.has(field)) {
		const numbers = items.map((item) => {
			if (!/^-?\d+$/.test(item)) {
				throw new Error(`字段 ${field} 的值应为数字列表，当前包含: ${item}`);
			}
			return Number(item);
		});
		return JSON.stringify(numbers);
	}

	return JSON.stringify(items);
}

const EmployeeFilterOperate: ResourceOperations = {
	name: '批量获取员工列表',
	value: 'directory:employee:filter',
	order: 30,
	options: [
		{
			displayName:
				'筛选条件之间为「且」关系，最多 10 条。部门 ID 与人事状态需组合使用。参考：https://open.feishu.cn/document/directory-v1/filter-usage',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: '筛选条件',
			name: 'filter',
			placeholder: 'Add Condition',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			default: {},
			description: '比较表达式列表，多个表达式之间的关系为且。',
			options: [
				{
					displayName: 'Conditions',
					name: 'conditions',
					values: [
						{
							displayName: '字段',
							name: 'field',
							type: 'options',
							// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
							options: [
								{ name: '手机号', value: 'base_info.mobile' },
								{ name: '邮箱', value: 'base_info.email' },
								{ name: '工号', value: 'work_info.job_number' },
								{
									name: '部门 ID',
									value: 'base_info.departments.department_id',
									description: '需配合人事状态组合查询',
								},
								{
									name: '人事状态',
									value: 'work_info.staff_status',
									description:
										'数值类型。1 在职、2 离职、3 待入职、4 取消入职、5 待离职。需配合部门 ID 组合查询',
								},
							],
							default: 'base_info.mobile',
							description: '筛选条件的左值。',
						},
						{
							displayName: '操作符',
							name: 'operator',
							type: 'options',
							options: [
								{ name: '等于', value: 'eq' },
								{ name: '属于任一', value: 'in' },
							],
							default: 'eq',
							description: '比较操作符。',
						},
						{
							displayName: '值',
							name: 'value',
							type: 'string',
							default: '',
							description:
								'筛选条件的右值。填写原始值即可（多个用逗号分隔），节点会自动转义。人事状态请填数字，例如 1。',
						},
					],
				},
			],
		},
		employeeIdTypeOption,
		directoryDepartmentIdTypeOption,
		employeeRequiredFieldsOption,
		paginationOptions.returnAll,
		paginationOptions.limit(100, 1, 20),
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [batchingOption, timeoutOption],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject[]> {
		const filterCollection = this.getNodeParameter('filter', index, {}) as IDataObject;
		const employeeIdType = this.getNodeParameter('employee_id_type', index, 'open_id') as string;
		const departmentIdType = this.getNodeParameter(
			'department_id_type',
			index,
			'open_department_id',
		) as string;
		const requiredFields = this.getNodeParameter('required_fields', index, []) as string[];
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 20) as number;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const rawConditions = NodeUtils.getNodeFixedCollection(filterCollection, 'conditions');
		if (rawConditions.length > 10) {
			throw new NodeOperationError(this.getNode(), '筛选条件最多 10 条', {
				itemIndex: index,
			});
		}

		if (!requiredFields || requiredFields.length === 0) {
			throw new NodeOperationError(this.getNode(), '请至少选择一个查询字段', {
				itemIndex: index,
			});
		}

		let conditions: IDataObject[];
		try {
			conditions = rawConditions.map((item) => {
				const field = String(item.field || '');
				const operator = String(item.operator || 'eq');
				const value = encodeFilterValue(field, operator, String(item.value ?? ''));
				return { field, operator, value };
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new NodeOperationError(this.getNode(), message, { itemIndex: index });
		}

		const fetchPage = async (pageToken: string | undefined, pageSize: number) => {
			const pageRequest: IDataObject = {
				page_size: pageSize,
			};
			if (pageToken) {
				pageRequest.page_token = pageToken;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'POST' as IHttpRequestMethods,
				url: '/open-apis/directory/v1/employees/filter',
				qs: {
					employee_id_type: employeeIdType,
					department_id_type: departmentIdType,
				},
				body: {
					filter: { conditions },
					required_fields: requiredFields,
					page_request: pageRequest,
				},
			};

			if (options.timeout) {
				requestOptions.timeout = options.timeout;
			}

			const response = await RequestUtils.request.call(this, requestOptions);
			const responseData = response as {
				employees?: IDataObject[];
				page_response?: {
					has_more?: boolean;
					page_token?: string;
				};
			};

			return {
				items: responseData.employees || [],
				pageToken: responseData.page_response?.page_token,
				hasMore: responseData.page_response?.has_more || false,
			};
		};

		if (returnAll) {
			let allResults: IDataObject[] = [];
			let pageToken: string | undefined = undefined;
			const pageSize = 100;

			while (true) {
				const { items, pageToken: nextPageToken, hasMore } = await fetchPage(pageToken, pageSize);
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
	},
};

export default EmployeeFilterOperate;
