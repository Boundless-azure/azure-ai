<template>
  <div class="relative flex h-full w-full flex-col overflow-y-auto bg-white text-[13px] md:overflow-hidden md:text-sm">
    <div class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 md:px-6 md:py-4">
      <div class="flex items-center gap-2 text-sm">
        <button
          @click="emit('close')"
          class="flex items-center gap-1 text-gray-500 transition-colors hover:text-gray-900"
        >
          <i class="fa-solid fa-arrow-left"></i>
          任务列表
        </button>
        <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
        <span class="truncate font-medium text-gray-900">{{ task.title }}</span>
      </div>
      <button
        @click="emit('close')"
        class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="flex flex-1 flex-col overflow-visible md:flex-row md:overflow-hidden">
      <div class="w-full shrink-0 border-b border-gray-200 bg-gray-50/50 p-4 md:w-80 md:overflow-y-auto md:border-b-0 md:border-r md:p-6">
        <div class="space-y-4">
          <div>
            <h2 class="text-lg font-bold text-gray-900 md:text-xl">{{ task.title }}</h2>
            <p v-if="task.description" class="mt-2 text-sm text-gray-600">{{ task.description }}</p>
          </div>

          <div class="space-y-4 border-t border-gray-100 pt-3">
            <div>
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-solid fa-flag-checkered w-4 text-center text-[13px]"></i>
                <span class="text-xs font-medium">里程碑</span>
              </div>
              <div
                v-if="task.milestone"
                class="task-markdown-preview pl-[22px] pt-1 text-[13px] text-gray-900 md:text-sm"
                v-html="renderedMilestone"
              ></div>
              <p v-else class="pl-[22px] text-[13px] text-gray-900 md:text-sm">-</p>
            </div>

            <div>
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-solid fa-user-tie w-4 text-center text-[13px]"></i>
                <span class="text-xs font-medium">任务 PM</span>
              </div>
              <p class="pl-[22px] text-[13px] text-gray-900 md:text-sm">{{ getPrincipalLabel(task.pmId) || '-' }}</p>
            </div>

            <div>
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-solid fa-users w-4 text-center text-[13px]"></i>
                <span class="text-xs font-medium">任务关联人</span>
              </div>
              <div class="flex flex-wrap gap-2 pl-[22px] pt-1">
                <span
                  v-for="assigneeId in task.assigneeIds || []"
                  :key="assigneeId"
                  class="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 border border-gray-200"
                >
                  {{ getPrincipalLabel(assigneeId) }}
                </span>
                <span v-if="!(task.assigneeIds || []).length" class="text-xs text-gray-400">-</span>
              </div>
            </div>

            <div>
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-regular fa-comments w-4 text-center text-[13px]"></i>
                <span class="text-xs font-medium">所属 Session</span>
              </div>
              <p class="break-all pl-[22px] text-[13px] text-gray-900 md:text-sm">{{ task.sessionId || '-' }}</p>
            </div>

            <div>
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-solid fa-folder-open w-4 text-center text-[13px]"></i>
                <span class="text-xs font-medium">关联文件夹</span>
              </div>
              <p class="break-all pl-[22px] text-[13px] text-gray-900 md:text-sm">{{ task.folderPath || '-' }}</p>
            </div>

            <div>
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-regular fa-calendar-days w-4 text-center text-[13px]"></i>
                <span class="text-xs font-medium">更新时间</span>
              </div>
              <p class="pl-[22px] text-[13px] text-gray-900 md:text-sm">{{ formatDate(task.updatedAt || task.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-1 flex-col overflow-visible bg-white md:overflow-hidden">
        <div class="border-b border-gray-100 px-4 pt-4 md:px-8 md:pt-6">
          <div class="flex gap-4 overflow-x-auto md:gap-8">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="relative -mb-[1px] border-b-2 pb-4 text-sm font-medium transition-colors"
              :class="activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
            >
              <i :class="tab.icon" class="mr-2"></i>
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-visible p-4 md:overflow-y-auto md:p-8">
          <div v-if="activeTab === 'detail'" class="max-w-3xl space-y-6">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">任务名称</label>
              <input v-model="editForm.title" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">任务描述</label>
              <textarea v-model="editForm.description" rows="3" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"></textarea>
            </div>

            <TaskMarkdownEditor
              v-model="editForm.milestone"
              label="任务里程碑"
              placeholder="支持 Markdown，多行描述任务阶段、目标、验收标准等"
              hint="可用工具栏快速插入 Markdown 语法；保存后左侧摘要区域会按 Markdown 效果展示。"
            />

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">所属 Session</label>
              <input v-model="editForm.sessionId" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">任务 PM</label>
              <select v-model="editForm.pmId" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                <option value="">未选择</option>
                <option v-for="option in principalOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">任务关联人</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in principalOptions"
                  :key="option.id"
                  @click="toggleAssignee(option.id)"
                  class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  :class="editForm.assigneeIds.includes(option.id)
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">关联文件夹</label>
              <div class="flex gap-2">
                <input v-model="editForm.folderPath" type="text" class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                <button @click="showFolderPicker = true" class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">选择文件夹</button>
              </div>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <button
                @click="handleSave"
                :disabled="saving"
                class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                保存任务
              </button>
              <button @click="handleDelete" class="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">删除任务</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'todos'" class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900">所属 Todo</h3>
              <button @click="loadTodos" class="text-sm text-gray-500 hover:text-gray-800">刷新</button>
            </div>

            <div v-if="todoLoading" class="py-10 text-center text-sm text-gray-400">加载中...</div>
            <div v-else-if="!todoItems.length" class="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">暂无关联 Todo</div>
            <div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th class="px-4 py-3">标题</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">跟进人</th>
                    <th class="px-4 py-3">更新时间</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="todo in todoItems" :key="todo.id" class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium text-gray-900">{{ todo.title }}</td>
                    <td class="px-4 py-3 text-gray-600">{{ formatTodoStatus(todo.status) }}</td>
                    <td class="px-4 py-3 text-gray-600">{{ getPrincipalLabel(todo.followerId) || '-' }}</td>
                    <td class="px-4 py-3 text-gray-500">{{ formatDate(todo.updatedAt || todo.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="space-y-4">
            <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p class="text-xs text-gray-500">任务目录</p>
                <p class="break-all text-sm font-medium text-gray-900">{{ task.folderPath || '未设置关联文件夹' }}</p>
              </div>
              <div class="flex items-center gap-2">
                <button v-if="task.folderPath && currentResourcePath !== task.folderPath" @click="resetTaskFolder" class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">回到任务目录</button>
                <button v-if="task.folderPath" @click="loadResources(task.folderPath)" class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">刷新</button>
              </div>
            </div>

            <div v-if="!task.folderPath" class="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">当前任务未关联资源库文件夹</div>
            <template v-else>
              <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                当前浏览路径：{{ currentResourcePath }}
              </div>
              <div v-if="resourceLoading" class="py-10 text-center text-sm text-gray-400">加载中...</div>
              <div v-else-if="resourceError" class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{{ resourceError }}</div>
              <div v-else-if="!resourceItems.length" class="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">当前文件夹暂无资源</div>
              <div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th class="px-4 py-3">名称</th>
                      <th class="px-4 py-3">类型</th>
                      <th class="px-4 py-3">路径</th>
                      <th class="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="node in resourceItems" :key="node.id" class="hover:bg-gray-50">
                      <td class="px-4 py-3 font-medium text-gray-900">{{ node.name }}</td>
                      <td class="px-4 py-3 text-gray-600">{{ node.type === 'folder' ? '文件夹' : '文件' }}</td>
                      <td class="px-4 py-3 text-gray-500">{{ node.path }}</td>
                      <td class="px-4 py-3 text-right">
                        <button @click="openResourceNode(node)" class="text-sm text-gray-600 hover:text-gray-900">
                          {{ node.type === 'folder' ? '进入' : '打开' }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <TaskFolderPickerModal
      v-if="showFolderPicker"
      :initial-path="editForm.folderPath || '/'"
      @close="showFolderPicker = false"
      @selected="handleFolderSelected"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title TaskDetail
 * @description 任务详情页，包含详情、Todo 列表与任务资源三个标签页。
 * @keywords-cn 任务详情, Todo列表, 任务资源
 * @keywords-en task-detail, task-todos, task-resources
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import { listNodes } from '../../../api/storage';
import { todoApi } from '../../../api/todo';
import type { StorageNode } from '../../storage/types/storage.types';
import { resolveImageUrl } from '../../resource/services/resource-url.service';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import type { TodoItem } from '../../todo/types/todo.types';
import { useTasks } from '../hooks/useTasks';
import type { TaskItem } from '../types/task.types';
import TaskFolderPickerModal from './TaskFolderPickerModal.vue';
import TaskMarkdownEditor from './TaskMarkdownEditor.vue';

const props = defineProps<{
  task: TaskItem;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
  (e: 'deleted'): void;
}>();

const { update, remove } = useTasks();
const { list: listPrincipals } = usePrincipals();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

const tabs = [
  { id: 'detail', label: '任务详情', icon: 'fa-solid fa-pen' },
  { id: 'todos', label: 'Todo 列表', icon: 'fa-solid fa-list-check' },
  { id: 'resources', label: '任务资源', icon: 'fa-solid fa-folder-open' },
];

const activeTab = ref('detail');
const saving = ref(false);
const showFolderPicker = ref(false);

const principalMap = ref<Record<string, { label: string }>>({});

const editForm = reactive({
  title: props.task.title,
  description: props.task.description || '',
  assigneeIds: [...(props.task.assigneeIds || [])],
  milestone: props.task.milestone || '',
  pmId: props.task.pmId || '',
  folderPath: props.task.folderPath || '',
  sessionId: props.task.sessionId || '',
});

const principalOptions = ref<Array<{ id: string; label: string }>>([]);

const todoLoading = ref(false);
const todoItems = ref<TodoItem[]>([]);

const resourceLoading = ref(false);
const resourceError = ref<string | null>(null);
const resourceItems = ref<StorageNode[]>([]);
const currentResourcePath = ref(props.task.folderPath || '/');

/**
 * @title 里程碑 Markdown 渲染
 * @description 将任务里程碑按 Markdown 渲染为摘要 HTML。
 * @keyword-en rendered-task-milestone
 */
const renderedMilestone = computed(() =>
  props.task.milestone?.trim() ? md.render(props.task.milestone) : '',
);

/**
 * @title 加载主体映射
 * @description 读取用于显示的人员名称映射。
 * @keyword-en load-task-detail-principals
 */
async function loadPrincipals() {
  try {
    const principals = await listPrincipals();
    const nextMap: Record<string, { label: string }> = {};
    principalOptions.value = (principals || [])
      .filter((item: any) => ['user', 'agent'].includes(item.principalType))
      .map((item: any) => {
        const label = item.displayName || item.name || item.id;
        nextMap[item.id] = { label };
        return { id: item.id, label };
      });
    principalMap.value = nextMap;
  } catch {
    principalOptions.value = [];
    principalMap.value = {};
  }
}

/**
 * @title 获取主体名
 * @description 根据主体 ID 返回显示名称。
 * @keyword-en get-task-principal-label
 */
function getPrincipalLabel(id: string | null | undefined) {
  if (!id) return '';
  return principalMap.value[id]?.label || id;
}

/**
 * @title 切换关联人
 * @description 在任务关联人集合中切换成员。
 * @keyword-en toggle-detail-assignee
 */
function toggleAssignee(id: string) {
  const index = editForm.assigneeIds.indexOf(id);
  if (index === -1) {
    editForm.assigneeIds.push(id);
    return;
  }
  editForm.assigneeIds.splice(index, 1);
}

/**
 * @title 保存任务
 * @description 提交任务详情修改。
 * @keyword-en save-task-detail
 */
async function handleSave() {
  saving.value = true;
  try {
    await update(props.task.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      assigneeIds: editForm.assigneeIds.length ? [...editForm.assigneeIds] : null,
      milestone: editForm.milestone.trim() || null,
      pmId: editForm.pmId || null,
      folderPath: editForm.folderPath.trim() || null,
      sessionId: editForm.sessionId.trim() || null,
    });
    emit('updated');
  } finally {
    saving.value = false;
  }
}

/**
 * @title 删除任务
 * @description 删除当前任务。
 * @keyword-en delete-task-detail
 */
async function handleDelete() {
  await remove(props.task.id);
  emit('deleted');
}

/**
 * @title 加载任务 Todo
 * @description 读取当前任务下的 Todo 列表。
 * @keyword-en load-task-todos
 */
async function loadTodos() {
  todoLoading.value = true;
  try {
    const res = await todoApi.list({ taskId: props.task.id });
    todoItems.value = Array.isArray(res) ? res : (res as any).data ?? [];
  } finally {
    todoLoading.value = false;
  }
}

/**
 * @title 加载任务资源
 * @description 读取任务目录下的资源列表。
 * @keyword-en load-task-resources
 */
async function loadResources(path?: string | null) {
  const normalizedPath = (path || '').trim();
  if (!normalizedPath) {
    resourceItems.value = [];
    resourceError.value = null;
    return;
  }
  resourceLoading.value = true;
  resourceError.value = null;
  try {
    resourceItems.value = await listNodes({ path: normalizedPath });
    currentResourcePath.value = normalizedPath;
  } catch (e) {
    resourceItems.value = [];
    resourceError.value = e instanceof Error ? e.message : '加载资源失败';
  } finally {
    resourceLoading.value = false;
  }
}

/**
 * @title 打开资源节点
 * @description 文件夹继续浏览，文件直接打开签名链接。
 * @keyword-en open-task-resource-node
 */
function openResourceNode(node: StorageNode) {
  if (node.type === 'folder') {
    void loadResources(node.path);
    return;
  }
  if (!node.resourcePath) return;
  const url = resolveImageUrl(node.resourcePath) || node.resourcePath;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * @title 重置任务目录
 * @description 回到任务绑定的初始目录。
 * @keyword-en reset-task-folder
 */
function resetTaskFolder() {
  void loadResources(props.task.folderPath);
}

/**
 * @title 处理文件夹选择
 * @description 将文件夹选择结果写回编辑表单。
 * @keyword-en handle-detail-folder-selected
 */
function handleFolderSelected(path: string) {
  editForm.folderPath = path;
  showFolderPicker.value = false;
}

/**
 * @title 格式化日期
 * @description 将时间字段格式化为中文日期时间。
 * @keyword-en format-task-date
 */
function formatDate(value?: string | Date) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @title 格式化 Todo 状态
 * @description 返回中文状态文案。
 * @keyword-en format-task-todo-status
 */
function formatTodoStatus(status: string) {
  const map: Record<string, string> = {
    pending: '未开始',
    in_progress: '进行中',
    failed: '失败',
    waiting_acceptance: '待验收',
    completed: '已完成',
  };
  return map[status] || status;
}

watch(
  () => props.task,
  (nextTask) => {
    editForm.title = nextTask.title;
    editForm.description = nextTask.description || '';
    editForm.assigneeIds = [...(nextTask.assigneeIds || [])];
    editForm.milestone = nextTask.milestone || '';
    editForm.pmId = nextTask.pmId || '';
    editForm.folderPath = nextTask.folderPath || '';
    editForm.sessionId = nextTask.sessionId || '';
    currentResourcePath.value = nextTask.folderPath || '/';
    if (activeTab.value === 'todos') {
      void loadTodos();
    }
    if (activeTab.value === 'resources') {
      void loadResources(nextTask.folderPath);
    }
  },
  { deep: true },
);

watch(activeTab, (tab) => {
  if (tab === 'todos') {
    void loadTodos();
  }
  if (tab === 'resources') {
    void loadResources(props.task.folderPath);
  }
});

onMounted(() => {
  void loadPrincipals();
  void loadTodos();
  void loadResources(props.task.folderPath);
});
</script>

<style scoped>
.task-markdown-preview :deep(h1),
.task-markdown-preview :deep(h2),
.task-markdown-preview :deep(h3),
.task-markdown-preview :deep(h4) {
  margin: 0 0 0.6rem;
  color: #111827;
  font-weight: 700;
  line-height: 1.35;
}

.task-markdown-preview :deep(h1) {
  font-size: 1.15rem;
}

.task-markdown-preview :deep(h2) {
  font-size: 1.05rem;
}

.task-markdown-preview :deep(h3),
.task-markdown-preview :deep(h4) {
  font-size: 0.98rem;
}

.task-markdown-preview :deep(p) {
  margin: 0 0 0.6rem;
  color: #111827;
  line-height: 1.7;
}

.task-markdown-preview :deep(ul),
.task-markdown-preview :deep(ol) {
  margin: 0 0 0.6rem;
  padding-left: 1.15rem;
  color: #111827;
}

.task-markdown-preview :deep(li) {
  margin-bottom: 0.2rem;
}

.task-markdown-preview :deep(blockquote) {
  margin: 0 0 0.6rem;
  border-left: 3px solid #d1d5db;
  padding-left: 0.75rem;
  color: #4b5563;
}

.task-markdown-preview :deep(code:not(pre code)) {
  border-radius: 0.375rem;
  background: #f3f4f6;
  padding: 0.1rem 0.35rem;
  font-size: 0.875em;
}

.task-markdown-preview :deep(pre) {
  margin: 0 0 0.75rem;
  overflow-x: auto;
  border-radius: 0.75rem;
  background: #111827;
  padding: 0.75rem 0.9rem;
}

.task-markdown-preview :deep(pre code) {
  color: #f9fafb;
}

.task-markdown-preview :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}

.task-markdown-preview :deep(table) {
  margin: 0 0 0.75rem;
  width: 100%;
  border-collapse: collapse;
}

.task-markdown-preview :deep(th),
.task-markdown-preview :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.4rem 0.6rem;
  text-align: left;
}

.task-markdown-preview :deep(th) {
  background: #f9fafb;
}

.task-markdown-preview :deep(hr) {
  margin: 0.9rem 0;
  border: 0;
  border-top: 1px solid #e5e7eb;
}
</style>
