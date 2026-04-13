import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import RequestUtils from '../../../help/utils/RequestUtils';
import { ResourceOperations } from '../../../help/type/IResource';
import {
	binaryPropertyNameOption,
	fileNameOption,
	mimeTypeOption,
	batchingOption,
	timeoutOption,
} from '../../../help/utils/sharedOptions';

const SpaceDownloadOperate: ResourceOperations = {
	name: '下载素材',
	value: 'space:mediaDownload',
	order: 160,
	description: '下载各类云文档中的素材，例如电子表格中的图片',
	options: [
		{
			displayName: '素材 Token',
			name: 'file_token',
			// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
			type: 'string',
			required: true,
			default: '',
			description:
				'素材的 token。参考<a href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/introduction">素材概述</a>了解如何获取素材 token',
		},
		binaryPropertyNameOption,
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add option',
			default: {},
			options: [
				fileNameOption,
				mimeTypeOption,
				{
					displayName: 'Extra',
					name: 'extra',
					type: 'string',
					default: '',
					description:
						'拥有高级权限的多维表格在下载素材时，需要添加额外的扩展信息作为 URL 查询参数鉴权。详情参考<a href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/introduction#3b8635d3">素材概述-extra 参数说明</a>。格式示例：{"bitablePerm":{"tableId":"tblXXX","attachments":{"fldXXX":{"recXXX":["boxXXX"]}}}}',
				},
				batchingOption,
				timeoutOption,
			],
		},
	],
	async call(this: IExecuteFunctions, index: number): Promise<IDataObject> {
		const file_token = this.getNodeParameter('file_token', index) as string;
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index) as string;
		const options = this.getNodeParameter('options', index, {}) as {
			file_name?: string;
			fileName?: string; // 兼容旧数据
			mimeType?: string;
			extra?: string;
			timeout?: number;
		};

		// 构建 URL，处理 extra 参数
		let url = `/open-apis/drive/v1/medias/${file_token}/download`;
		if (options.extra) {
			// 序列化 Extra 对象成字符串并进行 URL 编码
			const encodedExtra = encodeURIComponent(options.extra);
			url += `?extra=${encodedExtra}`;
		}

		const buffer = await RequestUtils.request.call(this, {
			method: 'GET',
			url,
			encoding: 'arraybuffer',
			json: false,
			timeout: options.timeout || undefined,
		});

		// 兼容旧数据：优先使用 file_name，其次使用 fileName
		const fileName = (options.file_name || options.fileName)?.trim() || undefined;
		const mimeType = options.mimeType?.trim() || undefined;

		const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, mimeType);

		return {
			binary: {
				[binaryPropertyName]: binaryData,
			},
			json: binaryData,
		};
	},
};

export default SpaceDownloadOperate;
