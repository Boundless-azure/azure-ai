import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { HookLifecycleInterceptor } from '../interceptors/hook-lifecycle.interceptor';
import type { HookFilter } from '../types/hook.types';

/**
 * @title Hook 生命周期声明装饰器
 * @description 为业务接口声明单次 Hook 的注册策略，不改变原有 DTO 与控制器逻辑。
 * @keywords-cn Hook声明, 生命周期, 装饰器
 * @keywords-en hook-declaration, lifecycle, decorator
 */
export interface HookLifecycleOptions {
  hook: string;
  description: string;
  payloadDto?: new () => object;
  middlewares?: string[];
  payloadSource?: 'body' | 'query' | 'params' | 'auto';
  filter?: HookFilter;
  errorMode?: 'capture' | 'throw';
}

export interface HookLifecycleDeclaration {
  hook: string;
  description: string;
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
