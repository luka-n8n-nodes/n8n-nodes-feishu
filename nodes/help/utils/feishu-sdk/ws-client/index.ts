import { Logger, RequestHelperFunctions } from 'n8n-workflow';

import WebSocket from 'ws';
import type { IncomingMessage } from 'http';
import { EventDispatcher } from '../handler/event-handler';
import * as protoBuf from '../proto-buf';
import { WSConfig } from './ws-config';
import { DataCache } from '../data-cache';
import {
	ConnectFailReason,
	Domain,
	ErrorCode,
	FrameType,
	HeaderKey,
	HttpStatusCode,
	MessageType,
} from '../enum';
import { pbbp2 } from '../proto-buf/pbbp2';

interface IConstructorParams {
	appId: string;
	appSecret: string;
	domain?: string | Domain;
	logger: Logger;
	helpers: RequestHelperFunctions;
	autoReconnect?: boolean;
	agent?: any;
}

/** 单次连接尝试的结构化结果 */
interface ConnectResult {
	ok: boolean;
	reason?: ConnectFailReason;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stopped';

/** 指数退避的基础间隔（毫秒），首次重连从这里起步 */
const BACKOFF_BASE_MS = 1000;

export class WSClient {
	private wsConfig = new WSConfig();

	private logger: Logger;

	private dataCache: DataCache;

	private helpers: RequestHelperFunctions;

	private eventDispatcher?: EventDispatcher;

	private pingInterval?: NodeJS.Timeout;

	private reconnectTimer?: NodeJS.Timeout;

	/**
	 * 是否允许重连。仅在 stop() 时置为 false。
	 * 取代旧的 isConnecting/shouldReconnect 隐式组合，避免竞态导致「断开后不再重连」。
	 */
	private shouldReconnect: boolean = true;

	/**
	 * 连接代际计数。每次 start()/stop() 递增，用于让「过期」的重连链路（定时器回调、
	 * 尚未 resolve 的连接尝试）在恢复执行时自行退出，避免 issue #177 的并行无界重连。
	 */
	private generation: number = 0;

	/** 当前是否有一次连接尝试正在进行，保证同一时刻只有一个 connectOnce 在跑 */
	private connecting: boolean = false;

	/** 连续重连失败次数，用于指数退避；连接成功后清零 */
	private reconnectAttempt: number = 0;

	/** 最近一次收到 pong 的时间戳，用于识别半开僵尸连接 */
	private lastPongAt: number = 0;

	private connectionState: ConnectionState = 'idle';

	private reconnectInfo = {
		lastConnectTime: 0,
		nextConnectTime: 0,
		attempt: 0,
		lastPongAt: 0,
	};

	private agent?: any;

	constructor(params: IConstructorParams) {
		const { appId, appSecret, logger, helpers, agent, domain, autoReconnect = true } = params;

		this.logger = logger;
		this.agent = agent;
		this.dataCache = new DataCache({ logger: this.logger });
		this.helpers = helpers;
		this.wsConfig.updateClient({
			appId,
			appSecret,
			domain,
		});

		this.wsConfig.updateWs({
			autoReconnect,
		});
	}

