import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	NodeOperationError,
	sleep,
} from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import { batchingOption, timeoutOption } from '../../../help/utils/sharedOptions';

// 导入任务状态枚举
const JOB_STATUS = {
	SUCCESS: 0,
	INITIALIZING: 1,
	PROCESSING: 2,
	INTERNAL_ERROR: 3,
	FILE_TOO_LARGE: 107,
	TIMEOUT: 108,
	NO_PERMISSION: 110,
	FILE_DELETED: 111,
	FILE_NOT_FOUND: 123,
} as const;

// 错误消息映射
const JOB_ERROR_MESSAGES: Record<number, string> = {
	[JOB_STATUS.INTERNAL_ERROR]: '内部错误',
	[JOB_STATUS.FILE_TOO_LARGE]: '导入文件过大',
	[JOB_STATUS.TIMEOUT]: '处理超时',
	[JOB_STATUS.NO_PERMISSION]: '无权限',
	[JOB_STATUS.FILE_DELETED]: '导入文件已删除',
	[JOB_STATUS.FILE_NOT_FOUND]: '导入文件不存在',
};

const SpaceImportOperate: ResourceOperations = {
	name: '导入文件',
	value: 'space:import',
	order: 110,
	description:
		'导入文件指将本地文件如 Word、TXT、Markdown、Excel 等格式的文件导入为某种格式的云文档，如在线文档、电子表格、多维表格等，并放置到云空间指定目录中。参考<a href="https://open.feishu.cn/document/server-docs/docs/drive-v1/import_task/import-user-guide">详细文档</a>',
	options: [
		{
			displayName:
				'导入文件指将本地文件如 Word、TXT、Markdown、Excel 等格式的文件导入为某种格式的云文档，如在线文档、电子表格、多维表格等，并放置到云空间指定目录中。<a target="_blank" href="https://open.feishu.cn/document/server-docs/docs/drive-v1/import_task/import-user-guide">详细文档</a>',
			name: 'importNotice',
			type: 'notice',
			default: '',
		},
		{
			displayName: '文件扩展名',
			name: 'file_extension',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{ name: 'Microsoft Word (DOCX) - 上限 600MB', value: 'docx' },
				{ name: 'Microsoft Word 97-2004 (DOC) - 上限 600MB', value: 'doc' },
				{ name: 'Microsoft Excel (XLSX) - 上限 800MB', value: 'xlsx' },
				{ name: 'Microsoft Excel 97-2003 (XLS) - 上限 20MB', value: 'xls' },
				{ name: 'CSV - 上限 20MB(Sheet)/100MB(Bitable)', value: 'csv' },
				{ name: 'Markdown (MD) - 上限 20MB', value: 'md' },
				{ name: 'Markdown (MARKDOWN) - 上限 20MB', value: 'markdown' },
				{ name: 'Markdown (MARK) - 上限 20MB', value: 'mark' },
				{ name: 'HTML - 上限 20MB', value: 'html' },
				{ name: '纯文本 (TXT) - 上限 20MB', value: 'txt' },
			],
			required: true,
			default: 'xlsx',
			description:
				'要导入的文件的扩展名。注意：此处填写的文件扩展名需与实际文件的后缀名保持严格一致。',
		},
		{
			displayName: '文件 Token',
			name: 'file_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description:
				'要导入文件的 token。创建任务前，需先调用上传素材或上传文件接口获取源文件的 token。最大长度 27 字符。',
		},
		// docx, doc, txt, md, markdown, mark, html → 只能导入为 docx (在线文档)
		{
			displayName: '目标云文档类型',
			name: 'type',
			type: 'hidden',
			default: 'docx',
			displayOptions: {
				show: {
					file_extension: ['docx', 'doc', 'txt', 'md', 'markdown', 'mark', 'html'],
				},
			},
		},
		// xlsx, csv → 可以导入为 sheet 或 bitable
		{
			displayName: '目标云文档类型',
			name: 'type',
			type: 'options',
			options: [
				{ name: '飞书电子表格 (Sheet)', value: 'sheet' },
				{ name: '飞书多维表格 (Bitable)', value: 'bitable' },
			],
			required: true,
			default: 'sheet',
			description: 'XLSX 和 CSV 文件可导入为电子表格或多维表格。',
			displayOptions: {
				show: {
					file_extension: ['xlsx', 'csv'],
				},
			},
		},
		// xls → 只能导入为 sheet
		{
			displayName: '目标云文档类型',
			name: 'type',
			type: 'hidden',
			default: 'sheet',
			displayOptions: {
				show: {
					file_extension: ['xls'],
				},
			},
		},
		{
			displayName: '挂载文件夹 Token',
			name: 'mount_key',
			type: 'string',
			required: true,
			default: '',
			description:
				'云文档挂载的文件夹的 token，即云空间下文件夹的 token。空表示云空间根目录。',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: '添加选项',
			default: {},
			options: [
				{
					displayName: '自定义文件名',
					name: 'file_name',
					type: 'string',
					default: '',
					description: '导入后的在线云文档名称。参数为空时，使用上传本地文件时的文件名。',
				},
				{
					displayName: '轮询间隔 (毫秒)',
					name: 'pollInterval',
					type: 'number',
					typeOptions: {
						minValue: 1000,
					},
					default: 2000,
					description: '查询导入任务状态的轮询间隔时间（毫秒）。',
				},
				{
					displayName: '最大轮询次数',
					name: 'maxPolls',
					type: 'number',
					typeOptions: {
						minValue: 1,
					},
					default: 60,
					description: '查询导入任务状态的最大轮询次数。超过后将抛出超时错误。',
				},
				batchingOption,
				timeoutOption,
			],
		},
	] as INodeProperties[],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const file_extension = this.getNodeParameter('file_extension', index) as string;
		const file_token = this.getNodeParameter('file_token', index) as string;
		const type = this.getNodeParameter('type', index) as string;
		const mount_key = this.getNodeParameter('mount_key', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			file_name?: string;
			pollInterval?: number;
			maxPolls?: number;
			timeout?: number;
		};

		const pollInterval = options.pollInterval || 2000;
		const maxPolls = options.maxPolls || 60;

		// 构建请求选项的基础配置
		const baseRequestOptions: IDataObject = {};
		if (options.timeout) {
			baseRequestOptions.timeout = options.timeout;
		}

		// 1. 创建导入任务
		const createBody: IDataObject = {
			file_extension,
			file_token,
			type,
			point: {
				mount_type: 1, // 固定值 1，表示将该云文档挂载至云空间下
				mount_key,
			},
		};

		// 添加可选的文件名
		if (options.file_name) {
			createBody.file_name = options.file_name;
		}

		const createResponse = await RequestUtils.request.call(this, {
			method: 'POST',
			url: '/open-apis/drive/v1/import_tasks',
			body: createBody,
			...baseRequestOptions,
		});

		const ticket = (createResponse as IDataObject).ticket as string;
		if (!ticket) {
			throw new NodeOperationError(this.getNode(), '创建导入任务失败：未返回 ticket');
		}

		// 2. 轮询查询导入任务结果
		let pollCount = 0;
		let importResult: IDataObject | null = null;

		while (pollCount < maxPolls) {
			const queryResponse = await RequestUtils.request.call(this, {
				method: 'GET',
				url: `/open-apis/drive/v1/import_tasks/${ticket}`,
				...baseRequestOptions,
			});

			const result = (queryResponse as IDataObject).result as IDataObject;
			if (!result) {
				throw new NodeOperationError(this.getNode(), '查询导入任务失败：未返回 result');
			}

			const jobStatus = result.job_status as number;

			// 检查任务状态
			if (jobStatus === JOB_STATUS.SUCCESS) {
				importResult = result;
				break;
			} else if (jobStatus === JOB_STATUS.INITIALIZING || jobStatus === JOB_STATUS.PROCESSING) {
				// 任务仍在处理中，等待后继续轮询
				await sleep(pollInterval);
				pollCount++;
			} else {
				// 任务失败
				const errorMsg = JOB_ERROR_MESSAGES[jobStatus] || result.job_error_msg || '未知错误';
				throw new NodeOperationError(
					this.getNode(),
					`导入任务失败 (状态码: ${jobStatus}): ${errorMsg}`,
				);
			}
		}

		if (!importResult) {
			throw new NodeOperationError(
				this.getNode(),
				`导入任务超时：已轮询 ${maxPolls} 次，任务仍未完成`,
			);
		}

		// 返回导入结果
		return {
			ticket,
			type: importResult.type,
			token: importResult.token,
			url: importResult.url,
			extra: importResult.extra,
			job_status: importResult.job_status,
			job_error_msg: importResult.job_error_msg,
		};
	},
};

export default SpaceImportOperate;
