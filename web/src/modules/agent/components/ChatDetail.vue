<template>
  <div class="h-full flex flex-col bg-white relative">
    <!-- Header (Desktop style: simple text) -->
    <div class="px-4 py-3 border-b border-gray-100 flex items-center">
      <button
        @click="$emit('close')"
        class="mr-3 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <h3 class="font-bold text-gray-800 flex-1">
        {{ title }}
        <span
          v-if="memberCount > 0"
          class="text-gray-500 font-normal text-sm ml-1"
          >({{ memberCount }})</span
        >
      </h3>
      <!-- Close button handled by parent drawer usually, but we can keep a close emit if needed or just rely on parent -->
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
      <!-- Members Grid -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">
            成员
          </h4>
        </div>
        <div class="grid grid-cols-4 gap-3">
          <div
            v-for="member in displayMembers"
            :key="member.principalId"
            class="flex flex-col items-center group cursor-pointer"
            @click="handleMemberClick(member)"
          >
            <div
              class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden group-hover:bg-gray-200 transition-colors"
            >
              <img
                v-if="getMemberAvatarSrc(member)"
                :src="getMemberAvatarSrc(member)"
                class="w-full h-full object-contain"
              />
              <i v-else class="fa-solid fa-user text-sm"></i>
            </div>
            <span
              class="text-[10px] text-gray-500 mt-1 truncate w-full text-center group-hover:text-gray-700"
              >{{ member.displayName }}</span
            >
          </div>
          <!-- Add Button (Grid item) -->
          <div
            class="flex flex-col items-center cursor-pointer group"
            @click="
              $emit(
                'addMember',
                members.map((m) => m.principalId),
              )
            "
          >
            <div
              class="w-10 h-10 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:border-gray-400 group-hover:bg-gray-50 transition-colors"
            >
              <i class="fa-solid fa-plus text-sm"></i>
            </div>
            <span class="text-[10px] text-gray-400 mt-1">邀请</span>
          </div>

          <!-- Remove Button (Owner only) -->
          <div
            v-if="type === 'group' && isOwner"
            class="flex flex-col items-center cursor-pointer group"
            @click="openKickModal"
          >
            <div
              class="w-10 h-10 rounded-lg border border-dashed border-red-200 flex items-center justify-center text-red-400 group-hover:border-red-300 group-hover:bg-red-50 transition-colors"
            >
              <i class="fa-solid fa-minus text-sm"></i>
            </div>
            <span class="text-[10px] text-red-400 mt-1">移除</span>
          </div>
        </div>
      </section>

      <div class="border-t border-gray-100"></div>

      <!-- Settings -->
      <section class="space-y-4">
        <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">
          设置
        </h4>

        <!-- Group Name -->
        <div
          v-if="type === 'group'"
          class="flex items-center justify-between group"
        >
          <span class="text-sm text-gray-700">群聊名称</span>
          <div
            class="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            @click="handleEditName"
          >
            <span class="text-sm text-gray-600 mr-2 max-w-[120px] truncate">{{
              currentTitle
            }}</span>
            <i
              class="fa-solid fa-pen text-xs text-gray-400 opacity-0 group-hover:opacity-100"
            ></i>
          </div>
        </div>

        <!-- Group Notice -->
        <div v-if="type === 'group'" class="flex items-center justify-between">
          <span class="text-sm text-gray-700">群公告</span>
          <div
            class="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            @click="openAnnouncements"
          >
            <span class="text-sm text-gray-600 mr-2 max-w-[120px] truncate">
              {{ announcementPreview || '未设置' }}
            </span>
            <span
              v-if="announcementTotal > 0"
              class="text-[10px] text-gray-400 mr-1"
              >({{ announcementTotal }})</span
            >
            <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
          </div>
        </div>

        <div
          v-if="type === 'group' && isOwner"
          class="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
          @click="openTransferOwnerModal"
        >
          <span class="text-sm text-gray-700">转让群主</span>
          <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
        </div>

        <!-- Pin Chat -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">置顶聊天</span>
          <button
            @click="togglePin"
            :disabled="['assistant', 'system'].includes(type)"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
            :class="[
              isPinnedLocal || ['assistant', 'system'].includes(type)
                ? 'bg-green-500'
                : 'bg-gray-200',
              ['assistant', 'system'].includes(type)
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer',
            ]"
          >
            <span
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
              :class="
                isPinnedLocal || ['assistant', 'system'].includes(type)
                  ? 'translate-x-4'
                  : 'translate-x-1'
              "
            />
          </button>
        </div>

        <!-- Background (DM only) -->
        <div
          v-if="type === 'dm'"
          class="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
        >
          <span class="text-sm text-gray-700">设置聊天背景</span>
          <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
        </div>
      </section>

      <div class="border-t border-gray-100"></div>

      <!-- Danger Zone -->
      <section class="space-y-2">
        <div
          class="flex items-center text-red-500 cursor-pointer hover:bg-red-50 px-2 py-2 rounded transition-colors"
          @click="clearHistory"
        >
          <i class="fa-regular fa-trash-can mr-2"></i>
          <span class="text-sm">清空聊天记录</span>
        </div>

        <div v-if="type === 'group'" class="space-y-2">
          <div
            class="flex items-center text-red-500 cursor-pointer hover:bg-red-50 px-2 py-2 rounded transition-colors"
            @click="leaveGroup"
          >
            <i class="fa-solid fa-arrow-right-from-bracket mr-2"></i>
            <span class="text-sm">退出群聊</span>
          </div>
          <div
            v-if="isOwner"
            class="flex items-center text-red-600 cursor-pointer hover:bg-red-50 px-2 py-2 rounded transition-colors"
            @click="dissolveGroup"
          >
            <i class="fa-regular fa-circle-xmark mr-2"></i>
            <span class="text-sm">解散群聊</span>
          </div>
        </div>
        <div
          v-else
          class="flex items-center text-gray-600 cursor-pointer hover:bg-gray-50 px-2 py-2 rounded transition-colors"
        >
          <i class="fa-solid fa-circle-exclamation mr-2 text-gray-400"></i>
          <span class="text-sm">投诉</span>
        </div>
      </section>
    </div>
  </div>

  <!-- Rename Modal (Centered Popup with Mask) -->
  <div
    v-if="showRenameModal"
    class="absolute inset-0 z-50 bg-black/50 flex items-center justify-center"
    @click.self="closeRenameModal"
  >
    <div
      class="bg-white rounded-xl w-[85%] max-w-xs p-5 shadow-2xl transform transition-all"
    >
      <h3 class="text-center font-bold text-gray-800 text-lg mb-4">
        修改群聊名称
      </h3>

      <input
        v-model="renameInput"
        type="text"
        class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all text-sm mb-5"
        placeholder="请输入群聊名称"
        @keyup.enter="submitRename"
      />

      <div class="flex gap-3">
        <button
          @click="closeRenameModal"
          class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="submitRename"
          class="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="renameSubmitting"
        >
          <span v-if="renameSubmitting"
            ><i class="fa-solid fa-spinner fa-spin"></i
          ></span>
          <span v-else>保存</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Announcements Page (Absolute Cover) -->
  <div
    v-if="showAnnouncementsModal"
    class="absolute inset-0 z-20 bg-white flex flex-col"
  >
    <div
      class="px-4 py-3 border-b border-gray-100 flex items-center bg-gray-50"
    >
      <button
        @click="closeAnnouncementsModal"
        class="mr-3 w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-800 text-lg">群公告</div>
        <div class="text-[10px] text-gray-400">
          共 {{ announcementTotal }} 条
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
      <div v-if="isOwner" class="space-y-2">
        <div class="text-sm font-bold text-gray-700">发布公告</div>
        <textarea
          v-model="announcementInput"
          rows="4"
          class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium resize-none text-sm"
          placeholder="输入公告内容（自动 @所有人）"
        ></textarea>
      </div>

      <div>
        <div v-if="announcementsLoading" class="py-10 flex justify-center">
          <i class="fa-solid fa-spinner fa-spin text-xl text-gray-400"></i>
        </div>
        <div v-else-if="announcements.length === 0" class="py-10 text-center">
          <div class="text-sm text-gray-400">暂无公告</div>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="a in announcements"
            :key="a.id"
            class="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-xs text-gray-400 mb-1">
                  {{ formatDateTime(a.createdAt) }}
                  <span v-if="a.senderName" class="ml-2">{{
                    a.senderName
                  }}</span>
                </div>
                <div
                  class="text-sm text-gray-800 whitespace-pre-wrap break-words"
                >
                  {{ a.content }}
                </div>
              </div>
              <button
                v-if="isOwner"
                @click="unsetAnnouncement(a.id)"
                class="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold"
                :disabled="announcementDeletingId === a.id"
              >
                <span v-if="announcementDeletingId === a.id">
                  <i class="fa-solid fa-spinner fa-spin"></i>
                </span>
                <span v-else>删除</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isOwner"
      class="px-6 py-4 border-t border-gray-100 flex items-center justify-end bg-gray-50"
    >
      <button
        @click="submitAnnouncement"
        class="px-6 py-2 text-sm text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="announcementSubmitting"
      >
        发布
      </button>
    </div>
  </div>

  <!-- Kick Member Page (Absolute Cover) -->
  <div v-if="showKickModal" class="absolute inset-0 z-20 bg-white">
    <MemberSelectorPanel
      :existingMembers="[]"
      source="provided"
      :providedItems="
        kickCandidates.map((m) => ({
          id: m.principalId,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
        }))
      "
      title="移除成员"
      confirmText="确认移除"
      :multi="true"
      :showExistingBadge="false"
      @close="closeKickModal"
      @confirm="handleKickConfirm"
    />
  </div>

  <!-- Transfer Owner Page (Absolute Cover) -->
  <div v-if="showTransferOwnerModal" class="absolute inset-0 z-20 bg-white">
    <MemberSelectorPanel
      :existingMembers="[]"
      source="provided"
      :providedItems="
        transferCandidates.map((m) => ({
          id: m.principalId,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
        }))
      "
      title="转让群主"
      confirmText="确认转让"
      :multi="false"
      :showExistingBadge="false"
      @close="closeTransferOwnerModal"
      @confirm="handleTransferOwnerConfirm"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Detail
 * @description 群聊/私聊详情抽屉：成员展示、置顶、群名/公告管理、踢人、转让群主、退出/解散。
 * @keywords-cn 聊天详情, 群管理, 群公告, 踢人, 转让群主, 退出群聊, 解散群聊
 * @keywords-en chat-detail, group-management, announcements, kick-member, transfer-owner, leave-group, dissolve-group
 */
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { imApi, type ImMemberInfo } from '../../../api/im';
import { resolveResourceUrl } from '../../../utils/http';
import { useImStore } from '../../im/im.module';
import { usePanelStore } from '../store/panel.store';
import { useUIStore } from '../store/ui.store';
import { useAgentSessionStore } from '../store/session.store';
import MemberSelectorPanel from './MemberSelectorPanel.vue';

