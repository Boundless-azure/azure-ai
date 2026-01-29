<template>
  <div class="flex flex-col h-full bg-white relative overflow-hidden">
    <div class="px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
      <div class="text-xs text-gray-500">通讯录</div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div
        v-for="group in contactGroups"
        :key="group.id"
        class="border-b border-gray-50"
      >
        <div
          class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
          @click="toggleCategory(group.id)"
        >
          <div class="flex items-center space-x-2 text-gray-700">
            <i
              class="fa-solid fa-chevron-right text-[10px] text-gray-400 transition-transform duration-200"
              :class="{
                'rotate-90': expandedCategories.includes(group.id),
              }"
            ></i>
            <span class="text-sm font-medium">{{ group.name }}</span>
          </div>
          <div class="text-xs text-gray-400" v-if="group.count > 0">
            {{ group.count }}
          </div>
        </div>

        <div v-if="expandedCategories.includes(group.id)" class="bg-white">
          <div
            v-for="t in group.items"
            :key="t.id"
            class="flex items-center px-4 py-2 pl-10 hover:bg-gray-50 cursor-pointer relative group"
            @click="handleEnterSession(t)"
          >
            <div
              class="relative flex-shrink-0 mr-3"
              @click.stop="openProfile(t)"
            >
              <ChatContactAvatar :thread="t" size="sm" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="text-gray-800 text-sm truncate">
                <ChatContactTitle
                  :thread="t"
                  :selfPrincipalId="selfPrincipalId"
                />
              </div>
            </div>
          </div>
          <div v-if="group.items.length === 0" class="pl-10 py-3">
            <div class="flex items-center gap-2 text-xs text-gray-400">
              <i class="fa-regular fa-circle-xmark"></i>
              <span>{{ t('contacts.emptyGroup') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showProfile && currentProfile"
      class="absolute inset-0 bg-white z-20 flex flex-col animate-fade-in-right"
    >
      <div class="px-4 py-3 border-b border-gray-100 flex items-center">
        <button
          @click="closeProfile"
          class="mr-3 text-gray-500 hover:text-gray-700"
        >
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <span class="font-bold text-gray-800">{{ t('contacts.profile') }}</span>
      </div>
      <div
        class="p-6 flex flex-col items-center flex-1 overflow-y-auto custom-scrollbar"
      >
        <div class="w-24 h-24 mb-4">
          <ChatContactAvatar :thread="currentProfile" size="lg" />
        </div>

        <h2 class="text-xl font-bold text-gray-900 mb-1 text-center">
          <ChatContactTitle
            :thread="currentProfile"
            :selfPrincipalId="selfPrincipalId"
          />
        </h2>
        <p class="text-gray-500 text-sm mb-6">ID: {{ currentProfile.id }}</p>

        <div class="w-full space-y-3">
          <button
            @click="handleProfileEnter"
            class="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center"
          >
            <i class="fa-solid fa-comment mr-2"></i>
            {{ t('contacts.sendMessage') }}
          </button>
          <div
            v-if="currentProfile.threadType === 'group'"
            class="w-full mt-2 space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-700">
                {{ t('contacts.memberManagement') }}
              </span>
            </div>
            <div class="space-y-2">
              <div
                v-for="(member, idx) in currentProfile.members || []"
                :key="idx"
                class="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-6 h-6 rounded bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-700"
                  >
                    <span>{{ member.slice(0, 1) }}</span>
                  </div>
                  <span class="text-sm text-gray-700">{{ member }}</span>
                </div>
                <button
                  @click="removeMemberFromCurrentSession(member)"
                  class="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                >
                  {{ t('contacts.removeMember') }}
                </button>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="newMemberName"
                  type="text"
                  :placeholder="t('contacts.inputMemberPlaceholder')"
                  class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                  @click="addMemberToCurrentSession"
                  class="text-xs px-3 py-2 rounded bg-green-500 text-white hover:bg-green-600"
                >
                  {{ t('contacts.addMember') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="w-full mt-8 border-t border-gray-100 pt-6">
          <div class="flex justify-between py-3 border-b border-gray-50">
            <span class="text-gray-500 text-sm">备注</span>
            <span class="text-gray-800 text-sm">无</span>
          </div>
          <div class="flex justify-between py-3 border-b border-gray-50">
            <span class="text-gray-500 text-sm">来源</span>
            <span class="text-gray-800 text-sm">搜索添加</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Contacts Panel
 * @description 通讯录分组列表（支持按首字母/拼音排序）与成员信息查看面板。
 * @keywords-cn 通讯录面板, 分组列表, 成员管理, 首字母排序, 拼音排序
 * @keywords-en contacts-panel, group-list, member-management, alphabetical-sort, pinyin-sorting
 */
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import Pinyin from 'tiny-pinyin';
import type { SessionListItem } from '../../types/agent.types';
import { useI18n } from '../../composables/useI18n';
import { usePanelStore } from '../../store/panel.store';
import { useUIStore } from '../../store/ui.store';
import { useAgentSessionStore } from '../../store/session.store';
import { useAgents } from '../../hooks/useAgents';
import ChatContactAvatar from './ChatContactAvatar.vue';
import ChatContactTitle from './ChatContactTitle.vue';

interface UpdateSessionOptions {
  title?: string | null;
  threadType?: string;
  isAiInvolved?: boolean;
  participants?: Array<{ id: string; name: string }>;
  isPinned?: boolean;
}

interface Props {
  contacts: SessionListItem[];
  sessions: SessionListItem[];
  selfPrincipalId?: string;
  enterSession: (session: SessionListItem) => void | Promise<void>;
  updateSession: (id: string, options: UpdateSessionOptions) => Promise<void>;
  loadSessions: () => Promise<void>;
}

const props = defineProps<Props>();

const { t } = useI18n();
const panelStore = usePanelStore();
const sessionStore = useAgentSessionStore();
const { expandedCategories } = storeToRefs(panelStore);
const { toggleCategory } = panelStore;
const { agents: agentList, list: loadAgents } = useAgents();

onMounted(() => {
  loadAgents();
});

const showProfile = ref(false);
const currentProfile = ref<SessionListItem | null>(null);
const newMemberName = ref('');

const contactGroups = computed(() => {
  const groups = props.sessions.filter((t) => t.threadType === 'group');
  const contacts = props.contacts;

  const agents = agentList.value.map(
    (a) =>
      ({
        id: a.id,
        title: a.nickname,
        chatClientId: null,
        threadType: 'assistant',
        isPinned: false,
        isAiInvolved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        avatarUrl: null,
      }) as SessionListItem,
  );

  const result = [
    {
      id: 'group-chats',
      name: t('contacts.groupChats'),
      count: groups.length,
      items: groups,
    },
    {
      id: 'agents',
      name: t('contacts.aiAgents'),
      count: agents.length,
      items: agents,
    },
  ];

  if (contacts.length === 0) {
    result.push({
      id: 'contacts',
      name: t('contacts.allContacts'),
      count: 0,
      items: [],
    });
    return result;
  }

  const sortedContacts = [...contacts].sort((a, b) => {
    const nameA = a.title || a.id || '';
    const nameB = b.title || b.id || '';
    const pyA = Pinyin.convertToPinyin(nameA, '', false).toUpperCase();
    const pyB = Pinyin.convertToPinyin(nameB, '', false).toUpperCase();
    return pyA.localeCompare(pyB);
  });

  result.push({
    id: 'contacts',
    name: t('contacts.allContacts'),
    count: sortedContacts.length,
    items: sortedContacts,
  });

  return result;
});

const openProfile = (t: SessionListItem) => {
  currentProfile.value = t;
  showProfile.value = true;
};

const closeProfile = () => {
  showProfile.value = false;
  currentProfile.value = null;
};

const refreshCurrentProfile = () => {
  if (!currentProfile.value) return;
  const updated = sessionStore.getSession(currentProfile.value.id);
  if (updated) currentProfile.value = updated;
};

const addMemberToCurrentSession = async () => {
  const profile = currentProfile.value;
  const name = (newMemberName.value || '').trim();
  if (!profile || !name || profile.threadType !== 'group') return;
  const existing = profile.members || [];
  if (existing.includes(name)) {
    const ui = useUIStore();
    ui.showToast('成员已存在', 'info');
    return;
  }
  const participants = [...existing, name].map((n) => ({ id: n, name: n }));
  try {
    await props.updateSession(profile.id, { participants });
    await props.loadSessions();
    refreshCurrentProfile();
    newMemberName.value = '';
    const ui = useUIStore();
    ui.showToast('成员已添加', 'success');
  } catch (e) {
    const ui = useUIStore();
    ui.showToast('添加成员失败', 'error');
  }
};

const removeMemberFromCurrentSession = async (member: string) => {
  const profile = currentProfile.value;
  if (!profile || profile.threadType !== 'group') return;
  const existing = profile.members || [];
  const next = existing.filter((m) => m !== member);
  const participants = next.map((n) => ({ id: n, name: n }));
  try {
    await props.updateSession(profile.id, { participants });
    await props.loadSessions();
    refreshCurrentProfile();
    const ui = useUIStore();
    ui.showToast('成员已移除', 'success');
  } catch (e) {
    const ui = useUIStore();
    ui.showToast('移除成员失败', 'error');
  }
};

const handleEnterSession = async (t: SessionListItem) => {
  await props.enterSession(t);
};

const handleProfileEnter = async () => {
  if (!currentProfile.value) return;
  await props.enterSession(currentProfile.value);
  closeProfile();
};
</script>

<style scoped>
@keyframes fade-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.animate-fade-in-right {
  animation: fade-in-right 0.3s ease-out;
}
</style>
