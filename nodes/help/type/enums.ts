/**
 * 输出类型枚举
 */
export declare const enum OutputType {
	Single = 'single',
	Multiple = 'multiple',
	None = 'none',
	PassThrough = 'passThrough',
}

/**
 * 凭证类型枚举
 */
export declare const enum Credentials {
	FeishuCredentialsApi = 'feishuNodeCredentialsApi',
	FeishuOauth2Api = 'feishuNodeOauth2Api',
	Id = '34970574-959e-40a3-99c0-23724063637d',
	Type = 'feishu',
}

/**
 * 触发事件类型枚举
 */
export enum TriggerEventType {
	ReceiveMessage = 'im.message.receive_v1',
}

/**
 * 文件类型枚举
 */
export enum FileType {
	Bitable = 'bitable',
	Docx = 'docx',
	Folder = 'folder',
	File = 'file',
	Slides = 'slides',
}

/**
 * API 基础 URL 枚举
 */
export enum BaseUrl {
	China = 'https://open.feishu.cn',
	Global = 'https://open.larksuite.com',
}

/**
 * 飞书 API 错误码常量
 */
export const FeishuErrorCodes = {
	/** Access Token 已过期 */
	ACCESS_TOKEN_EXPIRED: 99991663,
	/** Access Token 无效 */
	INVALID_ACCESS_TOKEN: 99991664,
	/** 请求频率超限 */
	RATE_LIMITED: 99991400,
	/** 内部错误 */
	INTERNAL_ERROR: 99991500,
} as const;

/**
 * 可自动重试的错误码列表
 */
export const RETRYABLE_ERROR_CODES: readonly number[] = [
	FeishuErrorCodes.ACCESS_TOKEN_EXPIRED,
	FeishuErrorCodes.RATE_LIMITED,
] as const;
