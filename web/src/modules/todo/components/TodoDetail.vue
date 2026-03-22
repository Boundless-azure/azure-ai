<template>
  <!-- 待办详情编辑页 -->
  <div class="h-full w-full flex flex-col bg-white relative overflow-y-auto md:overflow-hidden text-[13px] md:text-sm">
      <!-- 顶部导航栏 -->
      <div class="bg-gray-50 border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex-shrink-0 flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <button
            @click="emit('close')"
            class="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
          >
            <i class="fa-solid fa-arrow-left"></i>
            {{ t('todo.breadcrumb.home') }}
          </button>
          <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
          <span class="text-gray-900 font-medium truncate">{{ todo.title }}</span>
        </div>
        <button @click="emit('close')" class="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 主内容区：左右分栏 -->
      <div class="flex-1 flex flex-col md:flex-row overflow-visible md:overflow-hidden">
        <!-- 左侧：待办信息卡片 -->
        <div class="w-full md:w-80 bg-gray-50/50 border-b md:border-b-0 md:border-r border-gray-200 p-4 md:p-6 overflow-visible md:overflow-y-auto flex-shrink-0">
        <div class="space-y-4">
          <!-- 状态dot + 标题 -->
          <div class="flex items-start gap-3">
            <span
              class="w-3.5 h-3.5 rounded-full mt-1.5 flex-shrink-0 shadow-sm"
              :style="{ backgroundColor: todo.statusColor || getStatusColor(todo.status) }"
            ></span>
            <div class="flex-1">
              <h2 class="text-lg md:text-xl font-bold text-gray-900 leading-tight">{{ todo.title }}</h2>
              <div class="mt-2">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="statusClass(todo.status)"
                >
                  {{ t(`todo.status.${todo.status}`) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 描述 -->
          <div v-if="todo.description" class="pt-2 border-t border-gray-100">
            <p class="text-sm text-gray-600">{{ todo.description }}</p>
          </div>

          <!-- 基本信息 -->
          <div class="pt-2 border-t border-gray-100 space-y-4">
            <div class="space-y-1">
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-solid fa-user text-[13px] w-4 text-center"></i>
                <span class="text-xs font-medium">{{ t('todo.initiator') }}</span>
              </div>
              <p class="text-[13px] md:text-sm text-gray-900 pl-[22px]">{{ todo.initiatorId }}</p>
            </div>

            <div class="space-y-1">
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-regular fa-calendar-days text-[13px] w-4 text-center"></i>
                <span class="text-xs font-medium">{{ t('agent.createdAt') }}</span>
              </div>
              <p class="text-[13px] md:text-sm text-gray-900 pl-[22px]">{{ formatDate(todo.createdAt) }}</p>
            </div>

            <!-- 跟进人 -->
            <div class="space-y-1.5">
              <div class="flex items-center gap-1.5 text-gray-400">
                <i class="fa-solid fa-users text-[13px] w-4 text-center"></i>
                <span class="text-xs font-medium">{{ t('todo.followers') }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5 pl-[22px]">
                <template v-if="todo.followerIds && todo.followerIds.length > 0">
                  <span
                    v-for="followerId in todo.followerIds"
                    :key="followerId"
                    class="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                  >
                    {{ followerId }}
                  </span>
                </template>
                <span v-else class="text-xs text-gray-400 pl-[22px]">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：Tab切换 -->
      <div class="flex-1 flex flex-col overflow-visible md:overflow-hidden bg-white">
        <!-- Tab头部 -->
        <div class="border-b border-gray-100 px-4 md:px-8 pt-4 md:pt-6">
          <div class="flex gap-4 md:gap-8 overflow-x-auto hide-scrollbar">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="pb-4 text-sm font-medium transition-colors border-b-2 relative -mb-[1px]"
              :class="activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              <i :class="tab.icon" class="mr-2"></i>
              {{ t(tab.label) }}
            </button>
          </div>
        </div>

        <!-- Tab内容 -->
        <div class="flex-1 overflow-visible md:overflow-y-auto p-4 md:p-8">
          <!-- 基本信息编辑Tab -->
          <div v-if="activeTab === 'edit'" class="space-y-6 max-w-2xl">
            <!-- 待办名称 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('todo.form.title') }}
              </label>
              <input
                v-model="editForm.title"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            <!-- 描述 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('todo.form.description') }}
              </label>
              <textarea
                v-model="editForm.description"
                rows="2"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
              ></textarea>
            </div>

            <!-- 具体内容 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('todo.form.content') }}
              </label>
              <textarea
                v-model="editForm.content"
                rows="6"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none font-mono"
              ></textarea>
            </div>

            <!-- 跟进人 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('todo.form.followers') }}
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in followerOptions"
                  :key="option.id"
                  @click="toggleFollower(option.id)"
                  class="px-3 py-1.5 rounded-lg text-sm border transition-colors"
                  :class="editForm.followerIds.includes(option.id)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'"
                >
                  <i :class="option.icon" class="mr-1"></i>
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- 状态 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('todo.form.status') }}
              </label>
              <select
                v-model="editForm.status"
                class="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="pending">{{ t('todo.status.pending') }}</option>
                <option value="in_progress">{{ t('todo.status.inProgress') }}</option>
                <option value="failed">{{ t('todo.status.failed') }}</option>
                <option value="waiting_acceptance">{{ t('todo.status.waitingAcceptance') }}</option>
                <option value="completed">{{ t('todo.status.completed') }}</option>
              </select>
            </div>

            <!-- 保存按钮 -->
            <div class="flex items-center gap-3 pt-4">
              <button
                @click="handleSave"
                :disabled="saving"
                class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                {{ t('todo.form.save') }}
              </button>
              <button
                @click="emit('close')"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {{ t('todo.form.cancel') }}
              </button>
            </div>
          </div>

          <!-- 跟进记录Tab -->
          <div v-if="activeTab === 'followups'" class="space-y-4">
            <!-- 添加跟进按钮 -->
            <div class="flex justify-end">
              <button
                @click="showAddFollowup = true"
                class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <i class="fa-solid fa-plus"></i>
                {{ t('todo.followup.add') }}
              </button>
            </div>

            <!-- 跟进时间轴 -->
            <FollowupTimeline
              v-if="followups.length > 0"
              :followups="followups"
              @add-comment="handleAddComment"
            />

            <!-- 空状态 -->
            <div v-else class="text-center py-12">
              <i class="fa-solid fa-clock-rotate-left text-4xl text-gray-300 mb-4"></i>
              <p class="text-gray-400">{{ t('todo.followup.noRecords') }}</p>
            </div>

            <!-- 添加跟进弹窗 -->
            <AddFollowupModal
              v-if="showAddFollowup"
              :todo-id="todo.id"
              @close="showAddFollowup = false"
              @added="handleFollowupAdded"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title TodoDetail Component
 * @description 待办详情编辑页，包含左侧信息卡片和右侧Tab切换
 * @keywords-cn 待办详情, 面包屑, Tab切换, 左右分栏
 * @keywords-en todo-detail, breadcrumb, tabs, split-layout
 */
