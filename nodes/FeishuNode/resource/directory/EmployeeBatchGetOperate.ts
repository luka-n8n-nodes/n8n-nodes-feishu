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
	employeeRequiredFieldsOption,
} from '../../../help/utils/directoryProperties';

const EmployeeBatchGetOperate: ResourceOperations = {
	name: '批量获取员工信息',
	value: 'directory:employee:mget',
	order: 20,
	options: [
		{
			displayName: '员工 ID 列表',
			name: 'employee_ids',
			type: 'string',
			required: true,
			default: '',
			description:
				'员工 ID 列表，与员工 ID 类型保持一致。支持两种格式：1) 逗号分隔的字符串，如 "id1,id2,id3"；2) JSON 数组，如 ["id1","id2","id3"]。单次请求 1～100 个。',
		},
		employeeIdTypeOption,
		directoryDepartmentIdTypeOption,
		employeeRequiredFieldsOption,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [batchingOption, timeoutOption],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const employeeIdsInput = this.getNodeParameter('employee_ids', index);
		const employeeIdType = this.getNodeParameter('employee_id_type', index, 'open_id') as string;
		const departmentIdType = this.getNodeParameter(
			'department_id_type',
			index,
			'open_department_id',
		) as string;
		const requiredFields = this.getNodeParameter('required_fields', index, []) as string[];
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const employeeIds = NodeUtils.parseStringList(employeeIdsInput, '员工 ID 列表');

		if (employeeIds.length === 0) {
			throw new NodeOperationError(this.getNode(), '员工 ID 列表不能为空', {
				itemIndex: index,
			});
		}

		if (employeeIds.length > 100) {
			throw new NodeOperationError(this.getNode(), '单次请求最多 100 个员工 ID', {
				itemIndex: index,
			});
		}

		if (!requiredFields || requiredFields.length === 0) {
			throw new NodeOperationError(this.getNode(), '请至少选择一个查询字段', {
				itemIndex: index,
			});
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'POST' as IHttpRequestMethods,
			url: '/open-apis/directory/v1/employees/mget',
			qs: {
				employee_id_type: employeeIdType,
				department_id_type: departmentIdType,
			},
			body: {
				employee_ids: employeeIds,
				required_fields: requiredFields,
			},
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default EmployeeBatchGetOperate;
