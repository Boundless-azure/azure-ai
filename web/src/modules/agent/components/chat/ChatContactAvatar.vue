<template>
  <div
    v-if="thread.threadType === 'group' && thread.members && thread.members.length > 0"
    :class="groupAvatarClass"
  >
    <div
      v-for="(member, idx) in thread.members.slice(0, 9)"
      :key="idx"
      :class="memberAvatarClass"
    >
      <img v-if="member.startsWith('http')" :src="member" :class="imgClass" />
      <span v-else>{{ member.slice(0, 1) }}</span>
    </div>
  </div>
  <div v-else :class="singleAvatarClass">
    <img v-if="hasAvatarUrl" :src="avatarUrl" :class="imgClass" />
    <i v-else class="fa-solid" :class="threadIcon(thread)"></i>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Contact Avatar
 * @description 渲染通讯录项头像与群聊头像网格。
 * @keywords-cn 通讯录头像, 群聊头像, 头像网格
 * @keywords-en contact-avatar, group-avatar, avatar-grid
 */
import { computed } from 'vue';
import type { ThreadListItem } from '../../types/agent.types';

interface Props {
  thread: ThreadListItem;
  size?: 'sm' | 'lg';
}

const props = defineProps<Props>();

const isLarge = computed(() => props.size === 'lg');

const groupAvatarClass = computed(() =>
  isLarge.value
    ? 'w-full h-full rounded-xl bg-gray-200 p-1 grid gap-0.5 overflow-hidden'
    : 'w-8 h-8 rounded bg-gray-200 p-0.5 grid gap-0.5 overflow-hidden',
);

const memberAvatarClass = computed(() =>
  isLarge.value
    ? 'bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 rounded-sm overflow-hidden'
    : 'bg-gray-300 flex items-center justify-center text-[5px] font-bold text-gray-600 rounded-sm overflow-hidden',
);

const imgClass = computed(() => 'w-full h-full object-cover');
const avatarUrl = computed(() => (props.thread.avatarUrl || '').trim());
const hasAvatarUrl = computed(() => avatarUrl.value.length > 0);

const singleAvatarClass = computed(() =>
  isLarge.value
    ? `w-full h-full rounded-xl flex items-center justify-center text-white text-4xl ${getAvatarClass(props.thread)}`
    : `w-8 h-8 rounded flex items-center justify-center text-white text-sm ${getAvatarClass(props.thread)}`,
);

const threadIcon = (t: ThreadListItem) => {
  if (t.id === 'workflow_monitor' || t.id === 'fixed:workflow')
    return 'fa-gears';
  if (t.threadType === 'assistant') return 'fa-robot';
  if (t.threadType === 'system') return 'fa-bell';
  if (t.threadType === 'todo') return 'fa-list-check';
  if (t.threadType === 'dm') {
    return t.isAiInvolved ? 'fa-robot' : 'fa-user';
  }
  return 'fa-users';
};

const getAvatarClass = (t: ThreadListItem) => {
  if (t.id === 'workflow_monitor' || t.id === 'fixed:workflow')
    return 'bg-blue-100 text-blue-600';
  switch (t.threadType) {
    case 'assistant':
      return 'bg-blue-500';
    case 'system':
      return 'bg-orange-500';
    case 'group':
      return 'bg-green-500';
    case 'dm':
      return t.isAiInvolved ? 'bg-blue-500' : 'bg-indigo-500';
    case 'todo':
      return 'bg-purple-500';
    default:
      return 'bg-gray-400';
  }
};
</script>
