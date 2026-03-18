import type { HookResultStatus, HookPhase } from '../enums/hook.enums';

/**
 * @title Hook 类型定义
 * @description 定义 Hook 注册、事件、上下文、过滤器与中间件类型。
 * @keywords-cn Hook类型, 事件, 过滤器, 中间件
 * @keywords-en hook-types, event, filter, middleware
 */
export interface HookFilter {
  pluginId?: string;
  pluginName?: string;
  tag?: string;
  phase?: HookPhase;
}

export interface HookEvent<T = unknown> {
  name: string;
  payload: T;
  filter?: HookFilter;
  requestId?: string;
  ts?: number;
  source?: HookSource;
}

export interface HookMetadata {
  pluginId?: string;
  pluginName?: string;
  version?: string;
  tags?: string[];
  phase?: HookPhase;
  priority?: number;
}

export interface HookResult<R = unknown> {
  status: HookResultStatus;
  data?: R;
  error?: string;
  durationMs?: number;
}

export interface HookContext<T = unknown> {
  event: HookEvent<T>;
  metadata?: HookMetadata;
  state?: Record<string, unknown>;
}

export type HookHandler<T = unknown, R = unknown> = (
  ctx: HookContext<T>,
) => Promise<HookResult<R>> | HookResult<R>;

export type HookMiddleware<T = unknown, R = unknown> = (
  ctx: HookContext<T>,
  next: () => Promise<HookResult<R>>,
) => Promise<HookResult<R>>;

export interface HookRegistration<T = unknown, R = unknown> {
  id: string;
  name: string;
  handler: HookHandler<T, R>;
  metadata?: HookMetadata;
}

export interface HookBusOptions {
  bufferSize?: number;
  debug?: boolean;
  /** 并发处理的最大数（用于轮询批处理） */
  concurrency?: number;
}

export interface HookSource {
  file?: string;
  line?: number;
  stack?: string[];
}
