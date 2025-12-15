import { IDataObject, IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import NodeUtils from '../../../help/utils/NodeUtils';

const MessageFileUploadOperate: ResourceOperations = {
	name: '上传文件',
	value: 'message:fileUpload',
	options: [
		{
			displayName: '文件类型',
			name: 'file_type',
			type: 'options',
			// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
			options: [
				{
					name: 'OPUS 音频文件',
					value: 'opus',
				},
				{
					name: 'MP4 视频文件',
					value: 'mp4',
				},
				{
					name: 'PDF 格式文件',
					value: 'pdf',
				},
				{
					name: 'DOC 格式文件',
					value: 'doc',
				},
				{
					name: 'XLS 格式文件',
					value: 'xls',
				},
				{
					name: 'PPT 格式文件',
					value: 'ppt',
				},
				{
					name: 'Stream 格式文件（其他类型）',
					value: 'stream',
				},
			],
			required: true,
			default: 'stream',
			description:
				'待上传的文件类型。若上传文件不属于以上枚举类型，可以使用 stream 格式',
		},
		{
			displayName: '文件名',
			name: 'file_name',
			type: 'string',
			required: true,
			default: '',
			description: '带后缀的文件名，例如：测试视频.mp4',
		},
		{
			displayName: '二进制文件字段',
			name: 'fileFieldName',
			type: 'string',
			default: 'data',
			required: true,
			description: '输入数据中包含文件二进制数据的字段名',
		},
		{
			displayName: '选项',
			name: 'options',
			type: 'collection',
			placeholder: '添加选项',
			default: {},
			options: [
				{
					displayName: '文件时长（毫秒）',
					name: 'duration',
					type: 'number',
					default: 0,
					description: '文件的时长（视频、音频），单位：毫秒。不传值时无法显示文件的具体时长',
				},
			],
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const file_type = this.getNodeParameter('file_type', index) as string;
		const file_name = this.getNodeParameter('file_name', index) as string;
		const fileFieldName = this.getNodeParameter('fileFieldName', index) as string;
		const options = this.getNodeParameter('options', index, {}) as { duration?: number };

		const file = (await NodeUtils.buildUploadFileData.call(this, fileFieldName, index)) as any;

		if (!file || !file.value) {
			throw new NodeOperationError(this.getNode(), '未找到文件数据，请检查二进制文件字段名是否正确');
		}

		if (!file_name) {
			throw new NodeOperationError(this.getNode(), '文件名不能为空');
		}

		const formData: IDataObject = {
			file_type,
			file_name,
			file,
		};

		// 添加可选的时长参数
		if (options.duration && options.duration > 0) {
			formData.duration = options.duration.toString();
		}

		return RequestUtils.request.call(this, {
			method: 'POST',
			url: '/open-apis/im/v1/files',
			formData,
		});
	},
};

export default MessageFileUploadOperate;
