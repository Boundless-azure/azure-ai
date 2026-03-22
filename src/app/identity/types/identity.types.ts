/**
 * @title Identity Types
 * @description DTO 类型定义：Principal/Organization/Role 等。
 * @keywords-cn 身份类型, 组织类型, 角色类型
 * @keywords-en identity-types, organization-types, role-types
 */
import { PermissionDefinitionType } from '../enums/permission.enums';

export interface QueryPrincipalDto {
  q?: string;
  type?: 'user' | 'user_consumer' | 'official_account' | 'agent' | 'system';
  tenantId?: string;
}

export interface QueryUsersDto {
  q?: string;
  tenantId?: string;
  type?: 'user' | 'user_consumer' | 'system';
}

export interface CreateUserDto {
  displayName: string;
  principalType: 'user' | 'user_consumer' | 'system';
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
  principalType:
    | 'user'
    | 'user_consumer'
    | 'official_account'
    | 'agent'
    | 'system';
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

export interface UpsertRolePermissionsDto {
  items: Array<{
    subject: string;
    action: string;
    conditions?: Record<string, unknown> | null;
  }>;
}

export interface CreatePermissionDefinitionDto {
  fid?: string | null;
  nodeKey: string;
  extraData?: Record<string, unknown> | null;
  description?: string;
  permissionType?: PermissionDefinitionType;
}

export interface UpdatePermissionDefinitionDto {
  fid?: string | null;
  nodeKey?: string;
  extraData?: Record<string, unknown> | null;
  description?: string;
  permissionType?: PermissionDefinitionType;
}
