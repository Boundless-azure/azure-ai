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
        :currentThread="currentSession"
        :currentSessionTitle="currentSession?.title || currentSessionTitle"
        :isTitleLoading="isTitleLoading"
        @back="mode = 'home'"
        @openTab="openDrawer"
        @delete="handleDeleteCurrentSession"
      />

      <div
        v-if="showAnnouncementBar"
        class="px-4 py-2 bg-gray-50 border-t border-gray-200"
      >
        <button
          class="w-full flex items-center gap-3 text-left"
          @click="openAnnouncementsFromBar"
        >
          <i class="fa-solid fa-bullhorn text-gray-400"></i>
          <div class="flex-1 min-w-0">
            <div class="text-[10px] text-gray-400">群公告</div>
            <div class="text-sm text-gray-700 truncate">
              {{ latestAnnouncementPreview }}
            </div>
          </div>
          <div class="text-xs text-gray-500 flex items-center gap-1">
            <span>{{ announcementTotal }}</span>
            <span>条</span>
            <i class="fa-solid fa-chevron-right text-[10px] text-gray-300"></i>
          </div>
        </button>
      </div>
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
    <transition name="drawer-slide">
      <div
        v-if="drawerVisible"
        class="absolute inset-0 z-30 bg-white flex flex-col shadow-xl"
      >
        <MemberSelectorPanel
          v-if="drawerType === 'members'"
          :existingMembers="membersDrawerExistingMembers"
          :title="memberSelectorTitle"
          :confirmText="memberSelectorConfirmText"
          @close="closeDrawer"
          @confirm="handleMemberSelectorConfirm"
        />

        <ChatDetail
          v-else-if="drawerType === 'info' && detailDrawerProps"
          v-bind="detailDrawerProps"
          @close="closeDrawer"
          @addMember="handleAddMember"
        />

        <ChatTodos
          v-else-if="drawerType === 'todos' && drawerSessionId"
          :sessionId="drawerSessionId"
          @close="closeDrawer"
        />

        <ChatTasks
          v-else-if="drawerType === 'tasks' && drawerSessionId"
          :sessionId="drawerSessionId"
          @close="closeDrawer"
        />

        <ChatFiles
          v-else-if="drawerType === 'files' && drawerSessionId"
          :sessionId="drawerSessionId"
          @close="closeDrawer"
        />

        <UserProfile
          v-else-if="drawerType === 'profile' && profileDrawerUser"
          :user="profileDrawerUser"
          @close="closeDrawer"
          @sendMessage="handleSendMessage"
        />
      </div>
    </transition>

    <div
      v-if="isContactGroupCreateOpen"
      class="absolute inset-0 z-40 bg-black/40 flex items-center justify-center"
      @click.self="closeContactGroupCreate"
    >
      <div class="w-full h-full p-6 flex items-center justify-center">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
          <div class="text-base font-bold text-gray-800">新建聊天分组</div>
          <div class="mt-4">
            <div class="text-xs text-gray-500 mb-2">分组名</div>
            <input
              v-model="contactGroupName"
              type="text"
              class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
              placeholder="请输入分组名"
              @keydown.enter.prevent="submitContactGroupCreate"
              maxlength="50"
              autofocus
            />
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
              @click="closeContactGroupCreate"
            >
              取消
            </button>
            <button
              class="px-5 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              :disabled="!contactGroupName.trim()"
              @click="submitContactGroupCreate"
            >
              创建
            </button>
          </div>
        </div>
      </div>
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
            ? 'text-gray-900'
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
            ? 'text-gray-900'
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
            ? 'text-gray-900'
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
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '../store/agent.store';
import { useAgentSessionStore } from '../store/session.store';
import { useI18n } from '../composables/useI18n';
import ChatHomeHeader from './chat/ChatHomeHeader.vue';
import ChatSessionHeader from './chat/ChatSessionHeader.vue';
import { usePanelStore } from '../store/panel.store';
import { imApi, type ImMessageInfo } from '../../../api/im';
import { useUIStore } from '../store/ui.store';
import ChatDetail from './ChatDetail.vue';
import ChatTodos from './ChatTodos.vue';
import ChatTasks from './ChatTasks.vue';
import ChatFiles from './ChatFiles.vue';
import MemberSelectorPanel from './MemberSelectorPanel.vue';
import UserProfile from './UserProfile.vue';
import ChatSessionsPage from '../pages/chat-panel/ChatSessionsPage.vue';
import ChatContactsPage from '../pages/chat-panel/ChatContactsPage.vue';
import ChatDailyPage from '../pages/chat-panel/ChatDailyPage.vue';
import ChatMessagesPage from '../pages/chat-panel/ChatMessagesPage.vue';

