/**
 * @title useAgentGroups
 * @description 分组列表、创建/删除与摘要获取的组合函数，便于与其他 hooks 互相调用。
 * @keywords-cn 分组, 列表, 创建, 删除, 摘要
 * @keywords-en groups, list, create, delete, summaries
 */
import { ref } from 'vue';
import { imApi } from '../../../api/im';
import { useImStore } from '../../im/im.module';
import type {
  GroupListItem,
  CreateGroupRequest,
  CreateGroupResponse,
  SummariesByGroupResponse,
  GroupHistoryResponse,
  GroupListQueryDto,
} from '../types/agent.types';

export function useAgentGroups() {
  const loading = ref(false);
  const groups = ref<GroupListItem[]>([]);
  const error = ref<string | null>(null);
  const imStore = useImStore();

  async function list(_params?: GroupListQueryDto) {
    loading.value = true;
    error.value = null;
    try {
      await imStore.loadSessionsInitial(100);
      const sessions = imStore.sessions ?? [];
      const items: GroupListItem[] = sessions
        .filter((s) => s.type === 'group')
        .map((s) => ({
          id: s.sessionId,
          dayGroupId: s.sessionId,
          title: s.name,
          chatClientId: null,
          active: true,
          createdAt: s.createdAt,
          updatedAt: s.lastMessageAt || s.createdAt,
          latestMessage: s.lastMessagePreview
            ? {
                role: 'assistant',
                content: s.lastMessagePreview,
                timestamp: s.lastMessageAt || s.createdAt,
              }
            : undefined,
          threadType: 'group',
          isPinned: false,
          isAiInvolved: false,
          participants: [],
        }));
      groups.value = items;
      return items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list groups failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(
    data: CreateGroupRequest,
  ): Promise<CreateGroupResponse> {
    const res = await imApi.createSession({
      type: 'group',
      name: data.title ?? undefined,
      memberIds: [],
    });
    return { id: res.data.sessionId, dayGroupId: res.data.sessionId };
  }

  async function remove(groupId: string): Promise<void> {
    await imApi.deleteSession(groupId);
  }

  async function summaries(groupId: string): Promise<SummariesByGroupResponse> {
    const res = await imApi.getMessages(groupId, { limit: 200 });
    const items = res.data.items ?? [];
    const lastAssistant = [...items]
      .reverse()
      .find((m) => m.messageType !== 'system');
    const item = lastAssistant
      ? {
          sessionId: groupId,
          roundNumber: items.length,
          summaryContent: lastAssistant.content,
          createdAt: lastAssistant.createdAt,
        }
      : undefined;
    return {
      groupId,
      items: item ? [item] : [],
    };
  }

  async function history(
    groupId: string,
    params?: {
      limit?: number;
      includeSystem?: boolean;
      principalId?: string;
      since?: string;
    },
  ): Promise<GroupHistoryResponse> {
    const limit = params?.limit ?? 100;
    const includeSystem = params?.includeSystem ?? true;
    const since = params?.since;
    const res = await imApi.getMessages(groupId, { limit });
    const messages = res.data.items ?? [];
    const filtered = messages.filter((m) => {
      if (!includeSystem && m.messageType === 'system') return false;
      if (since) {
        const ts = new Date(m.createdAt).getTime();
        const s = new Date(since).getTime();
        if (!(ts > s)) return false;
      }
      return true;
    });
    return {
      groupId,
      items: filtered.map((m) => ({
        role:
          m.messageType === 'system'
            ? 'system'
            : m.senderId
              ? 'user'
              : 'assistant',
        content: m.content,
        timestamp: m.createdAt,
        metadata: m.senderId
          ? { senderId: m.senderId, senderName: m.senderName }
          : undefined,
      })),
    };
  }

  return { loading, error, groups, list, create, remove, summaries, history };
}
