/**
 * @title Identity Types (Web)
 * @description 前端身份与权限模块类型定义，保持与后端 DTO 一致。
 * @keywords-cn 身份类型, 组织类型, 角色类型, 成员类型
 * @keywords-en identity-types, organization-types, role-types, membership-types
 */

import { z } from 'zod';
import {
  PrincipalTypes,
  MembershipRoles,
} from '../constants/identity.constants';

export type PrincipalType =
  | 'user'
  | 'user_consumer'
  | 'official_account'
  | 'agent'
  | 'system';

export type MembershipRole = 'owner' | 'admin' | 'member';

export interface IdentityPrincipalItem {
  id: string;
  displayName: string;
  principalType: PrincipalType;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  tenantId?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryPrincipalDto {
  q?: string;
  type?: PrincipalType;
  tenantId?: string;
}

/**
 * @title QueryUsers DTO
 * @description 仅用户类型（企业/消费者）的查询参数定义。
 * @keywords-cn 用户查询, 企业用户, 消费者
 * @keywords-en query-users-dto, enterprise-user, consumer
 */
export type UserPrincipalType = 'user' | 'user_consumer' | 'system';

export interface QueryUsersDto {
  q?: string;
  tenantId?: string;
  type?: UserPrincipalType;
}

export interface CreateUserDto {
  displayName: string;
  principalType: UserPrincipalType;
  email: string;
  password?: string;
  phone?: string | null;
  tenantId?: string | null;
}

export interface UpdateUserDto {
  displayName?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
}

export interface CreatePrincipalDto {
  displayName: string;
  principalType: PrincipalType;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  tenantId?: string | null;
}

export interface UpdatePrincipalDto {
  displayName?: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

export interface OrganizationItem {
  id: string;
  name: string;
  code?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryOrganizationDto {
  q?: string;
}

export interface CreateOrganizationDto {
  name: string;
  code?: string | null;
}

export interface UpdateOrganizationDto {
  name?: string;
  code?: string | null;
  active?: boolean;
}

export interface RoleItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  organizationId?: string | null;
  builtin?: boolean;
}

export interface CreateRoleDto {
  name: string;
  code: string;
  description?: string | null;
  organizationId?: string | null;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
}

export interface RolePermissionItem {
  id: string;
  roleId: string;
  subject: string;
  action: string;
  conditions?: Record<string, unknown> | null;
}

export interface UpsertRolePermissionsDto {
  items: Array<{
    subject: string;
    action: string;
    conditions?: Record<string, unknown> | null;
  }>;
}

export interface MembershipItem {
  id: string;
  organizationId: string;
  principalId: string;
  /**
   * 角色字段 :: 内置三档 owner/admin/member 或自定义 RoleEntity.code (Agent 角色分配场景)。
   * 展示侧需自行做中文映射, 落盘时统一是 RoleEntity.code。
   */
  role: MembershipRole | string;
  department?: string | null;
  tags?: string[] | null;
  active: boolean;
}

export interface PermissionDefinitionItem {
  id: string;
  fid?: string | null;
  nodeKey: string;
  extraData?: Record<string, unknown> | null;
  permissionType: PermissionDefinitionType;
  description?: string;
}

export type PermissionDefinitionType = 'management' | 'data' | 'menu';

/**
 * @title PrincipalType Schema
 * @description Zod 校验：主体类型必须为允许的枚举值。
 * @keywords-cn 主体类型校验, Zod
 * @keywords-en principal-type-schema, zod
 */
export const PrincipalTypeSchema = z.union([
  z.literal(PrincipalTypes.User),
  z.literal(PrincipalTypes.UserConsumer),
  z.literal(PrincipalTypes.OfficialAccount),
  z.literal(PrincipalTypes.Agent),
  z.literal(PrincipalTypes.System),
]);

/**
 * @title QueryPrincipal Schema
 * @description Zod 校验：主体查询参数结构与类型。
 * @keywords-cn 查询参数校验, 主体查询, Zod
 * @keywords-en query-principal-schema, params-validation, zod
 */
export const QueryPrincipalSchema = z.object({
  q: z.string().optional(),
  type: PrincipalTypeSchema.optional(),
  tenantId: z.string().optional(),
});

/**
 * @title QueryUsers Schema
 * @description Zod 校验：仅用户（企业/消费者）的查询参数结构。
 * @keywords-cn 用户查询校验, 企业用户, 消费者
 * @keywords-en query-users-schema, enterprise-user, consumer
 */
export const QueryUsersSchema = z.object({
  q: z.string().optional(),
  tenantId: z.string().optional(),
  type: z
    .union([
      z.literal('user'),
      z.literal('user_consumer'),
      z.literal('system'),
    ])
    .optional(),
});

/**
 * @title CreatePrincipal Schema
 * @description Zod 校验：创建主体请求结构。
 * @keywords-cn 创建主体校验
 * @keywords-en create-principal-schema
 */
export const CreatePrincipalSchema = z.object({
  displayName: z.string().min(1),
  principalType: PrincipalTypeSchema,
  avatarUrl: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
});

export const CreateUserSchema = z.object({
  displayName: z.string().min(1),
  principalType: z.union([
    z.literal('user'),
    z.literal('user_consumer'),
    z.literal('system'),
  ]),
  email: z.string().email(),
  password: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
});

/**
 * @title UpdatePrincipal Schema
 * @description Zod 校验：更新主体请求结构。
 * @keywords-cn 更新主体校验
 * @keywords-en update-principal-schema
 */
export const UpdatePrincipalSchema = z.object({
  displayName: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const UpdateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

/**
 * @title QueryOrganization Schema
 * @description Zod 校验：组织查询参数。
 * @keywords-cn 组织查询校验
 * @keywords-en query-organization-schema
 */
export const QueryOrganizationSchema = z.object({ q: z.string().optional() });

/**
 * @title CreateOrganization Schema
 * @description Zod 校验：创建组织请求结构。
 * @keywords-cn 创建组织校验
 * @keywords-en create-organization-schema
 */
export const CreateOrganizationSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullable().optional(),
});

/**
 * @title UpdateOrganization Schema
 * @description Zod 校验：更新组织请求结构。
 * @keywords-cn 更新组织校验
 * @keywords-en update-organization-schema
 */
export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

/**
 * @title CreateRole Schema
 * @description Zod 校验：创建角色请求结构。
 * @keywords-cn 创建角色校验
 * @keywords-en create-role-schema
 */
export const CreateRoleSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
});