const { t } = useI18n();

const isCreateMenuOpen = ref(false);
const existingMemberIds = ref<string[]>([]);
const openAnnouncementsTrigger = ref<number>(0);

type MembersDrawerMode = 'invite' | 'create_group' | 'contact_group_manage';

const membersDrawerMode = computed<MembersDrawerMode>(() => {
  if (drawerType.value !== 'members') return 'invite';
  const v = drawerProps.value['membersMode'];
  if (v === 'create_group' || v === 'contact_group_manage' || v === 'invite') {
    return v;
  }
  return 'invite';
});

const membersDrawerExistingMembers = computed<string[]>(() => {
  const raw = drawerProps.value['existingMembers'];
  if (Array.isArray(raw)) {
    return raw
      .filter((x) => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return existingMemberIds.value;
});

const memberSelectorTitle = computed(() => {
  if (membersDrawerMode.value === 'create_group') return '全部联系人';
  if (membersDrawerMode.value === 'contact_group_manage') {
    const name = drawerProps.value['contactGroupName'];
    const n = typeof name === 'string' ? name.trim() : '';
    return n ? `分组管理：${n}` : '分组管理';
  }
  return '选择成员';
});

const memberSelectorConfirmText = computed(() => {
  if (membersDrawerMode.value === 'create_group') return '创建群聊';
  if (membersDrawerMode.value === 'contact_group_manage') return '添加到分组';
  return '确认添加';
});

const isContactGroupCreateOpen = ref(false);
const contactGroupName = ref('');

const announcementTotal = ref<number>(0);
const latestAnnouncement = ref<ImMessageInfo | null>(null);
const loadingAnnouncements = ref(false);

const latestAnnouncementPreview = computed(() => {
  const content = latestAnnouncement.value?.content;
  return typeof content === 'string' ? content : '';
});

const handleMemberSelectorConfirm = async (payload: {
  ids: string[];
  items: Array<{ id: string; displayName: string }>;
}) => {
  if (payload.ids.length === 0) return;

  if (membersDrawerMode.value === 'create_group') {
    const uiStore = useUIStore();
    try {
      const selfId = (selfPrincipalId.value || '').trim();
      const principalIds = Array.from(
        new Set(
          [...payload.ids, selfId]
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean),
        ),
      );

      const initialTitle = '群聊';
      const response = await imApi.createSession({
        type: 'group',
        name: initialTitle,
        memberIds: principalIds,
      });

      const id = response.data.sessionId;
      await sessionStore.loadSessions({
        onlyAi: onlyAi.value,
        searchQuery: searchQuery.value,
      });
      store.setCurrentSession(id, initialTitle);
      mode.value = 'chat';
      panelStore.closeDrawer();
      uiStore.showToast('群聊已创建', 'success');
      panelStore.triggerSessionRefresh();
    } catch (e) {
      uiStore.showToast('创建群聊失败', 'error');
      console.error(e);
    }
    return;
  }

  if (membersDrawerMode.value === 'contact_group_manage') {
    const uiStore = useUIStore();
    const rawGroupId = drawerProps.value['contactGroupId'];
    const groupId = typeof rawGroupId === 'string' ? rawGroupId.trim() : '';
    if (!groupId) {
      uiStore.showToast('分组信息缺失', 'error');
      panelStore.closeDrawer();
      return;
    }

    try {
      const added = await panelStore.addContactGroupMembers(
        groupId,
        payload.ids,
      );
      panelStore.closeDrawer();
      if (activeTab.value !== 'contacts') {
        activeTab.value = 'contacts';
      }
      if (!expandedCategories.value.includes(groupId)) {
        expandedCategories.value = [...expandedCategories.value, groupId];
      }
      uiStore.showToast(
        added > 0 ? `已添加 ${added} 位联系人` : '没有新增联系人',
        'success',
      );
    } catch (e) {
      uiStore.showToast('移动到分组失败', 'error');
      console.error(e);
    }
    return;
  }

  if (!currentSessionId.value) return;

  const uiStore = useUIStore();
  try {
    const sid = currentSessionId.value;

    const extraInviteIds: string[] = [];
    if (currentSession.value?.threadType === 'dm') {
      const selfId = selfPrincipalId.value;
      const otherId = existingMemberIds.value.find((id) => {
        const v = (id || '').trim();
        if (!v) return false;
        return selfId ? v !== selfId : true;
      });
      if (otherId) extraInviteIds.push(otherId);
    }

    const principalIds = Array.from(
      new Set(
        [...payload.ids, ...extraInviteIds]
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter(Boolean),
      ),
    );

    const resp = await imApi.inviteMembers(sid, { principalIds });
    const action = resp.data.action;
    const nextSessionId = resp.data.sessionId;

    await sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });

    if (action === 'created_group') {
      store.setCurrentSession(nextSessionId, resp.data.sessionName ?? '群聊');
      mode.value = 'chat';
      panelStore.closeDrawer();
      uiStore.showToast('群聊已创建', 'success');
    } else if (action === 'added_to_session') {
      uiStore.showToast(
        `成功添加 ${resp.data.addedCount ?? 0} 位成员`,
        'success',
      );
      panelStore.openDrawer('info', drawerProps.value);
    } else {
      uiStore.showToast('没有新增成员', 'info');
      panelStore.openDrawer('info', drawerProps.value);
    }

    panelStore.triggerSessionRefresh();
  } catch (e) {
    uiStore.showToast('邀请成员失败', 'error');
    console.error(e);
  }
};

