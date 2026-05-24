import type {
  DataPermissionBinding,
  DataPermissionNodeFn,
} from '../types/data-permission.types';

/**
 * @title Runner DataPermission Registry
 * @description 纯内存注册表: solution / 业务模块在启动时 bind(table, action, nodeKey, fn) 把数据权限节点函数挂上去。
 *              跟 SaaS 端 @BindDataPermissionNode 装饰器 + DataPermissionRegistryService 同语义, 但 runner 没装饰器栈, 用纯函数声明。
 *              热更新友好: 同 (table,action,nodeKey) 后注册会覆盖.
 * @keywords-cn 数据权限注册表, 节点绑定, 内存注册
 * @keywords-en data-permission-registry, node-binding, in-memory
 */
export class DataPermissionRegistry {
  private readonly bindings = new Map<string, DataPermissionBinding>();

  private keyOf(table: string, action: string, nodeKey: string): string {
    return `${table}::${action}::${nodeKey}`;
  }

  /**
   * 注册一条节点 binding. 幂等覆盖.
   * @keyword-en register-binding
   */
  bind(binding: DataPermissionBinding): void {
    const key = this.keyOf(binding.table, binding.action, binding.nodeKey);
    this.bindings.set(key, binding);
  }

  /**
   * 移除指定 binding (热卸载).
   * @keyword-en unbind
   */
  unbind(table: string, action: string, nodeKey: string): void {
    this.bindings.delete(this.keyOf(table, action, nodeKey));
  }

  /**
   * 取指定 (table, action) 上**所有 nodeKey 在 nodeKeys 集合内**的 bindings.
   * 返回顺序按 bindings 插入顺序.
   * @keyword-en lookup-bindings
   */
  lookup(
    table: string,
    action: string,
    nodeKeys: string[],
  ): DataPermissionBinding[] {
    if (nodeKeys.length === 0) return [];
    const wanted = new Set(nodeKeys);
    const out: DataPermissionBinding[] = [];
    for (const b of this.bindings.values()) {
      if (b.table === table && b.action === action && wanted.has(b.nodeKey)) {
        out.push(b);
      }
    }
    return out;
  }

  /**
   * 列出所有 binding (debug / admin hook 用).
   * @keyword-en list-bindings
   */
  listAll(): DataPermissionBinding[] {
    return Array.from(this.bindings.values());
  }

  /** 用于测试 reset. */
  clear(): void {
    this.bindings.clear();
  }
}

/**
 * 模块级单例; solution 注册时 import 这个直接 bind.
 * @keyword-en data-permission-registry-singleton
 */
export const dataPermissionRegistry = new DataPermissionRegistry();