	private async pullConnectConfig(): Promise<ConnectResult> {
		const { appId, appSecret } = this.wsConfig.getClient();

		try {
			const response = await this.helpers.request({
				method: 'POST',
				url: this.wsConfig.wsConfigUrl,
				body: {
					AppID: appId,
					AppSecret: appSecret,
				},
				// consumed by gateway
				headers: {
					locale: 'zh',
				},
				timeout: 15000,
			});

			const { code, data, msg } = JSON.parse(response);

			if (code !== ErrorCode.ok) {
				this.logger.error(`pull connect config failed, code: ${code}, msg: ${msg}`);
				return { ok: false, reason: this.classifyCode(code) };
			}

			const connectUrl: string | undefined = data?.URL;
			const ClientConfig = data?.ClientConfig;

			if (!connectUrl || !ClientConfig) {
				this.logger.error('pull connect config missing URL/ClientConfig');
				return { ok: false, reason: ConnectFailReason.server_error };
			}

			const parsedUrl = new URL(connectUrl);
			const device_id = parsedUrl.searchParams.get('device_id');
			const service_id = parsedUrl.searchParams.get('service_id');

			this.wsConfig.updateWs({
				connectUrl,

				deviceId: device_id as string,
				serviceId: service_id as string,

				pingInterval: ClientConfig.PingInterval * 1000,
				reconnectCount: ClientConfig.ReconnectCount,
				reconnectInterval: ClientConfig.ReconnectInterval * 1000,
				reconnectNonce: ClientConfig.ReconnectNonce * 1000,
			});

			this.logger.debug(`get connect config success, ws url: ${connectUrl}`);

			return { ok: true };
		} catch (e) {
			this.logger.error('pull connect config error', (e as any)?.message || 'system busy');
			return { ok: false, reason: ConnectFailReason.network };
		}
	}

	/** 把飞书返回的 code 归类为重连策略需要的原因 */
	private classifyCode(code: number): ConnectFailReason {
		switch (code) {
			case ErrorCode.exceed_conn_limit:
				return ConnectFailReason.exceed_conn_limit;
			case ErrorCode.auth_failed:
				return ConnectFailReason.auth_failed;
			case ErrorCode.forbidden:
				return ConnectFailReason.forbidden;
			case ErrorCode.system_busy:
			case ErrorCode.internal_error:
				return ConnectFailReason.system_busy;
			default:
				return ConnectFailReason.server_error;
		}
	}

	/**
	 * 建立 WebSocket 连接，并校验飞书握手结果。
	 *
	 * 关键修复：飞书网关在 upgrade 阶段用「非 101 响应头」返回握手结果，对应 ws 库的
	 * `unexpected-response` 事件。旧实现只监听 open/error，导致握手被拒时仍误判为成功，
	 * 进而出现「建连即断 → 重连 → 再被拒」的热循环。
	 */
	private connect(): Promise<ConnectResult> {
		const connectUrl = this.wsConfig.getWS('connectUrl');

		let wsInstance: WebSocket;
		try {
			const { agent } = this;
			wsInstance = new WebSocket(connectUrl, { agent });
		} catch (e) {
			this.logger.error('new WebSocket error');
			return Promise.resolve({ ok: false, reason: ConnectFailReason.network });
		}

		return new Promise<ConnectResult>((resolve) => {
			let settled = false;

			const onOpen = () => {
				this.logger.debug('ws connect success');
				this.wsConfig.setWSInstance(wsInstance);
				this.lastPongAt = Date.now();
				this.startPingLoop();
				settle({ ok: true });
			};

			const onError = (err: Error) => {
				this.logger.error(`ws connect failed: ${err?.message ?? 'unknown error'}`);
				settle({ ok: false, reason: ConnectFailReason.network });
			};

			const onUnexpectedResponse = (_req: unknown, res: IncomingMessage) => {
				settle({ ok: false, reason: this.parseHandshakeFailure(res) });
			};

			const settle = (result: ConnectResult) => {
				if (settled) {
					return;
				}
				settled = true;
				wsInstance.removeListener('open', onOpen);
				wsInstance.removeListener('error', onError);
				wsInstance.removeListener('unexpected-response', onUnexpectedResponse);
				resolve(result);
			};

			wsInstance.on('open', onOpen);
			wsInstance.on('error', onError);
			wsInstance.on('unexpected-response', onUnexpectedResponse);
		});
	}

