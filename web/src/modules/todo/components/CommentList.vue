<template>
  <!-- 评论列表 -->
  <div class="space-y-2">
    <!-- 评论列表 -->
    <div v-for="comment in comments" :key="comment.id" class="flex gap-2">
      <!-- 评论人头像 -->
      <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
        {{ getInitials(comment.userName || comment.userId) }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class="text-xs font-medium text-gray-900">{{ comment.userName || comment.userId }}</span>
          <span class="text-xs text-gray-400">{{ formatDate(comment.createdAt) }}</span>
        </div>
        <p class="text-sm text-gray-700 mt-0.5">{{ comment.content }}</p>
      </div>
    </div>

    <!-- 空状态 -->
    <p v-if="comments.length === 0" class="text-xs text-gray-400 text-center py-2">
      {{ t('todo.comment.noComments') }}
    </p>

    <!-- 添加评论 -->
    <div class="flex gap-2 pt-2 border-t border-gray-100">
      <input
        v-model="newComment"
        type="text"
        class="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        :placeholder="t('todo.comment.placeholder')"
        @keyup.enter="handleAddComment"
      />
      <button
        @click="handleAddComment"
        :disabled="!newComment.trim()"
        class="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title CommentList Component
 * @description 评论列表组件，支持展示和添加评论
 * @keywords-cn 评论列表, 评论, 添加评论
 * @keywords-en comment-list, comment, add-comment
 */
import { ref } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import type { TodoFollowupComment } from '../types/todo.types';
import { useTodos } from '../hooks/useTodos';

const { t } = useI18n();

const props = defineProps<{
  comments: TodoFollowupComment[];
  followupId: string;
}>();

const { createComment } = useTodos();
const newComment = ref('');

// 获取当前用户信息
function getCurrentUser(): { id: string; name: string } {
  try {
    const principalRaw = localStorage.getItem('principal');
    if (principalRaw) {
      const parsed = JSON.parse(principalRaw);
      return {
        id: parsed.id || 'unknown',
        name: parsed.displayName || parsed.name || '未知用户',
      };
    }
  } catch {
    // ignore
  }
  return { id: 'unknown', name: '未知用户' };
}

const handleAddComment = async () => {
  if (!newComment.value.trim()) return;

  try {
    const currentUser = getCurrentUser();
    await createComment(props.followupId, {
      userId: currentUser.id,
      userName: currentUser.name,
      content: newComment.value.trim(),
    });
    newComment.value = '';
  } catch (e) {
    console.error('Failed to add comment:', e);
  }
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
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  // 少于1分钟显示"刚刚"
  if (diff < 60000) return '刚刚';
  // 少于1小时显示"X分钟前"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  // 少于24小时显示"X小时前"
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;

  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};
</script>
