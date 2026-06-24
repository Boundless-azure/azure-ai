import { z, type ZodTypeAny } from 'zod';
import type {
  HookEvent,
  HookFilter,
  HookHandler,
  HookInvocationContext,
  HookMetadata,
  HookMiddleware,
  HookBusOptions,
  HookRegistration,
  HookResult,
  HookDebugEvent,
} from '../types/hook.types';
import { createHookLogSession } from '../../observability/hook-log.factory';

/**
 * 跨进程 SaaS hook 调用器签名 (与 hook-rpc.client createCallSaaSHook 返回值同构)
 *  - 由 attachHookRpc 在 socket connect 时通过 setForwardToSaaS 注入
 *  - hook 名以 `saas.` 开头时, hookBus.emit 自动路由到此函数, 不再查本地 registrations
 * @keyword-en forward-to-saas-fn
 */
export type ForwardToSaaSFn = (
  hookName: string,
  payload: unknown,
  context?: HookInvocationContext,
) => Promise<{ errorMsg?: string[]; result: unknown }>;

/**
 * @title HookBus 服务
 * @description 提供 runner 内存型 Hook 注册与发布能力; emit 入口对 `saas.*` 前缀 hook 自动转发到 SaaS (避免运行时探测和死循环)。
 * @keywords-cn HookBus服务, 注册, 发布, 过滤, saas转发, 跨进程
 * @keywords-en hookbus-service, register, emit, filter, saas-forward, cross-process
 */
export class RunnerHookBusService {
  private readonly registrations = new Map<string, HookRegistration[]>();
  private readonly debugListeners = new Set<(event: HookDebugEvent) => void>();
  private readonly middlewares: HookMiddleware[] = [];
  private readonly namedMiddlewares = new Map<string, HookMiddleware>();
  private readonly bindingMap = new Map<string, string>();
  private readonly queue: Array<{
    event: HookEvent<unknown>;
    resolve: (results: HookResult<unknown>[]) => void;
  }> = [];
  private runningWorkers = 0;
  private forwardToSaaS?: ForwardToSaaSFn;
  private readonly options: HookBusOptions;

  constructor(options?: HookBusOptions) {
    const normalizedStorage = {
      mode: options?.storage?.mode ?? 'memory',
      queueKeyPrefix: options?.storage?.queueKeyPrefix,
      bindingKeyPrefix: options?.storage?.bindingKeyPrefix,
    };
    this.options = {
      concurrency: options?.concurrency ?? 4,
      storage: normalizedStorage,
    };
  }

  register<TPayload, TResult>(
    name: string,
    handler: HookHandler<TPayload, TResult>,
    metadata?: HookMetadata,
  ): HookRegistration<TPayload, TResult> {
    const item: HookRegistration<TPayload, TResult> = {
      name,
      handler,
      metadata,
    };
    const list = this.registrations.get(name) ?? [];
    list.push(item as HookRegistration);
    list.sort(
      (a, b) => (a.metadata?.priority ?? 0) - (b.metadata?.priority ?? 0),
    );
    this.registrations.set(name, list);
    const methodRef = metadata?.methodRef;
    if (methodRef && methodRef.trim()) {
      this.bindingMap.set(name, methodRef.trim());
    }
    return item;
  }

  /**
   * @title 注销 Hook 注册项
   * @description 默认整组移除; 传 predicate 可只移除匹配项, 用于 lifecycle 热替换 (只清同来源旧项, 不影响其他模块同名注册)。
   * @keywords-cn 注销, 移除, 热替换
   * @keywords-en unregister, remove, hot-replace
   */
  unregister(
    name: string,
    predicate?: (reg: HookRegistration) => boolean,
  ): number {
    const list = this.registrations.get(name);
    if (!list || list.length === 0) return 0;
    if (!predicate) {
      const removed = list.length;
      this.registrations.delete(name);
      this.bindingMap.delete(name);
      return removed;
    }
    const remained = list.filter((item) => !predicate(item));
    const removed = list.length - remained.length;
    if (removed === 0) return 0;
    if (remained.length === 0) {
      this.registrations.delete(name);
      this.bindingMap.delete(name);
    } else {
      this.registrations.set(name, remained);
    }
    return removed;
  }

