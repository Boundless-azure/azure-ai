<template>
  <!-- 新建待办弹窗 -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 class="text-lg font-bold text-gray-900">{{ t('todo.create') }}</h3>
        <button
          @click="emit('close')"
          class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 表单内容 -->
      <div class="p-6 space-y-4">
        <!-- 待办名称 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.form.title') }} <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.title"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            :placeholder="t('todo.form.title')"
          />
        </div>

        <!-- 描述说明 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.form.description') }}
          </label>
          <textarea
            v-model="form.description"
            rows="2"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            :placeholder="t('todo.form.description')"
          ></textarea>
        </div>

        <!-- 具体内容 (Markdown) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.form.content') }}
          </label>
          <textarea
            v-model="form.content"
            rows="4"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none font-mono"
            placeholder="# 待办内容&#10;&#10;在这里填写详细内容..."
          ></textarea>
        </div>

        <!-- 跟进人选择 -->
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
              :class="form.followerIds.includes(option.id)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'"
            >
              <i :class="option.icon" class="mr-1"></i>
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- 状态颜色 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('todo.form.status') }}
          </label>
          <div class="flex items-center gap-3">
            <button
              v-for="color in statusColors"
              :key="color.value"
              @click="form.statusColor = color.value"
              class="w-8 h-8 rounded-full border-2 transition-transform"
              :class="form.statusColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'"
              :style="{ backgroundColor: color.value }"
              :title="color.label"
            ></button>
            <input
              type="color"
              v-model="form.statusColor"
              class="w-8 h-8 rounded cursor-pointer"
            />
          </div>
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
          :disabled="submitting || !form.title"
          class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i v-if="submitting" class="fa-solid fa-spinner fa-spin"></i>
          {{ t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title CreateTodoModal Component
 * @description 新建待办事项弹窗表单
 * @keywords-cn 新建待办, 弹窗表单
 * @keywords-en create-todo, modal-form
 */
import { ref, reactive } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import { useTodos } from '../hooks/useTodos';
import { usePrincipals } from '../../identity/hooks/usePrincipals';

const { t } = useI18n();
const { create } = useTodos();
const { list: listPrincipals } = usePrincipals();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const submitting = ref(false);

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

const currentUser = getCurrentUser();

const form = reactive({
  title: '',
  description: '',
  content: '',
  followerIds: [] as string[],
  statusColor: '#6B7280',
});

// 跟进人选项 - 从API获取
interface FollowerOption {
  id: string;
  label: string;
  icon: string;
}

const followerOptions = ref<FollowerOption[]>([]);

async function loadFollowerOptions() {
  try {
    const principals = await listPrincipals();
    followerOptions.value = (principals || [])
      .filter((p: any) => ['user', 'agent'].includes(p.principalType))
      .map((p: any) => ({
        id: p.id,
        label: p.displayName || p.name || p.id,
        icon: p.principalType === 'agent' ? 'fa-solid fa-robot' : 'fa-solid fa-user',
      }));
  } catch {
    followerOptions.value = [];
  }
}

loadFollowerOptions();

// 状态颜色选项
const statusColors = [
  { value: '#6B7280', label: '灰色' },
  { value: '#3B82F6', label: '蓝色' },
  { value: '#10B981', label: '绿色' },
  { value: '#F59E0B', label: '橙色' },
  { value: '#EF4444', label: '红色' },
];

const toggleFollower = (id: string) => {
  const idx = form.followerIds.indexOf(id);
  if (idx === -1) {
    form.followerIds.push(id);
  } else {
    form.followerIds.splice(idx, 1);
  }
};

const handleSubmit = async () => {
  if (!form.title) return;

  submitting.value = true;
  try {
    await create({
      initiatorId: currentUser.id,
      title: form.title,
      description: form.description || undefined,
      content: form.content || undefined,
      followerIds: form.followerIds.length > 0 ? form.followerIds : undefined,
      statusColor: form.statusColor,
      status: 'pending',
    });
    emit('created');
  } finally {
    submitting.value = false;
  }
};
</script>
