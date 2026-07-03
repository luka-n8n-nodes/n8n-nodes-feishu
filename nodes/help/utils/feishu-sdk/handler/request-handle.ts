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
			};
		}
		const { event, ...rest } = targetData;
		return {
			[CEventType]: targetData?.event?.type,
			...event,
			...rest,
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
