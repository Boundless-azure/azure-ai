/**
 * @title Identity Types (Web)
 * @description 前端身份与权限模块类型定义，保持与后端 DTO 一致。
 * @keywords-cn 身份类型, 组织类型, 角色类型, 成员类型
 * @keywords-en identity-types, organization-types, role-types, membership-types
 */

export type PrincipalType =
  | 'user_enterprise'
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
  role: MembershipRole;
  department?: string | null;
  tags?: string[] | null;
  active: boolean;
}

export interface PermissionDefinitionItem {
  id: string;
  subject: string;
  action: string;
  description?: string;
}
