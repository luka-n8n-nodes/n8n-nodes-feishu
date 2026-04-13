import { IDataObject, IExecuteFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const SpaceCreateFolderOperate: ResourceOperations = {
	name: '新建文件夹',
	value: 'space:createFolder',
	order: 30,
	description:
		'在用户云空间指定文件夹中创建一个空文件夹。',
	options: [
		{
			displayName: '文件夹名称',
			name: 'name',
			type: 'string',
			required: true,
			default: '',
			description: '文件夹名称，长度限制 1~256 个字节',
		},
		{
			displayName: '父文件夹Token',
			name: 'folder_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description: '父文件夹的 token，参数为空字符串时，表示在根目录下创建文件夹',
		},
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
		const name = this.getNodeParameter('name', index) as string;
		const folderToken = this.getNodeParameter('folder_token', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const body: IDataObject = {
			name,
			folder_token: folderToken,
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: '/open-apis/drive/v1/files/create_folder',
			body,
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default SpaceCreateFolderOperate;
