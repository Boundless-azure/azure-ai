/**
 * @title Runner RBAC Mongo Entities
 * @description 4 张内置集合的文档结构, 跟 SaaS 端 RolePermissionEntity / MembershipEntity / RoleEntity / PrincipalEntity 同语义,
 *   但精简掉 SaaS 多租户字段; runner 单租户场景 tenantId 概念隐式 (即 runner 自身).
 * @keywords-cn Runner实体, RBAC, mongo文档
 * @keywords-en runner-entity, rbac, mongo-doc
 */

import type { RunnerPermissionType, RunnerPrincipalType } from '../enums/identity.enums';

export interface RunnerPrincipalDoc {
  _id?: string;
  /** 主体 ID, 跟 ctx.principalId 对齐. system / anonymous-llm / solution:<name> / agent:<id> / debug:<userId> */
  id: string;
  type: RunnerPrincipalType;
  displayName?: string;
  /** 创建时间戳 */
  createdAt: Date;
  /** 默认 builtin=true 的主体不可被 admin hook 删除 (system / anonymous-llm) */
  builtin: boolean;
}

export interface RunnerRoleDoc {
  _id?: string;
  /** Role ID, 通常等于 code; 内置角色 builtin=true */
  id: string;
  code: string;
  name: string;
  description?: string;
  builtin: boolean;
  createdAt: Date;
}

export interface RunnerRolePermissionDoc {
  _id?: string;
  id: string;
  roleId: string;
  /** CASL subject (mongo / file / solution / dataTouchpoint / 'collection:<name>' for data perms) */
  subject: string;
  /** CASL action (read/create/update/delete/manage/'*') */
  action: string;
  permissionType: RunnerPermissionType;
  /**
   * 数据权限节点 key, 只在 permissionType === Data 时有意义。
   * 用于 DataPermissionRegistry 反查 bind 的节点函数。
   * @keyword-en data-permission-node-key
   */
  nodeKey?: string;
  createdAt: Date;
}

export interface RunnerMembershipDoc {
  _id?: string;
  id: string;
  principalId: string;
  roleId: string;
  createdAt: Date;
}
