import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	IHttpRequestMethods,
	IHttpRequestOptions,
	sleep,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { timeoutOption, paginationOptions, userIdTypeOption } from '../../../help/utils/sharedOptions';

class TokenBucketRateLimiter {
	private tokens: number;
	private readonly maxTokens: number;
	private readonly refillRatePerMs: number;
	private lastRefillTime: number;

	constructor(maxRequestsPerSecond: number) {
		this.maxTokens = maxRequestsPerSecond;
		this.tokens = maxRequestsPerSecond;
		this.refillRatePerMs = maxRequestsPerSecond / 1_000;
		this.lastRefillTime = Date.now();
	}

	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefillTime;
		this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
		this.lastRefillTime = now;
	}

	async acquire(): Promise<void> {
		this.refill();
		if (this.tokens < 1) {
			const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
			await sleep(waitMs);
			this.refill();
		}
		this.tokens -= 1;
	}
}

async function processWorkQueue<T>(
	initialItems: T[],
	concurrency: number,
	processor: (item: T) => Promise<T[]>,
): Promise<void> {
	const queue: T[] = [...initialItems];
	let nextIndex = 0;
	let activeTasks = 0;
	let waitingWorkers: Array<() => void> = [];

	const wakeAll = () => {
		waitingWorkers.splice(0).forEach((resolve) => resolve());
	};

	const waitForChange = () =>
		new Promise<void>((resolve) => {
			waitingWorkers.push(resolve);
		});

	async function worker(): Promise<void> {
		while (true) {
			if (nextIndex < queue.length) {
				const idx = nextIndex++;
				activeTasks++;
				const newItems = await processor(queue[idx]);
				if (newItems.length > 0) {
					queue.push(...newItems);
				}
				activeTasks--;
				wakeAll();
			} else if (activeTasks > 0) {
				await waitForChange();
			} else {
				break;
			}
		}
	}

	const workers = Array(Math.min(concurrency, Math.max(queue.length, 1)))
		.fill(null)
		.map(() => worker());

	await Promise.all(workers);
}

