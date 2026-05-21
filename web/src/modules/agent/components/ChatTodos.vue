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
      <button
        class="text-xs text-gray-900 hover:text-black font-medium"
        @click="createTodo"
      >
        <i class="fa-solid fa-plus mr-1"></i>新建
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
          <i class="fa-solid fa-list-check text-xl"></i>
        </div>
        <div class="mt-3 text-sm text-gray-400">暂无待办</div>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors group"
        >
          <div class="mt-0.5 mr-3">
            <input
              type="checkbox"
              :checked="item.status === TodoStatus.Completed"
              class="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              @change="toggleCompleted(item)"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm text-gray-800 font-medium line-clamp-2 transition-colors"
              :class="{ 'line-through text-gray-400': item.status === TodoStatus.Completed }"
            >
              {{ item.title }}
            </p>
            <p v-if="item.content" class="text-xs text-gray-500 mt-1 line-clamp-2">
              {{ item.content }}
            </p>
            <div class="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <span>{{ statusText(item.status) }}</span>
              <span>•</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Todos
 * @description 对话窗口待办抽屉，读取当前会话绑定的 Todo 并支持创建/完成。
 * @keywords-cn 聊天待办, 待办接口, 会话绑定
 * @keywords-en chat-todos, todo-api, session-bound
 */
import { onMounted, ref, watch } from 'vue';
import { todoApi } from '../../../api/todo';
import type { TodoItem } from '../../todo/types/todo.types';
import { TodoStatus } from '../../todo/enums/todo.enums';

const props = defineProps<{
  sessionId: string;
}>();

defineEmits(['close']);

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<TodoItem[]>([]);

/**
 * 获取当前登录主体 ID。
 * @keyword-en get-current-principal-id
 */
function getPrincipalId(): string | null {
  try {
    const raw = localStorage.getItem('principal');
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string };
      const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
      if (id) return id;
    }
  } catch {
    void 0;
  }
  return null;
}

/**
 * 加载当前会话绑定的待办。
 * @keyword-en load-chat-todos
 */
async function loadTodos() {
  loading.value = true;
  error.value = null;
  try {
    const res = await todoApi.list({ sessionId: props.sessionId });
    items.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '待办加载失败';
    items.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * 创建待办。
 * @keyword-en create-chat-todo
 */
async function createTodo() {
  const principalId = getPrincipalId();
  if (!principalId) return;
  const title = window.prompt('请输入待办标题');
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) return;
  await todoApi.create({
    initiatorId: principalId,
    sessionId: props.sessionId,
    title: normalizedTitle,
    content: `来自会话：${props.sessionId}`,
    followerIds: [principalId],
    status: TodoStatus.Pending,
  });
  await loadTodos();
}

/**
 * 切换待办完成状态。
 * @keyword-en toggle-todo-completed
 */
async function toggleCompleted(item: TodoItem) {
  const next =
    item.status === TodoStatus.Completed ? TodoStatus.Pending : TodoStatus.Completed;
  await todoApi.update(item.id, { status: next });
  await loadTodos();
}

/**
 * 待办状态文案。
 * @keyword-en todo-status-text
 */
function statusText(status: string) {
  const map: Record<string, string> = {
    [TodoStatus.Pending]: '待处理',
    [TodoStatus.InProgress]: '进行中',
    [TodoStatus.Failed]: '失败',
    [TodoStatus.WaitingAcceptance]: '待验收',
    [TodoStatus.Completed]: '已完成',
  };
  return map[status] ?? status;
}

/**
 * 格式化待办时间。
 * @keyword-en format-todo-time
 */
function formatTime(value?: string | Date) {
  if (!value) return '';
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

onMounted(() => {
  void loadTodos();
});

watch(
  () => props.sessionId,
  () => {
    void loadTodos();
  },
);
</script>
