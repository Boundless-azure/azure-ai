<template>
  <div class="h-full flex flex-col bg-white">
    <div
      class="px-4 py-3 border-b border-gray-100 flex items-center"
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
          <i class="fa-solid fa-list-check text-xl"></i>
        </div>
        <div class="mt-3 text-sm text-gray-400">当前会话暂无任务</div>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
        >
          <div class="flex items-center justify-between mb-2">
            <span
              class="text-xs font-bold px-2 py-0.5 rounded"
              :class="item.milestone ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'"
              >{{ item.milestone || '未设里程碑' }}</span
            >
            <span class="text-xs text-gray-400">{{ formatTime(item.updatedAt || item.createdAt) }}</span>
          </div>
          <h4 class="text-sm font-bold text-gray-800 mb-1">{{ item.title }}</h4>
          <p v-if="item.description" class="text-xs text-gray-500 line-clamp-2">
            {{ item.description }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span>PM：{{ getPrincipalLabel(item.pmId) || '-' }}</span>
            <span>关联人：{{ formatAssignees(item.assigneeIds) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Tasks
 * @description 对话窗口任务抽屉，读取当前会话绑定的任务。
 * @keywords-cn 聊天任务, 任务接口, 会话绑定
 * @keywords-en chat-tasks, task-api, session-bound
 */
import { onMounted, ref, watch } from 'vue';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import { useTasks } from '../../task/hooks/useTasks';

const props = defineProps<{
  sessionId: string;
}>();

defineEmits(['close']);

const { loading, items, error, list } = useTasks();
const { list: listPrincipals } = usePrincipals();

const principalMap = ref<Record<string, string>>({});

/**
 * 加载主体名称映射。
 * @keyword-en load-chat-task-principal-map
 */
async function loadPrincipalMap() {
  try {
    const principals = await listPrincipals();
    const map: Record<string, string> = {};
    (principals || []).forEach((item: any) => {
      map[item.id] = item.displayName || item.name || item.id;
    });
    principalMap.value = map;
  } catch {
    principalMap.value = {};
  }
}

/**
 * 加载当前会话绑定的任务。
 * @keyword-en load-chat-tasks
 */
async function loadTasks() {
  try {
    await list({ sessionId: props.sessionId });
  } catch {
    void 0;
  }
}

/**
 * 获取主体显示名。
 * @keyword-en get-chat-task-principal-label
 */
function getPrincipalLabel(id: string | null | undefined) {
  if (!id) return '';
  return principalMap.value[id] || id;
}

/**
 * 格式化任务关联人。
 * @keyword-en format-chat-task-assignees
 */
function formatAssignees(ids: string[] | null | undefined) {
  if (!ids?.length) return '-';
  const names = ids.map((id) => getPrincipalLabel(id));
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} +${names.length - 2}`;
}

/**
 * 格式化时间。
 * @keyword-en format-chat-task-time
 */
function formatTime(value?: string | Date) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

onMounted(() => {
  void Promise.all([loadTasks(), loadPrincipalMap()]);
});

watch(
  () => props.sessionId,
  () => {
    void loadTasks();
  },
);
</script>
