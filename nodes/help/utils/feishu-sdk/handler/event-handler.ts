import { Logger } from 'n8n-workflow';

import { internalCache } from './cache';
import { Cache } from '../interfaces';
import { IHandles } from './events-template';
import RequestHandle from './request-handle';
import { ANY_EVENT, CAppTicket, CAppTicketHandle, CEventType } from '../consts';

type EventHandler = (data: any) => Promise<any> | any;

export class EventDispatcher {
	verificationToken: string = '';

	encryptKey: string = '';

	requestHandle?: RequestHandle;

	handles: Map<string, EventHandler> = new Map();

	cache: Cache;

	logger: Logger;

	isAnyEvent: boolean;

	constructor(params: {
		logger: Logger;
		isAnyEvent: boolean;
		verificationToken?: string;
		encryptKey?: string;
	}) {
		const { encryptKey, verificationToken, logger } = params;
		this.logger = logger;
		this.isAnyEvent = params.isAnyEvent;
		this.encryptKey = encryptKey || '';
		this.verificationToken = verificationToken || '';

		this.requestHandle = new RequestHandle({
			logger: this.logger,
			encryptKey,
			verificationToken,
		});

		this.cache = internalCache;

		this.registerAppTicketHandle();

		this.logger.debug('event-dispatch is ready');
	}

	private registerAppTicketHandle() {
		this.register({
			app_ticket: async (data) => {
				const { app_ticket, app_id } = data;

				if (app_ticket) {
					await this.cache.set(CAppTicket, app_ticket as string, undefined, {
						namespace: app_id as string,
					});
					this.logger.debug('set app ticket');
				} else {
					this.logger.warn('response not include app ticket');
				}
			},
		});
	}

	register<T = object>(handles: IHandles & T) {
		Object.keys(handles).forEach((key) => {
			if (this.handles.has(key) && key !== CAppTicketHandle) {
				this.logger.debug(`this ${key} handle is registered`);
			}

			const handle = handles[key as keyof IHandles];
			if (handle) {
				this.handles.set(key, handle);
			} else {
				this.logger.warn(`Handle for key ${key} is undefined and will not be registered`);
			}
			this.logger.debug(`register ${key} handle`);
		});

		return this;
	}

	async invoke(data: any, params?: { needCheck?: boolean }) {
		const needCheck = params?.needCheck !== false;

		if (needCheck && !this.requestHandle?.checkIsEventValidated(data)) {
			this.logger.warn('event verification failed');
			return undefined;
		}

		const targetData = this.requestHandle?.parse(data);
		this.logger.debug(`Event data: ${JSON.stringify(targetData)}`);

		if (this.isAnyEvent) {
			const handler = this.handles.get(ANY_EVENT);
			if (!handler) {
				this.logger.warn(`no ${ANY_EVENT} handle`);
				return undefined;
			}
			const ret = await handler(targetData);
			this.logger.debug(`execute any_event handle`);
			return ret;
		}

		const type = targetData[CEventType];
		const handler = this.handles.get(type);
		if (handler) {
			const ret = await handler(targetData);
			this.logger.debug(`execute ${type} handle`);
			return ret;
		}

		this.logger.warn(`no ${type} handle`);

		return undefined;
	}
}
