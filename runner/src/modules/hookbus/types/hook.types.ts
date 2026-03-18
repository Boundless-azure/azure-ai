/**
 * @title HookBus 类型
 * @description 定义 HookBus 的事件、处理器、过滤条件与执行结果。
 * @keywords-cn HookBus类型, 事件, 处理器, 结果
 * @keywords-en hookbus-types, event, handler, result
 */
export interface HookFilter {
  pluginId?: string;
  pluginName?: string;
  tag?: string;
  phase?: 'before' | 'after' | 'around';
}

export interface HookEvent<TPayload = unknown> {
  name: string;
  payload: TPayload;
  filter?: HookFilter;
  declaration?: HookDeclaration;
}

export interface HookMetadata {
  pluginId?: string;
  pluginName?: string;
  tags?: string[];
  phase?: 'before' | 'after' | 'around';
  priority?: number;
  description?: string;
  middlewares?: string[];
  errorMode?: 'capture' | 'throw';
  methodRef?: string;
}

export interface HookResult<TResult = unknown> {
  status: 'success' | 'error';
  data?: TResult;
  error?: string;
}

export interface HookDebugEvent {
  type: 'emit' | 'result' | 'error';
  name: string;
  payload?: unknown;
  results?: Array<HookResult<unknown>>;
  ts: number;
}

export interface HookDeclaration {
  description?: string;
  middlewares?: string[];
  payloadDto?: new () => object;
  filter?: HookFilter;
  errorMode?: 'capture' | 'throw';
}

export type HookHandler<TPayload = unknown, TResult = unknown> = (
  event: HookEvent<TPayload>,
) => Promise<HookResult<TResult>> | HookResult<TResult>;

export type HookMiddleware<TPayload = unknown, TResult = unknown> = (
  event: HookEvent<TPayload>,
  next: () => Promise<HookResult<TResult>>,
) => Promise<HookResult<TResult>>;

export interface HookRegistration<TPayload = unknown, TResult = unknown> {
  name: string;
  handler: HookHandler<TPayload, TResult>;
  metadata?: HookMetadata;
}

export interface HookBusOptions {
  concurrency?: number;
  storage?: {
    mode: 'memory' | 'redis';
    queueKeyPrefix?: string;
    bindingKeyPrefix?: string;
  };
}