const toResourceUrl = resolveResourceUrl;

const props = defineProps<{
  sessionId: string;
  type: string; // 'dm', 'group', 'assistant', etc.
  title: string;
  isPinned: boolean;
  initialMembers?: string[]; // IDs
  openAnnouncementsTrigger?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'addMember', ids: string[]): void;
  // Search history removed
}>();

const panelStore = usePanelStore();
const { onlyAi, searchQuery } = storeToRefs(panelStore);
const sessionStore = useAgentSessionStore();
const imStore = useImStore();
const uiStore = useUIStore();
const members = ref<ImMemberInfo[]>([]);
const isLoadingMembers = ref(false);
const currentTitle = ref(props.title);
const isPinnedLocal = ref(props.isPinned);

const selfPrincipalId = ref<string | undefined>(undefined);
const sessionCreatorId = ref<string | null>(null);

const showRenameModal = ref(false);
const renameInput = ref('');
const renameSubmitting = ref(false);

const showAnnouncementsModal = ref(false);
const announcementsLoading = ref(false);
const announcements = ref<
  Array<{ id: string; content: string; createdAt: string; senderName?: string }>
>([]);
const announcementTotal = ref(0);
const announcementInput = ref('');
const announcementSubmitting = ref(false);
const announcementDeletingId = ref<string | null>(null);

