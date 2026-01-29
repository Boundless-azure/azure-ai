<template>
  <div class="h-16 flex items-center justify-between px-4 relative">
    <div class="flex items-center space-x-3 overflow-hidden">
      <button
        @click="emit('back')"
        class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors flex-shrink-0"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>

      <div class="flex flex-col min-w-0">
        <div class="flex items-center space-x-2">
          <h2 class="text-base font-bold text-gray-800 truncate">
            {{ currentSessionTitle || '未命名对话' }}
          </h2>
          <i
            v-if="isTitleLoading"
            class="fas fa-spinner fa-spin text-gray-400 text-xs"
          ></i>
        </div>
      </div>
    </div>

    <div class="relative">
      <button
        @click="toggleMenu"
        class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
        title="更多设置"
      >
        <i class="fa-solid fa-ellipsis"></i>
      </button>

      <div
        v-if="isSettingsMenuOpen"
        class="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 animate-fade-in-up"
      >
        <div class="px-2 pb-2 border-b border-gray-100 mb-2">
          <div class="text-xs text-gray-400 px-2">会话设置</div>
        </div>

        <button
          @click="openTab('info')"
          class="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center justify-between text-gray-700"
        >
          <span
            ><i class="fa-solid fa-circle-info mr-2 text-gray-400"></i
            >聊天详情</span
          >
        </button>

        <button
          @click="openTab('todos')"
          class="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center justify-between text-gray-700"
        >
          <span
            ><i class="fa-solid fa-check-square mr-2 text-gray-400"></i
            >待办事项</span
          >
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
        </button>

        <button
          @click="openTab('tasks')"
          class="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center justify-between text-gray-700"
        >
          <span
            ><i class="fa-solid fa-list-check mr-2 text-gray-400"></i
            >任务列表</span
          >
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
        </button>

        <button
          @click="openTab('files')"
          class="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center justify-between text-gray-700"
        >
          <span
            ><i class="fa-solid fa-folder mr-2 text-gray-400"></i>文件列表</span
          >
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
        </button>

        <div class="border-t border-gray-100 my-1"></div>

        <button
          @click="handleDelete"
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-sm flex items-center text-red-600"
        >
          <i class="fa-solid fa-trash mr-2"></i>
          删除/退出
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Session Header
 * @description 对话窗口头部标题与会话设置入口。
 * @keywords-cn 对话头部, 会话设置, 标题栏
 * @keywords-en session-header, chat-settings, title-bar
 */
import { ref } from 'vue';

interface Props {
  currentSessionTitle?: string | null;
  isTitleLoading: boolean;
}

type DrawerTab = 'info' | 'todos' | 'tasks' | 'files';

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'openTab', tab: DrawerTab): void;
  (e: 'delete'): void;
}>();

const isSettingsMenuOpen = ref(false);

const toggleMenu = () => {
  isSettingsMenuOpen.value = !isSettingsMenuOpen.value;
};

const openTab = (tab: DrawerTab) => {
  emit('openTab', tab);
  isSettingsMenuOpen.value = false;
};

const handleDelete = () => {
  emit('delete');
  isSettingsMenuOpen.value = false;
};
</script>