import { ref, reactive, onMounted, watch } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import type { TodoItem } from '../types/todo.types';
import { useTodos } from '../hooks/useTodos';
import FollowupTimeline from './FollowupTimeline.vue';
import AddFollowupModal from './AddFollowupModal.vue';

const { t } = useI18n();
const props = defineProps<{
  todo: TodoItem;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const { update, listFollowups, followups, createFollowup } = useTodos();

const activeTab = ref('edit');
const saving = ref(false);
const showAddFollowup = ref(false);

const tabs = [
  { id: 'edit', label: 'todo.detail.editInfo', icon: 'fa-solid fa-pen' },
  { id: 'followups', label: 'todo.detail.followupRecords', icon: 'fa-solid fa-clock-rotate-left' },
];

// 跟进人选项 - 从API获取
interface FollowerOption {
  id: string;
  label: string;
  icon: string;
}

const followerOptions = ref<FollowerOption[]>([]);

async function loadFollowerOptions() {
  try {
    // 获取用户列表
    const usersRes = await fetch('/api/identity/users', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      const users = usersData.data || [];
      const options: FollowerOption[] = users.map((u: any) => ({
        id: u.id,
        label: u.displayName || u.name || u.id,
        icon: 'fa-solid fa-user',
      }));
      followerOptions.value = options;
    }
  } catch {
    // 如果API失败，使用空数组
    followerOptions.value = [];
  }
}

// 编辑表单
const editForm = reactive({
  title: props.todo.title,
  description: props.todo.description || '',
  content: props.todo.content || '',
  followerIds: [...(props.todo.followerIds || [])],
  status: props.todo.status,
});

// 监听props.todo变化
watch(() => props.todo, (newTodo) => {
  editForm.title = newTodo.title;
  editForm.description = newTodo.description || '';
  editForm.content = newTodo.content || '';
  editForm.followerIds = [...(newTodo.followerIds || [])];
  editForm.status = newTodo.status;
}, { deep: true });

const toggleFollower = (id: string) => {
  const idx = editForm.followerIds.indexOf(id);
  if (idx === -1) {
    editForm.followerIds.push(id);
  } else {
    editForm.followerIds.splice(idx, 1);
  }
};

const handleSave = async () => {
  saving.value = true;
  try {
    await update(props.todo.id, {
      title: editForm.title,
      description: editForm.description || undefined,
      content: editForm.content || undefined,
      followerIds: editForm.followerIds,
      status: editForm.status as any,
    });
    emit('updated');
  } finally {
    saving.value = false;
  }
};

const handleFollowupAdded = async () => {
  showAddFollowup.value = false;
  await loadFollowups();
};

const loadFollowups = async () => {
  await listFollowups(props.todo.id);
};

const handleAddComment = (followupId: string) => {
  // 评论功能由FollowupTimeline内部处理
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

const formatDate = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

onMounted(() => {
  loadFollowups();
  loadFollowerOptions();
});
</script>

<style scoped>
.hide-scrollbar {
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