	/** 解析握手失败响应头，映射为结构化原因 */
	private parseHandshakeFailure(res?: IncomingMessage): ConnectFailReason {
		const headers = (res?.headers ?? {}) as Record<string, string | undefined>;
		const statusRaw = headers[HeaderKey.handshake_status];
		const msg = headers[HeaderKey.handshake_msg];
		const status = statusRaw !== undefined ? Number(statusRaw) : NaN;

		if (Number.isNaN(status)) {
			this.logger.error(
				`handshake failed without status header, http status: ${res?.statusCode}`,
			);
			return ConnectFailReason.server_error;
		}

		if (status === ErrorCode.auth_failed) {
			const authErrCode = Number(headers[HeaderKey.handshake_autherrcode]);
			if (authErrCode === ErrorCode.exceed_conn_limit) {
				this.logger.warn(
					`connection limit exceeded (max 50 per app). ${msg ?? ''}`.trim(),
				);
				return ConnectFailReason.exceed_conn_limit;
			}
			this.logger.error(`handshake auth failed: ${msg ?? ''}`.trim());
			return ConnectFailReason.auth_failed;
		}

		if (status === ErrorCode.forbidden) {
			this.logger.error(`handshake forbidden: ${msg ?? ''}`.trim());
			return ConnectFailReason.forbidden;
		}

		this.logger.error(`handshake failed, status: ${status}, ${msg ?? ''}`.trim());
		return ConnectFailReason.server_error;
	}

	/** 拉取配置并建连，返回结构化结果；成功时挂载消息处理 */
	private async connectOnce(): Promise<ConnectResult> {
		this.reconnectInfo.lastConnectTime = Date.now();

		const configResult = await this.pullConnectConfig();
		if (!configResult.ok) {
			return configResult;
		}

		const connectResult = await this.connect();
		if (connectResult.ok) {
			this.communicate();
		}
		return connectResult;
	}

	/**
	 * 执行一次连接（供 start 与重连定时器调用）。
	 * 通过 generation 与 connecting 双重守卫，保证：过期链路自动退出、同一时刻仅一个连接尝试。
	 */
	private async runConnect(generation: number) {
		if (generation !== this.generation || !this.shouldReconnect) {
			return;
		}
		if (this.connecting) {
			this.logger.debug('connect already in progress, skip');
			return;
		}

		this.connecting = true;
		this.connectionState = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';

		let result: ConnectResult;
		try {
			result = await this.connectOnce();
		} finally {
			this.connecting = false;
		}

		// 等待期间可能已被 stop() 或新一轮 start() 取代
		if (generation !== this.generation || !this.shouldReconnect) {
			return;
		}

		if (result.ok) {
			this.connectionState = 'connected';
			this.reconnectAttempt = 0;
			this.reconnectInfo.attempt = 0;
			this.logger.info('ws client ready');
			return;
		}

		this.connectionState = 'reconnecting';
		this.scheduleReconnect(result.reason);
	}

	/**
	 * 依据失败原因调度下一次重连：
	 * - 幂等：始终只保留一个待执行定时器
	 * - 指数退避 + 抖动，exceed_conn_limit 使用更长的最小等待
	 * - 不可自愈错误（auth/forbidden）直接停止重试并上报
	 */
	private scheduleReconnect(reason?: ConnectFailReason) {
		if (!this.shouldReconnect || !this.wsConfig.getWS('autoReconnect')) {
			return;
		}

		if (reason === ConnectFailReason.auth_failed || reason === ConnectFailReason.forbidden) {
			this.logger.error(
				`unrecoverable error (${reason}), stop reconnecting. Please check the app credentials / event subscription permissions.`,
			);
			this.connectionState = 'stopped';
			return;
		}

		const { reconnectCount } = this.wsConfig.getWS();
		if (reconnectCount >= 0 && this.reconnectAttempt >= reconnectCount) {
			this.logger.error(
				`unable to connect after ${this.reconnectAttempt} attempts, give up`,
			);
			this.connectionState = 'stopped';
			return;
		}

		const delay = this.computeBackoff(reason);
		this.reconnectAttempt += 1;
		this.reconnectInfo.attempt = this.reconnectAttempt;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		const generation = this.generation;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined;
			void this.runConnect(generation);
		}, delay);
		this.reconnectInfo.nextConnectTime = Date.now() + delay;

