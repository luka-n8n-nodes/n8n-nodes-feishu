export enum ErrorCode {
	ok = 0,
	system_busy = 1,
	forbidden = 403,
	auth_failed = 514,
	internal_error = 1000040343,
	exceed_conn_limit = 1000040350,
}

/**
 * 连接失败的分类原因，用于决定重连策略：
 * - network / system_busy / server_error：可自愈，指数退避后重试
 * - exceed_conn_limit：连接数超限（多因实例重启后旧连接尚未被网关回收），需更长等待
 * - auth_failed / forbidden：凭证或权限问题，不可自愈，停止重试并上报
 */
export enum ConnectFailReason {
	network = 'network',
	system_busy = 'system_busy',
	server_error = 'server_error',
	exceed_conn_limit = 'exceed_conn_limit',
	auth_failed = 'auth_failed',
	forbidden = 'forbidden',
}

export enum FrameType {
	control = 0,
	data = 1,
}

export enum HeaderKey {
	type = 'type',
	message_id = 'message_id',
	sum = 'sum',
	seq = 'seq',
	trace_id = 'trace_id',
	biz_rt = 'biz_rt',
	handshake_status = 'handshake-status',
	handshake_msg = 'handshake-msg',
	handshake_autherrcode = 'handshake-autherrcode',
}

export enum MessageType {
	event = 'event',
	card = 'card',
	ping = 'ping',
	pong = 'pong',
}

export enum HttpStatusCode {
	// 2xx Success
	ok = 200,
	// 5xx Server errors
	internal_server_error = 500,
}

export enum Domain {
	Feishu,
	Lark,
}
