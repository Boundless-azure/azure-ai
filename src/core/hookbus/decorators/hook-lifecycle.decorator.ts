import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { HookLifecycleInterceptor } from '../interceptors/hook-lifecycle.interceptor';
import type { HookFilter } from '../types/hook.types';

/**
 * @title Hook 生命周期声明装饰器
 * @description 为业务接口声明单次 Hook 的注册策略，不改变原有 DTO 与控制器逻辑。
 *              payloadSchema 走 zod (SSOT), 用户声明的是 input 部分形状, lifecycle-registration
 *              注册到 HookBus 时自动包装成 envelope `{ input, meta?, ok?, result?, error? }` 写入 metadata.payloadSchema,
 *              由 invoker 在 handler 前自动校验, 同时 LLM 通过 get_hook_info 读取派生的 JSON Schema。
 * @keywords-cn Hook声明, 生命周期, 装饰器, zod-schema, SSOT
 * @keywords-en hook-declaration, lifecycle, decorator, zod-schema, ssot
 */
export interface HookLifecycleOptions {
  hook: string;
  description: string;
  /** zod schema, 描述 input 部分形状; 框架自动包装 envelope, 不要自己包 input 字段 */
  payloadSchema?: ZodTypeAny;
  middlewares?: string[];
  payloadSource?: 'body' | 'query' | 'params' | 'auto';
  filter?: HookFilter;
  errorMode?: 'capture' | 'throw';
}

export interface HookLifecycleDeclaration {
  hook: string;
  description: string;
  payloadSchema?: ZodTypeAny;
  middlewares?: string[];
  filter?: HookFilter;
  errorMode?: 'capture' | 'throw';
  className?: string;
  methodName?: string;
  methodRef?: string;
}

export const HOOK_LIFECYCLE_METADATA = 'hookbus:lifecycle';
const hookLifecycleRegistry = new Map<string, HookLifecycleDeclaration>();

export function listHookLifecycleDeclarations(): HookLifecycleDeclaration[] {
  return Array.from(hookLifecycleRegistry.values());
}

export function HookLifecycle(options: HookLifecycleOptions) {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown>,
  ) => {
    if (!descriptor.value) return;
    const className =
      target && (target as { constructor?: { name?: string } }).constructor
        ? (target as { constructor?: { name?: string } }).constructor?.name
        : 'UnknownController';
    const methodRef = `${className}.${String(propertyKey)}`;
    hookLifecycleRegistry.set(options.hook, {
      hook: options.hook,
      description: options.description,
      payloadSchema: options.payloadSchema,
      middlewares: options.middlewares,
      filter: options.filter,
      errorMode: options.errorMode,
      className,
      methodName: String(propertyKey),
      methodRef,
    });
    applyDecorators(
      SetMetadata(HOOK_LIFECYCLE_METADATA, options),
      UseInterceptors(HookLifecycleInterceptor),
    )(target, propertyKey, descriptor);
  };
}