const showKickModal = ref(false);
const kickSelectedIds = ref<string[]>([]);
const kickSubmitting = ref(false);

const showTransferOwnerModal = ref(false);
const transferSelectedId = ref<string | null>(null);
const transferSubmitting = ref(false);

watch(
  () => props.isPinned,
  (val) => {
    isPinnedLocal.value = val;
  },
);

watch(
  () => props.title,
  (val) => {
    currentTitle.value = val;
  },
);

const memberCount = computed(() => members.value.length);

const handleMemberClick = (member: ImMemberInfo) => {
  const id = (member.principalId || '').trim();
  if (!id) return;
  const displayName = (member.displayName || id).trim();
  const avatarUrl =
    typeof member.avatarUrl === 'string' ? member.avatarUrl.trim() : null;

  panelStore.openDrawer('profile', {
    user: {
      id,
      principalId: id,
      title: displayName,
      displayName,
      threadType: 'dm',
      chatClientId: null,
      isPinned: false,
      isAiInvolved: false,
      avatarUrl: avatarUrl || null,
      createdAt: '',
      updatedAt: '',
    },
  });
};

const getMemberAvatarSrc = (member: ImMemberInfo) => {
  const raw =
    typeof member.avatarUrl === 'string' ? member.avatarUrl.trim() : '';
  if (!raw) return '';
  const resolved = toResourceUrl(raw);
  return (resolved || '').trim();
};