const handleDeleteCurrentSession = async () => {
  if (!currentSessionId.value) return;
  const sid = currentSessionId.value;
  const threadType = currentSession.value?.threadType;
  const uiStore = useUIStore();

  if (threadType === 'group') {
    let isOwner = false;
    try {
      const pid = selfPrincipalId.value;
      if (pid) {
        const detail = await imApi.getSession(sid);
        const self = (detail.data.members || []).find(
          (m) => m.principalId === pid,
        );
        isOwner = self?.role === 'owner' || detail.data.creatorId === pid;
      }
    } catch {
      isOwner = false;
    }

    const confirmText = isOwner
      ? '确定要解散该群聊吗？'
      : '确定要退出该群聊吗？';
    if (!confirm(confirmText)) return;

    try {
      if (isOwner) {
        await imApi.deleteSession(sid);
        uiStore.showToast('群聊已解散', 'success');
      } else {
        await imApi.leaveSession(sid);
        uiStore.showToast('已退出群聊', 'success');
      }
      panelStore.closeDrawer();
      mode.value = 'home';
      store.setCurrentSession(undefined, '');
      void sessionStore.loadSessions({
        onlyAi: onlyAi.value,
        searchQuery: searchQuery.value,
      });
      panelStore.triggerSessionRefresh();
    } catch {
      uiStore.showToast('操作失败', 'error');
    }
    return;
  }

  if (!confirm('确定要删除该对话吗？')) return;
  try {
    await imApi.deleteSession(sid);
    panelStore.closeDrawer();
    mode.value = 'home';
    store.setCurrentSession(undefined, '');
    uiStore.showToast('会话已删除', 'success');
    void sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });
  } catch {
    uiStore.showToast('删除失败', 'error');
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
const selfPrincipalId = ref<string | undefined>(getPrincipalId());

const sessionStore = useAgentSessionStore();
const { sessions } = storeToRefs(sessionStore);

const store = useAgentStore();
const { currentSessionId, currentSessionTitle } = storeToRefs(store);

const panelStore = usePanelStore();
const {
  mode,
  activeTab,
  onlyAi,
  searchQuery,
  expandedCategories,
  sessionRefreshTrigger,
  drawerVisible,
  drawerType,
  drawerProps,
} = storeToRefs(panelStore);

const currentSession = computed(() => {
  const sid = currentSessionId.value;
  if (!sid) return undefined;
  return sessions.value.find((s) => s.id === sid);
});

const unreadCount = computed(() => {
  return sessions.value.reduce((sum, s) => {
    const c = typeof s.unreadCount === 'number' ? s.unreadCount : 0;
    return sum + c;
  }, 0);
});

const unreadDisplay = computed(() => {
  const c = unreadCount.value;
  if (c > 99) return '99+';
  return String(c);
});

const showAnnouncementBar = computed(() => {
  if (mode.value !== 'chat') return false;
  if (currentSession.value?.threadType !== 'group') return false;
  if (loadingAnnouncements.value) return true;
  return announcementTotal.value > 0 || !!latestAnnouncement.value;
});

const refreshAnnouncementBar = async () => {
  const sid = currentSessionId.value;
  if (
    !sid ||
    mode.value !== 'chat' ||
    currentSession.value?.threadType !== 'group'
  ) {
    announcementTotal.value = 0;
    latestAnnouncement.value = null;
    loadingAnnouncements.value = false;
    return;
  }

  loadingAnnouncements.value = true;
  try {
    const resp = await imApi.getAnnouncements(sid, { limit: 1 });
    announcementTotal.value = resp.data.total || 0;
    latestAnnouncement.value = resp.data.items?.[0] || null;
  } catch {
    announcementTotal.value = 0;
    latestAnnouncement.value = null;
  } finally {
    loadingAnnouncements.value = false;
  }
};

watch([mode, currentSessionId, sessionRefreshTrigger], () => {
  void refreshAnnouncementBar();
});

const drawerSessionId = computed(() => {
  const sid = drawerProps.value['sessionId'];
  return typeof sid === 'string' && sid.trim() ? sid : undefined;
});

const detailDrawerProps = computed(() => {
  if (drawerType.value !== 'info') return null;
  const sessionId = drawerSessionId.value;
  if (!sessionId) return null;

  const rawType = drawerProps.value['type'];
  const rawTitle = drawerProps.value['title'];
  const rawPinned = drawerProps.value['isPinned'];
  const rawTrigger = drawerProps.value['openAnnouncementsTrigger'];

  const type = typeof rawType === 'string' ? rawType : 'dm';
  const title = typeof rawTitle === 'string' ? rawTitle : '';
  const isPinned = typeof rawPinned === 'boolean' ? rawPinned : false;
  const openAnnouncementsTrigger =
    typeof rawTrigger === 'number' ? rawTrigger : undefined;

  return {
    sessionId,
    type,
    title,
    isPinned,
    openAnnouncementsTrigger,
  };
});

const profileDrawerUser = computed(() => {
  if (drawerType.value !== 'profile') return null;
  const u = drawerProps.value['user'];
  return u ?? null;
});

const openDrawer = (tab: 'info' | 'todos' | 'tasks' | 'files') => {
  // If opening for current session
  panelStore.openDrawer(tab, {
    sessionId: currentSessionId.value,
    type: currentSession.value?.threadType || 'dm',
    title: currentSession.value?.title || currentSessionTitle.value || '',
    isPinned: !!currentSession.value?.isPinned,
    openAnnouncementsTrigger: openAnnouncementsTrigger.value,
  });
};

const openAnnouncementsFromBar = () => {
  openAnnouncementsTrigger.value = Date.now();
  openDrawer('info');
};

const closeDrawer = () => {
  if (drawerType.value === 'members') {
    if (membersDrawerMode.value === 'invite') {
      panelStore.openDrawer('info', drawerProps.value);
    } else {
      panelStore.closeDrawer();
    }
  } else {
    panelStore.closeDrawer();
  }
};

const handleSendMessage = async (user: any) => {
  closeDrawer();
  activeTab.value = 'chat';

  const rawId = typeof user?.id === 'string' ? user.id.trim() : '';
  const principalId = rawId.startsWith('contact:')
    ? rawId.substring('contact:'.length)
    : typeof user?.principalId === 'string'
      ? user.principalId.trim()
      : rawId;

  if (!principalId) return;

  const existing = sessions.value.find(
    (x) => x.threadType === 'dm' && (x.members || []).includes(principalId),
  );

  if (existing) {
    store.setCurrentSession(existing.id, existing.title ?? '');
    mode.value = 'chat';
    return;
  }

  const title =
    typeof user?.title === 'string'
      ? user.title
      : typeof user?.displayName === 'string'
        ? user.displayName
        : undefined;

  const created = await imApi.createSession({
    type: 'private',
    name: title,
    memberIds: [principalId],
  });

  await sessionStore.loadSessions({
    onlyAi: onlyAi.value,
    searchQuery: searchQuery.value,
  });

  store.setCurrentSession(created.data.sessionId, title || '');
  mode.value = 'chat';
};

const handleAddMember = (memberIds?: string[]) => {
  if (!currentSessionId.value) return;
  existingMemberIds.value = (memberIds || [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);

  panelStore.openDrawer('members', {
    ...drawerProps.value,
    existingMembers: existingMemberIds.value,
    membersMode: 'invite',
  });
};

const createSessionOfType = async (
  type: 'assistant' | 'system' | 'todo' | 'group' | 'dm' | 'contact_group',
) => {
  const uiStore = useUIStore();

  if (type === 'contact_group') {
    contactGroupName.value = '';
    isContactGroupCreateOpen.value = true;
    return;
  }

  if (type === 'dm') {
    activeTab.value = 'contacts';
    uiStore.showToast('请选择联系人创建私聊', 'info');
    return;
  }
  if (type === 'assistant') {
    const id = await sessionStore.ensureFixedEntrySession(
      'azure-ai',
      t('chat.assistantTitle'),
    );
    const resolved = sessionStore.getSession(id);
    store.setCurrentSession(id, resolved?.title ?? t('chat.assistantTitle'));
    mode.value = 'chat';
    return;
  }
  if (type === 'system') {
    uiStore.showToast('系统通知暂未开放', 'info');
    return;
  }

  if (type === 'todo') {
    uiStore.showToast('待办通知暂未开放', 'info');
    return;
  }

  if (type === 'group') {
    existingMemberIds.value = [];
    panelStore.openDrawer('members', {
      membersMode: 'create_group',
      existingMembers: [],
    });
    return;
  }
};

const closeContactGroupCreate = () => {
  isContactGroupCreateOpen.value = false;
};

const submitContactGroupCreate = async () => {
  const name = contactGroupName.value.trim();
  if (!name) return;
  try {
    const group = await panelStore.createContactGroup(name);
    if (!group) return;
    isContactGroupCreateOpen.value = false;
    activeTab.value = 'contacts';
    if (!expandedCategories.value.includes(group.id)) {
      expandedCategories.value = [...expandedCategories.value, group.id];
    }
    useUIStore().showToast('分组已创建', 'success');
  } catch (e) {
    useUIStore().showToast('创建分组失败', 'error');
    console.error(e);
  }
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

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