  listRegistrations(): HookRegistration[] {
    return Array.from(this.registrations.values()).flat();
  }

  onDebug(listener: (event: HookDebugEvent) => void): () => void {
    this.debugListeners.add(listener);
    return () => {
      this.debugListeners.delete(listener);
    };
  }

  use(middleware: HookMiddleware): void {
    this.middlewares.push(middleware);
  }

  useNamed(name: string, middleware: HookMiddleware): void {
    this.namedMiddlewares.set(name, middleware);
  }

  recordBinding(hook: string, methodRef: string): void {
    if (!hook.trim() || !methodRef.trim()) return;
    this.bindingMap.set(hook.trim(), methodRef.trim());
  }

  getBinding(hook: string): string | null {
    return this.bindingMap.get(hook) ?? null;
  }

  /**
   * 注入跨进程 SaaS hook 转发器 (由 attachHookRpc 在 socket connect 时调用)
   * - hook 名以 `saas.` 开头的调用会自动路由到此函数
   * - 重复注入安全, 后注入覆盖前者 (socket 重连场景)
   * @keyword-en set-forward-to-saas
   */
  setForwardToSaaS(fn: ForwardToSaaSFn): void {
    this.forwardToSaaS = fn;
  }

  async emit<TPayload, TResult>(
    event: HookEvent<TPayload>,
  ): Promise<Array<HookResult<TResult>>> {
    this.emitDebug({
      type: 'emit',
      name: event.name,
      payload: event.payload,
      ts: Date.now(),
    });
    // saas.* 前缀的 hook 直接转发 SaaS, 不查本地 registrations 也不入本地队列
    // 死循环靠"前缀决定路由"避免: SaaS 端如果没找到 saas hook, 直接报错, 不会再回弹
    if (event.name.startsWith('saas.')) {
      const results = await this.forwardSaaSHook(event as HookEvent<unknown>);
      return results as unknown as Array<HookResult<TResult>>;
    }
    return await new Promise<Array<HookResult<TResult>>>((resolve) => {
      this.queue.push({
        event: event as HookEvent<unknown>,
        resolve: (results) => resolve(results as Array<HookResult<TResult>>),
      });
      this.schedule();
    });
  }

  /**
   * 走 forwardToSaaS 把 saas.* hook 调用转发到 SaaS, 把回包适配回 HookResult[]
   *  - forwardToSaaS 未注入: 单条 error (可能是 socket 还没连上)
   *  - errorMsg 非空: 单条 error 聚合所有报错
   *  - SaaS 端 reply.result 通常是数组(多 handler 适配后), 数组就拍平成多条 success result
   * @keyword-en forward-saas-hook
   */
  private async forwardSaaSHook(
    event: HookEvent<unknown>,
  ): Promise<Array<HookResult<unknown>>> {
    if (!this.forwardToSaaS) {
      return [
        {
          status: 'error',
          error: `saas hook forwarder not ready: ${event.name} (saas socket 未连)`,
        },
      ];
    }
    try {
      const reply = await this.forwardToSaaS(
        event.name,
        event.payload,
        event.context,
      );
      if (reply.errorMsg && reply.errorMsg.length > 0) {
        return [{ status: 'error', error: reply.errorMsg.join('; ') }];
      }
      if (Array.isArray(reply.result)) {
        return reply.result.map((d) => ({ status: 'success', data: d }));
      }
      return [{ status: 'success', data: reply.result }];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return [{ status: 'error', error: msg }];
    }
  }

  /** event.context.extras.debug=true 时为本次调用造 OTel log 会话, 否则走 noop 单例 */
  private buildLogSession(event: HookEvent<unknown>) {
    const debug = Boolean(event.context?.extras?.debug);
    return createHookLogSession({
      hookName: event.name,
      debug,
      ...(event.context?.traceId
        ? { upstreamTraceId: event.context.traceId }
        : {}),
    });
  }

  private schedule(): void {
    const concurrency = Math.max(1, this.options.concurrency ?? 1);
    while (this.runningWorkers < concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.runningWorkers += 1;
      void this.consumeTask(task).finally(() => {
        this.runningWorkers -= 1;
        this.schedule();
      });
    }
  }