const displayMembers = computed(() => {
  return members.value.slice(0, 12); // Show fewer members on desktop panel
});

const selfMembership = computed(() => {
  const pid = selfPrincipalId.value;
  if (!pid) return undefined;
  return members.value.find((m) => m.principalId === pid);
});

const isOwner = computed(() => {
  if (props.type !== 'group') return false;
  const pid = selfPrincipalId.value;
  if (!pid) return false;
  if (sessionCreatorId.value === pid) return true;
  return selfMembership.value?.role === 'owner';
});

const announcementPreview = computed(() => {
  const first = announcements.value[0];
  if (!first) return '';
  const raw = first.content || '';
  const trimmed = raw.replace(/^@所有人\s*/u, '').trim();
  return trimmed || raw;
});

const kickCandidates = computed(() => {
  const pid = selfPrincipalId.value;
  return members.value.filter((m) => {
    if (pid && m.principalId === pid) return false;
    if (m.role === 'owner') return false;
    return true;
  });
});

const transferCandidates = computed(() => {
  const pid = selfPrincipalId.value;
  return members.value.filter((m) => {
    if (pid && m.principalId === pid) return false;
    if (m.role === 'owner') return false;
    return true;
  });
});

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

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const ok = !isNaN(d.getTime());
  return ok ? d.toLocaleString() : iso;
};

const loadMembers = async () => {
  if (!props.sessionId) return;
  isLoadingMembers.value = true;
  try {
    const res = await imApi.getSession(props.sessionId);
    if (res.data && res.data.members) {
      members.value = (res.data.members || [])
        .map((m) => ({ ...m, principalId: (m.principalId || '').trim() }))
        .filter((m) => !!m.principalId);
      sessionCreatorId.value = (res.data.creatorId || '').trim() || null;
    }
  } catch (err) {
    console.error('Failed to load members', err);
  } finally {
    isLoadingMembers.value = false;
  }
};

const loadAnnouncements = async (limit = 20) => {
  if (!props.sessionId) return;
  if (props.type !== 'group') {
    announcements.value = [];
    announcementTotal.value = 0;
    return;
  }
  announcementsLoading.value = true;
  try {
    const resp = await imApi.getAnnouncements(props.sessionId, { limit });
    announcementTotal.value = resp.data.total || 0;
    const list = resp.data.items || [];
    announcements.value = list.map((x) => ({
      id: x.id,
      content: x.content,
      createdAt: x.createdAt,
      senderName: x.senderName,
    }));
  } catch {
    announcements.value = [];
    announcementTotal.value = 0;
  } finally {
    announcementsLoading.value = false;
  }
};

