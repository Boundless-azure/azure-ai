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
  FrpStart = 'runner/frp:start',
  FrpStop = 'runner/frp:stop',
  FrpReload = 'runner/frp:reload',
  /** SaaS → Runner :: 派发 hook 调用 */
  HookCall = 'hook:call',
  /** Runner → SaaS :: 收到回执 (≤3s 必到, 否则判定 runner 离线软错) */
  HookAck = 'hook:ack',
  /** Runner → SaaS :: 进度心跳 (3s 一次, 合并 in-flight callIds) */
  HookProgress = 'hook:progress',
  /** Runner → SaaS :: 终态回包 ({ errorMsg, result, debugLog }) */
  HookResult = 'hook:result',
}

export const RUNNER_NAMESPACE = '/runner/ws';
export const RUNNER_WS_PING_INTERVAL_MS = 25000;
export const RUNNER_WS_PING_TIMEOUT_MS = 20000;

/** ack 软超时 :: 派发后多久未收到 hook:ack 视为 runner 离线 */
export const HOOK_CALL_ACK_TIMEOUT_MS = 3000;
/** stale 软超时 :: ack 后超过此时长未收到任一 progress / result 视为僵死 */
export const HOOK_CALL_STALE_TIMEOUT_MS = 5000;
/** progress 推送周期 :: Runner 合并 in-flight callId push 的节奏 */
export const HOOK_CALL_PROGRESS_INTERVAL_MS = 3000;
/** 单 Runner in-flight 上限 :: 防 LLM 暴怼 */
export const HOOK_CALL_INFLIGHT_LIMIT = 64;
/** RPC scan tick :: SaaS / Runner 内部扫表周期 */
export const HOOK_CALL_TICK_INTERVAL_MS = 1000;
