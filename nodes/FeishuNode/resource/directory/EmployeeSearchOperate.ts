import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
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

const EmployeeSearchOperate: ResourceOperations = {
	name: '搜索员工信息',
	value: 'directory:employee:search',
	order: 40,
	options: [
		{
			displayName: '该接口无法搜索外部企业员工和已离职员工。',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: '搜索关键词',
			name: 'query',
			type: 'string',
			required: true,
			default: '',
			description:
				'搜索关键词。支持员工 ID、员工名称、员工手机号、员工邮箱。其中员工 ID、手机号支持精确搜索，姓名、邮箱支持模糊搜索，姓名支持国际化名称搜索。',
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
		const query = this.getNodeParameter('query', index) as string;
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

		if (!requiredFields || requiredFields.length === 0) {
			throw new NodeOperationError(this.getNode(), '请至少选择一个查询字段', {
				itemIndex: index,
			});
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
				url: '/open-apis/directory/v1/employees/search',
				qs: {
					employee_id_type: employeeIdType,
					department_id_type: departmentIdType,
				},
				body: {
					query,
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

export default EmployeeSearchOperate;
