import { Module, DynamicModule, Global } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { HookRegistryService } from './services/hook.registry.service';
import { HookInvokerService } from './services/hook.invoker.service';
import { HookBusService } from './services/hook.bus.service';
import { HookCacheService } from './cache/hook.cache';
import { HookDecoratorExplorerService } from './services/hook.decorator-explorer.service';
import { HookDebugStateService } from './services/hook.debug-state.service';
import { HookValidationMiddlewareService } from './services/hook.validation-middleware.service';
import { HookAuthMiddlewareService } from './services/hook.auth-middleware.service';
import { HookLifecycleRegistrationService } from './services/hook.lifecycle-registration.service';
import { HookbusDebugGateway } from './controllers/hookbus-debug.gateway';
import { HookbusDebugController } from './controllers/hookbus-debug.controller';
import { HookLifecycleInterceptor } from './interceptors/hook-lifecycle.interceptor';
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
        HookDecoratorExplorerService,
        HookDebugStateService,
        HookValidationMiddlewareService,
        HookAuthMiddlewareService,
        HookLifecycleRegistrationService,
        HookLifecycleInterceptor,
        HookbusDebugGateway,
      ],
      controllers: [HookbusDebugController],
      exports: [
        HookRegistryService,
        HookInvokerService,
        HookBusService,
        HookCacheService,
        HookDebugStateService,
      ],
    };
  }
}
