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
import { imApi } from '../../../../api/im';

const { t } = useI18n();

const panelStore = usePanelStore();
const { onlyAi, searchQuery } = storeToRefs(panelStore);

const agentStore = useAgentStore();
const { currentSessionId } = storeToRefs(agentStore);

const sessionStore = useAgentSessionStore();
const { sessions } = storeToRefs(sessionStore);

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

onMounted(() => {
  void loadSessions();
});

onUnmounted(() => {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = null;
});

const enterSession = async (t: SessionListItem) => {
  agentStore.setCurrentSession(t.id, t.title ?? '');
  panelStore.mode = 'chat';
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
    await imApi.updateSession(t.id, {
      name: t.title ?? undefined,
      isPinned: t.isPinned,
    });
    await loadSessions();
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
    await imApi.deleteSession(t.id);
    await loadSessions();
    sessionStore.removeSession(t.id);
  } catch {
    return;
  }
};
</script>
