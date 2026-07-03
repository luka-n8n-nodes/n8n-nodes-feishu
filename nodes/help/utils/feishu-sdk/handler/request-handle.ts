import { Logger } from 'n8n-workflow';
import crypto from 'crypto';
import { AESCipher } from '../utils/aes-cipher';
import { CEventType } from '../consts';

export default class RequestHandle {
	aesCipher?: AESCipher;

	verificationToken?: string;

	encryptKey?: string;

	logger: Logger;

	constructor(params: { logger: Logger; encryptKey?: string; verificationToken?: string }) {
		const { encryptKey, verificationToken, logger } = params;
		this.verificationToken = verificationToken;
		this.encryptKey = encryptKey;
		this.logger = logger;

		if (encryptKey) {
			this.aesCipher = new AESCipher(encryptKey);
		}
	}

	parse(data: any) {
		const targetData = (() => {
			const { encrypt, ...rest } = data || {};
			if (encrypt) {
				if (!this.aesCipher) {
					this.logger.error('parse encrypt data failed: aesCipher is not initialized');
					return rest;
				}
				try {
					const decrypted = this.aesCipher.decrypt(encrypt);
					return {
						...JSON.parse(decrypted),
						...rest,
					};
				} catch (e) {
					this.logger.error(
						`parse encrypt data failed: ${e instanceof Error ? e.message : String(e)}`,
					);
					return rest;
				}
			}

			return rest;
		})();

		// v1和v2版事件的区别：https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM
		if ('schema' in targetData) {
			const { header, event, ...rest } = targetData;
			return {
				[CEventType]: targetData?.header?.event_type,
				...rest,
				...header,
				...event,
				// 统一暴露可见的 event_type，便于下游用 {{$json.event_type}} 判断事件类型
				event_type: targetData?.header?.event_type,
			};
		}
		const { event = {}, ...envelope } = targetData ?? {};
		const eventType = (event as Record<string, unknown>)?.type;
		// 拍平事件体与信封。注意：v1.0 信封自带 type: "event_callback"（回调信封类型，
		// 非业务事件类型），拍平后会污染顶层且与 event_type 并存造成歧义，这里统一删除，
		// 改用 event_type 表达真实事件类型，使 v1.0 输出结构与 v2.0 保持一致。
		const merged: Record<string, unknown> = { ...event, ...envelope };
		delete merged.type;
		return {
			[CEventType]: eventType,
			...merged,
			// v1.0 事件原始报文不含 schema 字段，这里显式补齐为 "1.0"，
			// 与 v2.0 的 "schema": "2.0" 对齐，便于下游按版本区分
			schema: '1.0',
			// 与 v2.0 对齐，统一用可见的 event_type 表达事件类型
			event_type: eventType,
		};
	}

	checkIsEventValidated(data: any): boolean {
		if (!this.encryptKey) {
			return true;
		}

		if (!data?.headers) {
			this.logger.warn('event validation failed: missing headers');
			return false;
		}

		const {
			'x-lark-request-timestamp': timestamp,
			'x-lark-request-nonce': nonce,
			'x-lark-signature': signature,
		} = data.headers;

		if (!timestamp || !nonce || !signature) {
			this.logger.warn('event validation failed: missing required headers');
			return false;
		}

		const content = timestamp + nonce + this.encryptKey + JSON.stringify(data);
		const computedSignature = crypto.createHash('sha256').update(content).digest('hex');

		return computedSignature === signature;
	}
}
