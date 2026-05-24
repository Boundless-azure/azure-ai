<template>
  <span>{{ displayTitle }}</span>
</template>

<script setup lang="ts">
/**
 * @title Chat Contact Title
 * @description 生成通讯录项显示标题与标签。
 * @keywords-cn 通讯录标题, 联系人标签, 群聊名称
 * @keywords-en contact-title, contact-label, group-title
 */
import { computed } from 'vue';
import type { SessionListItem } from '../../types/agent.types';

interface Props {
  thread: SessionListItem;
  selfPrincipalId?: string;
}

const props = defineProps<Props>();

const getDisplayTitle = (t: SessionListItem, selfId?: string) => {
  if (t.threadType === 'assistant') return 'AI 助手';
  if (t.threadType === 'system') return '系统通知';
  if (t.threadType === 'todo') return '待办通知';
  if (t.threadType === 'dm') {
    const ms = t.members || [];
    const others = ms.filter((m) => (selfId ? m !== selfId : true));
    return others[0] || ms[0] || '私聊';
  }
  if (t.threadType === 'group') {
    const ms = t.members || [];
    if (ms.length === 0) return '群聊';
    return ms.slice(0, 9).join('、');
  }
  return '群聊';
};

const displayTitle = computed(() => {
  const title = props.thread.title || '';
  if (title.trim().length > 0) return title;
  return getDisplayTitle(props.thread, props.selfPrincipalId);
});
</script>
