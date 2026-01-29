/**
 * @title useAgentSessions
 * @description 会话列表、创建与更新的组合函数；内部仍通过后端 thread 接口适配。
 * @keywords-cn 会话, 列表, 创建, 更新
 * @keywords-en sessions, list, create, update
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type { SessionListItem } from '../types/agent.types';

export function useAgentSessions() {
  const loading = ref(false);
  const sessions = ref<SessionListItem[]>([]);
  const error = ref<string | null>(null);

  async function list(params?: {
    type?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
    ai?: boolean;
    pinned?: boolean;
    q?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<SessionListItem[]> =
        await agentApi.listThreads(params);
      const items = res.data;
      sessions.value = items;
      return items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list threads failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: {
    title?: string | null;
    chatClientId?: string | null;
    threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
    isPinned?: boolean;
    isAiInvolved?: boolean;
  }) {
    const res: BaseResponse<{ id: string }> = await agentApi.createThread(data);
    return res.data;
  }

  async function update(
    sessionId: string,
    data: {
      title?: string | null;
      isPinned?: boolean;
      isAiInvolved?: boolean;
      threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
      active?: boolean;
      participants?: Array<{ id: string; name?: string }> | string[];
    },
  ) {
    const res: BaseResponse<{ success: true }> = await agentApi.updateThread(
      sessionId,
      data,
    );
    return res.data;
  }

  return { loading, error, sessions, list, create, update };
}

export const useAgentThreads = useAgentSessions;
