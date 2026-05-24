import type {
  DataPermissionContext,
  DataPermissionResolveResult,
} from '../types/data-permission.types';
import type { DataPermissionRegistry } from './data-permission.registry';

/**
 * @title Runner DataPermission Service
 * @description 求值入口: service 层在执行 mongo 查询 / 写入前调 resolve(table, action, ctx) 拿 filter,
 *              内部走 registry.lookup 找匹配 nodeKey 的 binding, 逐个执行 fn 合并 where ($and).
 *
 *              语义:
 *                - 空 binding (table/action 完全无数据权限定义) → allow=true filter={} (放开)
 *                - 任一 binding allow=false → 整体 allow=false filter={} (业务拒绝)
 *                - 全部 allow → $and 所有 where, 业务侧 mongo find/update/delete 直接用
 * @keywords-cn 数据权限求值, mongo filter 合并, allow 短路
 * @keywords-en data-permission-resolve, mongo-filter-merge, allow-shortcut
 */
export class DataPermissionService {
  constructor(private readonly registry: DataPermissionRegistry) {}

  /**
   * 对给定 (table, action, ctx) 求出最终 mongo filter.
   * - ctx.dataPermissions 来自 RunnerAbilityService.buildForPrincipal, 已经匹配 principal 的 role
   * - 仅取 ctx.dataPermissions 中 table 匹配且 action 匹配 (含 manage/'*' 通配) 的 nodeKey, 在 registry 反查 binding
   * @keyword-en resolve
   */
  async resolve(
    table: string,
    action: string,
    ctx: DataPermissionContext,
  ): Promise<DataPermissionResolveResult> {
    // 1. 从 ctx.dataPermissions 筛出本 (table, action) 的 nodeKey 列表
    const matchedNodeKeys = ctx.dataPermissions
      .filter((p) => {
        const tableMatch = p.table === table || p.table === '*';
        const actionMatch =
          !p.action ||
          p.action === action ||
          p.action === 'manage' ||
          p.action === '*';
        return tableMatch && actionMatch;
      })
      .map((p) => p.nodeKey);

    if (matchedNodeKeys.length === 0) {
      // 没匹配的数据权限定义 → 默认放开 (跟 SaaS 同语义: 不声明 = 不限制)
      return { allow: true, filter: {}, matchedNodes: [] };
    }

    // 2. 查 registry 拿 binding 函数
    const bindings = this.registry.lookup(table, action, matchedNodeKeys);
    if (bindings.length === 0) {
      // ctx 里有 nodeKey 但 registry 没注册 → 严格模式: 放开 (跟 SaaS 一致)
      // 业务方可改成"deny" 策略, 这里先 permissive
      return { allow: true, filter: {}, matchedNodes: [] };
    }

    // 3. 逐个执行 + 合并
    const wheres: Record<string, unknown>[] = [];
    const usedKeys: string[] = [];
    for (const b of bindings) {
      const r = await b.fn(ctx);
      if (!r.allow) {
        return { allow: false, filter: {}, matchedNodes: [b.nodeKey] };
      }
      if (r.where && Object.keys(r.where).length > 0) {
        wheres.push(r.where);
      }
      usedKeys.push(b.nodeKey);
    }

    if (wheres.length === 0) {
      return { allow: true, filter: {}, matchedNodes: usedKeys };
    }
    if (wheres.length === 1) {
      return { allow: true, filter: wheres[0], matchedNodes: usedKeys };
    }
    return {
      allow: true,
      filter: { $and: wheres },
      matchedNodes: usedKeys,
    };
  }
}
