/**
 * @title useChatContacts
 * @description 通讯录与 AI 助手数据加载及提及候选项聚合。
 * @keywords-cn 通讯录数据, AI助手列表, 提及候选
 * @keywords-en contacts-data, ai-agents, mention-candidates
 */
import { computed, ref } from 'vue';
import type { SessionListItem } from '../types/agent.types';
import { usePrincipals } from '../../identity/hooks/usePrincipals';

export function useChatContacts() {
  const allContacts = ref<SessionListItem[]>([]);
  const { list: listPrincipals } = usePrincipals();

  const loadContacts = async () => {
    try {
      const principals = await listPrincipals();
      const nowIso = new Date().toISOString();
      const mapped = (principals || []).map((p) => {
        const item: SessionListItem = {
          id: `contact:${p.id}`,
          title: p.displayName,
          chatClientId: null,
          threadType: 'dm',
          isPinned: false,
          isAiInvolved: p.principalType === 'agent',
          avatarUrl: p.avatarUrl || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        return item;
      });
      allContacts.value = mapped;
    } catch (e) {
      allContacts.value = [];
    }
  };

  const mentionCandidates = computed(() => {
    const contacts = allContacts.value;
    const sorted = [...contacts].sort((a, b) => {
      const ta = (a.title || '').toLowerCase();
      const tb = (b.title || '').toLowerCase();
      return ta.localeCompare(tb);
    });
    return sorted.map((item) => ({
      id: item.id,
      title: item.title,
      chatClientId: item.chatClientId,
      threadType: item.threadType,
      isPinned: item.isPinned,
      isAiInvolved: item.isAiInvolved,
      workflowStatus: item.workflowStatus,
      lastMessage: item.lastMessage,
      avatarUrl: item.avatarUrl,
      members: item.members,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  });

  return {
    allContacts,
    mentionCandidates,
    loadContacts,
  };
}
