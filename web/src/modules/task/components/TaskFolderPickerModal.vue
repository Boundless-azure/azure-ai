<template>
  <BaseModal :open="true" title="选择关联文件夹" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <p class="text-xs text-gray-500">当前目录</p>
          <p class="text-sm font-medium text-gray-900 break-all">{{ currentPath }}</p>
        </div>
        <button
          @click="selectCurrentPath"
          class="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          选择当前目录
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="goRoot"
          class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          根目录
        </button>
        <button
          @click="goParent"
          :disabled="currentPath === '/'"
          class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一级
        </button>
      </div>

      <div v-if="loading" class="py-10 text-center text-sm text-gray-400">加载中...</div>
      <div v-else class="max-h-[420px] overflow-y-auto space-y-2 pr-1">
        <button
          v-for="folder in folders"
          :key="folder.id"
          @click="openFolder(folder.path)"
          class="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-gray-300 hover:bg-gray-50"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <i class="fa-solid fa-folder"></i>
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-gray-900">{{ folder.name }}</p>
              <p class="truncate text-xs text-gray-500">{{ folder.path }}</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-xs text-gray-400"></i>
        </button>

        <div v-if="!folders.length" class="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          当前目录下没有子文件夹
        </div>
      </div>
    </div>

    <template #footer>
      <button
        @click="emit('close')"
        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
      >
        取消
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
/**
 * @title TaskFolderPickerModal
 * @description 用于浏览资源库文件夹并选择目录路径。
 * @keywords-cn 文件夹选择器, 任务文件夹, 资源库目录
 * @keywords-en folder-picker, task-folder, storage-directory
 */
import { computed, onMounted, ref, watch } from 'vue';
import BaseModal from '../../../components/BaseModal.vue';
import { listNodes } from '../../../api/storage';
import type { StorageNode } from '../../storage/types/storage.types';

const props = defineProps<{
  initialPath?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selected', path: string): void;
}>();

const loading = ref(false);
const currentPath = ref(props.initialPath || '/');
const nodes = ref<StorageNode[]>([]);

const folders = computed(() => nodes.value.filter((node) => node.type === 'folder'));

/**
 * @title 加载目录
 * @description 按路径加载当前目录下的节点。
 * @keyword-en load-folder-nodes
 */
async function load(path: string) {
  loading.value = true;
  try {
    nodes.value = await listNodes({ path });
    currentPath.value = path || '/';
  } finally {
    loading.value = false;
  }
}

/**
 * @title 打开子目录
 * @description 切换到指定文件夹路径。
 * @keyword-en open-folder-path
 */
function openFolder(path: string) {
  void load(path || '/');
}

/**
 * @title 返回根目录
 * @description 切换到资源库根目录。
 * @keyword-en folder-picker-root
 */
function goRoot() {
  void load('/');
}

/**
 * @title 返回上一级
 * @description 从当前路径回退到父目录。
 * @keyword-en folder-picker-parent
 */
function goParent() {
  if (currentPath.value === '/') return;
  const segments = currentPath.value.split('/').filter(Boolean);
  segments.pop();
  const next = segments.length ? `/${segments.join('/')}` : '/';
  void load(next);
}

/**
 * @title 选择当前目录
 * @description 将当前浏览路径作为结果返回。
 * @keyword-en select-current-folder
 */
function selectCurrentPath() {
  emit('selected', currentPath.value || '/');
}

watch(
  () => props.initialPath,
  (path) => {
    if (path !== undefined) {
      void load(path || '/');
    }
  },
);

onMounted(() => {
  void load(currentPath.value || '/');
});
</script>
