import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { HOOK_COMPONENT_METADATA } from '../decorators/hook-component.decorator';
import { HookComponentRegistryService } from './hook-component.registry.service';
import { HookBusService } from './hook.bus.service';
import type { HookResult } from '../types/hook.types';
import { HookResultStatus } from '../enums/hook.enums';

/**
 * @title Hook Component Explorer Service
 * @description 启动时扫描所有 NestJS Provider，发现 @HookComponent 装饰的属性，
 *              读取其字符串值：
 *              1. 注册到 HookComponentRegistryService（含完整元数据）
 *              2. 在 HookBus 注册同名 hook（isComponent=true, denyLlm=true），
 *                 让 LLM 可通过 search_hook/get_hook_info 发现，但无法 call_hook 直接调用。
 *              与 HookControllerExplorerService 同样复用 DiscoveryService。
 * @keywords-cn hook组件自动发现, 启动扫描, 装饰器探测, hookbus注册
 * @keywords-en hook-component-explorer, startup-scan, decorator-discovery, hookbus-registration
 */
@Injectable()
export class HookComponentExplorerService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly registry: HookComponentRegistryService,
    private readonly bus: HookBusService,
  ) {}

  /**
   * 扫描所有 Provider，注册被 @HookComponent 标记的属性到注册表和 HookBus。
   * @keyword-en scan-and-register-hook-components
   */
  onModuleInit(): void {
    const wrappers = [
      ...this.discovery.getControllers(),
      ...this.discovery.getProviders(),
    ];

    for (const wrapper of wrappers) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const metatype = wrapper.metatype;
      if (!metatype) continue;

      const registrations: Array<{
        hookName: string;
        propertyKey: string | symbol;
        meta?: {
          description?: string;
          tags?: string[];
          payloadSchema?: import('zod').ZodTypeAny;
        };
      }> = Reflect.getMetadata(HOOK_COMPONENT_METADATA, metatype) ?? [];

      for (const { hookName, propertyKey, meta } of registrations) {
        const value = instance[propertyKey as string];
        if (typeof value !== 'string' || !value.trim()) continue;

        // 1. 注册到组件注册表
        this.registry.register(hookName, value, meta);

        // 2. 注册到 HookBus — denyLlm=true 阻止 call_hook 直接调用；
        //    isComponent=true 标记此为 Web Component Hook；
        //    LLM 可通过 search_hook / get_hook_info 发现 description/tags/schema。
        this.bus.register(
          hookName,
          async (): Promise<HookResult<never>> => ({
            status: HookResultStatus.Error,
            error: 'component-hook: use markdown fence, not call_hook',
          }),
          {
            description: meta?.description,
            tags: meta?.tags ?? [],
            payloadSchema: meta?.payloadSchema,
            isComponent: true,
            denyLlm: true,
          },
        );
      }
    }
  }
}
