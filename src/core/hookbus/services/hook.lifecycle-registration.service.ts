import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { listHookLifecycleDeclarations } from '../decorators/hook-lifecycle.decorator';
import { HookCacheService } from '../cache/hook.cache';
import { HookBusService } from './hook.bus.service';
import { HookResultStatus } from '../enums/hook.enums';

/**
 * @title Hook 生命周期注册服务
 * @description 启动时把 @HookLifecycle 声明的控制器方法挂到 HookBus, 以便外部以 Hook 形式调用。
 *              handler 直接接收 event。
 * @keywords-cn 生命周期注册, Hook映射缓存, 方法引用
 * @keywords-en lifecycle-registration, hook-binding-cache, method-reference
 */
@Injectable()
export class HookLifecycleRegistrationService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly cache: HookCacheService,
    private readonly hookBus: HookBusService,
  ) {}

  onModuleInit(): void {
    const declarations = listHookLifecycleDeclarations();
    for (const item of declarations) {
      if (!item.methodRef) continue;
      void this.cache.recordBinding(item.hook, item.methodRef);
      const exists = this.hookBus.select(item.hook).length > 0;
      if (exists) continue;
      const callable = this.resolveCallable(item.className, item.methodName);
      this.hookBus.register(
        item.hook,
        async (event) => {
          const methodRef =
            (await this.cache.getBinding(item.hook)) ?? item.methodRef;
          if (!callable) {
            return {
              status: HookResultStatus.Error,
              error: `hook target not found: ${methodRef}`,
            };
          }
          const args = this.resolveArgs(event.payload);
          const result = await callable(...args);
          return {
            status: HookResultStatus.Success,
            data: result,
          };
        },
        {
          pluginName: 'controller-hook',
          tags: ['controller', 'hook', 'registered'],
          description: item.description,
          middlewares: item.middlewares,
          errorMode: item.errorMode,
        },
      );
    }
  }

  private resolveArgs(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const obj = payload as { args?: unknown[]; input?: unknown };
      if (Array.isArray(obj.args)) return obj.args;
      if (obj.input !== undefined) {
        return Array.isArray(obj.input) ? obj.input : [obj.input];
      }
    }
    if (payload === undefined || payload === null) return [];
    return [payload];
  }

  private resolveCallable(
    className?: string,
    methodName?: string,
  ): ((...args: unknown[]) => unknown) | null {
    if (!className || !methodName) return null;
    const wrappers = [
      ...this.discovery.getControllers(),
      ...this.discovery.getProviders(),
    ];
    for (const wrapper of wrappers) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      const metatype = wrapper.metatype as { name?: string } | undefined;
      if (!instance || !metatype || metatype.name !== className) continue;
      const fn = instance[methodName];
      if (typeof fn !== 'function') continue;
      return (...args: unknown[]) =>
        (fn as (...next: unknown[]) => unknown).apply(instance, args);
    }
    return null;
  }
}
