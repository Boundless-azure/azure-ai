<template>
  <!-- Runner 控制面板 -->
  <RunnerProxyPage v-if="viewRef === 'proxy'" :runner-id="selectedRunnerId" :on-back="handleBack" />

  <!-- Runner 管理列表 -->
  <div v-else class="space-y-4 h-full flex flex-col">
    <div class="pt-8 pb-6">
      <h2 class="text-2xl font-bold text-gray-900">Runner 管理</h2>
      <p class="text-sm text-gray-500 mt-1">管理 Runner 实例、绑定主体与在线状态</p>
    </div>

    <div
      class="flex flex-col md:flex-row md:items-center gap-3 bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm"
    >
      <div class="flex-1 w-full md:w-auto md:min-w-[220px]">
        <div class="relative">
          <i
            class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          ></i>
          <input
            v-model="keyword"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="搜索 Runner 别名"
            @keyup.enter="reload"
          />
        </div>
      </div>

      <div class="md:min-w-[120px]">
        <select
          v-model="status"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <option value="">全部状态</option>
          <option value="mounted">挂载中</option>
          <option value="offline">离线中</option>
        </select>
      </div>

      <button
        class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        @click="reload"
      >
        <i class="fa-solid fa-filter"></i>
        <span>筛选</span>
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        @click="openCreate"
      >
        <i class="fa-solid fa-plus"></i>
        <span>新增</span>
      </button>
    </div>

    <div
      v-if="latestCreatedKey"
      class="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-800 break-all"
    >
      新创建 Runner Key：{{ latestCreatedKey }}
    </div>

    <div class="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        v-if="loading"
        class="flex items-center justify-center py-16 text-gray-400"
      >
        <i class="fa-solid fa-spinner fa-spin text-xl"></i>
      </div>
      <div v-else>
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>
                <th class="px-6 py-3 font-semibold text-gray-700">Runner ID</th>
                <th class="px-6 py-3 font-semibold text-gray-700">别名</th>
                <th class="px-6 py-3 font-semibold text-gray-700">主体 ID</th>
                <th class="px-6 py-3 font-semibold text-gray-700">Runner Key</th>
                <th class="px-6 py-3 font-semibold text-gray-700">描述</th>
                <th class="px-6 py-3 font-semibold text-gray-700">状态</th>
                <th class="px-6 py-3 font-semibold text-gray-700">启用</th>
                <th class="px-6 py-3 font-semibold text-gray-700 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="item in paginatedItems"
                :key="item.id"
                class="hover:bg-gray-50"
              >
                <td class="px-6 py-3 font-mono text-xs text-gray-700">
                  {{ item.id }}
                </td>
                <td class="px-6 py-3 text-gray-900">{{ item.alias }}</td>
                <td class="px-6 py-3 font-mono text-xs text-gray-600">
                  {{ item.principalId }}
                </td>
                <td class="px-6 py-3 text-gray-600">
                  <button
                    class="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    :disabled="!canOpenRunnerKey(item)"
                    @click="openKeyDialog(item)"
                  >
                    <i class="fa-solid fa-key"></i>
                    <span>{{ canOpenRunnerKey(item) ? '查看' : '-' }}</span>
                  </button>
                </td>
                <td class="px-6 py-3 text-gray-600">
                  {{ item.description || '-' }}
                </td>
                <td class="px-6 py-3">
                  <span
                    class="px-2 py-1 rounded-full text-xs font-medium"
                    :class="statusClass(item.status)"
                  >
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <td class="px-6 py-3">
                  <span
                    class="px-2 py-1 rounded-full text-xs font-medium"
                    :class="item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                  >
                    {{ item.active ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="px-6 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="编辑"
                      @click="openEdit(item)"
                    >
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button
                      class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                      @click="removeItem(item.id)"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                    <button
                      class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="控制面板"
                      @click="openProxyPanel(item)"
                    >
                      <i class="fa-solid fa-gears"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="paginatedItems.length === 0">
                <td colspan="8" class="px-6 py-10 text-center text-gray-400">
                  暂无 Runner
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination (Desktop) -->
        <div class="hidden md:flex px-6 py-4 border-t border-gray-100 items-center justify-between" v-if="items.length > 0">
          <span class="text-sm text-gray-500">共 {{ items.length }} 条记录</span>
          <div class="flex items-center gap-2">
            <button 
              class="px-3 py-1 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="page <= 1"
              @click="page--"
            >
              上一页
            </button>
            <span class="text-sm text-gray-700 font-medium px-2">{{ page }} / {{ Math.ceil(items.length / limit) || 1 }}</span>
            <button 
              class="px-3 py-1 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="page * limit >= items.length"
              @click="page++"
            >
              下一页
            </button>
          </div>
        </div>

        <div class="md:hidden p-4 space-y-4">
          <div
            v-for="item in paginatedItems"
            :key="item.id"
            class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="font-medium text-gray-900">{{ item.alias }}</div>
                <div class="font-mono text-xs text-gray-500 mt-1">{{ item.id }}</div>
              </div>
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="statusClass(item.status)"
              >
                {{ statusLabel(item.status) }}
              </span>
            </div>
            <div class="mt-3 text-xs text-gray-600 space-y-1">
              <div>主体：{{ item.principalId }}</div>
              <div class="inline-flex items-center gap-2">
                <span>Runner Key：</span>
                <button
                  class="inline-flex items-center gap-1 text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                  :disabled="!canOpenRunnerKey(item)"
                  @click="openKeyDialog(item)"
                >
                  <i class="fa-solid fa-key"></i>
                  <span>{{ canOpenRunnerKey(item) ? '查看' : '-' }}</span>
                </button>
              </div>
              <div>描述：{{ item.description || '-' }}</div>
              <div>启用：{{ item.active ? '是' : '否' }}</div>
            </div>
            <div class="flex justify-end gap-2 border-t border-gray-100 mt-3 pt-3">
              <button
                class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg"
                @click="openEdit(item)"
              >
                编辑
              </button>
              <button
                class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg"
                @click="removeItem(item.id)"
              >
                删除
              </button>
              <button
                class="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg"
                @click="openProxyPanel(item)"
              >
                控制面板
              </button>
            </div>
          </div>
          <div v-if="paginatedItems.length === 0" class="text-center text-gray-400 py-8">
            暂无 Runner
          </div>

          <!-- Mobile Pagination Info -->
          <div class="flex justify-between items-center pt-2 px-2" v-if="items.length > 0">
            <span class="text-xs text-gray-500">共 {{ items.length }} 条</span>
            <div class="flex gap-2">
              <button 
                class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white disabled:opacity-50"
                :disabled="page <= 1"
                @click="page--"
              >
                上一页
              </button>
              <span class="text-xs flex items-center bg-white px-2 rounded-lg border border-gray-200">{{ page }} / {{ Math.ceil(items.length / limit) || 1 }}</span>
              <button 
                class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white disabled:opacity-50"
                :disabled="page * limit >= items.length"
                @click="page++"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BaseModal
      :open="showDialog"
      :title="editingId ? '编辑 Runner' : '新增 Runner'"
      :subtitle="editingId ? '更新 Runner 信息与可用状态' : '创建新 Runner 并生成绑定密钥'"
      size="lg"
      @close="showDialog = false"
    >
      <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Runner 别名</label>
              <input
                v-model="form.alias"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="请输入 Runner 别名"
              />
            </div>
            <div v-if="!editingId">
              <label class="block text-sm font-medium text-gray-700 mb-1">主体显示名</label>
              <input
                v-model="form.principalDisplayName"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="可选，默认同 Runner 别名"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              v-model="form.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 min-h-[110px]"
              placeholder="描述 Runner 用途或绑定环境"
            />
          </div>

        <label
          v-if="editingId"
          class="text-sm text-gray-700 inline-flex items-center gap-2"
        >
          <input type="checkbox" v-model="form.active" />
          启用该 Runner
        </label>
      </div>

      <template #footer>
        <button
          class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          @click="showDialog = false"
        >
          取消
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          @click="submit"
        >
          保存
        </button>
      </template>
    </BaseModal>

    <BaseModal
      :open="showKeyDialog"
      title="Runner Key"
      :subtitle="keyDialogAlias || '-'"
      size="md"
      @close="closeKeyDialog"
    >
      <div class="space-y-3">
          <div
            class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-mono break-all"
          >
            {{ keyVisible ? keyDialogValue : maskedKey }}
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
              @click="keyVisible = !keyVisible"
            >
              <i :class="keyVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              <span>{{ keyVisible ? '隐藏' : '查看' }}</span>
            </button>
            <button
              class="px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 inline-flex items-center gap-2 disabled:bg-gray-300"
              :disabled="!keyDialogValue"
              @click="copyRunnerKey"
            >
              <i class="fa-regular fa-copy"></i>
              <span>复制</span>
            </button>
          <span v-if="copyNotice" class="text-xs text-green-700">{{ copyNotice }}</span>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
/**
 * @title RunnerManagement
 * @description Runner 管理组件，提供 Runner 增删改查与 key 展示。
 * @keywords-cn Runner管理, CRUD, Key展示
 * @keywords-en runner-management, crud, key-display
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BaseModal from '../../../components/BaseModal.vue';
import { RUNNER_STATUS_LABEL } from '../constants/runner.constants';
import { useRunners } from '../hooks/useRunners';
import { useRightPanelStore } from '../../agent/store/right-panel.store';
import type { RunnerItem } from '../types/runner.types';
import RunnerProxyPage from '../pages/RunnerProxyPage.vue';

const props = defineProps<{
  subView?: 'proxy';
  runnerId?: string;
}>();

const { items, loading, latestCreatedKey, list, create, update, remove } = useRunners();

const keyword = ref('');
const status = ref('');
const showDialog = ref(false);
const editingId = ref<string | null>(null);
const showKeyDialog = ref(false);
const keyDialogValue = ref('');
const keyDialogAlias = ref('');
const keyVisible = ref(false);
const copyNotice = ref('');
const rightPanelStore = useRightPanelStore();

const page = ref(1);
const limit = ref(10);
const selectedRunnerId = ref('');

// 内部视图状态：'list' | 'proxy'
const viewRef = ref<'list' | 'proxy'>(props.subView === 'proxy' ? 'proxy' : 'list');

// 监听外部 subView 变化（如通过 openTab 传入新 props）
watch(() => props.subView, (val) => {
  viewRef.value = val === 'proxy' ? 'proxy' : 'list';
});

const paginatedItems = computed(() => {
  const start = (page.value - 1) * limit.value;
  return items.value?.slice(start, start + limit.value) || [];
});

const form = reactive<{
  alias: string;
  description: string;
  principalDisplayName: string;
  active: boolean;
}>({
  alias: '',
  description: '',
  principalDisplayName: '',
  active: true,
});

const statusLabel = (statusValue: RunnerItem['status']) => {
  if (statusValue === 'mounted') return RUNNER_STATUS_LABEL.mounted;
  if (statusValue === 'offline') return RUNNER_STATUS_LABEL.offline;
  return statusValue;
};

const statusClass = (statusValue: RunnerItem['status']) => {
  if (statusValue === 'mounted') return 'bg-blue-100 text-blue-700';
  if (statusValue === 'offline') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-600';
};

const reload = async () => {
  page.value = 1;
  await list({ q: keyword.value || undefined, status: status.value || undefined });
};

const canOpenRunnerKey = (item: RunnerItem) =>
  typeof item.runnerKey === 'string' && item.runnerKey.trim() !== '-' && item.runnerKey.trim() !== '';

const openKeyDialog = (item: RunnerItem) => {
  if (!canOpenRunnerKey(item)) return;
  keyDialogValue.value = item.runnerKey;
  keyDialogAlias.value = item.alias;
  keyVisible.value = false;
  copyNotice.value = '';
  showKeyDialog.value = true;
};

const closeKeyDialog = () => {
  showKeyDialog.value = false;
  keyDialogValue.value = '';
  keyDialogAlias.value = '';
  keyVisible.value = false;
  copyNotice.value = '';
};

const maskedKey = computed(() => {
  if (!keyDialogValue.value) return '-';
  return '•'.repeat(Math.max(12, keyDialogValue.value.length));
});

const copyRunnerKey = async () => {
  if (!keyDialogValue.value) return;
  try {
    await navigator.clipboard.writeText(keyDialogValue.value);
    copyNotice.value = '已复制';
  } catch {
    copyNotice.value = '复制失败';
  }
};

const openCreate = () => {
  editingId.value = null;
  form.alias = '';
  form.description = '';
  form.principalDisplayName = '';
  form.active = true;
  showDialog.value = true;
};

const openEdit = (item: RunnerItem) => {
  editingId.value = item.id;
  form.alias = item.alias;
  form.description = item.description ?? '';
  form.active = item.active;
  showDialog.value = true;
};

const submit = async () => {
  if (!form.alias.trim()) return;
  if (editingId.value) {
    await update(editingId.value, {
      alias: form.alias.trim(),
      description: form.description || undefined,
      active: form.active,
    });
    showDialog.value = false;
    return;
  }
  await create({
    alias: form.alias.trim(),
    description: form.description || undefined,
    principalDisplayName: form.principalDisplayName || undefined,
  });
  showDialog.value = false;
};

const removeItem = async (id: string) => {
  await remove(id);
};

const openProxyPanel = (item: RunnerItem) => {
  selectedRunnerId.value = item.id;
  viewRef.value = 'proxy';
};

const handleBack = () => {
  selectedRunnerId.value = '';
  viewRef.value = 'list';
};

onMounted(async () => {
  await reload();
});
</script>
