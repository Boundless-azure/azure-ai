/**
 * @title Runner 枚举
 * @description Runner 状态与 WebSocket 事件名定义。
 * @keywords-cn Runner枚举, 状态, WebSocket事件
 * @keywords-en runner-enums, status, websocket-events
 */
export enum RunnerStatus {
  Mounted = 'mounted',
  Offline = 'offline',
}

export enum RunnerWsEvent {
  Register = 'runner/register',
  Registered = 'runner/registered',
  Status = 'runner/status',
}

export const RUNNER_NAMESPACE = '/runner/ws';
export const RUNNER_WS_PING_INTERVAL_MS = 25000;
export const RUNNER_WS_PING_TIMEOUT_MS = 20000;
