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
        <h3 class="font-bold text-gray-800">任务列表</h3>
      </div>
      <button class="text-xs text-blue-600 hover:text-blue-700 font-medium">
        <i class="fa-solid fa-plus mr-1"></i>新建
      </button>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4">
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
        >
          <div class="flex items-center justify-between mb-2">
            <span
              class="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600"
              >{{ item.status }}</span
            >
            <span class="text-xs text-gray-400">{{ item.time }}</span>
          </div>
          <h4 class="text-sm font-bold text-gray-800 mb-1">{{ item.title }}</h4>
          <p class="text-xs text-gray-500 line-clamp-2">{{ item.desc }}</p>
          <div class="mt-2 flex items-center space-x-2">
            <div
              class="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500"
            >
              {{ item.assignee.slice(0, 1) }}
            </div>
            <span class="text-xs text-gray-400">{{ item.assignee }}</span>
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
  {
    id: 1,
    title: 'API接口联调',
    desc: '完成用户模块的所有API对接工作',
    status: '进行中',
    assignee: '张三',
    time: '11:20',
  },
  {
    id: 2,
    title: '数据库迁移',
    desc: '将旧数据迁移到新的PostgreSQL实例',
    status: '待开始',
    assignee: '李四',
    time: '昨天 16:00',
  },
  {
    id: 3,
    title: '前端性能优化',
    desc: '优化首页加载速度，减少首屏渲染时间',
    status: '已完成',
    assignee: '王五',
    time: '前天 10:00',
  },
]);
</script>
