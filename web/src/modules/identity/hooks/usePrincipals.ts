/**
 * @title usePrincipals
 * @description 主体列表/创建/更新/删除的组合函数；与组织/角色 hooks 可互相调用。
 * @keywords-cn 主体, 列表, 创建, 更新, 删除
 * @keywords-en principals, list, create, update, delete
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type {
  IdentityPrincipalItem,
  QueryPrincipalDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
  CreateUserDto,
  UpdateUserDto,
} from '../types/identity.types';
import { IDENTITY_EVENT_NAMES } from '../constants/identity.constants';

export function usePrincipals() {
  const loading = ref(false);
  const items = ref<IdentityPrincipalItem[]>([]);
  const error = ref<string | null>(null);

  async function list(params?: QueryPrincipalDto) {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<IdentityPrincipalItem[]> =
        await agentApi.listPrincipals(params);
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list principals failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * @title List Users Only
   * @description 仅返回用户主体（企业/消费者）。
   * @keywords-cn 用户列表, 企业用户, 消费者
   * @keywords-en list-users, enterprise-user, consumer
   */
  async function listUsers(params?: {
    q?: string;
    tenantId?: string;
    type?: 'user_enterprise' | 'user_consumer' | 'system';
  }) {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<IdentityPrincipalItem[]> =
        await agentApi.listUsers(params);
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list users failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(dto: CreatePrincipalDto) {
    const res: BaseResponse<IdentityPrincipalItem> =
      await agentApi.createPrincipal(dto);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.principalsChanged),
    );
    return res.data;
  }

  async function update(id: string, dto: UpdatePrincipalDto) {
    const res: BaseResponse<{ success: true }> = await agentApi.updatePrincipal(
      id,
      dto,
    );
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.principalsChanged),
    );
    return res.data;
  }

  async function remove(id: string) {
    const res: BaseResponse<{ success: true }> =
      await agentApi.deletePrincipal(id);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.principalsChanged),
    );
    return res.data;
  }

  async function createUser(dto: CreateUserDto) {
    const res: BaseResponse<IdentityPrincipalItem> =
      await agentApi.createUser(dto);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.principalsChanged),
    );
    return res.data;
  }

  async function updateUser(id: string, dto: UpdateUserDto) {
    const res: BaseResponse<{ success: true }> = await agentApi.updateUser(
      id,
      dto,
    );
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.principalsChanged),
    );
    return res.data;
  }

  async function removeUser(id: string) {
    const res: BaseResponse<{ success: true }> = await agentApi.deleteUser(id);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.principalsChanged),
    );
    return res.data;
  }

  return {
    loading,
    items,
    error,
    list,
    listUsers,
    create,
    update,
    remove,
    createUser,
    updateUser,
    removeUser,
  };
}
