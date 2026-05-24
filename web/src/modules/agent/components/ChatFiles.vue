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
      <button
        class="text-gray-400 hover:text-gray-600"
        title="刷新"
        @click="loadResources"
      >
        <i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': loading }"></i>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-4">
      <div v-if="loading" class="py-10 text-center text-sm text-gray-400">
        加载中...
      </div>
      <div v-else-if="error" class="py-10 text-center text-sm text-red-500">
        {{ error }}
      </div>
      <div v-else-if="items.length === 0" class="py-10 text-center">
        <div
          class="mx-auto w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300"
        >
          <i class="fa-solid fa-folder-open text-xl"></i>
        </div>
        <div class="mt-3 text-sm text-gray-400">暂无会话文件</div>
      </div>
      <div v-else class="space-y-2">
        <a
          v-for="item in items"
          :key="item.id"
          :href="resolveResourceUrl(item.path)"
          target="_blank"
          rel="noreferrer"
          class="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer group transition-colors"
        >
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
            :class="fileMeta(item).bgClass"
          >
            <i
              class="fa-solid text-lg"
              :class="[fileMeta(item).icon, fileMeta(item).textClass]"
            ></i>
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors"
            >
              {{ item.originalName }}
            </p>
            <div
              class="flex items-center text-xs text-gray-400 mt-0.5 space-x-2"
            >
              <span>{{ formatSize(item.fileSize) }}</span>
              <span>•</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
          </div>
          <i class="fa-solid fa-arrow-up-right-from-square text-gray-300"></i>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Files
 * @description 基于 resources 表展示当前会话关联文件。
 * @keywords-cn 聊天文件, resources表, 会话文件
 * @keywords-en chat-files, resources-table, session-files
 */
import { onMounted, ref, watch } from 'vue';
import { resourceApi } from '../../../api/resource';
import type { ResourceListItem } from '../../resource/types/resource.types';
import { resolveResourceUrl } from '../../resource/services/resource-url.service';

const props = defineProps<{
  sessionId: string;
}>();

defineEmits(['close']);

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<ResourceListItem[]>([]);

/**
 * 加载当前会话关联资源。
 * @keyword-en load-session-resources
 */
async function loadResources() {
  loading.value = true;
  error.value = null;
  try {
    const res = await resourceApi.list({ sessionId: props.sessionId, limit: 100 });
    items.value = res.data ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : '文件列表加载失败';
    items.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * 格式化文件大小。
 * @keyword-en format-file-size
 */
function formatSize(value: string) {
  const size = Number(value);
  if (!Number.isFinite(size)) return value;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * 格式化资源创建时间。
 * @keyword-en format-resource-time
 */
function formatTime(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 根据资源类型解析图标与配色。
 * @keyword-en file-meta
 */
function fileMeta(item: ResourceListItem) {
  if (item.category === 'image') {
    return { icon: 'fa-file-image', bgClass: 'bg-purple-50', textClass: 'text-purple-500' };
  }
  if (item.category === 'video') {
    return { icon: 'fa-file-video', bgClass: 'bg-blue-50', textClass: 'text-blue-500' };
  }
  if (item.category === 'office' && item.fileExt === '.pdf') {
    return { icon: 'fa-file-pdf', bgClass: 'bg-red-50', textClass: 'text-red-500' };
  }
  if (item.category === 'code') {
    return { icon: 'fa-file-code', bgClass: 'bg-gray-100', textClass: 'text-gray-600' };
  }
  return { icon: 'fa-file', bgClass: 'bg-gray-50', textClass: 'text-gray-500' };
}

onMounted(() => {
  void loadResources();
});

watch(
  () => props.sessionId,
  () => {
    void loadResources();
  },
);
</script>
