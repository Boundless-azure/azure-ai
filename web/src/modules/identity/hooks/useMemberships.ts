/**
 * @title useMemberships
 * @description 成员列表、添加与移除的组合函数；与主体/组织/角色 hooks 可互相调用。
 * @keywords-cn 成员, 列表, 添加, 移除
 * @keywords-en memberships, list, add, remove
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { MembershipItem } from '../types/identity.types';
import { IDENTITY_EVENT_NAMES } from '../constants/identity.constants';

export function useMemberships() {
  const loading = ref(false);
  const items = ref<MembershipItem[]>([]);
  const error = ref<string | null>(null);

  /**
   * 把后端返回的 membership 项归一化 :: role 字段直接透传 (内置三档或自定义角色 code), 不再强制 zod 校验,
   * 以便 Agent 角色分配场景能展示自定义 RoleEntity.code。展示侧自行做友好映射。
   * @keyword-en normalize-membership
   */
  function normalizeMembership(r: {
    id: string;
    organizationId: string;
    principalId: string;
    role: string;
    department?: string | null;
    tags?: string[] | null;
    active: boolean;
  }): MembershipItem {
    return {
      id: r.id,
      organizationId: r.organizationId,
      principalId: r.principalId,
      role: r.role || 'member',
      department: r.department ?? null,
      tags: r.tags ?? null,
      active: r.active,
    };
  }

  async function list(params?: {
    organizationId?: string;
    principalId?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentApi.listMemberships(params);
      const normalized = res.data.map(normalizeMembership);
      items.value = normalized;
      return normalized;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list memberships failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function add(dto: {
    organizationId: string;
    principalId: string;
    role?: string;
    roleId?: string;
  }) {
    const res = await agentApi.addMembership(dto);
    const normalized = normalizeMembership(res.data);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.membershipsChanged),
    );
    return normalized;
  }

  async function remove(id: string) {
    const res = await agentApi.removeMembership(id);
    window.dispatchEvent(
      new CustomEvent(IDENTITY_EVENT_NAMES.membershipsChanged),
    );
    return res.data;
  }

  return { loading, items, error, list, add, remove };
}
