<template>
  <div class="flex flex-col h-full bg-white relative">
    <!-- Header (Transparent/Overlay) -->
    <div class="absolute top-0 left-0 right-0 p-4 z-10 flex items-center">
      <button
        @click="$emit('close')"
        class="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-800 transition-colors backdrop-blur-sm"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto custom-scrollbar pt-20 pb-6 px-6">
      <div class="flex flex-col items-center">
        <!-- Avatar -->
        <div class="w-24 h-24 mb-4">
          <ChatContactAvatar :thread="user" size="lg" />
        </div>

        <!-- Name -->
        <div class="flex items-center gap-2 mb-2">
          <h2 class="text-xl font-bold text-gray-900">
            <ChatContactTitle :thread="user" />
          </h2>
        </div>

        <!-- Tags -->
        <div
          v-if="displayTags.length > 0"
          class="flex flex-wrap justify-center gap-1.5 mb-8"
        >
          <div
            v-for="tag in displayTags"
            :key="tag"
            class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
          >
            {{ tag }}
          </div>
        </div>
        <div v-else class="mb-8"></div>

        <!-- Divider -->
        <div class="w-full h-px bg-gray-100 mb-8"></div>

        <!-- Info Rows (WeChat Style) -->
        <div class="w-full space-y-6 mb-10">
          <div class="flex items-start">
            <span class="text-gray-500 w-20 flex-shrink-0 text-sm">备注</span>
            <span class="text-gray-900 text-sm flex-1">{{
              user?.remark || '无'
            }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="w-full space-y-3 px-4">
          <button
            @click="handleSendMessage"
            class="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center"
          >
            <i class="fa-solid fa-comment mr-2"></i>
            发消息
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title User Profile Component
 * @description 用户资料详情页：展示用户头像、昵称与标签，并提供发消息操作。
 * @keywords-cn 用户资料, 详情页, 标签, 代理Tag
 * @keywords-en user-profile, detail-page, tags, agent-tag
 */
import { computed } from 'vue';
import ChatContactAvatar from './chat/ChatContactAvatar.vue';
import ChatContactTitle from './chat/ChatContactTitle.vue';

const props = defineProps<{
  user: any; // Principal or Thread object
}>();

const emit = defineEmits(['close', 'sendMessage']);

const displayTags = computed(() => {
  const u = props.user;
  const tags: string[] = [];

  const principalType =
    typeof u?.principalType === 'string' ? u.principalType : '';
  const threadType = typeof u?.threadType === 'string' ? u.threadType : '';
  const type = typeof u?.type === 'string' ? u.type : '';

  const labels = Array.isArray(u?.labels)
    ? u.labels.filter((x: unknown) => typeof x === 'string')
    : [];
  const hasAiLabel = labels.includes('isAi');
  const isAi =
    u?.isAi === true ||
    hasAiLabel ||
    type === 'assistant' ||
    threadType === 'assistant';
  const isAgent =
    principalType === 'agent' ||
    type === 'assistant' ||
    threadType === 'assistant';

  if (isAgent) tags.push('Agent');
  else if (principalType === 'system' || threadType === 'system')
    tags.push('System');
  if (isAi && !tags.includes('AI')) tags.push('AI');

  const dept1 =
    typeof u?.departmentName === 'string' ? u.departmentName.trim() : '';
  const dept2 = typeof u?.department === 'string' ? u.department.trim() : '';
  const dept = dept1 || dept2;
  if (dept) tags.push(dept);

  for (const label of labels) {
    if (label.startsWith('dept:')) {
      const name = label.slice('dept:'.length).trim();
      if (name && !tags.includes(name)) tags.push(name);
    }
    if (label.startsWith('department:')) {
      const name = label.slice('department:'.length).trim();
      if (name && !tags.includes(name)) tags.push(name);
    }
  }

  return tags;
});

const handleSendMessage = () => {
  emit('sendMessage', props.user);
};
</script>
