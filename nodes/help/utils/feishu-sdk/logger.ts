import { Logger } from 'n8n-workflow';

/**
 * 生成带统一前缀的作用域 logger。
 *
 * 所有触发器相关日志会被打印为：`[FeishuNode:Trigger:{workflowId}] <message>`，
 * 便于在多工作流 / 多实例场景下按 workflowId 过滤定位。
 */
export function createScopedLogger(logger: Logger, workflowId?: string): Logger {
	const prefix = `[FeishuNode:Trigger:${workflowId ?? 'unknown'}]`;

	type LogMeta = Parameters<Logger['error']>[1];

	const withPrefix =
		(fn: (message: string, meta?: LogMeta) => void) =>
		(message: string, meta?: LogMeta) => {
			fn(`${prefix} ${message}`, meta);
		};

	return {
		error: withPrefix(logger.error.bind(logger)),
		warn: withPrefix(logger.warn.bind(logger)),
		info: withPrefix(logger.info.bind(logger)),
		debug: withPrefix(logger.debug.bind(logger)),
	} as Logger;
}
