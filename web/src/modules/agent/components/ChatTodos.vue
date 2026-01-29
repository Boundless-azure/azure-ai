<template>
  <div class="h-full flex flex-col bg-white">
    <div
      class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
    >
      <div class="flex items-center">
        <button
          @click="$emit('close')"
          class="mr-3 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
        >
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h3 class="font-bold text-gray-800">待办事项</h3>
      </div>
      <button class="text-xs text-green-600 hover:text-green-700 font-medium">
        <i class="fa-solid fa-plus mr-1"></i>新建
      </button>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4">
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-green-200 transition-colors cursor-pointer group"
        >
          <div class="mt-0.5 mr-3">
            <input
              type="checkbox"
              class="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm text-gray-800 font-medium line-clamp-2 group-hover:text-green-700 transition-colors"
            >
              {{ item.content }}
            </p>
            <p class="text-xs text-gray-400 mt-1">{{ item.time }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  sessionId: string;
}>();

const emit = defineEmits(['close']);

// Mock data sorted by time
const items = ref([
  { id: 1, content: '完成项目需求文档编写', time: '10:30' },
  { id: 2, content: '与设计团队确认UI细节', time: '昨天 15:45' },
  { id: 3, content: '修复登录页面的Bug', time: '昨天 09:20' },
  { id: 4, content: '准备周会汇报材料', time: '前天 14:00' },
]);
</script>
