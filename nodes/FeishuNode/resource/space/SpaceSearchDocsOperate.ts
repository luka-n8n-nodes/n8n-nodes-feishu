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

const SpaceSearchDocsOperate: ResourceOperations = {
	name: '搜索云文档',
	value: 'space:searchDocs',
	order: 70,
	description:
		'根据搜索关键词对当前用户可见的云文档进行搜索。',
	options: [
		{
			displayName: '该接口仅支持通过用户授权凭证（user_access_token）方式调用，请确保已使用用户授权方式进行认证。',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: '搜索关键词',
			name: 'search_key',
			type: 'string',
			required: true,
			default: '',
			description: '指定搜索的关键字',
		},
		{
			displayName: '文件类型过滤',
			name: 'docs_types',
			type: 'multiOptions',
			options: [
				{ name: '电子表格 (Sheet)', value: 'sheet' },
				{ name: '多维表格 (Bitable)', value: 'bitable' },
				{ name: '幻灯片 (Slides)', value: 'slides' },
				{ name: '思维笔记 (Mindnote)', value: 'mindnote' },
				{ name: '文档 (Doc/docx)', value: 'doc' },
				{ name: '文件 (File)', value: 'file' },
			],
			default: [],
			description: '按文件类型过滤结果，不选则返回所有类型',
		},
		{
			displayName: '文件所有者 Open ID',
			name: 'owner_ids',
			type: 'string',
			default: '',
			description: '文件所有者的 Open ID，多个用逗号分隔',
		},
		{
			displayName: '文件所在群 ID',
			name: 'chat_ids',
			type: 'string',
			default: '',
			description: '文件所在群的 ID，多个用逗号分隔',
		},
		paginationOptions.returnAll,
		paginationOptions.limit(50),
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
		const searchKey = this.getNodeParameter('search_key', index) as string;
		const docsTypes = this.getNodeParameter('docs_types', index, []) as string[];
		const ownerIdsRaw = this.getNodeParameter('owner_ids', index, '') as string;
		const chatIdsRaw = this.getNodeParameter('chat_ids', index, '') as string;
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 50) as number;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const ownerIds = ownerIdsRaw
			? ownerIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)
			: undefined;
		const chatIds = chatIdsRaw
			? chatIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)
			: undefined;

		const fetchPage = async (offset: number, count: number) => {
			const body: IDataObject = {
				search_key: searchKey,
				count,
				offset,
			};

			if (ownerIds && ownerIds.length > 0) {
				body.owner_ids = ownerIds;
			}

			if (chatIds && chatIds.length > 0) {
				body.chat_ids = chatIds;
			}

			if (docsTypes.length > 0) {
				body.docs_types = docsTypes;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'POST' as IHttpRequestMethods,
				url: '/open-apis/suite/docs-api/search/object',
				body,
			};

			if (options.timeout) {
				requestOptions.timeout = options.timeout;
			}

			const response = await RequestUtils.request.call(this, requestOptions);

			const responseData = response as {
				docs_entities?: IDataObject[];
				has_more?: boolean;
				total?: number;
			};

			return {
				items: responseData.docs_entities || [],
				hasMore: responseData.has_more || false,
				total: responseData.total || 0,
			};
		};

		if (returnAll) {
			let allResults: IDataObject[] = [];
			let offset = 0;
			const pageSize = 50;

			while (true) {
				const { items, hasMore } = await fetchPage(offset, pageSize);
				allResults = allResults.concat(items);

				if (!hasMore || items.length === 0) {
					break;
				}

				offset += items.length;
			}

			return allResults;
		} else {
			const count = Math.min(limit, 50);
			const { items } = await fetchPage(0, count);
			return items;
		}
	},
};

export default SpaceSearchDocsOperate;
