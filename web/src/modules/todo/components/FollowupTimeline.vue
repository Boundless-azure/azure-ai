<template>
  <!-- 跟进时间轴 -->
  <div class="relative">
    <!-- 时间轴线 -->
    <div class="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

    <!-- 跟进记录列表 -->
    <div class="space-y-6">
      <div
        v-for="(followup, index) in followups"
        :key="followup.id"
        class="relative flex gap-4"
      >
        <!-- 时间轴节点 -->
        <div
          class="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0 z-10"
        >
          <div
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: getStatusColor(followup.status) }"
          ></div>
        </div>

        <!-- 跟进内容卡片 -->
        <div class="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <!-- 卡片头部 -->
          <div class="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <!-- 跟进人头像 -->
              <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 overflow-hidden cursor-help" :title="followup.followerName || followup.followerId">
                <img v-if="followup.followerAvatar" :src="resolveResourceUrl(followup.followerAvatar)" class="w-full h-full object-cover" />
                <span v-else>{{ getInitials(followup.followerName || followup.followerId) }}</span>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ followup.followerName || followup.followerId }}</p>
                <p class="text-xs text-gray-400">{{ formatDate(followup.createdAt) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="statusClass(followup.status)"
              >
                {{ t(`todo.status.${followup.status}`) }}
              </span>
              <!-- 编辑按钮 -->
              <button
                @click="emit('edit', followup)"
                class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                :title="t('common.edit')"
              >
                <i class="fa-solid fa-pen-to-square text-sm"></i>
              </button>
            </div>
          </div>

          <!-- 跟进内容 -->
          <div v-if="followup.content" class="p-4">
            <div class="prose prose-sm max-w-none text-gray-700 markdown-content" v-html="renderMarkdown(followup.content)"></div>
          </div>

          <!-- 评论区域 -->
          <div class="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <!-- 展开/收起评论 -->
            <button
              @click="toggleComments(followup.id)"
              class="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <i :class="expandedComments.has(followup.id) ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
              {{ t('todo.comment.title') }} ({{ followup.comments?.length || 0 }})
            </button>

            <!-- 评论列表 -->
            <div v-if="expandedComments.has(followup.id)" class="mt-3 space-y-2">
              <CommentList
                :comments="followup.comments || []"
                :followup-id="followup.id"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title FollowupTimeline Component
 * @description 跟进记录竖向时间轴展示组件
 * @keywords-cn 跟进时间轴, 竖向时间轴, 跟进记录
 * @keywords-en followup-timeline, vertical-timeline, followup-records
 */
import { ref } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import type { TodoFollowup } from '../types/todo.types';
import CommentList from './CommentList.vue';

const { t } = useI18n();

defineProps<{
  followups: TodoFollowup[];
}>();

const emit = defineEmits<{
  (e: 'add-comment', followupId: string): void;
  (e: 'edit', followup: TodoFollowup): void;
}>();

const expandedComments = ref(new Set<string>());

const toggleComments = (followupId: string) => {
  if (expandedComments.value.has(followupId)) {
    expandedComments.value.delete(followupId);
  } else {
    expandedComments.value.add(followupId);
  }
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

const getInitials = (name: string | null): string => {
  if (!name) return '?';
  if (name.startsWith('user-') || name.startsWith('agent-')) {
    return name.slice(-2).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 简单的Markdown渲染（实际项目中应使用marked库）
const renderMarkdown = (content: string): string => {
  if (!content) return '';
  // 基础转换：标题
  let html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-3 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-4 mb-2">$1</h1>')
    // 列表
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 换行
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br />');

  // 包裹在p标签中
  if (!html.startsWith('<')) {
    html = `<p class="my-2">${html}</p>`;
  }

  return html;
};
</script>

<style scoped>
.prose {
  line-height: 1.6;
}
.prose h1, .prose h2, .prose h3 {
  font-weight: 600;
}
.prose li {
  list-style-type: disc;
}
</style>