/**
 * @title UpdateRole Schema
 * @description Zod 校验：更新角色请求结构。
 * @keywords-cn 更新角色校验
 * @keywords-en update-role-schema
 */
export const UpdateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

/**
 * @title UpsertRolePermissions Schema
 * @description Zod 校验：角色权限批量更新请求结构。
 * @keywords-cn 角色权限校验
 * @keywords-en upsert-role-permissions-schema
 */
export const UpsertRolePermissionsSchema = z.object({
  items: z.array(
    z.object({
      subject: z.string().min(1),
      action: z.string().min(1),
      conditions: z.record(z.any()).nullable().optional(),
    }),
  ),
});

/**
 * @title ListMemberships Query Schema
 * @description Zod 校验：成员查询参数。
 * @keywords-cn 成员查询校验
 * @keywords-en list-memberships-query-schema
 */
export const ListMembershipsQuerySchema = z.object({
  organizationId: z.string().optional(),
  principalId: z.string().optional(),
});

/**
 * @title AddMembership Schema
 * @description Zod 校验：添加成员请求结构。
 *              role 走内置三档 (owner/admin/member, 由 UserManagement 用) ;
 *              roleId 走 RoleEntity 主键 (由 Agent / 自定义角色场景用)。
 *              二者择一; 后端 MembershipController 同时接受。
 * @keywords-cn 添加成员校验, 角色字段, 自定义角色ID
 * @keywords-en add-membership-schema, role-field, custom-role-id
 */
export const AddMembershipSchema = z
  .object({
    organizationId: z.string().min(1),
    principalId: z.string().min(1),
    role: z.string().min(1).optional(),
    roleId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.role || data.roleId), {
    message: 'role 或 roleId 必须提供其一',
  });

/**
 * @title CreatePermissionDefinition Schema
 * @description Zod 校验：创建权限定义请求结构。
 * @keywords-cn 创建权限定义校验
 * @keywords-en create-permission-definition-schema
 */
export const CreatePermissionDefinitionSchema = z.object({
  fid: z.string().nullable().optional(),
  nodeKey: z.string().min(1),
  extraData: z.record(z.any()).nullable().optional(),
  permissionType: z
    .union([z.literal('management'), z.literal('data'), z.literal('menu')])
    .optional(),
  description: z.string().optional(),
});