watch(
  () => panelStore.sessionRefreshTrigger,
  () => {
    loadMembers();
  },
);

const handleEditName = () => {
  if (props.type !== 'group') return;
  if (!isOwner.value) {
    uiStore.showToast('仅群主可修改群聊名称', 'warning');
    return;
  }
  renameInput.value = currentTitle.value;
  showRenameModal.value = true;
};

const closeRenameModal = () => {
  showRenameModal.value = false;
  renameSubmitting.value = false;
};

const submitRename = async () => {
  if (!props.sessionId) return;
  const newName = (renameInput.value || '').trim();
  if (!newName) {
    uiStore.showToast('群聊名称不能为空', 'warning');
    return;
  }
  if (newName === currentTitle.value.trim()) {
    closeRenameModal();
    return;
  }
  renameSubmitting.value = true;
  try {
    await imStore.updateSession(props.sessionId, { name: newName });
    currentTitle.value = newName;
    panelStore.triggerSessionRefresh();
    uiStore.showToast('群聊名称已更新', 'success');
    closeRenameModal();
  } catch (e) {
    console.error(e);
    uiStore.showToast('更新失败', 'error');
    renameSubmitting.value = false;
  }
};

const openAnnouncements = async () => {
  if (props.type !== 'group') return;
  showAnnouncementsModal.value = true;
  await loadAnnouncements(50);
};

const closeAnnouncementsModal = () => {
  showAnnouncementsModal.value = false;
  announcementInput.value = '';
  announcementSubmitting.value = false;
  announcementDeletingId.value = null;
};

const submitAnnouncement = async () => {
  if (!props.sessionId) return;
  if (!isOwner.value) {
    uiStore.showToast('仅群主可发布公告', 'warning');
    return;
  }
  const content = (announcementInput.value || '').trim();
  if (!content) {
    uiStore.showToast('公告内容不能为空', 'warning');
    return;
  }
  announcementSubmitting.value = true;
  try {
    await imApi.createAnnouncement(props.sessionId, { content });
    announcementInput.value = '';
    await loadAnnouncements(50);
    panelStore.triggerSessionRefresh();
    uiStore.showToast('公告已发布', 'success');
  } catch {
    uiStore.showToast('发布失败', 'error');
  } finally {
    announcementSubmitting.value = false;
  }
};

const unsetAnnouncement = async (messageId: string) => {
  if (!props.sessionId) return;
  if (!isOwner.value) {
    uiStore.showToast('仅群主可删除公告', 'warning');
    return;
  }
  announcementDeletingId.value = messageId;
  try {
    await imApi.deleteAnnouncement(props.sessionId, messageId);
    await loadAnnouncements(50);
    panelStore.triggerSessionRefresh();
    uiStore.showToast('公告已删除', 'success');
  } catch {
    uiStore.showToast('操作失败', 'error');
  } finally {
    announcementDeletingId.value = null;
  }
};

const openKickModal = () => {
  if (!isOwner.value) {
    uiStore.showToast('仅群主可移除成员', 'warning');
    return;
  }
  kickSelectedIds.value = [];
  showKickModal.value = true;
};

const closeKickModal = () => {
  showKickModal.value = false;
  kickSubmitting.value = false;
  kickSelectedIds.value = [];
};

const submitKick = async () => {
  if (!props.sessionId) return;
  if (!isOwner.value) {
    uiStore.showToast('仅群主可移除成员', 'warning');
    return;
  }
  const ids = Array.from(
    new Set(
      kickSelectedIds.value
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) return;

  kickSubmitting.value = true;
  try {
    for (const id of ids) {
      await imApi.removeMember(props.sessionId, id);
    }
    await loadMembers();
    void sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });
    panelStore.triggerSessionRefresh();
    uiStore.showToast('成员已移除', 'success');
    closeKickModal();
  } catch {
    uiStore.showToast('操作失败', 'error');
    kickSubmitting.value = false;
  }
};

const handleKickConfirm = async (payload: { ids: string[] }) => {
  kickSelectedIds.value = payload.ids;
  await submitKick();
};

