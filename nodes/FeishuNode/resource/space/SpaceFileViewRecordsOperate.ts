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

const SpaceFileViewRecordsOperate: ResourceOperations = {
	name: '获取文件访问记录',
	value: 'space:fileViewRecords',
	order: 60,
	description:
		'获取文档、电子表格、多维表格等文件的历史访问记录，包括访问者的 ID、姓名、头像和最近访问时间。',
	options: [
		{
			displayName: '文件Token',
			name: 'file_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description: '文件 token',
		},
		{
			displayName: '文件类型',
			name: 'file_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{ name: '旧版文档', value: 'doc' },
				{ name: '新版文档', value: 'docx' },
				{ name: '电子表格', value: 'sheet' },
				{ name: '思维笔记', value: 'mindnote' },
				{ name: '多维表格', value: 'bitable' },
				{ name: '文件', value: 'file' },
				{ name: '知识库文档', value: 'wiki' },
			],
			required: true,
			default: 'docx',

		},
		{
			displayName: '访问者ID类型',
			name: 'viewer_id_type',
			type: 'options',
			options: [
				{ name: 'Open ID', value: 'open_id' },
				{ name: 'Union ID', value: 'union_id' },
				{ name: 'User ID', value: 'user_id' },
			],
			default: 'open_id',
			description: '返回的访问者 ID 的类型',
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
		const fileToken = this.getNodeParameter('file_token', index) as string;
		const fileType = this.getNodeParameter('file_type', index) as string;
		const viewerIdType = this.getNodeParameter('viewer_id_type', index, 'open_id') as string;
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 50) as number;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		const fetchPage = async (pageToken: string | undefined, pageSize: number) => {
			const qs: IDataObject = {
				page_size: pageSize,
				file_type: fileType,
				viewer_id_type: viewerIdType,
			};

			if (pageToken) {
				qs.page_token = pageToken;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: `/open-apis/drive/v1/files/${fileToken}/view_records`,
				qs,
			};

			if (options.timeout) {
				requestOptions.timeout = options.timeout;
			}

			const response = await RequestUtils.request.call(this, requestOptions);

			const responseData = response as {
				items?: IDataObject[];
				page_token?: string;
				has_more?: boolean;
			};

			return {
				items: responseData.items || [],
				pageToken: responseData.page_token,
				hasMore: responseData.has_more || false,
			};
		};

		if (returnAll) {
			let allResults: IDataObject[] = [];
			let pageToken: string | undefined = undefined;
			const pageSize = 50;

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

export default SpaceFileViewRecordsOperate;
