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
    this.options = { concurrency: options?.concurrency ?? 4, storage: normalizedStorage };
  }

  register<TPayload, TResult>(
    name: string,
    handler: HookHandler<TPayload, TResult>,
    metadata?: HookMetadata,
  ): HookRegistration<TPayload, TResult> {
    const item: HookRegistration<TPayload, TResult> = { name, handler, metadata };
    const list = this.registrations.get(name) ?? [];
    list.push(item as HookRegistration);
    list.sort((a, b) => (a.metadata?.priority ?? 0) - (b.metadata?.priority ?? 0));
    this.registrations.set(name, list);
    const methodRef = metadata?.methodRef;
    if (methodRef && methodRef.trim()) {
      this.bindingMap.set(name, methodRef.trim());
    }
    return item;
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
      const named = (task.event.declaration?.middlewares ?? [])
        .map((name) => this.namedMiddlewares.get(name))
        .filter((mw): mw is HookMiddleware<unknown, unknown> => Boolean(mw));
      const chain = this.compose([...named, ...this.middlewares], async () =>
        item.handler(task.event),
      );
      try {
        const result = await chain(task.event);
        results.push(result as HookResult<unknown>);
      } catch (error) {
        results.push({
          status: 'error',
          error: error instanceof Error ? error.message : 'hook failed',
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

  private matchFilter(metadata: HookMetadata | undefined, filter: HookFilter | undefined): boolean {
    if (!filter) return true;
    if (filter.pluginId && metadata?.pluginId !== filter.pluginId) return false;
    if (filter.pluginName && metadata?.pluginName !== filter.pluginName) return false;
    if (filter.tag && !(metadata?.tags ?? []).includes(filter.tag)) return false;
    if (filter.phase && metadata?.phase !== filter.phase) return false;
    return true;
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