const openTransferOwnerModal = () => {
  if (!isOwner.value) {
    uiStore.showToast('仅群主可转让群主', 'warning');
    return;
  }
  transferSelectedId.value = null;
  showTransferOwnerModal.value = true;
};

const closeTransferOwnerModal = () => {
  showTransferOwnerModal.value = false;
  transferSubmitting.value = false;
  transferSelectedId.value = null;
};

const submitTransferOwner = async () => {
  if (!props.sessionId) return;
  if (!isOwner.value) {
    uiStore.showToast('仅群主可转让群主', 'warning');
    return;
  }
  const pid = (transferSelectedId.value || '').trim();
  if (!pid) return;
  transferSubmitting.value = true;
  try {
    await imApi.transferOwner(props.sessionId, { principalId: pid });
    await loadMembers();
    void sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });
    panelStore.triggerSessionRefresh();
    uiStore.showToast('群主已转让', 'success');
    closeTransferOwnerModal();
  } catch {
    uiStore.showToast('操作失败', 'error');
    transferSubmitting.value = false;
  }
};

const handleTransferOwnerConfirm = async (payload: { ids: string[] }) => {
  transferSelectedId.value = payload.ids[0] || null;
  await submitTransferOwner();
};

const togglePin = async () => {
  try {
    const newVal = !isPinnedLocal.value;
    await imStore.updateSession(props.sessionId, { isPinned: newVal });
    isPinnedLocal.value = newVal;
    panelStore.triggerSessionRefresh();
  } catch (e) {
    uiStore.showToast('操作失败', 'error');
  }
};

const clearHistory = async () => {
  if (confirm('确定要清空聊天记录吗？')) {
    try {
      uiStore.showToast('聊天记录已清空(本地)', 'success');
      panelStore.triggerSessionRefresh();
    } catch (e) {
      uiStore.showToast('操作失败', 'error');
    }
  }
};

const deleteThread = async () => {
  if (!props.sessionId) return;
  if (props.type === 'group') return;
  if (!confirm('确定要删除该对话吗？')) return;
  try {
    await imApi.deleteSession(props.sessionId);
    panelStore.triggerSessionRefresh();
    emit('close');
    uiStore.showToast('会话已删除', 'success');
  } catch {
    uiStore.showToast('删除失败', 'error');
  }
};

const leaveGroup = async () => {
  if (!props.sessionId) return;
  if (props.type !== 'group') return;
  const confirmText = isOwner.value
    ? '退出后将自动转让群主，确定退出？'
    : '确定要退出该群聊吗？';
  if (!confirm(confirmText)) return;
  try {
    await imApi.leaveSession(props.sessionId);
    void sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });
    panelStore.triggerSessionRefresh();
    emit('close');
    uiStore.showToast('已退出群聊', 'success');
  } catch {
    uiStore.showToast('操作失败', 'error');
  }
};

const dissolveGroup = async () => {
  if (!props.sessionId) return;
  if (props.type !== 'group') return;
  if (!isOwner.value) {
    uiStore.showToast('仅群主可解散群聊', 'warning');
    return;
  }
  if (!confirm('确定要解散该群聊吗？')) return;
  try {
    await imApi.deleteSession(props.sessionId);
    void sessionStore.loadSessions({
      onlyAi: onlyAi.value,
      searchQuery: searchQuery.value,
    });
    panelStore.triggerSessionRefresh();
    emit('close');
    uiStore.showToast('群聊已解散', 'success');
  } catch {
    uiStore.showToast('操作失败', 'error');
  }
};

onMounted(() => {
  selfPrincipalId.value = getPrincipalId();
  loadMembers();
  void loadAnnouncements(1);
});

watch(
  () => props.sessionId,
  () => {
    loadMembers();
    void loadAnnouncements(1);
    currentTitle.value = props.title;
    isPinnedLocal.value = props.isPinned;
  },
);

watch(
  () => props.openAnnouncementsTrigger,
  (val) => {
    if (!val) return;
    void openAnnouncements();
  },
);
</script>

<style scoped>
/* Custom scrollbar adjustments if needed */
</style>
