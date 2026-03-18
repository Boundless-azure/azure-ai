import { Module, DynamicModule } from '@nestjs/common';
import { HookRegistryService } from './services/hook.registry.service';
import { HookInvokerService } from './services/hook.invoker.service';
import { HookBusService } from './services/hook.bus.service';
import { HookCacheService } from './cache/hook.cache';
import type { HookBusOptions } from './types/hook.types';

/**
 * @title HookBus 模块
 * @description 提供本地队列的 Hook 总线与审计能力（多进程独立、无跨进程分发）。
 * @keywords-cn HookBus模块, 本地队列, 审计
 * @keywords-en hookbus-module, local-queue, audit
 */
@Module({})
export class HookBusModule {
  static forRoot(_options?: HookBusOptions): DynamicModule {
    return {
      module: HookBusModule,
      providers: [
        HookRegistryService,
        HookInvokerService,
        HookBusService,
        HookCacheService,
      ],
      exports: [
        HookRegistryService,
        HookInvokerService,
        HookBusService,
        HookCacheService,
      ],
    };
  }
}
