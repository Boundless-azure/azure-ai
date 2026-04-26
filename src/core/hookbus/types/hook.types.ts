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

/**
 * Hook 日志接口 (event.log)
 * - handler 通过 event.log.info(...) 写日志, 禁 console.log / 独立 LogRecord
 * - 实现见 core/observability/services/hook-log.factory.ts
 *   * debug=false 走 noop 单例, 零开销
 *   * debug=true 落 OTel SpanEvent, finalize drain 进 reply.debugLog
 * @keyword-en hook-log-api
 */
export interface HookLog {
  trace(message: string, attrs?: Record<string, unknown>): void;
  debug(message: string, attrs?: Record<string, unknown>): void;
  info(message: string, attrs?: Record<string, unknown>): void;
  warn(message: string, attrs?: Record<string, unknown>): void;
  error(message: string, attrs?: Record<string, unknown>): void;
  /** 自定义事件名, 对应 OTel SpanEvent.name */
  event(name: string, attrs?: Record<string, unknown>): void;
}

/**
 * drain 出来的单条日志, 透过 reply.debugLog 回到 SaaS / LLM
 * @keyword-en hook-log-entry
 */
export interface HookLogEntry {
  ts: number;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'event';
  message: string;
  attrs?: Record<string, unknown>;
}

/**
 * 一次 hook 调用的 log 会话; invoker 创建, 注入到 event.log, 调完 finalize 拿条目
 * @keyword-en hook-log-session
 */
export interface HookLogSession {
  log: HookLog;
  finalize(opts?: { ok?: boolean; error?: string }): HookLogEntry[];
}

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
  middlewares?: string[];
  filter?: HookFilter;
  errorMode?: 'capture' | 'throw';
  /**
   * runtime 镜像; 由 HookInvokerService.invoke 从命中的 reg.metadata.requiredAbility 复制过来,
   * 让中间件无需访问 reg 即可读到能力要求 (中间件签名只接受 event)。
   * @keyword-en required-ability-mirror
   */
  requiredAbility?: HookRequiredAbility | HookRequiredAbility[];
}

/**
 * Hook 所需能力声明 (CASL action/subject)
 * - 形状与 identity 模块的 RequiredAbility 同构, 但本类型刻意 in-place 定义,
 *   避免 core/hookbus 反向依赖 app/identity
 * - HookAbilityMiddleware 在 source === 'llm' 路径上据此调用 AbilityService.can(...)
 * @keyword-en hook-required-ability
 */
export interface HookRequiredAbility {
  action: string;
  subject: string;
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
  /**
   * 调用方所需能力 (action/subject); 一个或多个 (多个为 AND 关系)。
   * - 由 @HookLifecycle 注册时从同方法 @CheckAbility 自动继承; 也可显式声明
   * - HookAbilityMiddleware 仅在 context.source === 'llm' 时校验, 其他来源 (http/system) 由各自入口卫兵负责
   * @keyword-en required-ability
   */
  requiredAbility?: HookRequiredAbility | HookRequiredAbility[];
}

export interface HookResult<R = unknown> {
  status: HookResultStatus;
  data?: R;
  error?: string;
  durationMs?: number;
  /**
   * debug=true 时由 invoker drain HookLogSession 注入; 否则缺省。
   * 走 reply.debugLog 回 LLM / SaaS, 不走 console.log / 独立 LogRecord。
   * @keyword-en debug-log
   */
  debugLog?: HookLogEntry[];
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
  /**
   * Hook 日志接口 (event.log.info(...) 等); 由 invoker 注入, 永远非空。
   * - debug=false 时是 noop 单例, 零开销
   * - debug=true 时挂在一次性 InMemorySpanExporter 上, finalize drain 进 reply.debugLog
   * @keyword-en hook-log-on-event
   */
  log?: HookLog;
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
