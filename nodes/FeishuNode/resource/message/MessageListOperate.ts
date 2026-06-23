import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { commonOptions, paginationOptions } from '../../../help/utils/sharedOptions';

const MessageListOperate: ResourceOperations = {
	name: '获取会话历史消息',
	value: 'message:list',
	order: 32,
	options: [
		{
			displayName: '容器类型',
			name: 'container_id_type',
			type: 'options',
			required: true,
			options: [
				{
					name: 'Chat',
					value: 'chat',
					description: '包含单聊（p2p）和群聊（group）',
				},
				{
					name: 'Thread',
					value: 'thread',
					description: '话题',
				},
			],
			default: 'chat',
			description:
				'容器类型。注意：对于普通对话群中的话题消息，通过 chat 容器类型仅能获取到话题的根消息，你需要将容器类型设置为 thread 获取话题回复中的所有消息。',
		},
		{
			displayName: '容器 ID',
			name: 'container_id',
			type: 'string',
			required: true,
			default: '',
			description: '容器 ID。ID 类型与 container_id_type 取值一致，例如 oc_234jsi43d3ssi993d43545f。',
		},
		{
			displayName: '起始时间',
			name: 'start_time',
			type: 'string',
			default: '',
			description: '待查询历史信息的起始时间，秒级时间戳。注意：thread 容器类型暂不支持获取指定时间范围内的消息。',
			displayOptions: {
				show: {
					container_id_type: ['chat'],
				},
			},
		},
		{
			displayName: '结束时间',
			name: 'end_time',
			type: 'string',
			default: '',
			description: '待查询历史信息的结束时间，秒级时间戳。注意：thread 容器类型暂不支持获取指定时间范围内的消息。',
			displayOptions: {
				show: {
					container_id_type: ['chat'],
				},
			},
		},
		{
			displayName: '排序方式',
			name: 'sort_type',
			type: 'options',
			options: [
				{
					name: 'By Create Time Asc',
					value: 'ByCreateTimeAsc',
					description: '按消息创建时间升序排列',
				},
				{
					name: 'By Create Time Desc',
					value: 'ByCreateTimeDesc',
					description: '按消息创建时间降序排列',
				},
			],
			default: 'ByCreateTimeAsc',
			description: '消息排序方式。注意：使用 page_token 分页请求时，排序方式均与第一次请求一致，不支持中途改换排序方式。',
		},
		paginationOptions.returnAll,
		paginationOptions.limit(50, 1, 20),
		commonOptions,
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject[]> {
		const container_id_type = this.getNodeParameter('container_id_type', index, 'chat') as string;
		const container_id = this.getNodeParameter('container_id', index) as string;
		const start_time = this.getNodeParameter('start_time', index, '') as string;
		const end_time = this.getNodeParameter('end_time', index, '') as string;
		const sort_type = this.getNodeParameter('sort_type', index, 'ByCreateTimeAsc') as string;
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 20) as number;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
		};

		// 统一的请求函数
		const fetchPage = async (pageToken: string | undefined, pageSize: number) => {
			const qs: IDataObject = {
				container_id_type,
				container_id,
				sort_type,
				page_size: pageSize,
			};

			if (start_time) {
				qs.start_time = start_time;
			}

			if (end_time) {
				qs.end_time = end_time;
			}

			if (pageToken) {
				qs.page_token = pageToken;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: '/open-apis/im/v1/messages',
				qs,
			};

			// 添加超时配置
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

		// 处理分页逻辑
		if (returnAll) {
			let allResults: IDataObject[] = [];
			let pageToken: string | undefined = undefined;
			const pageSize = 50; // 使用最大分页大小以减少请求次数

			while (true) {
				const { items, pageToken: nextPageToken, hasMore } = await fetchPage(pageToken, pageSize);
				allResults = allResults.concat(items);

				// 检查是否还有更多数据
				if (!hasMore || !nextPageToken) {
					break;
				}

				pageToken = nextPageToken;
			}

			return allResults;
		} else {
			// 单次请求，返回限制数量的数据
			const { items } = await fetchPage(undefined, limit);
			return items;
		}
	},
};

export default MessageListOperate;
