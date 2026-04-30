/**
 * @title Terminal 类型定义
 * @description 终端操作的请求/响应类型与执行记录结构。
 * @keywords-cn 终端类型, 执行记录, 进程状态
 * @keywords-en terminal-types, exec-record, process-status
 */

/** 终端执行请求 payload */
export interface TerminalExecPayload {
  /** 要执行的命令 */
  command: string;
  /** 用于回调通知的会话 ID */
  sessionId: string;
  /** sync: 同步等待(≤30s) / async: 异步返回句柄 */
  mode?: 'sync' | 'async';
  /** 超时 ms, 同步默认 30000, 异步默认 300000(5min) */
  timeout?: number;
  /** 输出缓冲上限 bytes, 默认 1MB */
  maxBuffer?: number;
}

/** 句柄查询 payload */
export interface TerminalHandlePayload {
  handleId: string;
}

/** 终端执行状态 */
export type TerminalStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'killed'
  | 'timeout';

/** 终端执行记录 (持久化到文件) */
export interface TerminalRecord {
  handleId: string;
  command: string;
  sessionId: string;
  mode: 'sync' | 'async';
  status: TerminalStatus;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: number;
  finishedAt: number | null;
  timeout: number;
  /** 原始调用 context, 用于异步回调时携带用户身份 */
  invocationContext?: Record<string, unknown>;
}

/** 进程池状态 */
export interface TerminalPoolStatus {
  active: number;
  max: number;
  available: number;
}
