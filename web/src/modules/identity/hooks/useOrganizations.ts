/**
 * @title useOrganizations
 * @description 组织列表/创建/更新/删除的组合函数；与主体/角色 hooks 互相调用。
 * @keywords-cn 组织, 列表, 创建, 更新, 删除
 * @keywords-en organizations, list, create, update, delete
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type {
  OrganizationItem,
  QueryOrganizationDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '../types/identity.types';
import { IDENTITY_EVENT_NAMES } from '../constants/identity.constants';

export function useOrganizations() {
  const loading = ref(false);
  const items = ref<OrganizationItem[]>([]);
  const error = ref<string | null>(null);

  async function list(params?: QueryOrganizationDto) {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<OrganizationItem[]> =
        await agentApi.listOrganizations(params);
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'list organizations failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(dto: CreateOrganizationDto) {
    const res: BaseResponse<OrganizationItem> =
      await agentApi.createOrganization(dto);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.organizationsChanged),
    );
    return res.data;
  }

  async function update(id: string, dto: UpdateOrganizationDto) {
    const res: BaseResponse<{ success: true }> =
      await agentApi.updateOrganization(id, dto);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.organizationsChanged),
    );
    return res.data;
  }

  async function remove(id: string) {
    const res: BaseResponse<{ success: true }> =
      await agentApi.deleteOrganization(id);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.organizationsChanged),
    );
    return res.data;
  }

  return { loading, items, error, list, create, update, remove };
}
