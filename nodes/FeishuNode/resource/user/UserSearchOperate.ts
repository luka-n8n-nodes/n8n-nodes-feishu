import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { timeoutOption, paginationOptions } from '../../../help/utils/sharedOptions';

const UserSearchOperate: ResourceOperations = {
	name: '搜索用户',
	value: 'user:search',
	order: 60,
	options: [
		{
			displayName:
				'该接口仅支持通过用户授权凭证（user_access_token）方式调用，请确保已使用用户授权方式进行认证。搜索结果不包含外部组织用户及已离职用户。',
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
			description: '搜索关键词，接口通过传入的关键词搜索相匹配的用户名。',
		},
		paginationOptions.returnAll,
		paginationOptions.limit(200),
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [timeoutOption],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject[]> {
		const query = this.getNodeParameter('query', index) as string;
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 20) as number;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const fetchPage = async (pageToken: string | undefined, pageSize: number) => {
			const qs: IDataObject = {
				query,
				page_size: pageSize,
			};

			if (pageToken) {
				qs.page_token = pageToken;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: '/open-apis/search/v1/user',
				qs,
			};

			if (options.timeout) {
				requestOptions.timeout = options.timeout;
			}

			const response = await RequestUtils.request.call(this, requestOptions);

			const responseData = response as {
				users?: IDataObject[];
				page_token?: string;
				has_more?: boolean;
			};

			return {
				items: responseData.users || [],
				pageToken: responseData.page_token,
				hasMore: responseData.has_more || false,
			};
		};

		if (returnAll) {
			let allResults: IDataObject[] = [];
			let pageToken: string | undefined = undefined;
			const pageSize = 200;

			while (true) {
				const { items, pageToken: nextPageToken, hasMore } = await fetchPage(pageToken, pageSize);
				allResults = allResults.concat(items);

				if (!hasMore || !nextPageToken) {
					break;
				}

				pageToken = nextPageToken;
			}

			return allResults;
		} else {
			const { items } = await fetchPage(undefined, limit);
			return items;
		}
	},
};

export default UserSearchOperate;
