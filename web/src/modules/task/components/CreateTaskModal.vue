<template>
  <BaseModal :open="true" title="新建任务" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">任务名称 <span class="text-red-500">*</span></label>
        <input
          v-model="form.title"
          type="text"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          placeholder="输入任务名称"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">任务描述</label>
        <textarea
          v-model="form.description"
          rows="3"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
          placeholder="输入任务描述"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">任务里程碑</label>
          <input
            v-model="form.milestone"
            type="text"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="例如：MVP 上线"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">所属 Session</label>
          <input
            v-model="form.sessionId"
            type="text"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="可选，填写 sessionId"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">任务 PM</label>
        <select
          v-model="form.pmId"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
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
            :class="form.assigneeIds.includes(option.id)
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
          <input
            v-model="form.folderPath"
            type="text"
            class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="例如：/workspace/project-a"
          />
          <button
            @click="showFolderPicker = true"
            class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            选择文件夹
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        @click="emit('close')"
        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
      >
        取消
      </button>
      <button
        @click="handleSubmit"
        :disabled="submitting || !form.title.trim()"
        class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <i v-if="submitting" class="fa-solid fa-spinner fa-spin"></i>
        创建任务
      </button>
    </template>

    <TaskFolderPickerModal
      v-if="showFolderPicker"
      :initial-path="form.folderPath || '/'"
      @close="showFolderPicker = false"
      @selected="handleFolderSelected"
    />
  </BaseModal>
</template>

<script setup lang="ts">
/**
 * @title CreateTaskModal
 * @description 新建任务弹窗。
 * @keywords-cn 新建任务, 任务弹窗, 任务表单
 * @keywords-en create-task-modal, task-form, task-dialog
 */
import { onMounted, reactive, ref } from 'vue';
import BaseModal from '../../../components/BaseModal.vue';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import { useTasks } from '../hooks/useTasks';
import TaskFolderPickerModal from './TaskFolderPickerModal.vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const { create } = useTasks();
const { list: listPrincipals } = usePrincipals();

const submitting = ref(false);
const showFolderPicker = ref(false);

const form = reactive({
  title: '',
  description: '',
  assigneeIds: [] as string[],
  milestone: '',
  pmId: '',
  folderPath: '',
  sessionId: '',
});

const principalOptions = ref<Array<{ id: string; label: string }>>([]);

/**
 * @title 加载主体选项
 * @description 读取可用的用户/Agent 主体。
 * @keyword-en load-task-principals
 */
async function loadPrincipalOptions() {
  try {
    const principals = await listPrincipals();
    principalOptions.value = (principals || [])
      .filter((item: any) => ['user', 'agent'].includes(item.principalType))
      .map((item: any) => ({
        id: item.id,
        label: item.displayName || item.name || item.id,
      }));
  } catch {
    principalOptions.value = [];
  }
}

/**
 * @title 切换关联人
 * @description 在多选集合中添加或移除关联人。
 * @keyword-en toggle-task-assignee
 */
function toggleAssignee(id: string) {
  const index = form.assigneeIds.indexOf(id);
  if (index === -1) {
    form.assigneeIds.push(id);
    return;
  }
  form.assigneeIds.splice(index, 1);
}

/**
 * @title 处理文件夹选择
 * @description 写回选中的文件夹路径。
 * @keyword-en handle-task-folder-selected
 */
function handleFolderSelected(path: string) {
  form.folderPath = path;
  showFolderPicker.value = false;
}

/**
 * @title 提交任务
 * @description 调用任务创建接口。
 * @keyword-en submit-create-task
 */
async function handleSubmit() {
  if (!form.title.trim()) return;
  submitting.value = true;
  try {
    await create({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assigneeIds: form.assigneeIds.length ? [...form.assigneeIds] : undefined,
      milestone: form.milestone.trim() || undefined,
      pmId: form.pmId || undefined,
      folderPath: form.folderPath.trim() || undefined,
      sessionId: form.sessionId.trim() || undefined,
    });
    emit('created');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadPrincipalOptions();
});
</script>
