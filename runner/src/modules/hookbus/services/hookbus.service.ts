import type {
  HookEvent,
  HookFilter,
  HookHandler,
  HookMetadata,
  HookMiddleware,
  HookBusOptions,
  HookRegistration,
  HookResult,
  HookDebugEvent,
} from '../types/hook.types';
import { createHookLogSession } from '../../observability/hook-log.factory';

/**
 * @title HookBus 服务
 * @description 提供 runner 内存型 Hook 注册与发布能力。
 * @keywords-cn HookBus服务, 注册, 发布, 过滤
 * @keywords-en hookbus-service, register, emit, filter
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

  async emit<TPayload, TResult>(
    event: HookEvent<TPayload>,
  ): Promise<Array<HookResult<TResult>>> {
    this.emitDebug({
      type: 'emit',
      name: event.name,
      payload: event.payload,
      ts: Date.now(),
    });
    return await new Promise<Array<HookResult<TResult>>>((resolve) => {
      this.queue.push({
        event: event as HookEvent<unknown>,
        resolve: (results) => resolve(results as Array<HookResult<TResult>>),
      });
      this.schedule();
    });
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
    const results: Array<HookResult<unknown>> = [];
    for (const item of selected) {
      const session = this.buildLogSession(task.event);
      const decoratedEvent: HookEvent<unknown> = {
        ...task.event,
        log: session.log,
      };
      const named = (task.event.declaration?.middlewares ?? [])
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
   * 紧贴 handler 的 zod payload 校验; metadata.payloadSchema 缺省时跳过 (兼容存量 hook)
   * @keyword-en run-handler-with-schema
   */
  private async runHandlerWithSchema(
    reg: HookRegistration,
    event: HookEvent<unknown>,
  ): Promise<HookResult<unknown>> {
    const schema = reg.metadata?.payloadSchema;
    if (!schema) return await reg.handler(event);
    const parsed = schema.safeParse(event.payload);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ');
      return {
        status: 'error',
        error: `payload-schema-invalid: ${detail}`,
      };
    }
    return await reg.handler({ ...event, payload: parsed.data });
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
