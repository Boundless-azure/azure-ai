<template>
  <div class="relative flex h-full w-full flex-col bg-gray-50">
    <template v-if="!selectedTask">
      <div class="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-2xl font-bold text-gray-900">任务列表</h2>
          <button
            @click="showCreateModal = true"
            class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <i class="fa-solid fa-plus"></i>
            新建任务
          </button>
        </div>

        <div class="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row">
          <div class="relative flex-1">
            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              v-model="query.q"
              type="text"
              class="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="搜索任务名称、描述或里程碑"
              @keyup.enter="handleRefresh"
            />
          </div>
          <input
            v-model="query.sessionId"
            type="text"
            class="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 md:w-72"
            placeholder="按 sessionId 过滤"
            @keyup.enter="handleRefresh"
          />
          <button
            @click="handleRefresh"
            class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            刷新
          </button>
        </div>

        <div v-if="loading" class="py-16 text-center text-sm text-gray-400">加载中...</div>
        <div v-else-if="items.length === 0" class="py-16 text-center text-gray-400">
          <i class="fa-solid fa-list-check mb-4 text-4xl text-gray-300"></i>
          <p>暂无任务</p>
        </div>
        <div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-4 py-3">任务名称</th>
                <th class="px-4 py-3">里程碑</th>
                <th class="px-4 py-3">任务 PM</th>
                <th class="px-4 py-3">关联人</th>
                <th class="px-4 py-3">所属 Session</th>
                <th class="px-4 py-3">关联文件夹</th>
                <th class="px-4 py-3">更新时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="item in items"
                :key="item.id"
                class="cursor-pointer hover:bg-gray-50"
                @click="openDetail(item)"
              >
                <td class="px-4 py-3 align-top">
                  <p class="font-medium text-gray-900">{{ item.title }}</p>
                  <p v-if="item.description" class="mt-1 line-clamp-2 max-w-[280px] text-xs text-gray-500">{{ item.description }}</p>
                </td>
                <td class="px-4 py-3 text-gray-600">{{ item.milestone || '-' }}</td>
                <td class="px-4 py-3 text-gray-600">{{ getPrincipalLabel(item.pmId) || '-' }}</td>
                <td class="px-4 py-3 text-gray-600">{{ formatAssignees(item.assigneeIds) }}</td>
                <td class="px-4 py-3 text-gray-600">{{ item.sessionId || '-' }}</td>
                <td class="px-4 py-3 text-gray-500">{{ item.folderPath || '-' }}</td>
                <td class="px-4 py-3 text-gray-500">{{ formatDate(item.updatedAt || item.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template v-else>
      <TaskDetail
        :task="selectedTask"
        @close="selectedTask = null"
        @updated="handleUpdated"
        @deleted="handleDeleted"
      />
    </template>

    <CreateTaskModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title TaskList
 * @description 任务列表主页面，使用 table 形式展示任务。
 * @keywords-cn 任务列表, 任务表格, 任务详情入口
 * @keywords-en task-list, task-table, task-detail-entry
 */
import { onMounted, reactive, ref } from 'vue';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import type { TaskItem } from '../types/task.types';
import { useTasks } from '../hooks/useTasks';
import CreateTaskModal from './CreateTaskModal.vue';
import TaskDetail from './TaskDetail.vue';

const { loading, items, list } = useTasks();
const { list: listPrincipals } = usePrincipals();

const principalMap = ref<Record<string, string>>({});
const selectedTask = ref<TaskItem | null>(null);
const showCreateModal = ref(false);

const query = reactive({
  q: '',
  sessionId: '',
});

/**
 * @title 加载人员映射
 * @description 拉取主体名称用于列表显示。
 * @keyword-en load-task-list-principals
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
 * @title 刷新列表
 * @description 根据当前筛选重新加载任务。
 * @keyword-en refresh-task-list
 */
async function handleRefresh() {
  await list({
    q: query.q.trim() || undefined,
    sessionId: query.sessionId.trim() || undefined,
  });
}

/**
 * @title 打开详情
 * @description 进入任务详情页。
 * @keyword-en open-task-detail
 */
function openDetail(item: TaskItem) {
  selectedTask.value = item;
}

/**
 * @title 创建后回调
 * @description 关闭弹窗并刷新任务列表。
 * @keyword-en handle-task-created
 */
async function handleCreated() {
  showCreateModal.value = false;
  await handleRefresh();
}

/**
 * @title 更新后回调
 * @description 刷新列表并同步当前详情数据。
 * @keyword-en handle-task-updated
 */
async function handleUpdated() {
  const currentId = selectedTask.value?.id;
  await handleRefresh();
  if (!currentId) return;
  selectedTask.value = items.value.find((item) => item.id === currentId) || null;
}

/**
 * @title 删除后回调
 * @description 刷新列表并关闭详情页。
 * @keyword-en handle-task-deleted
 */
async function handleDeleted() {
  selectedTask.value = null;
  await handleRefresh();
}

/**
 * @title 获取主体名称
 * @description 根据主体 ID 显示名称。
 * @keyword-en get-task-list-principal-label
 */
function getPrincipalLabel(id: string | null | undefined) {
  if (!id) return '';
  return principalMap.value[id] || id;
}

/**
 * @title 格式化关联人
 * @description 将任务关联人数组格式化为列表摘要。
 * @keyword-en format-task-assignees
 */
function formatAssignees(ids: string[] | null) {
  if (!ids?.length) return '-';
  const names = ids.map((id) => getPrincipalLabel(id));
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} +${names.length - 2}`;
}

/**
 * @title 格式化日期
 * @description 输出任务更新时间。
 * @keyword-en format-task-list-date
 */
function formatDate(value?: string | Date) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(async () => {
  await Promise.all([handleRefresh(), loadPrincipalMap()]);
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
