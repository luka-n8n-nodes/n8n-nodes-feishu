import { IDataObject, IExecuteFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const SpaceRootFolderMetaOperate: ResourceOperations = {
	name: '获取我的空间（根文件夹）元数据',
	value: 'space:rootFolderMeta',
	order: 1,
	description:
		'获取我的空间（根文件夹）的元数据，包括文件夹的 ID、名称等信息。',
	options: [
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
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: '/open-apis/drive/explorer/v2/root_folder/meta',
		};

		if (options.timeout) {
			requestOptions.timeout = options.timeout;
		}

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default SpaceRootFolderMetaOperate;
