<template>
  <!-- 添加跟进记录弹窗 -->
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 class="text-lg font-bold text-gray-900">{{ t('todo.followup.add') }}</h3>
        <button
          @click="emit('close')"
          class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 表单内容 -->
      <div class="p-6 space-y-4">
        <!-- 跟进人 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.followers') }} <span class="text-red-500">*</span>
            <span v-if="!isAdmin" class="text-xs text-gray-400 font-normal">({{ t('todo.followup.restrictedFollower') }})</span>
          </label>
          <select
            v-model="form.followerId"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">-- {{ t('todo.form.followers') }} --</option>
            <option v-for="option in followerOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- 状态 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.form.status') }} <span class="text-red-500">*</span>
          </label>
          <select
            v-model="form.status"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="pending">{{ t('todo.status.pending') }}</option>
            <option value="in_progress">{{ t('todo.status.inProgress') }}</option>
            <option value="failed">{{ t('todo.status.failed') }}</option>
            <option value="waiting_acceptance">{{ t('todo.status.waitingAcceptance') }}</option>
            <option value="completed">{{ t('todo.status.completed') }}</option>
          </select>
        </div>

        <!-- 跟进内容 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.content') }}
          </label>
          <textarea
            v-model="form.content"
            rows="4"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none font-mono"
            :placeholder="t('todo.followup.placeholder')"
          ></textarea>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          @click="handleSubmit"
          :disabled="submitting || !form.followerId || !form.status"
          class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i v-if="submitting" class="fa-solid fa-spinner fa-spin"></i>
          {{ t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title AddFollowupModal Component
 * @description 添加跟进记录弹窗
 * @keywords-cn 添加跟进, 弹窗
 * @keywords-en add-followup, modal
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import { useTodos } from '../hooks/useTodos';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import { useMemberships } from '../../identity/hooks/useMemberships';

const { t } = useI18n();
const props = defineProps<{
  todoId: string;
  followerIds: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'added'): void;
}>();

const { createFollowup } = useTodos();
const { list: listPrincipals } = usePrincipals();
const { list: listMemberships } = useMemberships();
const submitting = ref(false);
const isAdmin = ref(false);

// 跟进人选项 - 从API获取
interface FollowerOption {
  id: string;
  label: string;
  icon: string;
  avatarUrl?: string;
}

const followerOptions = ref<FollowerOption[]>([]);
const principalMap = ref<Record<string, any>>({});

async function loadFollowerOptions() {
  try {
    const principals = await listPrincipals();
    const pMap: Record<string, any> = {};
    (principals || []).forEach((p: any) => {
      pMap[p.id] = p;
    });
    principalMap.value = pMap;

    const allOptions = (principals || [])
      .filter((p: any) => ['user', 'agent'].includes(p.principalType))
      .map((p: any) => ({
        id: p.id,
        label: p.displayName || p.name || p.id,
        icon: p.principalType === 'agent' ? 'fa-solid fa-robot' : 'fa-solid fa-user',
        avatarUrl: p.avatarUrl,
      }));

    // 非管理员只能选择todo指定的跟进人
    if (!isAdmin.value) {
      followerOptions.value = allOptions.filter(opt => props.followerIds.includes(opt.id));
    } else {
      followerOptions.value = allOptions;
    }
  } catch {
    followerOptions.value = [];
  }
}

// 获取当前用户
function getCurrentUserId(): string {
  try {
    const principalRaw = localStorage.getItem('principal');
    if (principalRaw) {
      const parsed = JSON.parse(principalRaw);
      return parsed.id || '';
    }
  } catch {
    // ignore
  }
  return '';
}

// 检查当前用户是否是管理员
async function checkAdmin() {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const memberships = await listMemberships({ principalId: userId });
    isAdmin.value = memberships.some(m => m.role === 'admin' || m.role === 'owner');
  } catch {
    isAdmin.value = false;
  }
}

onMounted(async () => {
  await checkAdmin();
  await loadFollowerOptions();
});

const form = reactive({
  followerId: '',
  status: 'in_progress',
  content: '',
});

const handleSubmit = async () => {
  if (!form.followerId || !form.status) return;

  submitting.value = true;
  try {
    const selectedFollower = followerOptions.value.find(f => f.id === form.followerId);
    await createFollowup(props.todoId, {
      followerId: form.followerId,
      followerName: selectedFollower?.label || form.followerId,
      status: form.status,
      content: form.content || undefined,
    });
    emit('added');
  } finally {
    submitting.value = false;
  }
};
</script>
