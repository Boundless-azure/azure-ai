/**
 * @title Identity Controller (Web)
 * @description 前端身份模块控制器，桥接服务与 UI。
 * @keywords-cn 身份控制器, 组织控制器, 角色控制器
 * @keywords-en identity-controller, organization-controller, role-controller
 */

import { identityService } from '../services/identity.service';
import type {
  IdentityPrincipalItem,
  QueryPrincipalDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
  OrganizationItem,
  QueryOrganizationDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  RoleItem,
  CreateRoleDto,
  UpdateRoleDto,
  RolePermissionItem,
  UpsertRolePermissionsDto,
  MembershipItem,
} from '../types/identity.types';

export class IdentityController {
  async listPrincipals(params?: QueryPrincipalDto): Promise<IdentityPrincipalItem[]> {
    return await identityService.listPrincipals(params);
  }
  async createPrincipal(dto: CreatePrincipalDto): Promise<IdentityPrincipalItem> {
    return await identityService.createPrincipal(dto);
  }
  async updatePrincipal(id: string, dto: UpdatePrincipalDto): Promise<{ success: true }> {
    return await identityService.updatePrincipal(id, dto);
  }
  async deletePrincipal(id: string): Promise<{ success: true }> {
    return await identityService.deletePrincipal(id);
  }

  async listOrganizations(params?: QueryOrganizationDto): Promise<OrganizationItem[]> {
    return await identityService.listOrganizations(params);
  }
  async createOrganization(dto: CreateOrganizationDto): Promise<OrganizationItem> {
    return await identityService.createOrganization(dto);
  }
  async updateOrganization(id: string, dto: UpdateOrganizationDto): Promise<{ success: true }> {
    return await identityService.updateOrganization(id, dto);
  }
  async deleteOrganization(id: string): Promise<{ success: true }> {
    return await identityService.deleteOrganization(id);
  }

  async listRoles(): Promise<RoleItem[]> {
    return await identityService.listRoles();
  }
  async createRole(dto: CreateRoleDto): Promise<RoleItem> {
    return await identityService.createRole(dto);
  }
  async updateRole(id: string, dto: UpdateRoleDto): Promise<{ success: true }> {
    return await identityService.updateRole(id, dto);
  }
  async deleteRole(id: string): Promise<{ success: true }> {
    return await identityService.deleteRole(id);
  }
  async listRolePermissions(roleId: string): Promise<RolePermissionItem[]> {
    return await identityService.listRolePermissions(roleId);
  }
  async upsertRolePermissions(roleId: string, dto: UpsertRolePermissionsDto): Promise<{ success: true }> {
    return await identityService.upsertRolePermissions(roleId, dto);
  }

  async listMemberships(params?: { organizationId?: string; principalId?: string }): Promise<MembershipItem[]> {
    return await identityService.listMemberships(params);
  }
  async addMembership(dto: { organizationId: string; principalId: string; role: string }): Promise<MembershipItem> {
    return await identityService.addMembership(dto);
  }
  async removeMembership(id: string): Promise<{ success: true }> {
    return await identityService.removeMembership(id);
  }
}

export const identityController = new IdentityController();
