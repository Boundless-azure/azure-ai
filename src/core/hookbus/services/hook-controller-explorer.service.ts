import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { z } from 'zod';
import {
  HOOK_CONTROLLER_METADATA,
  HOOK_ROUTE_METADATA,
  type HookControllerMeta,
  type HookRouteMeta,
} from '../decorators/hook-controller.decorator';
import { HookResultStatus } from '../enums/hook.enums';
import type {
  HookEvent,
  HookMetadata,
  HookRequiredAbility,
  HookResult,
} from '../types/hook.types';
import { HookBusService } from './hook.bus.service';

/**
 * identity module @CheckAbility metadata key mirror.
 * @keyword-en check-ability-key-mirror
 */
const CHECK_ABILITY_KEY = 'check_ability_metadata';

/**
 * @title Hook Controller Explorer
 * @description Registers @HookRoute methods from Nest providers/controllers.
 *              A hook route receives event.payload as a SINGLE object (not a positional args array).
 * @keywords-en hook-controller-scan, single-object-payload, controller-reuse
 */
@Injectable()
export class HookControllerExplorerService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly scanner: MetadataScanner,
    private readonly hookBus: HookBusService,
  ) {}

  onModuleInit(): void {
    const wrappers = [
      ...this.discovery.getControllers(),
      ...this.discovery.getProviders(),
    ];
    for (const wrapper of wrappers) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance) as object | null;
      if (!prototype) continue;
      const metatype = wrapper.metatype;
      const classMeta = metatype
        ? this.reflector.get<HookControllerMeta>(
            HOOK_CONTROLLER_METADATA,
            metatype,
          )
        : undefined;
      const methodNames = this.scanner.getAllMethodNames(prototype);
      for (const methodName of methodNames) {
        const raw = instance[methodName];
        if (typeof raw !== 'function') continue;
        const fn = raw as (...args: unknown[]) => unknown;
        const route = this.reflector.get<HookRouteMeta>(
          HOOK_ROUTE_METADATA,
          fn,
        );
        if (!route) continue;
        const ability = this.readAbility(fn);
        const metadata = this.buildMetadata(route, classMeta, ability);
        this.hookBus.register(
          route.hook,
          async (event) =>
            await this.invokeRoute(
              instance,
              fn,
              route,
              event as HookEvent<unknown>,
            ),
          metadata,
        );
      }
    }
  }

  private async invokeRoute(
    instance: Record<string, unknown>,
    fn: (...args: unknown[]) => unknown,
    route: HookRouteMeta,
    event: HookEvent<unknown>,
  ): Promise<HookResult> {
    const principal = event.context?.principalId
      ? {
          id: event.context.principalId,
          type: event.context.principalType,
          user: {
            id: event.context.principalId,
            type: event.context.principalType,
          },
        }
      : undefined;
    // payload 现在是单对象 (非位置数组): 有声明 args → 作为第一个形参 (payload); 无参 hook → 不传 payload。
    const payloadArgs = route.args?.length ? [event.payload] : [];
    const result = await fn.apply(instance, [
      ...payloadArgs,
      principal,
      event.context,
      event,
    ]);
    if (this.isHookResult(result)) return result;
    return { status: HookResultStatus.Success, data: result };
  }

  private buildMetadata(
    route: HookRouteMeta,
    classMeta: HookControllerMeta | undefined,
    ability: HookRequiredAbility | HookRequiredAbility[] | null,
  ): HookMetadata {
    const routeMeta = route.metadata ?? {};
    return {
      ...routeMeta,
      pluginName:
        routeMeta.pluginName ?? classMeta?.pluginName ?? 'hook-controller',
      tags: [
        ...(classMeta?.tags ?? []),
        ...(routeMeta.tags ?? []),
        'hook-controller',
      ],
      description: route.description,
      payloadSchema: this.buildArgsSchema(route.args),
      requiredAbility: routeMeta.requiredAbility ?? ability ?? undefined,
    };
  }

  private buildArgsSchema(args: HookRouteMeta['args']): z.ZodTypeAny {
    // 单对象 payload 约定: 无参 hook → 允许省略或空对象; 有参 hook → 直接用其对象 schema (args[0])。
    // (迁移后 args 恒为 [] 或 [singleObjectSchema]; 存量多元素退化为末尾 tuple 兜底, 正常不触达)
    if (!args || args.length === 0) {
      return z.object({}).passthrough().optional();
    }
    if (args.length === 1) {
      return args[0];
    }
    const [first, ...rest] = args;
    return z.tuple([first, ...rest]);
  }

  private isHookResult(value: unknown): value is HookResult {
    if (!value || typeof value !== 'object') return false;
    const status = (value as { status?: unknown }).status;
    return (
      status === HookResultStatus.Success ||
      status === HookResultStatus.Error ||
      status === HookResultStatus.Skipped
    );
  }

  private readAbility(
    methodRef: (...args: unknown[]) => unknown,
  ): HookRequiredAbility | HookRequiredAbility[] | null {
    const raw = Reflect.getMetadata(CHECK_ABILITY_KEY, methodRef) as unknown;
    if (!raw) return null;
    if (Array.isArray(raw)) return raw as HookRequiredAbility[];
    if (typeof raw === 'object') return raw as HookRequiredAbility;
    return null;
  }
}
