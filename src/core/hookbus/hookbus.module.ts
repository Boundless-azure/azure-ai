import { Module, DynamicModule, Global } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { HookRegistryService } from './services/hook.registry.service';
import { HookInvokerService } from './services/hook.invoker.service';
import { HookBusService } from './services/hook.bus.service';
import { HookCacheService } from './cache/hook.cache';
import { HookControllerExplorerService } from './services/hook-controller-explorer.service';
import { HookDebugStateService } from './services/hook.debug-state.service';
import { HookAuthMiddlewareService } from './services/hook.auth-middleware.service';
import { HookbusDebugGateway } from './controllers/hookbus-debug.gateway';
import { HookbusDebugController } from './controllers/hookbus-debug.controller';
import { HookInvokeController } from './controllers/hook-invoke.controller';
import { HookComponentRegistryService } from './services/hook-component.registry.service';
import { HookComponentExplorerService } from './services/hook-component.explorer.service';
import type { HookBusOptions } from './types/hook.types';

/**
 * @title HookBus 模块
 * @description 提供本地队列的 Hook 总线与审计能力（多进程独立、无跨进程分发）。
 * @keywords-cn HookBus模块, 本地队列, 审计
 * @keywords-en hookbus-module, local-queue, audit
 */
@Global()
@Module({})
export class HookBusModule {
  static forRoot(_options?: HookBusOptions): DynamicModule {
    return {
      module: HookBusModule,
      imports: [DiscoveryModule],
      providers: [
        HookRegistryService,
        HookInvokerService,
        HookBusService,
        HookCacheService,
        HookControllerExplorerService,
        HookDebugStateService,
        HookAuthMiddlewareService,
        HookbusDebugGateway,
        HookComponentRegistryService,
        HookComponentExplorerService,
      ],
      controllers: [HookbusDebugController, HookInvokeController],
      exports: [
        HookRegistryService,
        HookInvokerService,
        HookBusService,
        HookCacheService,
        HookDebugStateService,
        HookComponentRegistryService,
      ],
    };
  }
}
