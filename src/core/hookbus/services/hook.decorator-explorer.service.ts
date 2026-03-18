import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { HookBusService } from './hook.bus.service';
import {
  HOOK_HANDLER_METADATA,
  type HookHandlerMeta,
} from '../decorators/hook-handler.decorator';
import type { HookContext, HookResult } from '../types/hook.types';

/**
 * @title Hook 装饰器扫描服务
 * @description 扫描标注的 Hook 处理器并注册到 HookBus。
 * @keywords-cn Hook扫描, 装饰器注册, 自动发现
 * @keywords-en hook-scan, decorator-register, auto-discovery
 */
@Injectable()
export class HookDecoratorExplorerService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly scanner: MetadataScanner,
    private readonly hookBus: HookBusService,
  ) {}

  onModuleInit(): void {
    const providers = this.discovery.getProviders();
    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance) as object | null;
      if (!prototype) continue;
      const methodNames = this.scanner.getAllMethodNames(prototype);
      for (const methodName of methodNames) {
        const instanceRecord = instance as Record<string, unknown>;
        const handler = instanceRecord[methodName];
        if (typeof handler !== 'function') continue;
        const methodRef = handler as (
          ctx: HookContext,
        ) => HookResult | Promise<HookResult>;
        const meta = this.reflector.get<HookHandlerMeta>(
          HOOK_HANDLER_METADATA,
          methodRef,
        );
        if (!meta) continue;
        this.hookBus.register(
          meta.name,
          (ctx) => methodRef.call(instance, ctx),
          meta.metadata,
        );
      }
    }
  }
}
