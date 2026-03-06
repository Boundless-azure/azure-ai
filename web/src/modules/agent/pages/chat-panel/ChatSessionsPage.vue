<template>
  <div class="h-full overflow-hidden">
    <ChatThreadList
      :threads="sessions"
      :active-id="currentSessionId"
      :search-query="searchQuery"
      :is-loading="isLoadingSessions"
      :empty-text="t('chat.emptyThreads')"
      :workflow-count="0"
      @select="enterSession"
      @open-detail="openThreadDetail"
      @toggle-pin="togglePin"
      @delete="deleteSession"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Sessions Page
 * @description 会话记录页面：加载会话列表、置顶/删除与进入会话。
 * @keywords-cn 会话记录, 会话列表, 置顶, 删除会话
 * @keywords-en sessions, session-list, pin, delete-session
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import ChatThreadList from '../../components/chat/ChatThreadList.vue';
import { useI18n } from '../../composables/useI18n';
import { usePanelStore } from '../../store/panel.store';
import { useAgentSessionStore } from '../../store/session.store';
import { useAgentStore } from '../../store/agent.store';
import type { SessionListItem } from '../../types/agent.types';
import { useImStore } from '../../../im/im.module';

const { t } = useI18n();

const panelStore = usePanelStore();
const { onlyAi, searchQuery, sessionRefreshTrigger } = storeToRefs(panelStore);

const agentStore = useAgentStore();
const { currentSessionId } = storeToRefs(agentStore);

const sessionStore = useAgentSessionStore();
const { sessions } = storeToRefs(sessionStore);

const imStore = useImStore();

const isLoadingSessions = ref(false);

const loadSessions = async () => {
  isLoadingSessions.value = true;
  try {
    await sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });
  } finally {
    isLoadingSessions.value = false;
  }
};

let debounceTimer: number | null = null;
const debouncedLoadSessions = () => {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void loadSessions();
    debounceTimer = null;
  }, 200);
};

watch(onlyAi, debouncedLoadSessions);
watch(searchQuery, debouncedLoadSessions);
watch(sessionRefreshTrigger, debouncedLoadSessions);

onMounted(() => {
  void loadSessions();
});

onUnmounted(() => {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = null;
});

const enterSession = async (t: SessionListItem) => {
  if (t.id === 'azure-ai') {
    const id = await sessionStore.ensureFixedEntrySession(
      'azure-ai',
      t.title ?? undefined,
    );
    const resolved = sessionStore.getSession(id);
    agentStore.setCurrentSession(id, resolved?.title ?? t.title ?? '');
    panelStore.mode = 'chat';
    return;
  }
  if (t.id === 'ai-notify') {
    const id = await sessionStore.ensureFixedEntrySession(
      'ai-notify',
      t.title ?? undefined,
    );
    const resolved = sessionStore.getSession(id);
    agentStore.setCurrentSession(id, resolved?.title ?? t.title ?? '');
    panelStore.mode = 'chat';
    return;
  }

  agentStore.setCurrentSession(t.id, t.title ?? '');
  panelStore.mode = 'chat';
};

const openThreadDetail = (t: SessionListItem) => {
  const type = t.threadType === 'group' ? 'group' : 'dm';
  panelStore.openDrawer('info', {
    sessionId: t.id,
    type,
    title: t.title ?? '',
    isPinned: !!t.isPinned,
  });
};

const togglePin = async (t: SessionListItem) => {
  if (
    t.id.startsWith('fixed:') ||
    t.threadType === 'assistant' ||
    t.threadType === 'system'
  ) {
    return;
  }
  t.isPinned = !t.isPinned;
  try {
    await imStore.updateSession(t.id, {
      name: t.title ?? undefined,
      isPinned: t.isPinned,
    });
  } catch {
    t.isPinned = !t.isPinned;
  }
};

const deleteSession = async (t: SessionListItem) => {
  if (
    t.id.startsWith('fixed:') ||
    t.threadType === 'assistant' ||
    t.threadType === 'system'
  ) {
    return;
  }
  if (!confirm('确定要删除该对话吗？')) return;

  try {
    await imStore.deleteSession(t.id);
    panelStore.triggerSessionRefresh();
  } catch {
    return;
  }
};
</script>
