import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { z, type ZodTypeAny } from 'zod';
import { listHookLifecycleDeclarations } from '../decorators/hook-lifecycle.decorator';
import { HookCacheService } from '../cache/hook.cache';
import { HookBusService } from './hook.bus.service';
import { HookResultStatus } from '../enums/hook.enums';
import type { HookRequiredAbility } from '../types/hook.types';

/**
 * identity 模块 @CheckAbility 装饰器使用的 metadata key (字符串常量复用)
 * - 这里只读不依赖 identity 模块的 import, 避免 core/hookbus 反向依赖 app/identity
 * - 与 src/app/identity/decorators/check-ability.decorator.ts 的 CHECK_ABILITY_KEY 同值
 * @keyword-en check-ability-key-mirror
 */
const CHECK_ABILITY_KEY = 'check_ability_metadata';

/**
 * 把用户声明的 input schema 包装成 lifecycle envelope schema
 * envelope shape :: { input, meta?, ok?, result?, error? }
 * @keyword-en wrap-lifecycle-envelope-schema
 */
function wrapLifecycleEnvelope(inputSchema: ZodTypeAny): ZodTypeAny {
  return z
    .object({
      input: inputSchema,
      meta: z.unknown().optional(),
      ok: z.boolean().optional(),
      result: z.unknown().optional(),
      error: z.unknown().optional(),
    })
    .passthrough();
}

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
      const { callable, ability } = this.resolveTarget(
        item.className,
        item.methodName,
      );
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
          // HTTP 路径下 NestJS 通过 @CurrentPrincipal() 等装饰器把 principal 注入到 controller method 第 2 参;
          // hook 路径绕开了 NestJS pipeline, 这里手动把 event.context 转成 JwtPayload 形态 append 到 args 末尾,
          // 让 controller method 与 service 层 (尤其是 data-permission build) 能拿到一致的 principal。
          // controller method 没声明 principal 参数时多余位置参数被静默丢弃, 不会破坏既有签名。
          const principal = event.context?.principalId
            ? {
                id: event.context.principalId,
                type: event.context.principalType,
              }
            : undefined;
          const result = await callable(...args, principal);
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
          payloadSchema: item.payloadSchema
            ? wrapLifecycleEnvelope(item.payloadSchema)
            : undefined,
          requiredAbility: ability ?? undefined,
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

  /**
   * @title 同时取出 controller 方法的可调对象与 @CheckAbility 元数据
   * @description 一次扫描兼顾 callable 与 ability 元数据继承,
   *              避免 onModuleInit 阶段两次遍历 DiscoveryService。
   * @keywords-cn 反射读取, 能力继承, 控制器方法
   * @keywords-en reflect-resolve, ability-inheritance, controller-method
   */
  private resolveTarget(
    className?: string,
    methodName?: string,
  ): {
    callable: ((...args: unknown[]) => unknown) | null;
    ability: HookRequiredAbility | HookRequiredAbility[] | null;
  } {
    if (!className || !methodName) return { callable: null, ability: null };
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
      const callable = (...args: unknown[]) =>
        (fn as (...next: unknown[]) => unknown).apply(instance, args);
      const ability = (Reflect.getMetadata(CHECK_ABILITY_KEY, fn) ?? null) as
        | HookRequiredAbility
        | HookRequiredAbility[]
        | null;
      return { callable, ability };
    }
    return { callable: null, ability: null };
  }
}
