/**
 * @title useAgents
 * @description 代理列表/更新/删除与向量更新的组合函数。
 * @keywords-cn 代理, 列表, 更新, 删除, 向量
 * @keywords-en agents, list, update, delete, embeddings
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type { Agent, UpdateAgentRequest } from '../types/agent.types';

export function useAgents() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const agents = ref<Agent[]>([]);

  async function list() {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<Agent[]> = await agentApi.getAgents();
      const items = res.data;
      agents.value = items;
      return items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list agents failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function update(id: string, dto: UpdateAgentRequest) {
    const res: BaseResponse<Agent> = await agentApi.updateAgent(id, dto);
    return res.data;
  }

  async function remove(id: string) {
    const res: BaseResponse<{ success: boolean }> =
      await agentApi.deleteAgent(id);
    return res.data;
  }

  async function updateEmbeddings(ids?: string[]) {
    const res: BaseResponse<{
      updated: number;
      errors?: Array<{ id: string; error: string }>;
    }> = await agentApi.updateEmbeddings(ids);
    return res.data;
  }

  return { loading, error, agents, list, update, remove, updateEmbeddings };
}
