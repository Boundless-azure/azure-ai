import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  HookRegistration,
  HookHandler,
  HookMetadata,
} from '../types/hook.types';

/**
 * @title Hook 注册服务
 * @description 管理 Hook 处理器的注册、查询与移除。
 * @keywords-cn Hook注册, 处理器管理
 * @keywords-en hook-register, handler-management
 */
@Injectable()
export class HookRegistryService {
  private readonly registry = new Map<string, HookRegistration[]>();

  register<T, R>(
    name: string,
    handler: HookHandler<T, R>,
    metadata?: HookMetadata,
  ): HookRegistration<T, R> {
    const reg: HookRegistration<T, R> = {
      id: randomUUID(),
      name,
      handler,
      metadata,
    };
    const list = this.registry.get(name) ?? [];
    list.push(reg);
    // 按优先级排序（小值优先）；缺省 0
    list.sort(
      (a, b) => (a.metadata?.priority ?? 0) - (b.metadata?.priority ?? 0),
    );
    this.registry.set(name, list);
    return reg;
  }

  remove(name: string, id: string): boolean {
    const list = this.registry.get(name);
    if (!list) return false;
    const next = list.filter((r) => r.id !== id);
    this.registry.set(name, next);
    return next.length !== list.length;
  }

  get(name: string): HookRegistration[] {
    return this.registry.get(name) ?? [];
  }

  list(): HookRegistration[] {
    const all: HookRegistration[] = [];
    for (const [, regs] of this.registry) all.push(...regs);
    return all;
  }
}
