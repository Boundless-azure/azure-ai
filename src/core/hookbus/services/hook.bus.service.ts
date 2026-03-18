import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HookRegistryService } from './hook.registry.service';
import { HookInvokerService } from './hook.invoker.service';
import { HookResultStatus } from '../enums/hook.enums';
import type {
  HookBusOptions,
  HookEvent,
  HookRegistration,
  HookFilter,
  HookResult,
  HookHandler,
  HookMetadata,
  HookDebugEvent,
} from '../types/hook.types';

/**
 * @title HookBus 服务
 * @description 提供 Hook 注册与事件发布（仅本地队列，多进程独立），并内置错误与空 Hook 处理。
 * @keywords-cn Hook总线, 注册, 本地发布, 多进程独立, 中间件
 * @keywords-en hook-bus, register, local-publish, multi-process-isolated, middleware
 */
@Injectable()
export class HookBusService implements OnModuleInit {
  private readonly logger = new Logger(HookBusService.name);
  private readonly debugListeners = new Set<(event: HookDebugEvent) => void>();
  private readonly queue: Array<{
    event: HookEvent<unknown>;
    resolve: (results: HookResult<unknown>[]) => void;
  }> = [];
  private activeWorkers = 0;
  private opts: HookBusOptions = {
    bufferSize: 1000,
    debug: false,
    concurrency: 8,
  };

  constructor(
    private readonly registry: HookRegistryService,
    private readonly invoker: HookInvokerService,
  ) {}

  onModuleInit(): void {
    this.logger.log('HookBus running in local-only mode');
  }

  configure(options: HookBusOptions): void {
    this.opts = { ...this.opts, ...options };
  }

  register<T, R>(
    name: string,
    handler: HookHandler<T, R>,
    metadata?: HookMetadata,
  ): HookRegistration<T, R> {
    return this.registry.register<T, R>(name, handler, metadata);
  }

  async emit<T, R>(event: HookEvent<T>): Promise<HookResult<R>[]> {
    const now = Date.now();
    const src = this.captureSource();
    const enriched: HookEvent<T> = { ...event, ts: now, source: src };
    this.emitDebug({
      type: 'emit',
      name: enriched.name,
      payload: enriched.payload,
      ts: Date.now(),
    });
    return await new Promise<HookResult<R>[]>((resolve) => {
      this.queue.push({
        event: enriched as HookEvent<unknown>,
        resolve: (results) => resolve(results as HookResult<R>[]),
      });
      this.scheduleConsumers();
    });
  }

  private async dispatchLocal<T, R>(
    event: HookEvent<T>,
  ): Promise<HookResult<R>[]> {
    const regs = this.select<T, R>(event.name, event.filter);
    return await this.invoker.invoke<T, R>({ event }, regs);
  }

  private matchFilter(
    meta:
      | {
          pluginId?: string;
          pluginName?: string;
          tags?: string[];
          phase?: string;
        }
      | undefined,
    filter?: HookFilter,
  ): boolean {
    if (!filter) return true;
    if (filter.pluginId && meta?.pluginId !== filter.pluginId) return false;
    if (filter.pluginName && meta?.pluginName !== filter.pluginName)
      return false;
    if (filter.tag && !(meta?.tags ?? []).includes(filter.tag)) return false;
    if (filter.phase && meta?.phase !== filter.phase) return false;
    return true;
  }

  select<T, R>(name: string, filter?: HookFilter): HookRegistration<T, R>[] {
    const regs = this.registry.get(name);
    return regs.filter((r) =>
      this.matchFilter(r.metadata, filter),
    ) as HookRegistration<T, R>[];
  }

  listRegistrations(): HookRegistration[] {
    return this.registry.list();
  }

  onDebug(listener: (event: HookDebugEvent) => void): () => void {
    this.debugListeners.add(listener);
    return () => {
      this.debugListeners.delete(listener);
    };
  }

  // 本地模式无需跨进程轮询

  private captureSource(): { file?: string; line?: number; stack?: string[] } {
    const err = new Error();
    const raw = typeof err.stack === 'string' ? err.stack.split('\n') : [];
    const stack = raw.map((s) => s.trim());
    let file: string | undefined;
    let line: number | undefined;
    for (const s of stack) {
      const m =
        s.match(/\((.*?):(\d+):(\d+)\)/) || s.match(/at\s+(.*?):(\d+):(\d+)/);
      if (m) {
        const p = m[1];
        if (!/hook\.bus\.service\.(ts|js)/.test(p)) {
          file = p;
          line = Number(m[2]);
          break;
        }
      }
    }
    return { file, line, stack };
  }

  private scheduleConsumers(): void {
    const concurrency = Math.max(1, this.opts.concurrency ?? 1);
    while (this.activeWorkers < concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.activeWorkers += 1;
      void this.consumeTask(task).finally(() => {
        this.activeWorkers -= 1;
        this.scheduleConsumers();
      });
    }
  }

  private async consumeTask(task: {
    event: HookEvent<unknown>;
    resolve: (results: HookResult<unknown>[]) => void;
  }): Promise<void> {
    try {
      const results = await this.dispatchLocal(task.event);
      this.emitDebug({
        type: 'result',
        name: task.event.name,
        results: results,
        ts: Date.now(),
      });
      task.resolve(results);
    } catch (error) {
      const failed: HookResult<unknown>[] = [
        {
          status: HookResultStatus.Error,
          error:
            error instanceof Error ? error.message : 'hook dispatch failed',
        },
      ];
      this.emitDebug({
        type: 'result',
        name: task.event.name,
        results: failed,
        ts: Date.now(),
      });
      task.resolve(failed);
    }
  }

  private emitDebug(event: HookDebugEvent): void {
    for (const listener of this.debugListeners) {
      listener(event);
    }
  }
}
