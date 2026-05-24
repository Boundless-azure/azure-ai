/**
 * @title useRoles
 * @description 角色与角色权限的组合函数；支持列表、创建、更新、删除与权限批量更新。
 * @keywords-cn 角色, 权限, 列表, 创建, 更新, 删除
 * @keywords-en roles, permissions, list, create, update, delete
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type {
  RoleItem,
  CreateRoleDto,
  UpdateRoleDto,
  RolePermissionItem,
  UpsertRolePermissionsDto,
} from '../types/identity.types';
import { IDENTITY_EVENT_NAMES } from '../constants/identity.constants';

export function useRoles() {
  const loading = ref(false);
  const items = ref<RoleItem[]>([]);
  const error = ref<string | null>(null);

  async function list() {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<RoleItem[]> = await agentApi.listRoles();
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list roles failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(dto: CreateRoleDto) {
    const res: BaseResponse<RoleItem> = await agentApi.createRole(dto);
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT_NAMES.rolesChanged));
    return res.data;
  }

  async function update(id: string, dto: UpdateRoleDto) {
    const res: BaseResponse<{ success: true }> = await agentApi.updateRole(
      id,
      dto,
    );
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT_NAMES.rolesChanged));
    return res.data;
  }

  async function remove(id: string) {
    const res: BaseResponse<{ success: true }> = await agentApi.deleteRole(id);
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT_NAMES.rolesChanged));
    return res.data;
  }

  async function listPermissions(
    roleId: string,
  ): Promise<RolePermissionItem[]> {
    const res: BaseResponse<RolePermissionItem[]> =
      await agentApi.listRolePermissions(roleId);
    return res.data;
  }

  async function upsertPermissions(
    roleId: string,
    dto: UpsertRolePermissionsDto,
  ) {
    const res: BaseResponse<{ success: true }> =
      await agentApi.upsertRolePermissions(roleId, dto);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.permissionsChanged),
    );
    return res.data;
  }

  return {
    loading,
    items,
    error,
    list,
    create,
    update,
    remove,
    listPermissions,
    upsertPermissions,
  };
}
