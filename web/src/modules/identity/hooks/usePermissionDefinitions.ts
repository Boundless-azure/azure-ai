/**
 * @title usePermissionDefinitions
 * @description 权限定义列表/创建/删除的组合函数；与角色权限 hooks 互补。
 * @keywords-cn 权限定义, 列表, 创建, 删除
 * @keywords-en permission-definitions, list, create, delete
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type { PermissionDefinitionItem } from '../types/identity.types';
import { IDENTITY_EVENT_NAMES } from '../constants/identity.constants';

export function usePermissionDefinitions() {
  const loading = ref(false);
  const items = ref<PermissionDefinitionItem[]>([]);
  const error = ref<string | null>(null);

  async function list() {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<PermissionDefinitionItem[]> =
        await agentApi.listPermissionDefinitions();
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'list permission definitions failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: {
    subject: string;
    action: string;
    description?: string;
  }) {
    const res = await agentApi.createPermissionDefinition(data);
    const item: PermissionDefinitionItem = {
      id: res.data.id,
      subject: data.subject,
      action: data.action,
      description: data.description,
    };
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.permissionsChanged),
    );
    return item;
  }

  async function remove(id: string) {
    const res: BaseResponse<{ success: true }> =
      await agentApi.deletePermissionDefinition(id);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.permissionsChanged),
    );
    return res.data;
  }

  return { loading, items, error, list, create, remove };
}
