import { Module, OnModuleInit } from '@nestjs/common';
import { HookMonitorStoreService } from './cache/hook.monitor.store';
import { HookMonitorService } from './services/hook.monitor.service';
import { HookMonitorController } from './controller/hook.monitor.controller';
import { HookInvokerService } from '../services/hook.invoker.service';

/**
 * @title HookMonitor 模块
 * @description 提供 Hook 执行监控的中间件与查询接口。
 * @keywords-cn Hook监控模块, 中间件, 查询接口
 * @keywords-en hook-monitor-module, middleware, query-api
 */
@Module({
  controllers: [HookMonitorController],
  providers: [HookMonitorStoreService, HookMonitorService],
  exports: [HookMonitorStoreService, HookMonitorService],
})
export class HookMonitorModule implements OnModuleInit {
  constructor(
    private readonly invoker: HookInvokerService,
    private readonly monitor: HookMonitorService,
  ) {}

  onModuleInit(): void {
    this.invoker.use(this.monitor.getMiddleware());
  }
}
