import { IDataObject, IExecuteFunctions, INodeProperties, IHttpRequestOptions } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const WikiSpacesNodeUpdateTitleOperate: ResourceOperations = {
	name: '更新知识空间节点标题',
	value: 'wiki:spaces:node:updateTitle',
	order: 130,
	options: [
		{
			displayName: '知识空间ID',
			name: 'space_id',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: '节点Token',
			name: 'node_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: '新标题',
			name: 'title',
			type: 'string',
			required: true,
			default: '',
			description: '节点新标题',
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
		const spaceId = this.getNodeParameter('space_id', index) as string;
		const nodeToken = this.getNodeParameter('node_token', index) as string;
		const title = this.getNodeParameter('title', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};
		const body: IDataObject = { title };
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `/open-apis/wiki/v2/spaces/${spaceId}/nodes/${nodeToken}/update_title`,
			body,
		};
		if (options.timeout) requestOptions.timeout = options.timeout;

		return RequestUtils.request.call(this, requestOptions);
	},
};

export default WikiSpacesNodeUpdateTitleOperate;
