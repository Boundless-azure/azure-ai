import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { HookBusService } from './hook.bus.service';
import {
  HOOK_HANDLER_METADATA,
  type HookHandlerMeta,
} from '../decorators/hook-handler.decorator';
import type {
  HookEvent,
  HookMetadata,
  HookRequiredAbility,
  HookResult,
} from '../types/hook.types';

/**
 * identity 模块 @CheckAbility 装饰器使用的 metadata key (字符串常量复用)
 * - 这里只读不依赖 identity 模块的 import, 避免 core/hookbus 反向依赖 app/identity
 * - 与 src/app/identity/decorators/check-ability.decorator.ts 的 CHECK_ABILITY_KEY 同值
 * - 与 hook.lifecycle-registration.service.ts 中的同名常量保持一致
 * @keyword-en check-ability-key-mirror
 */
const CHECK_ABILITY_KEY = 'check_ability_metadata';

/**
 * @title Hook 装饰器扫描服务
 * @description 启动期扫描 @HookHandler 标注的方法并注册到 HookBus。
 *              handler 直接接收 event (无 ctx wrapper)。
 *              如果同方法上还挂了 @CheckAbility, 自动把 ability 元数据镜像进 metadata.requiredAbility,
 *              让 HookAbilityMiddleware 在 LLM 链路兜底校验, 跟 controller @HookLifecycle + @CheckAbility 路径行为对称。
 *              用户不必在 @HookHandler 的 metadata 里手写 requiredAbility, service 方法保持纯净 (只描述业务+权限要求)。
 * @keywords-cn Hook扫描, 装饰器注册, 自动发现, CASL继承, 鉴权对称
 * @keywords-en hook-scan, decorator-register, auto-discovery, casl-inherit, ability-symmetry
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
          event: HookEvent,
        ) => HookResult | Promise<HookResult>;
        const meta = this.reflector.get<HookHandlerMeta>(
          HOOK_HANDLER_METADATA,
          methodRef,
        );
        if (!meta) continue;
        const inheritedAbility = this.readAbility(methodRef);
        const finalMetadata = this.mergeAbility(meta.metadata, inheritedAbility);
        this.hookBus.register(
          meta.name,
          (event) => methodRef.call(instance, event),
          finalMetadata,
        );
      }
    }
  }

  /**
   * 读取方法上的 @CheckAbility 元数据 (单个或数组形态)
   * @keyword-en read-check-ability
   */
  private readAbility(
    methodRef: (...args: unknown[]) => unknown,
  ): HookRequiredAbility | HookRequiredAbility[] | null {
    const raw = Reflect.getMetadata(CHECK_ABILITY_KEY, methodRef) as unknown;
    if (!raw) return null;
    if (Array.isArray(raw)) return raw as HookRequiredAbility[];
    if (typeof raw === 'object') return raw as HookRequiredAbility;
    return null;
  }

  /**
   * 把读到的 ability 合并进现有 HookMetadata.requiredAbility:
   * - metadata 里已经显式声明的优先 (允许用户在 @HookHandler 里覆盖)
   * - 否则用从 @CheckAbility 继承来的
   * @keyword-en merge-ability-into-metadata
   */
  private mergeAbility(
    metadata: HookMetadata | undefined,
    inherited: HookRequiredAbility | HookRequiredAbility[] | null,
  ): HookMetadata | undefined {
    if (!inherited) return metadata;
    if (metadata?.requiredAbility) return metadata;
    return { ...(metadata ?? {}), requiredAbility: inherited };
  }
}
