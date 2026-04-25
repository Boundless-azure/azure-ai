import type { HookResultStatus, HookPhase } from '../enums/hook.enums';

/**
 * @title Hook 类型定义 (SaaS)
 * @description 统一 SaaS / Runner 两端的 Hook 协议外形:
 *              - HookEvent 是入口标准消息, 携带 payload (LLM 可控) + context (运行时注入,LLM 不可见)
 *              - HookHandler / HookMiddleware 直接接收 event, 不再包一层 ctx wrapper
 *              - HookInvocationContext 是 token / principalId / traceId 等环境信息的统一通道
 * @keywords-cn Hook类型, 调用上下文, 事件外形, 中间件, 运行时注入
 * @keywords-en hook-types, invocation-context, event-shape, middleware, runtime-injected
 */

export interface HookFilter {
  pluginId?: string;
  pluginName?: string;
  tag?: string;
  phase?: HookPhase;
}

/**
 * Hook 调用环境上下文
 * - LLM 不可见, 不通过工具 schema 暴露
 * - AgentRuntime / Controller / 系统触发点在调用时注入
 * - 中间件 (例: HookAuthMiddleware) 可读 token, 校验后回填 principalId / principalType
 * @keyword-en hook-invocation-context
 */
export interface HookInvocationContext {
  /** 调用者凭据 (jwt / api-key); 由调用入口注入, LLM 不可见 */
  token?: string;
  /** 解析后的主体 ID (HookAuthMiddleware 校验后回填) */
  principalId?: string;
  /** 主体类型 user / agent / system */
  principalType?: string;
  /** 调用来源 */
  source?: 'llm' | 'system' | 'http' | 'runner';
  /** 跨服务追踪 ID (OTel) */
  traceId?: string;
  /** 调用涉及的 runner (跨进程派发时由发起方填) */
  runnerId?: string;
  /** 时间戳 */
  ts?: number;
  /** 透传扩展位 */
  extras?: Record<string, unknown>;
}

export interface HookDeclaration {
  description?: string;
  payloadDto?: new () => object;
  middlewares?: string[];
  filter?: HookFilter;
  errorMode?: 'capture' | 'throw';
}

export interface HookMetadata {
  pluginId?: string;
  pluginName?: string;
  version?: string;
  tags?: string[];
  phase?: HookPhase;
  priority?: number;
  description?: string;
  middlewares?: string[];
  errorMode?: 'capture' | 'throw';
  /** 强约束: 不允许 LLM 写, 由 Unit Core / Integrator / 静态声明注入 */
  payloadSchema?: import('zod').ZodTypeAny;
  /** 是否要求调用者携带有效 token (HookAuthMiddleware 据此判断是否拒绝) */
  requireAuth?: boolean;
  /** 控制器层桥接的方法引用 (className.methodName) */
  methodRef?: string;
}

export interface HookResult<R = unknown> {
  status: HookResultStatus;
  data?: R;
  error?: string;
  durationMs?: number;
}

export interface HookDebugEvent {
  type: 'emit' | 'result';
  name: string;
  payload?: unknown;
  results?: HookResult<unknown>[];
  ts: number;
}

export interface HookEvent<T = unknown> {
  name: string;
  payload: T;
  /** 运行时注入, LLM 不可见 */
  context?: HookInvocationContext;
  filter?: HookFilter;
  declaration?: HookDeclaration;
  /** captureSource 填的调用栈起点, 仅 SaaS 调试用 */
  callSite?: { file?: string; line?: number; stack?: string[] };
}

export type HookHandler<T = unknown, R = unknown> = (
  event: HookEvent<T>,
) => Promise<HookResult<R>> | HookResult<R>;

export type HookMiddleware<T = unknown, R = unknown> = (
  event: HookEvent<T>,
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
  /** 并发处理的最大数 (用于轮询批处理) */
  concurrency?: number;
  storage?: {
    mode: 'memory' | 'redis';
    queueKeyPrefix?: string;
    bindingKeyPrefix?: string;
  };
}
