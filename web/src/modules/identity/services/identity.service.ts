/**
 * @title Identity Service (Web)
 * @description 前端身份与权限服务，封装主体/组织/成员/角色/权限接口。
 * @keywords-cn 身份服务, 组织服务, 角色服务, 权限服务
 * @keywords-en identity-service, organization-service, role-service, permission-service
 */

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
  PermissionDefinitionItem,
} from '../types/identity.types';
import type { BaseResponse } from '../../../utils/types';
import { useUIStore } from '../../agent/store/ui.store';
import { agentApi } from '../../../api/agent';

export class IdentityService {
  private isBaseResponse<T>(response: unknown): response is BaseResponse<T> {
    return (
      typeof response === 'object' &&
      response !== null &&
      'data' in response &&
      'code' in response
    );
  }

  private async handleRequest<T>(request: Promise<unknown>): Promise<T> {
    try {
      const response = await request;
      if (this.isBaseResponse<T>(response)) {
        return response.data;
      }
      return response as T;
    } catch (error: any) {
      const ui = useUIStore();
      const msg = error instanceof Error ? error.message : 'Network error';
      ui.showToast(msg, 'error');
      throw error;
    }
  }

  /** Principals */
  async listPrincipals(
    params?: QueryPrincipalDto,
  ): Promise<IdentityPrincipalItem[]> {
    return this.handleRequest(agentApi.listPrincipals(params));
  }
  async createPrincipal(
    dto: CreatePrincipalDto,
  ): Promise<IdentityPrincipalItem> {
    return this.handleRequest(agentApi.createPrincipal(dto));
  }
  async updatePrincipal(
    id: string,
    dto: UpdatePrincipalDto,
  ): Promise<{ success: true }> {
    return this.handleRequest(agentApi.updatePrincipal(id, dto));
  }
  async deletePrincipal(id: string): Promise<{ success: true }> {
    return this.handleRequest(agentApi.deletePrincipal(id));
  }

  /** Organizations */
  async listOrganizations(
    params?: QueryOrganizationDto,
  ): Promise<OrganizationItem[]> {
    return this.handleRequest(agentApi.listOrganizations(params));
  }
  async createOrganization(
    dto: CreateOrganizationDto,
  ): Promise<OrganizationItem> {
    return this.handleRequest(agentApi.createOrganization(dto));
  }
  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<{ success: true }> {
    return this.handleRequest(agentApi.updateOrganization(id, dto));
  }
  async deleteOrganization(id: string): Promise<{ success: true }> {
    return this.handleRequest(agentApi.deleteOrganization(id));
  }

  /** Roles */
  async listRoles(): Promise<RoleItem[]> {
    return this.handleRequest(agentApi.listRoles());
  }
  async createRole(dto: CreateRoleDto): Promise<RoleItem> {
    return this.handleRequest(agentApi.createRole(dto));
  }
  async updateRole(id: string, dto: UpdateRoleDto): Promise<{ success: true }> {
    return this.handleRequest(agentApi.updateRole(id, dto));
  }
  async deleteRole(id: string): Promise<{ success: true }> {
    return this.handleRequest(agentApi.deleteRole(id));
  }
  async listRolePermissions(roleId: string): Promise<RolePermissionItem[]> {
    return this.handleRequest(agentApi.listRolePermissions(roleId));
  }
  async upsertRolePermissions(
    roleId: string,
    dto: UpsertRolePermissionsDto,
  ): Promise<{ success: true }> {
    return this.handleRequest(agentApi.upsertRolePermissions(roleId, dto));
  }

  /** Permission Definitions */
  async listPermissionDefinitions(): Promise<PermissionDefinitionItem[]> {
    try {
      const response = await agentApi.listPermissionDefinitions();
      if (Array.isArray(response)) {
        return response;
      }
      if (this.isBaseResponse<PermissionDefinitionItem[]>(response)) {
        return response.data;
      }
      throw new Error('Invalid response format');
    } catch (_e) {
      console.warn(
        'API /identity/permissions/definitions failed, using mock data',
      );
      const fallback: PermissionDefinitionItem[] = [
        {
          id: '1',
          subject: 'user',
          action: 'create',
          description: 'Create User',
        },
        { id: '2', subject: 'user', action: 'read', description: 'Read User' },
        {
          id: '3',
          subject: 'user',
          action: 'update',
          description: 'Update User',
        },
        {
          id: '4',
          subject: 'user',
          action: 'delete',
          description: 'Delete User',
        },
        { id: '5', subject: 'role', action: 'read', description: 'Read Role' },
        {
          id: '6',
          subject: 'role',
          action: 'update',
          description: 'Update Role',
        },
      ];
      return fallback;
    }
  }
  async createPermissionDefinition(data: {
    subject: string;
    action: string;
    description?: string;
  }) {
    return this.handleRequest(agentApi.createPermissionDefinition(data));
  }
  async deletePermissionDefinition(id: string) {
    return this.handleRequest(agentApi.deletePermissionDefinition(id));
  }

  /** Memberships */
  async listMemberships(params?: {
    organizationId?: string;
    principalId?: string;
  }): Promise<MembershipItem[]> {
    return this.handleRequest(agentApi.listMemberships(params));
  }
  async addMembership(dto: {
    organizationId: string;
    principalId: string;
    role: string;
  }): Promise<MembershipItem> {
    return this.handleRequest(agentApi.addMembership(dto));
  }
  async removeMembership(id: string): Promise<{ success: true }> {
    return this.handleRequest(agentApi.removeMembership(id));
  }

  /** Function Call Handle */
  public getHandle() {
    return {
      name: 'identity_service',
      description: 'Web identity and permissions service for CRUD operations.',
      parameters: {},
    };
  }
}

export const identityService = new IdentityService();
