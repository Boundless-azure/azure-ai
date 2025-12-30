import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HookRegistryService } from './hook.registry.service';
import { HookInvokerService } from './hook.invoker.service';
import type {
  HookBusOptions,
  HookEvent,
  HookRegistration,
  HookFilter,
  HookResult,
  HookHandler,
  HookMetadata,
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

  async emit<T>(event: HookEvent<T>): Promise<void> {
    const now = Date.now();
    const src = this.captureSource();
    const enriched: HookEvent<T> = { ...event, ts: now, source: src };
    await this.dispatchLocal(enriched);
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

  /**
   * @title HookBus 等待式发布
   * @description 本地执行并等待所有处理器完成，返回每个处理器的执行结果。
   * @keywords-cn Hook发布等待, 本地执行, 结果收集
   * @keywords-en hook-emit-await, local-execution, result-collect
   */
  async emitAwait<T, R>(event: HookEvent<T>): Promise<HookResult<R>[]> {
    return await this.dispatchLocal<T, R>(event);
  }
}