		this.logger.info(
			`reconnect scheduled in ${delay}ms (attempt ${this.reconnectAttempt}` +
				`${reconnectCount >= 0 ? `/${reconnectCount}` : ''}${reason ? `, reason: ${reason}` : ''})`,
		);
	}

	/** 指数退避（上限为服务端建议的 reconnectInterval），叠加抖动避免多副本同时抢连 */
	private computeBackoff(reason?: ConnectFailReason): number {
		const { reconnectInterval, reconnectNonce } = this.wsConfig.getWS();
		const cap = reconnectInterval || 120 * 1000;

		let delay = Math.min(BACKOFF_BASE_MS * 2 ** this.reconnectAttempt, cap);

		// 连接数超限多半是重启后旧连接尚未被网关回收，给它更充裕的过期窗口
		if (reason === ConnectFailReason.exceed_conn_limit) {
			delay = Math.min(Math.max(delay, 10 * 1000), cap);
		}

		const jitter = reconnectNonce ? reconnectNonce * Math.random() : 0;
		return Math.floor(delay + jitter);
	}

	private startPingLoop() {
		if (this.pingInterval) {
			clearTimeout(this.pingInterval);
		}
		this.pingLoop();
	}

	private pingLoop() {
		const { serviceId, pingInterval } = this.wsConfig.getWS();

		const wsInstance = this.wsConfig.getWSInstance();
		if (wsInstance?.readyState === WebSocket.OPEN) {
			// 僵尸连接检测：长时间收不到 pong，说明是半开连接，主动断开触发重连
			if (this.lastPongAt && Date.now() - this.lastPongAt > pingInterval * 2 + 5000) {
				this.logger.warn(
					'no pong received for too long, connection considered dead, terminating',
				);
				wsInstance.terminate();
				// 不再调度本循环；重连成功后会重新 startPingLoop
				return;
			}

			const frame: pbbp2.IFrame = {
				headers: [
					{
						key: HeaderKey.type,
						value: MessageType.ping,
					},
				],
				service: Number(serviceId),
				method: FrameType.control,
				SeqID: 0,
				LogID: 0,
			};
			this.sendMessage(frame);
			this.logger.debug('ping success');
		}

		this.pingInterval = setTimeout(this.pingLoop.bind(this), pingInterval);
	}

	private communicate() {
		const wsInstance = this.wsConfig.getWSInstance();

		wsInstance?.on('message', async (buffer: Uint8Array) => {
			const data = protoBuf.decode(buffer);
			const { method } = data;

			if (method === FrameType.control) {
				await this.handleControlData(data);
			}

			if (method === FrameType.data) {
				await this.handleEventData(data);
			}
		});

		wsInstance?.on('error', () => {
			this.logger.error('ws error');
		});

		wsInstance?.on('close', () => {
			// 仅当前实例的 close 才触发重连，避免被 terminate 的旧实例误触发额外重连
			if (this.wsConfig.getWSInstance() !== wsInstance) {
				return;
			}

			if (!this.shouldReconnect) {
				this.logger.debug('client closed');
				return;
			}

			this.logger.info('client closed unexpectedly, try to reconnect');
			this.connectionState = 'reconnecting';
			this.scheduleReconnect();
		});
	}

	private async handleControlData(data: pbbp2.Frame) {
		const type = data.headers.find((item) => item.key === HeaderKey.type)?.value;
		const payload = data.payload;

		if (type === MessageType.ping) {
			return;
		}

		if (type === MessageType.pong && payload) {
			this.logger.debug('receive pong');
			this.lastPongAt = Date.now();
			this.reconnectInfo.lastPongAt = this.lastPongAt;
			const dataString = new TextDecoder('utf-8').decode(payload);
			const { PingInterval, ReconnectCount, ReconnectInterval, ReconnectNonce } =
				JSON.parse(dataString);

			this.wsConfig.updateWs({
				pingInterval: PingInterval * 1000,
				reconnectCount: ReconnectCount,
				reconnectInterval: ReconnectInterval * 1000,
				reconnectNonce: ReconnectNonce * 1000,
			});

			this.logger.debug('update wsConfig with pong data');
		}
	}

	private async handleEventData(data: pbbp2.Frame) {
		const headers = data.headers.reduce(
			(acc, cur) => {
				acc[cur.key as HeaderKey] = cur.value;
				return acc;
			},
			{} as Record<HeaderKey, string>,
		);
		const { message_id, sum, seq, type, trace_id } = headers;
		const payload = data.payload;

		if (type !== MessageType.event) {
			return;
		}

		const mergedData = this.dataCache.mergeData({
			message_id,
			sum: Number(sum),
			seq: Number(seq),
			trace_id,
			data: payload,
		});

		if (!mergedData) {
			return;
		}

		this.logger.debug(
			`receive message, message_type: ${type}; message_id: ${message_id}; trace_id: ${trace_id}; data: ${mergedData.data}`,
		);

		const respPayload: { code: number; data?: string } = {
			code: HttpStatusCode.ok,
		};

		const startTime = Date.now();
		try {
			const result = await this.eventDispatcher?.invoke(mergedData);
			if (result) {
				respPayload.data = Buffer.from(JSON.stringify(result)).toString('base64');
			}
		} catch (error) {
			respPayload.code = HttpStatusCode.internal_server_error;
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(
				`invoke event failed, message_type: ${type}; message_id: ${message_id}; trace_id: ${trace_id}; error: ${errorMessage}`,
			);
		}
		const endTime = Date.now();

		this.sendMessage({
			...data,
			headers: [...data.headers, { key: HeaderKey.biz_rt, value: String(endTime - startTime) }],
			payload: new TextEncoder().encode(JSON.stringify(respPayload)),
		});
	}

	private sendMessage(data: pbbp2.IFrame) {
		const wsInstance = this.wsConfig.getWSInstance();
		if (wsInstance?.readyState === WebSocket.OPEN) {
			const resp = pbbp2.Frame.encode(data).finish();
			this.wsConfig.getWSInstance()?.send(resp, (err) => {
				if (err) {
					this.logger.error('send data failed');
				}
			});
		}
	}

	getReconnectInfo() {
		return { ...this.reconnectInfo, state: this.connectionState };
	}

	async start(params: { eventDispatcher: EventDispatcher }) {
		const { eventDispatcher } = params;

		if (!eventDispatcher) {
			this.logger.error('client need to start with a eventDispatcher');
			return;
		}
		this.eventDispatcher = eventDispatcher;

		// 递增代际，让任何遗留的重连链路失效（防止 issue #177 的并行重连堆积）
		this.generation += 1;
		this.shouldReconnect = true;
		this.reconnectAttempt = 0;
		this.reconnectInfo.attempt = 0;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		const oldInstance = this.wsConfig.getWSInstance();
		if (oldInstance) {
			oldInstance.terminate();
			this.wsConfig.setWSInstance(null);
		}

		await this.runConnect(this.generation);
	}

	async stop() {
		this.shouldReconnect = false;
		this.generation += 1;
		this.connectionState = 'stopped';

		const wsInstance = this.wsConfig.getWSInstance();
		if (wsInstance) {
			// 优雅关闭：发送 close 帧让飞书网关尽快回收连接槽位，缩短重启后「连接数超限」窗口
			if (wsInstance.readyState === WebSocket.OPEN) {
				try {
					wsInstance.close(1000);
				} catch {
					wsInstance.terminate();
				}
			} else {
				wsInstance.terminate();
			}
			this.wsConfig.setWSInstance(null);
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		if (this.pingInterval) {
			clearTimeout(this.pingInterval);
			this.pingInterval = undefined;
		}

		this.dataCache.clear();
		this.eventDispatcher = undefined;
		this.connecting = false;
		this.reconnectAttempt = 0;
	}
}
