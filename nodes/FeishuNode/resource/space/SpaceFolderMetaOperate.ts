import { IDataObject, IExecuteFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const SpaceFolderMetaOperate: ResourceOperations = {
	name: '获取文件夹元数据',
	value: 'space:folderMeta',
	order: 20,
	description:
		'根据文件夹 token 获取该文件夹的元数据，包括文件夹的 ID、名称、创建者 ID 等。',
	options: [
		{
			displayName: '文件夹Token',
			name: 'folder_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description: '文件夹的 token',
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
		const folderToken = this.getNodeParameter('folder_token', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: `/open-apis/drive/explorer/v2/folder/${folderToken}/meta`,
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default SpaceFolderMetaOperate;
