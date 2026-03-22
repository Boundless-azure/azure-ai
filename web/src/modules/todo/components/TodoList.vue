<template>
  <!-- 待办事项主列表页 -->
  <div class="h-full flex flex-col bg-gray-50 w-full relative">
    <template v-if="!selectedTodo">
      <!-- 列表内容包裹，共用垂直滚动和统一的左右 padding 保证绝对对齐 -->
      <div class="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
        <!-- 顶部区域：标题 -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-gray-900">{{ t('todo.title') }}</h2>
          <button
            @click="showCreateModal = true"
            class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <i class="fa-solid fa-plus"></i>
            {{ t('todo.create') }}
          </button>
        </div>

        <!-- 筛选和搜索 -->
        <div class="flex items-center gap-3 mb-8 pb-4 border-b border-gray-200">
          <select
            v-model="selectedStatus"
            class="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            @change="handleRefresh"
          >
            <option value="">{{ t('todo.allStatuses') }}</option>
            <option value="pending">{{ t('todo.status.pending') }}</option>
            <option value="in_progress">{{ t('todo.status.inProgress') }}</option>
            <option value="failed">{{ t('todo.status.failed') }}</option>
            <option value="waiting_acceptance">{{ t('todo.status.waitingAcceptance') }}</option>
            <option value="completed">{{ t('todo.status.completed') }}</option>
          </select>
          <div class="flex-1 max-w-md relative">
            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              v-model="searchQuery"
              class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              :placeholder="t('todo.search')"
              @keyup.enter="handleRefresh"
            />
          </div>
        </div>

        <!-- 待办卡片列表 -->
        <!-- 加载状态 -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
        </div>

        <!-- 空状态 -->
        <div v-else-if="items.length === 0" class="text-center py-16">
          <i class="fa-solid fa-list-check text-4xl text-gray-300 mb-4"></i>
          <p class="text-gray-400">{{ t('todo.empty') }}</p>
        </div>

        <!-- 卡片网格 -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="item in paginatedItems"
            :key="item.id"
            class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
            @click="openDetail(item)"
          >
            <!-- 卡片头部：状态dot + 标题 -->
            <div class="p-4 pb-2">
              <div class="flex items-start gap-3">
                <!-- 状态dot -->
                <span
                  class="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                  :style="{ backgroundColor: item.statusColor || getStatusColor(item.status) }"
                ></span>
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-gray-900 truncate">{{ item.title }}</h3>
                  <p v-if="item.description" class="text-sm text-gray-500 mt-1 line-clamp-2">
                    {{ item.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 卡片底部 -->
            <div class="px-4 pb-4 pt-2 border-t border-gray-50">
              <div class="flex items-center justify-between">
                <!-- 跟进人头像 -->
                <div class="flex items-center -space-x-2">
                  <template v-if="item.followerIds && item.followerIds.length > 0">
                    <div
                      v-for="(followerId, idx) in item.followerIds.slice(0, 3)"
                      :key="followerId"
                      class="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
                      :title="`Follower ${followerId}`"
                    >
                      {{ getInitials(followerId) }}
                    </div>
                    <span
                      v-if="item.followerIds.length > 3"
                      class="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-500"
                    >
                      +{{ item.followerIds.length - 3 }}
                    </span>
                  </template>
                  <span v-else class="text-xs text-gray-400">{{ t('todo.followers') }}: -</span>
                </div>

                <!-- 状态标签 -->
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="statusClass(item.status)"
                >
                  {{ t(`todo.status.${item.status}`) }}
                </span>
              </div>

              <!-- 发起人和时间 -->
              <div class="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span>{{ t('todo.initiator') }}: {{ item.initiatorId }}</span>
                <span>{{ formatDate(item.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页控件 -->
        <div v-if="totalPages > 0" class="flex justify-center items-center gap-2 mt-8 pb-4">
          <button
            @click="handlePageChange(currentPage - 1)"
            :disabled="currentPage === 1"
            class="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <span class="text-sm text-gray-600 px-4 font-medium">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            @click="handlePageChange(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>
    </template>

    <!-- 详情页 -->
    <template v-else>
      <TodoDetail
        :todo="selectedTodo"
        @close="selectedTodo = null"
        @updated="handleUpdated"
      />
    </template>

    <!-- 创建待办弹窗 -->
    <CreateTodoModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title TodoList Component
 * @description 待办事项主列表页，展示卡片式待办列表
 * @keywords-cn 待办列表, 卡片, 状态dot, 头像
 * @keywords-en todo-list, cards, status-dot, avatar
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import type { TodoItem } from '../types/todo.types';
import { useTodos } from '../hooks/useTodos';
import CreateTodoModal from './CreateTodoModal.vue';
import TodoDetail from './TodoDetail.vue';

const { t } = useI18n();
const { loading, items, list } = useTodos();

const selectedStatus = ref('');
const searchQuery = ref('');
const showCreateModal = ref(false);
const selectedTodo = ref<TodoItem | null>(null);

// 分页逻辑
const currentPage = ref(1);
const pageSize = ref(12);

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return items.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() => Math.ceil(items.value.length / pageSize.value));

const handlePageChange = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const handleRefresh = async () => {
  currentPage.value = 1;
  await list({
    status: selectedStatus.value || undefined,
    q: searchQuery.value || undefined,
  });
};

const openDetail = (todo: TodoItem) => {
  selectedTodo.value = todo;
};

const handleCreated = async () => {
  showCreateModal.value = false;
  await handleRefresh();
};

const handleUpdated = async () => {
  await handleRefresh();
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: '#6B7280',
    in_progress: '#3B82F6',
    failed: '#EF4444',
    waiting_acceptance: '#F59E0B',
    completed: '#10B981',
  };
  return colors[status] || '#6B7280';
};

const statusClass = (status: string): string => {
  const classes: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-50 text-blue-600',
    failed: 'bg-red-50 text-red-600',
    waiting_acceptance: 'bg-orange-50 text-orange-600',
    completed: 'bg-green-50 text-green-600',
  };
  return classes[status] || 'bg-gray-100 text-gray-600';
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  // 如果是 user-xxx 或 agent-xxx 格式
  if (name.startsWith('user-') || name.startsWith('agent-')) {
    return name.slice(-2).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

onMounted(handleRefresh);
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
