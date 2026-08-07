import { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { ResourceOperations } from '../../../help/type/IResource';
import BitableUrlUtils from '../../../help/utils/BitableUrlUtils';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

const BitableParseUrlOperate: ResourceOperations = {
	name: '解析多维表格地址',
	value: 'bitable:parseUrl',
	order: 10,
	options: [
		{
			displayName: '多维表格地址',
			name: 'url',
			type: 'string',
			default: '',
			required: true,
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
		const url = this.getNodeParameter('url', index, '') as string;
		const options = this.getNodeParameter('options', index, {}) as { timeout?: number };

		return {
			...(await BitableUrlUtils.parseBitableUrl(this, url, options.timeout)),
		};
	},
};

export default BitableParseUrlOperate;
