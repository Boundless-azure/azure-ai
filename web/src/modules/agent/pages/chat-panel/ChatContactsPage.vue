<template>
  <ChatContactsPanel
    :contacts="allContacts"
    :sessions="sessions"
    :selfPrincipalId="selfPrincipalId"
    :enterSession="enterSession"
    :updateSession="updateSession"
    :loadSessions="loadSessions"
  />
</template>

<script setup lang="ts">
/**
 * @title Chat Contacts Page
 * @description 通讯录页面：加载联系人，并支持从联系人进入/创建私聊会话。
 * @keywords-cn 通讯录, 联系人, 私聊, 创建会话
 * @keywords-en contacts, address-book, direct-message, create-session
 */
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import ChatContactsPanel from '../../components/chat/ChatContactsPanel.vue';
import { useChatContacts } from '../../hooks/useChatContacts';
import { useAgentSessionStore } from '../../store/session.store';
import { usePanelStore } from '../../store/panel.store';
import { useAgentStore } from '../../store/agent.store';
import type { SessionListItem } from '../../types/agent.types';
import { imApi } from '../../../../api/im';

interface UpdateSessionOptions {
  title?: string | null;
  threadType?: string;
  isAiInvolved?: boolean;
  participants?: Array<{ id: string; name: string }>;
  isPinned?: boolean;
}

const props = defineProps<{
  selfPrincipalId?: string;
}>();

const { allContacts, loadContacts } = useChatContacts();

const panelStore = usePanelStore();
const { onlyAi, searchQuery } = storeToRefs(panelStore);

const agentStore = useAgentStore();

const sessionStore = useAgentSessionStore();
const { sessions } = storeToRefs(sessionStore);

const loadSessions = async () => {
  await sessionStore.loadSessions({
    onlyAi: onlyAi.value,
    searchQuery: searchQuery.value,
  });
};

onMounted(() => {
  void loadContacts();
});

const createSession = async (options: {
  title?: string | null;
  threadType?: string;
  memberIds?: string[];
}): Promise<{ id: string }> => {
  const typeMap: Record<string, 'private' | 'group' | 'channel'> = {
    dm: 'private',
    assistant: 'private',
    group: 'group',
    system: 'channel',
    todo: 'channel',
  };

  const response = await imApi.createSession({
    type: typeMap[options.threadType || 'group'] || 'group',
    name: options.title || undefined,
    memberIds: options.memberIds,
  });

  return { id: response.data.sessionId };
};

const updateSession = async (id: string, options: UpdateSessionOptions) => {
  if (options.title !== undefined || options.isPinned !== undefined) {
    await imApi.updateSession(id, {
      name: options.title ?? undefined,
      isPinned: options.isPinned,
    });
  }
  if (options.participants && options.participants.length > 0) {
    for (const p of options.participants) {
      try {
        await imApi.addMember(id, { principalId: p.id });
      } catch {
        continue;
      }
    }
  }
};

const enterSession = async (t: SessionListItem) => {
  if (t.id.startsWith('contact:')) {
    const principalId = t.id.substring('contact:'.length);
    const existing = sessions.value.find(
      (x) => x.threadType === 'dm' && (x.members || []).includes(principalId),
    );

    if (existing) {
      agentStore.setCurrentSession(existing.id, existing.title ?? '');
      panelStore.mode = 'chat';
      return;
    }

    const created = await createSession({
      threadType: 'dm',
      title: t.title || principalId,
      memberIds: [principalId],
    });

    await loadSessions();
    agentStore.setCurrentSession(created.id, t.title ?? '');
    panelStore.mode = 'chat';
    return;
  }

  agentStore.setCurrentSession(t.id, t.title ?? '');
  panelStore.mode = 'chat';
};
</script>
