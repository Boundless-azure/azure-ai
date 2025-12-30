import { Injectable } from '@nestjs/common';
import type {
  HookMiddleware,
  HookContext,
  HookResult,
} from '../../types/hook.types';
import { HookMonitorStoreService } from '../cache/hook.monitor.store';
import type { HookMonitorRecord } from '../types/hook-monitor.types';

/**
 * @title HookMonitor 服务
 * @description 生成中间件并将执行记录写入内存存储。
 * @keywords-cn Hook监控服务, 中间件, 执行记录
 * @keywords-en hook-monitor-service, middleware, execution-record
 */
@Injectable()
export class HookMonitorService {
  constructor(private readonly store: HookMonitorStoreService) {}

  getMiddleware<T, R>(): HookMiddleware<T, R> {
    return async (
      ctx: HookContext<T>,
      next: () => Promise<HookResult<R>>,
    ): Promise<HookResult<R>> => {
      const start = Date.now();
      const res = await next();
      const end = Date.now();
      const duration = end - start;
      const originFile = ctx.event.source?.file;
      const originLine = ctx.event.source?.line;
      const originStack = ctx.event.source?.stack;
      const receiverId =
        typeof ctx.state?.regId === 'string' ? ctx.state?.regId : undefined;
      const receiverPluginName = ctx.metadata?.pluginName;
      const receiverPhase = ctx.metadata?.phase;
      const receiverTags = ctx.metadata?.tags;
      const record: Omit<HookMonitorRecord, 'id'> = {
        name: ctx.event.name,
        requestId: ctx.event.requestId,
        startTs: start,
        endTs: end,
        durationMs: duration,
        status: res.status,
        payload: ctx.event.payload,
        resultData: res.data,
        error: res.error,
        originFile,
        originLine,
        originStack,
        receiverId,
        receiverPluginName,
        receiverPhase: receiverPhase as any,
        receiverTags,
        processId: process.pid,
      };
      this.store.add(record);
      return res;
    };
  }
}
