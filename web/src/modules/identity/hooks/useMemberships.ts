/**
 * @title useMemberships
 * @description 成员列表、添加与移除的组合函数；与主体/组织/角色 hooks 可互相调用。
 * @keywords-cn 成员, 列表, 添加, 移除
 * @keywords-en memberships, list, add, remove
 */
import { ref } from 'vue';
import { z } from 'zod';
import { agentApi } from '../../../api/agent';
import type { MembershipItem } from '../types/identity.types';
import { IDENTITY_EVENT_NAMES } from '../constants/identity.constants';

export function useMemberships() {
  const loading = ref(false);
  const items = ref<MembershipItem[]>([]);
  const error = ref<string | null>(null);

  const RoleSchema = z.union([
    z.literal('owner'),
    z.literal('admin'),
    z.literal('member'),
  ]);

  function normalizeMembership(r: {
    id: string;
    organizationId: string;
    principalId: string;
    role: string;
    department?: string | null;
    tags?: string[] | null;
    active: boolean;
  }): MembershipItem {
    const parsed = RoleSchema.safeParse(r.role);
    const role = parsed.success ? parsed.data : 'member';
    return {
      id: r.id,
      organizationId: r.organizationId,
      principalId: r.principalId,
      role,
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
    role: string;
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