const SpaceFileListOperate: ResourceOperations = {
	name: '获取文件夹中的文件清单',
	value: 'space:fileList',
	order: 10,
	description:
		'获取用户云空间中指定文件夹下的文件清单。当 folder_token 为空时，获取根目录下的清单。',
	options: [
		{
			displayName: '文件夹Token',
			name: 'folder_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			default: '',
			description:
				'文件夹的 token。不填写或填空字符串，将获取用户云空间根目录下的清单，且不支持分页。',
		},
		{
			displayName: '文件类型过滤',
			name: 'type_filter',
		type: 'options',
		// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
		options: [
			{ name: '全部', value: 'all' },
			{ name: '电子表格', value: 'sheet' },
			{ name: '多维表格', value: 'bitable' },
			{ name: '旧版文档', value: 'doc' },
			{ name: '新版文档', value: 'docx' },
			{ name: '思维导图', value: 'mindnote' },
			{ name: '文件', value: 'file' },
			{ name: '文件夹', value: 'folder' },
			{ name: '快捷方式', value: 'shortcut' },
		],
		default: 'all',
		description: '按文件类型过滤结果',
		},
		{
			displayName: '排序方式',
			name: 'order_by',
			type: 'options',
			options: [
				{ name: '按编辑时间排序', value: 'EditedTime' },
				{ name: '按创建时间排序', value: 'CreatedTime' },
			],
			default: 'EditedTime',
		},
		{
			displayName: '排序规则',
			name: 'direction',
			type: 'options',
			options: [
				{ name: '升序', value: 'ASC' },
				{ name: '降序', value: 'DESC' },
			],
			default: 'DESC',
			description: '排序规则，与 order_by 配合使用',
		},
		userIdTypeOption,
		paginationOptions.returnAll,
		paginationOptions.limit(200),
		{
			displayName: '递归获取所有子文件夹',
			name: 'recursive',
			type: 'boolean',
			default: false,
			description: 'Whether to recursively fetch files in all sub-folders',
		},
		{
			displayName: '递归层级',
			name: 'recursiveDepth',
			type: 'number',
			default: 2,
			typeOptions: {
				minValue: 0,
			},
			displayOptions: {
				show: {
					recursive: [true],
				},
			},
			description: '递归获取的层级深度，0表示递归获取所有层级',
		},
		{
			displayName: '数据结构',
			name: 'dataStructure',
			type: 'options',
			options: [
				{ name: '扁平化数据结构', value: 'flat' },
				{ name: '树形数据结构', value: 'tree' },
			],
			default: 'flat',
			displayOptions: {
				show: {
					recursive: [true],
				},
			},
			description: '返回数据的结构类型',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				{
					displayName: '递归并发数',
					name: 'recursiveConcurrency',
					type: 'number',
					default: 5,
					typeOptions: {
						minValue: 1,
						maxValue: 10,
					},
					description:
						'递归获取子文件夹时的最大并发请求数。配合频率限制自动调度，默认5并发可有效利用频控。',
				},
				{
					displayName: '频率限制（次/秒）',
					name: 'rateLimit',
					type: 'number',
					default: 5,
					typeOptions: {
						minValue: 1,
					},
					description:
						'接口频率限制，默认5次/秒（接口上限20次/秒）。Token Bucket 算法会自动最大化利用该频控。',
				},
				timeoutOption,
			],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject[]> {
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = this.getNodeParameter('limit', index, 50) as number;
		const folderToken = this.getNodeParameter('folder_token', index, '') as string;
		const orderBy = this.getNodeParameter('order_by', index, 'EditedTime') as string;
		const direction = this.getNodeParameter('direction', index, 'DESC') as string;
		const userIdType = this.getNodeParameter('user_id_type', index, 'open_id') as string;
		const typeFilter = this.getNodeParameter('type_filter', index, 'all') as string;
		const options = this.getNodeParameter('options', index, {}) as {
			timeout?: number;
			recursiveConcurrency?: number;
			rateLimit?: number;
		};
		const recursive = this.getNodeParameter('recursive', index, false) as boolean;

		let rateLimiter: TokenBucketRateLimiter | undefined;
		if (recursive) {
			const rateLimit = options.rateLimit ?? 5;
			rateLimiter = new TokenBucketRateLimiter(rateLimit);
		}

		const fetchAllFiles = async (
			targetFolderToken: string,
			limiter?: TokenBucketRateLimiter,
		): Promise<IDataObject[]> => {
			let allItems: IDataObject[] = [];
			let pageToken: string | undefined = undefined;

			while (true) {
				if (limiter) await limiter.acquire();

				const qs: IDataObject = {
					page_size: 200,
					order_by: orderBy,
					direction,
					user_id_type: userIdType,
				};

				if (targetFolderToken) {
					qs.folder_token = targetFolderToken;
				}

				if (pageToken) {
					qs.page_token = pageToken;
				}

				const requestOptions: IHttpRequestOptions = {
					method: 'GET' as IHttpRequestMethods,
					url: '/open-apis/drive/v1/files',
					qs,
				};

				if (options.timeout) {
					requestOptions.timeout = options.timeout;
				}

				const response = await RequestUtils.request.call(this, requestOptions);

				const responseData = response as {
					files?: IDataObject[];
					next_page_token?: string;
					has_more?: boolean;
				};

				allItems = allItems.concat(responseData.files || []);

				if (!responseData.has_more || !responseData.next_page_token) {
					break;
				}

				pageToken = responseData.next_page_token;
			}

			return allItems;
		};

		const fetchPage = async (pageToken: string | undefined, pageSize: number) => {
			const qs: IDataObject = {
				page_size: pageSize,
				order_by: orderBy,
				direction,
				user_id_type: userIdType,
			};

			if (folderToken) {
				qs.folder_token = folderToken;
			}

			if (pageToken) {
				qs.page_token = pageToken;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: '/open-apis/drive/v1/files',
				qs,
			};

			if (options.timeout) {
				requestOptions.timeout = options.timeout;
			}

			const response = await RequestUtils.request.call(this, requestOptions);

			const responseData = response as {
				files?: IDataObject[];
				next_page_token?: string;
				has_more?: boolean;
			};

			return {
				items: responseData.files || [],
				pageToken: responseData.next_page_token,
				hasMore: responseData.has_more || false,
			};
		};

		const applyTypeFilter = (items: IDataObject[]): IDataObject[] => {
			if (typeFilter === 'all') return items;
			return items.filter((item) => item.type === typeFilter);
		};

		const fetchRecursiveFlat = async (
			initialItems: IDataObject[],
			recursiveDepth: number,
			concurrency: number,
			limiter: TokenBucketRateLimiter,
		): Promise<IDataObject[]> => {
			const results: IDataObject[] = [];

			type Task = { item: IDataObject; path: string[]; depth: number };
			const seed: Task[] = initialItems.map((item) => ({
				item,
				path: [item.name as string],
				depth: 1,
			}));

			await processWorkQueue<Task>(seed, concurrency, async ({ item, path, depth }) => {
				results.push({ ...item, breadcrumbItems: path });

				if (
					item.type === 'folder' &&
					(recursiveDepth === 0 || depth < recursiveDepth)
				) {
					const children = await fetchAllFiles(item.token as string, limiter);
					return children.map((child) => ({
						item: child,
						path: [...path, child.name as string],
						depth: depth + 1,
					}));
				}
				return [];
			});

			return results;
		};

		const fetchRecursiveTree = async (
			initialItems: IDataObject[],
			recursiveDepth: number,
			concurrency: number,
			limiter: TokenBucketRateLimiter,
		): Promise<IDataObject[]> => {
			type TreeNode = IDataObject & { children?: TreeNode[] };
			type Task = { node: TreeNode; path: string[]; depth: number };

			const rootNodes: TreeNode[] = initialItems.map((item) => ({
				...item,
				breadcrumbItems: [item.name as string],
				children: [],
			}));

			const seed: Task[] = rootNodes.map((node) => ({
				node,
				path: [node.name as string],
				depth: 1,
			}));

			await processWorkQueue<Task>(seed, concurrency, async ({ node, path, depth }) => {
				if (
					node.type === 'folder' &&
					(recursiveDepth === 0 || depth < recursiveDepth)
				) {
					const children = await fetchAllFiles(node.token as string, limiter);
					const childNodes: TreeNode[] = children.map((child) => ({
						...child,
						breadcrumbItems: [...path, child.name as string],
						children: [],
					}));
					node.children = childNodes;
					return childNodes.map((cn) => ({
						node: cn,
						path: [...path, cn.name as string],
						depth: depth + 1,
					}));
				}
				return [];
			});

			return rootNodes;
		};

		if (returnAll) {
			const initialItems = await fetchAllFiles(folderToken, rateLimiter);

			if (!recursive) {
				return applyTypeFilter(initialItems);
			}

			const recursiveDepth = this.getNodeParameter('recursiveDepth', index, 2) as number;
			const dataStructure = this.getNodeParameter('dataStructure', index, 'flat') as string;
			const concurrency = options.recursiveConcurrency ?? 5;

			if (dataStructure === 'flat') {
				const results = await fetchRecursiveFlat(
					initialItems,
					recursiveDepth,
					concurrency,
					rateLimiter!,
				);
				return applyTypeFilter(results);
			} else {
				return await fetchRecursiveTree(
					initialItems,
					recursiveDepth,
					concurrency,
					rateLimiter!,
				);
			}
		} else {
			const { items } = await fetchPage(undefined, limit);

			if (!recursive) {
				return applyTypeFilter(items);
			}

			const recursiveDepth = this.getNodeParameter('recursiveDepth', index, 2) as number;
			const dataStructure = this.getNodeParameter('dataStructure', index, 'flat') as string;
			const concurrency = options.recursiveConcurrency ?? 5;

			if (dataStructure === 'flat') {
				const results = await fetchRecursiveFlat(
					items,
					recursiveDepth,
					concurrency,
					rateLimiter!,
				);
				return applyTypeFilter(results);
			} else {
				return await fetchRecursiveTree(items, recursiveDepth, concurrency, rateLimiter!);
			}
		}
	},
};

export default SpaceFileListOperate;
