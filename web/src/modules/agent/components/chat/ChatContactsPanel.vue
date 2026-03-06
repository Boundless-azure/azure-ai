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
          <div class="flex items-center gap-2">
            <div class="text-xs text-gray-400" v-if="group.count > 0">
              {{ group.count }}
            </div>
            <button
              v-if="isCustomContactGroup(group.id)"
              class="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              @click.stop="openGroupManage(group.id, group.name)"
            >
              分组管理
            </button>
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
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Contacts Panel
 * @description 通讯录分组列表（支持按首字母/拼音排序）与成员信息查看面板。
 * @keywords-cn 通讯录面板, 分组列表, 成员管理, 首字母排序, 拼音排序
 * @keywords-en contacts-panel, group-list, member-management, alphabetical-sort, pinyin-sorting
 */
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import Pinyin from 'tiny-pinyin';
import type { SessionListItem } from '../../types/agent.types';
import { useI18n } from '../../composables/useI18n';
import { usePanelStore } from '../../store/panel.store';
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
const {
  expandedCategories,
  contactGroups: customContactGroups,
  contactGroupMembers,
} = storeToRefs(panelStore);
const { toggleCategory } = panelStore;
const { agents: agentList, list: loadAgents } = useAgents();

onMounted(() => {
  loadAgents();
});

const contactGroups = computed(() => {
  const groups = props.sessions.filter((t) => t.threadType === 'group');
  const contacts = props.contacts;

  const contactIdToPrincipalId = (id: string): string => {
    const raw = (id || '').trim();
    if (!raw) return '';
    if (raw.startsWith('contact:'))
      return raw.substring('contact:'.length).trim();
    return raw;
  };

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

  const customGroups = [...(customContactGroups.value || [])].sort((a, b) => {
    const ta = typeof a.createdAt === 'string' ? a.createdAt : '';
    const tb = typeof b.createdAt === 'string' ? b.createdAt : '';
    return ta.localeCompare(tb);
  });

  for (const g of customGroups) {
    const memberIds = contactGroupMembers.value?.[g.id] || [];
    const memberSet = new Set(
      memberIds
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean),
    );
    const items = sortedContacts.filter((c) => {
      const pid = contactIdToPrincipalId(c.id || '');
      return pid ? memberSet.has(pid) : false;
    });
    result.push({
      id: g.id,
      name: g.name,
      count: items.length,
      items,
    });
  }

  return result;
});

const isCustomContactGroup = (id: string): boolean => {
  const v = (id || '').trim();
  return v.startsWith('contact-group:');
};

const openGroupManage = (groupId: string, groupName: string) => {
  const gid = (groupId || '').trim();
  if (!gid) return;
  const existingMembers = contactGroupMembers.value?.[gid] || [];
  panelStore.openDrawer('members', {
    membersMode: 'contact_group_manage',
    contactGroupId: gid,
    contactGroupName: groupName,
    existingMembers,
  });
};

const openProfile = (t: SessionListItem) => {
  if (t.threadType === 'group') {
    panelStore.openDrawer('info', {
      sessionId: t.id,
      type: t.threadType,
      title: t.title || '',
      isPinned: t.isPinned,
    });
  } else {
    panelStore.openDrawer('profile', { user: t });
  }
};

const handleEnterSession = async (t: SessionListItem) => {
  await props.enterSession(t);
};
</script>

<style scoped>
/* Animations moved to ChatPanel or global */
</style>
