/**
 * @title HookBus 类型 (Runner)
 * @description 与 SaaS 端 HookBus 保持一致的协议外形:
 *              - HookEvent 是入口标准消息, 携带 payload (业务参数) + context (运行时注入)
 *              - HookHandler / HookMiddleware 直接接收 event, 不再包一层 ctx wrapper
 *              - HookInvocationContext 是 token / principalId / runnerId 等环境信息的统一通道
 * @keywords-cn HookBus类型, 调用上下文, 事件外形, 中间件
 * @keywords-en hookbus-types, invocation-context, event-shape, middleware
 */
export interface HookFilter {
  pluginId?: string;
  pluginName?: string;
  tag?: string;
  phase?: 'before' | 'after' | 'around';
}

/**
 * Hook 所需能力声明 (CASL action/subject)
 * - 与 SaaS 端 HookRequiredAbility / identity RequiredAbility 同构
 * - Runner 不本地校验 (ability 数据在 SaaS), 仅透传到 metadata 并通过 runner.system.hookbus.getInfo 暴露给 LLM 自查
 * @keyword-en hook-required-ability
 */
export interface HookRequiredAbility {
  action: string;
  subject: string;
}

/**
 * Hook 调用环境上下文
 * - LLM 不可见, 不通过工具 schema 暴露
 * - SaaS 派发到 Runner 时通过 WS envelope.context 透传, Runner 端透传给 hookBus.emit
 * @keyword-en hook-invocation-context
 */
export interface HookInvocationContext {
  /** 调用者凭据 (jwt / api-key); 由 SaaS 入口注入 */
  token?: string;
  /** 解析后的主体 ID (上游中间件回填) */
  principalId?: string;
  /** 主体类型 user / agent / system */
  principalType?: string;
  /** 调用来源 */
  source?: 'llm' | 'system' | 'http' | 'runner';
  /** 跨服务追踪 ID (OTel) */
  traceId?: string;
  /** 调用涉及的 runner */
  runnerId?: string;
  /** 时间戳 */
  ts?: number;
  /** 透传扩展位 */
  extras?: Record<string, unknown>;
}

export interface HookEvent<TPayload = unknown> {
  name: string;
  payload: TPayload;
  context?: HookInvocationContext;
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
  /**
   * @field payloadSchema
   * @description Zod schema (来自 Unit Core / 用户声明), 用于在 runner.system.hookbus.getInfo 时派生 JSON Schema。
   *              强约束: 不允许 LLM 写, 仅 Unit Core / Integrator 注册时填入。
   * @keyword-en payload-schema, zod
   */
  payloadSchema?: import('zod').ZodTypeAny;
  /** 是否要求调用者携带有效 token */
  requireAuth?: boolean;
  /**
   * 调用方所需能力 (action/subject); 一个或多个 (多个为 AND)。
   * - Runner 端不本地校验, 仅透传 + LLM 自查暴露
   * - 由 SaaS 端 HookAbilityMiddleware 在派发 hook:call 前完成校验
   * @keyword-en required-ability
   */
  requiredAbility?: HookRequiredAbility | HookRequiredAbility[];
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
