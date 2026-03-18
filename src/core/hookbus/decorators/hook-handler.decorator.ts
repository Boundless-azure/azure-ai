import type { HookMetadata } from '../types/hook.types';

/**
 * @title Hook 处理器装饰器
 * @description 标记 Hook 处理器方法，供 HookBus 自动扫描注册。
 * @keywords-cn Hook装饰器, 处理器注册, 自动扫描
 * @keywords-en hook-decorator, handler-register, auto-scan
 */
export interface HookHandlerMeta {
  name: string;
  metadata?: HookMetadata;
}

export const HOOK_HANDLER_METADATA = 'hookbus:handler';

export function HookHandler(name: string, metadata?: HookMetadata) {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown>,
  ) => {
    if (!descriptor.value) return;
    Reflect.defineMetadata(
      HOOK_HANDLER_METADATA,
      { name, metadata },
      descriptor.value,
    );
  };
}
