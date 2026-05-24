/**
 * @title Runner DataPermission Types
 * @description Runner 端数据权限相关类型, 跟 SaaS core/data-permission 语义同构, 但纯函数声明 (不依赖装饰器/反射).
 * @keywords-cn 数据权限类型, runner, mongo过滤
 * @keywords-en data-permission-types, runner, mongo-filter
 */

import type { RunnerDataPermissionRule } from '../../identity/types/identity.types';

/**
 * 单条节点函数返回值: 一段 mongo where 片段 + 是否放行整个查询.
 * - allow: 整条 deny 时为 false, 上层应短路 (查空 / 拒写)
 * - where: 节点求出的 mongo filter (例: { uploaderId: ctx.principalId }), 上层做 $and 合并
 * @keyword-en data-permission-node-result
 */
export interface DataPermissionNodeResult {
  allow: boolean;
  where?: Record<string, unknown>;
}

/**
 * 节点函数 :: (ctx) => 部分 mongo filter; 同 SaaS DataPermissionNode 函数语义.
 * @keyword-en data-permission-node-fn
 */
export type DataPermissionNodeFn = (
  ctx: DataPermissionContext,
) => DataPermissionNodeResult | Promise<DataPermissionNodeResult>;

/**
 * 数据权限运行时上下文; build 后传给业务 service 执行 resolve.
 * @keyword-en data-permission-context
 */
export interface DataPermissionContext {
  principalId: string;
  tenantId?: string;
  /** 由 RunnerAbilityService 求出的数据权限列表 (来源: 本地 mongo permissionType=Data) */
  dataPermissions: RunnerDataPermissionRule[];
  /** 业务方自由扩展位 (如 collection 上下文 / 当前操作元数据等) */
  attributes?: Record<string, unknown>;
}

/**
 * 注册 binding 时使用: 把一个或多个 nodeKey 绑定到 (table, action) 维度的节点函数.
 * @keyword-en data-permission-binding
 */
export interface DataPermissionBinding {
  /** mongo collection 名 */
  table: string;
  /** CRUD action (read/create/update/delete) */
  action: string;
  /** node key (跟 RolePermission.nodeKey 对齐, 用于反查) */
  nodeKey: string;
  /** 节点函数 */
  fn: DataPermissionNodeFn;
  /** 可选: 给 debug 用的描述 */
  description?: string;
}

/**
 * resolve 输出: 整张表 (collection) + 当前 action 求值后的 mongo filter.
 * - allow=false 时业务侧应拒绝该操作 (查询返空 / 写操作 throw)
 * - filter 是 $and 合并各 matched binding 的 where 后的最终 mongo filter
 * @keyword-en data-permission-resolve-result
 */
export interface DataPermissionResolveResult {
  allow: boolean;
  filter: Record<string, unknown>;
  /** 命中的 binding nodeKey 列表 (排查用) */
  matchedNodes: string[];
}