  private async consumeTask(task: {
    event: HookEvent<unknown>;
    resolve: (results: HookResult<unknown>[]) => void;
  }): Promise<void> {
    const list = this.registrations.get(task.event.name) ?? [];
    const selected = list.filter((item) =>
      this.matchFilter(item.metadata, task.event.filter),
    );
    // fail-fast :: hook 名未注册 → 明确软错, 避免 LLM 看到 data=[] 误以为"成功 0 项"
    // 与 SaaS HookBus dispatchSaasHook 同语义 (errorMsg 含 Correction order),
    // 额外补 runner 特有提示: 完整 4 段名约束 (常见错误是 LLM 传短名 terminal.exec 而非 runner.unitcore.terminal.exec)
    if (selected.length === 0) {
      const result: HookResult<unknown> = {
        status: 'error',
        error:
          `hook-not-found:${task.event.name} :: This hook is not registered on this runner. ` +
          '⚠ Correction order: call tool init_tip first to receive discoveryChains, ' +
          'then walk the hook chain (get_hook_tag → search_hook → get_hook_info → call_hook) ' +
          'with target=runner + runnerId to find the right hook. Do not guess hook names. ' +
          '⚠ Runner hook 必须用完整 4 段名 platform.app.module.action ' +
          '(例 "runner.unitcore.terminal.exec" 而非 "terminal.exec"); ' +
          'runnerId 必须是 saas.app.runner.list 返回的 items[].id (UUID), 不是 alias.',
      };
      this.emitDebug({
        type: 'result',
        name: task.event.name,
        results: [result],
        ts: Date.now(),
      });
      task.resolve([result]);
      return;
    }
    const results: Array<HookResult<unknown>> = [];
    for (const item of selected) {
      const session = this.buildLogSession(task.event);
      // 镜像 reg.metadata.requiredAbility / denyLlm 到 event.declaration, 跟 SaaS HookInvoker 同构,
      // 让 ability middleware 不需要访问 reg 即可读到能力要求 + 拒 LLM 标记
      const decoratedDeclaration =
        item.metadata?.requiredAbility !== undefined ||
        item.metadata?.denyLlm !== undefined
          ? {
              ...task.event.declaration,
              ...(item.metadata?.requiredAbility !== undefined
                ? { requiredAbility: item.metadata.requiredAbility }
                : {}),
              ...(item.metadata?.denyLlm !== undefined
                ? { denyLlm: item.metadata.denyLlm }
                : {}),
            }
          : task.event.declaration;
      const decoratedEvent: HookEvent<unknown> = {
        ...task.event,
        log: session.log,
        ...(decoratedDeclaration ? { declaration: decoratedDeclaration } : {}),
      };
      const named = (decoratedEvent.declaration?.middlewares ?? [])
        .map((name) => this.namedMiddlewares.get(name))
        .filter((mw): mw is HookMiddleware<unknown, unknown> => Boolean(mw));
      const chain = this.compose([...named, ...this.middlewares], async () =>
        this.runHandlerWithSchema(item, decoratedEvent),
      );
      try {
        const result = await chain(decoratedEvent);
        const debugLog = session.finalize({
          ok: result.status !== 'error',
          ...(result.error ? { error: result.error } : {}),
        });
        results.push(debugLog.length > 0 ? { ...result, debugLog } : result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'hook failed';
        const debugLog = session.finalize({ error: msg });
        results.push({
          status: 'error',
          error: msg,
          ...(debugLog.length > 0 ? { debugLog } : {}),
        });
      }
    }
    this.emitDebug({
      type: 'result',
      name: task.event.name,
      results,
      ts: Date.now(),
    });
    task.resolve(results);
  }

  private matchFilter(
    metadata: HookMetadata | undefined,
    filter: HookFilter | undefined,
  ): boolean {
    if (!filter) return true;
    if (filter.pluginId && metadata?.pluginId !== filter.pluginId) return false;
    if (filter.pluginName && metadata?.pluginName !== filter.pluginName)
      return false;
    if (filter.tag && !(metadata?.tags ?? []).includes(filter.tag))
      return false;
    if (filter.phase && metadata?.phase !== filter.phase) return false;
    return true;
  }

  /**
   * 紧贴 handler 的 zod payload 校验; metadata.payloadSchema 缺省时跳过 (兼容存量 hook)。
   *
   * **智能 array unwrap (args 形参约定适配)**:
   * SaaS 端 call_hook / search_hook 等工具都按 "args 数组形参" 约定把 payload 包成 `[{...}]` 数组,
   * 这是因为 SaaS @HookRoute({args:[...]}) 装饰器自动用 z.tuple(...) 包了一层 schema。
   * Runner 端 unit hook (terminal/mongo/file 等) 直接传 z.object(...) 单对象 schema, 没有 tuple 包装,
   * 直接 safeParse 数组 payload 会得到 `expected object, received array` 失败。
   *
   * 兼容策略:
   *   1. 先按 schema 直接 safeParse 原 payload (跟 SaaS HookInvoker 行为对齐)
   *   2. 失败且 payload 是数组 → 取 payload[0] 再 safeParse (适配 SaaS 包 array 调过来的业务 hook)
   *   3. 仍失败 → 返回原 error (包含字段路径), 让 LLM 看到具体哪里错
   *
   * 这样:
   *   - meta hook (payloadSchema=z.tuple([...])) 直接 array 校验通过, 不进 unwrap
   *   - 业务 hook (payloadSchema=z.object({...})) 通过 unwrap 兼容 SaaS 调用
   *   - runner 内部直传 object 的调用 (source=system/runner) 直接通过, 不受影响
   * @keyword-en run-handler-with-schema, array-unwrap-fallback
   */
  private async runHandlerWithSchema(
    reg: HookRegistration,
    event: HookEvent<unknown>,
  ): Promise<HookResult<unknown>> {
    const schema = reg.metadata?.payloadSchema;
    if (!schema) return await reg.handler(event);

    // 第一遍: 直接按原 payload 校验
    const direct = schema.safeParse(event.payload);
    if (direct.success) {
      return await reg.handler({ ...event, payload: direct.data });
    }
    let issues = direct.error.issues;

    // 第二遍 fallback: array 包装 → 取 [0] 再试
    if (Array.isArray(event.payload)) {
      const unwrapped = (event.payload as unknown[])[0];
      const second = schema.safeParse(unwrapped);
      if (second.success) {
        return await reg.handler({ ...event, payload: second.data });
      }
      issues = second.error.issues;
    }

    // 两次都失败, 返回最贴近 handler 实际入参的错误描述
    const detail = issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    return {
      status: 'error',
      error:
        `payload-schema-invalid: ${detail}; ` +
        `expectedPayloadSchema=${this.describePayloadSchema(schema)}`,
    };
  }

  /**
   * 把当前 runner hook 的 zod payload schema 投影为紧凑 JSON Schema, 随校验错误直接返回。
   * @keyword-cn payload模式描述, zod校验
   * @keyword-en payload-schema-description, zod-validation
   */
  private describePayloadSchema(schema: ZodTypeAny): string {
    try {
      return this.previewSchemaValue(z.toJSONSchema(schema));
    } catch {
      const schemaDef = (schema as { _def?: { type?: string; typeName?: string } })
        ._def;
      return this.previewSchemaValue({
        type: schemaDef?.type ?? schemaDef?.typeName ?? 'zod-schema',
      });
    }
  }

  /**
   * 压缩展示 JSON Schema, 避免单条 hook 错误响应过长。
   * @keyword-cn schema预览, payload校验
   * @keyword-en schema-preview, payload-validation
   */
  private previewSchemaValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    const raw = JSON.stringify(value);
    if (!raw) return `<${typeof value}>`;
    return raw.length > 1800 ? `${raw.slice(0, 1797)}...` : raw;
  }

  private compose<TPayload, TResult>(
    middlewares: HookMiddleware<TPayload, TResult>[],
    last: () => Promise<HookResult<TResult>>,
  ) {
    return async (event: HookEvent<TPayload>): Promise<HookResult<TResult>> => {
      let idx = -1;
      const dispatch = async (i: number): Promise<HookResult<TResult>> => {
        if (i <= idx) throw new Error('next() called multiple times');
        idx = i;
        const middleware = middlewares[i];
        if (!middleware) return await last();
        return await middleware(event, () => dispatch(i + 1));
      };
      return await dispatch(0);
    };
  }

  private emitDebug(event: HookDebugEvent): void {
    for (const listener of this.debugListeners) {
      listener(event);
    }
  }
}
