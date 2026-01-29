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
        <h3 class="font-bold text-gray-800">文件列表</h3>
      </div>
      <div class="flex space-x-2">
        <button class="text-gray-400 hover:text-gray-600">
          <i class="fa-solid fa-filter"></i>
        </button>
        <button class="text-gray-400 hover:text-gray-600">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4">
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer group transition-colors"
        >
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
            :class="item.bgClass"
          >
            <i
              class="fa-solid text-lg"
              :class="[item.icon, item.textClass]"
            ></i>
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors"
            >
              {{ item.name }}
            </p>
            <div
              class="flex items-center text-xs text-gray-400 mt-0.5 space-x-2"
            >
              <span>{{ item.size }}</span>
              <span>•</span>
              <span>{{ item.time }}</span>
            </div>
          </div>
          <button
            class="text-gray-300 hover:text-gray-600 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <i class="fa-solid fa-download"></i>
          </button>
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
  {
    id: 1,
    name: '需求规格说明书_v1.2.pdf',
    size: '2.4 MB',
    time: '10:15',
    icon: 'fa-file-pdf',
    bgClass: 'bg-red-50',
    textClass: 'text-red-500',
  },
  {
    id: 2,
    name: 'UI设计稿_首页.sketch',
    size: '15.8 MB',
    time: '昨天 14:30',
    icon: 'fa-file-image',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-500',
  },
  {
    id: 3,
    name: '接口文档.docx',
    size: '540 KB',
    time: '昨天 09:10',
    icon: 'fa-file-word',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-500',
  },
  {
    id: 4,
    name: 'config.json',
    size: '2 KB',
    time: '前天 11:00',
    icon: 'fa-file-code',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
  },
]);
</script>
