<template>
  <div class="flex flex-col h-full bg-gray-50 relative">
    <!-- Header -->
    <div class="flex-shrink-0 z-10 bg-white border-b border-gray-200">
      <!-- Home Mode Header -->
      <ChatHomeHeader
        v-if="mode === 'home'"
        :searchQuery="searchQuery"
        :onlyAi="onlyAi"
        :isCreateMenuOpen="isCreateMenuOpen"
        @update:searchQuery="searchQuery = $event"
        @update:onlyAi="onlyAi = $event"
        @update:isCreateMenuOpen="isCreateMenuOpen = $event"
        @createSession="createSessionOfType"
      />

      <!-- Chat Mode Header -->
      <ChatSessionHeader
        v-else
        :currentSessionTitle="currentSessionTitle"
        :isTitleLoading="isTitleLoading"
        @back="mode = 'home'"
        @openTab="openDrawer"
        @delete="handleDeleteCurrentSession"
      />
    </div>

    <div class="flex-1 flex overflow-hidden relative">
      <div class="flex-1 flex flex-col min-w-0 bg-white relative z-0">
        <div
          v-if="mode === 'home'"
          class="flex-1 overflow-y-auto p-2 custom-scrollbar relative"
        >
          <ChatSessionsPage v-if="activeTab === 'chat'" />
          <ChatContactsPage
            v-else-if="activeTab === 'contacts'"
            :selfPrincipalId="selfPrincipalId"
          />
          <ChatDailyPage v-else-if="activeTab === 'daily'" />
        </div>

        <ChatMessagesPage
          v-else
          :selfPrincipalId="selfPrincipalId"
          @titleLoadingChange="isTitleLoading = $event"
        />
      </div>
    </div>

    <!-- Right Drawer -->
    <div
      v-if="mode !== 'home' && isDrawerOpen"
      class="absolute inset-0 z-30 bg-white flex flex-col transition-all"
    >
      <component
        :is="activeDrawerComponent"
        :sessionId="currentSessionId"
        :type="currentSession?.threadType || 'dm'"
        :title="currentSession?.title || currentSessionTitle || ''"
        :isPinned="!!currentSession?.isPinned"
        :existingMembers="existingMemberIds"
        @close="closeDrawer"
        @addMember="handleAddMember"
        @confirm="handleMemberSelectorConfirm"
      />
    </div>

    <!-- Bottom Tab Bar -->
    <div
      v-if="mode === 'home'"
      class="flex-shrink-0 bg-white border-t border-gray-200 flex items-center justify-around h-14 pb-2"
    >
      <button
        @click="activeTab = 'chat'"
        class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
        :class="
          activeTab === 'chat'
            ? 'text-green-600'
            : 'text-gray-400 hover:text-gray-600'
        "
      >
        <div class="relative">
          <i class="fa-solid fa-message text-lg"></i>
          <span
            v-if="unreadCount > 0"
            class="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center leading-none"
          >
            {{ unreadDisplay }}
          </span>
        </div>
        <span class="text-[10px] font-medium">{{ t('tabs.chat') }}</span>
      </button>

      <button
        @click="activeTab = 'contacts'"
        class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
        :class="
          activeTab === 'contacts'
            ? 'text-green-600'
            : 'text-gray-400 hover:text-gray-600'
        "
      >
        <i class="fa-solid fa-address-book text-lg"></i>
        <span class="text-[10px] font-medium">{{ t('tabs.contacts') }}</span>
      </button>

      <button
        @click="activeTab = 'daily'"
        class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
        :class="
          activeTab === 'daily'
            ? 'text-green-600'
            : 'text-gray-400 hover:text-gray-600'
        "
      >
        <i class="fa-solid fa-file-lines text-lg"></i>
        <span class="text-[10px] font-medium">{{ t('tabs.daily') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Panel Component
 * @description 聊天主容器：负责模式切换、页挂载与右侧抽屉。
 * @keywords-cn 聊天面板, 模式切换, 抽屉, 页面挂载
 * @keywords-en chat-panel, mode-switch, drawer, page-mount
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '../store/agent.store';
import { useAgentSessionStore } from '../store/session.store';
import { useI18n } from '../composables/useI18n';
import ChatHomeHeader from './chat/ChatHomeHeader.vue';
import ChatSessionHeader from './chat/ChatSessionHeader.vue';
import { usePanelStore } from '../store/panel.store';
import { imApi } from '../../../api/im';
import { useUIStore } from '../store/ui.store';
import ChatDetail from './ChatDetail.vue';
import ChatTodos from './ChatTodos.vue';
import ChatTasks from './ChatTasks.vue';
import ChatFiles from './ChatFiles.vue';
import MemberSelectorPanel from './MemberSelectorPanel.vue';
import ChatSessionsPage from '../pages/chat-panel/ChatSessionsPage.vue';
import ChatContactsPage from '../pages/chat-panel/ChatContactsPage.vue';
import ChatDailyPage from '../pages/chat-panel/ChatDailyPage.vue';
import ChatMessagesPage from '../pages/chat-panel/ChatMessagesPage.vue';

const { t } = useI18n();

const isCreateMenuOpen = ref(false);
const isDrawerOpen = ref(false);
const currentDrawerTab = ref<'info' | 'todos' | 'tasks' | 'files' | 'members'>(
  'info',
);
// const isMemberSelectorOpen = ref(false); // Removed
const existingMemberIds = ref<string[]>([]);

const activeDrawerComponent = computed(() => {
  switch (currentDrawerTab.value) {
    case 'info':
      return ChatDetail;
    case 'todos':
      return ChatTodos;
    case 'tasks':
      return ChatTasks;
    case 'files':
      return ChatFiles;
    case 'members':
      return MemberSelectorPanel;
    default:
      return ChatDetail;
  }
});

const openDrawer = (tab: 'info' | 'todos' | 'tasks' | 'files') => {
  currentDrawerTab.value = tab;
  isDrawerOpen.value = true;
};

const closeDrawer = () => {
  if (currentDrawerTab.value === 'members') {
    currentDrawerTab.value = 'info';
  } else {
    isDrawerOpen.value = false;
  }
};

const handleAddMember = (memberIds?: string[]) => {
  if (!currentSessionId.value) return;
  existingMemberIds.value = memberIds || [];
  currentDrawerTab.value = 'members';
  isDrawerOpen.value = true;
};

const handleMemberSelectorConfirm = async (selectedIds: string[]) => {
  if (!currentSessionId.value || selectedIds.length === 0) return;

  try {
    const promises = selectedIds.map((principalId) =>
      imApi.addMember(currentSessionId.value!, { principalId }),
    );

    await Promise.all(promises);

    const uiStore = useUIStore();
    uiStore.showToast(`成功添加 ${selectedIds.length} 位成员`, 'success');
    currentDrawerTab.value = 'info';

    // Refresh session members
    panelStore.triggerSessionRefresh();
  } catch (e) {
    const uiStore = useUIStore();
    uiStore.showToast('添加成员失败', 'error');
    console.error(e);
  }
};

const handleDeleteCurrentSession = async () => {
  if (!currentSessionId.value) return;
  if (confirm('确定要删除该对话吗？')) {
    try {
      await imApi.deleteSession(currentSessionId.value);
      isDrawerOpen.value = false;
      mode.value = 'home';
      store.setCurrentSession(undefined, '');
      const uiStore = useUIStore();
      uiStore.showToast('会话已删除', 'success');
      void sessionStore.loadSessions({
        onlyAi: onlyAi.value,
        searchQuery: searchQuery.value,
      });
    } catch (e) {
      const uiStore = useUIStore();
      uiStore.showToast('删除失败', 'error');
    }
  }
};

const isTitleLoading = ref<boolean>(false);

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return typeof v === 'object' && v !== null;
};

const getPrincipalId = (): string | undefined => {
  try {
    const principalRaw = localStorage.getItem('principal');
    if (principalRaw) {
      const parsed: unknown = JSON.parse(principalRaw);
      if (isRecord(parsed)) {
        const idVal = parsed['id'];
        if (typeof idVal === 'string') {
          const pid = idVal.trim();
          if (pid) return pid;
        }
      }
    }
    const legacy = localStorage.getItem('identity.currentPrincipalId');
    const id = (legacy || '').trim();
    return id || undefined;
  } catch {
    return undefined;
  }
};
const selfPrincipalId = ref<string | undefined>(undefined);

const panelStore = usePanelStore();
const { mode, activeTab, onlyAi, searchQuery, sessionRefreshTrigger } =
  storeToRefs(panelStore);

watch(sessionRefreshTrigger, async () => {
  await sessionStore.loadSessions({
    onlyAi: onlyAi.value,
    searchQuery: searchQuery.value,
  });
  // 若当前会话已被删除（不在列表中），跳回首页；
  // 固定会话（azure-ai / ai-notify）不受此规则影响
  const curId = currentSessionId.value;
  const isFixed = curId === 'azure-ai' || curId === 'ai-notify';
  if (curId && !isFixed && !sessions.value.find((t) => t.id === curId)) {
    mode.value = 'home';
    store.setCurrentSession(undefined, '');
  }
});

const sessionStore = useAgentSessionStore();
const { sessions } = storeToRefs(sessionStore);

const store = useAgentStore();
const { currentSessionId, currentSessionTitle } = storeToRefs(store);

const currentSession = computed(() => {
  return sessionStore.getSession(currentSessionId.value);
});

const unreadCount = computed(() => {
  return sessions.value.reduce(
    (sum, s) => sum + (typeof s.unreadCount === 'number' ? s.unreadCount : 0),
    0,
  );
});

const unreadDisplay = computed(() => {
  const c = unreadCount.value;
  return c > 99 ? '99+' : String(c);
});

onMounted(() => {
  const principalId = getPrincipalId();
  selfPrincipalId.value = principalId || undefined;
  sessionStore.connectRealtime();
  void sessionStore.loadSessions({
    onlyAi: onlyAi.value,
    searchQuery: searchQuery.value,
  });
});

onUnmounted(() => {
  sessionStore.disconnectRealtime();
});

watch(mode, (m) => {
  if (m === 'home') {
    isDrawerOpen.value = false;
    currentDrawerTab.value = 'info';
  }
});

const createSessionOfType = async (
  type: 'assistant' | 'system' | 'todo' | 'group' | 'dm',
) => {
  const uiStore = useUIStore();

  if (type === 'dm') {
    activeTab.value = 'contacts';
    uiStore.showToast('请选择联系人创建私聊', 'info');
    return;
  }
  if (type === 'assistant') {
    store.setCurrentSession('azure-ai', t('chat.assistantTitle'));
    mode.value = 'chat';
    return;
  }
  if (type === 'system') {
    store.setCurrentSession('ai-notify', t('chat.systemNotification'));
    mode.value = 'chat';
    return;
  }

  const initialTitle =
    type === 'todo' ? t('chat.todoNotification') || '待办通知' : '群聊';
  const mappedType: 'group' | 'channel' = type === 'todo' ? 'channel' : 'group';

  const response = await imApi.createSession({
    type: mappedType,
    name: initialTitle,
  });

  const id = response.data.sessionId;
  await sessionStore.loadSessions({
    onlyAi: onlyAi.value,
    searchQuery: searchQuery.value,
  });
  store.setCurrentSession(id, initialTitle);
  mode.value = 'chat';
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #d1d5db;
}
</style>
