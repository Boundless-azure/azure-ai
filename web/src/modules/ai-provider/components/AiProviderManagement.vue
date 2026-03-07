<template>
  <div class="space-y-4 h-full flex flex-col">
    <div class="pt-8 pb-6">
      <h2 class="text-2xl font-bold text-gray-900">AI提供商</h2>
      <p class="text-sm text-gray-500 mt-1">管理系统内所有模型配置</p>
    </div>

    <div class="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div class="flex-1 min-w-[200px]">
        <div class="relative">
          <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            v-model="query.q"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="搜索模型名称或显示名称"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>

      <div class="min-w-[150px]">
        <select
          v-model="query.provider"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <option value="">全部提供商</option>
          <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="min-w-[140px]">
        <select
          v-model="query.type"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <option value="">全部类型</option>
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="min-w-[140px]">
        <select
          v-model="query.status"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <option value="">全部状态</option>
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="min-w-[120px]">
        <select
          v-model="query.enabled"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <option value="">全部启用</option>
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>

      <button
        class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
        @click="handleSearch"
      >
        <i class="fa-solid fa-filter"></i>
        <span>筛选</span>
      </button>

      <div class="h-6 w-px bg-gray-200 mx-1"></div>

      <button
        class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
        @click="openCreateModal"
      >
        <i class="fa-solid fa-plus"></i>
        <span>新增模型</span>
      </button>
    </div>

    <div class="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16 text-gray-400">
        <i class="fa-solid fa-spinner fa-spin text-xl"></i>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 font-semibold text-gray-700">模型ID</th>
              <th class="px-6 py-3 font-semibold text-gray-700">显示名称</th>
              <th class="px-6 py-3 font-semibold text-gray-700">提供商</th>
              <th class="px-6 py-3 font-semibold text-gray-700">接口规范</th>
              <th class="px-6 py-3 font-semibold text-gray-700">类型</th>
              <th class="px-6 py-3 font-semibold text-gray-700">状态</th>
              <th class="px-6 py-3 font-semibold text-gray-700">启用</th>
              <th class="px-6 py-3 font-semibold text-gray-700">BaseURL</th>
              <th class="px-6 py-3 font-semibold text-gray-700 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in items" :key="item.id" class="hover:bg-gray-50">
              <td class="px-6 py-3 font-mono text-xs text-gray-700">
                {{ item.name }}
              </td>
              <td class="px-6 py-3 text-gray-900">
                {{ item.displayName || '-' }}
              </td>
              <td class="px-6 py-3 text-gray-600">
                {{ formatProvider(item.provider) }}
              </td>
              <td class="px-6 py-3 text-gray-600">
                {{ formatProtocol(item.apiProtocol) }}
              </td>
              <td class="px-6 py-3 text-gray-600">
                {{ formatType(item.type) }}
              </td>
              <td class="px-6 py-3">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="statusClass(item.status)"
                >
                  {{ formatStatus(item.status) }}
                </span>
              </td>
              <td class="px-6 py-3">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="item.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ item.enabled ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-6 py-3 text-gray-500">
                {{ item.baseURL || '-' }}
              </td>
              <td class="px-6 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                    @click="openEditModal(item)"
                  >
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button
                    class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                    @click="handleDelete(item)"
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td colspan="9" class="px-6 py-10 text-center text-gray-400">
                暂无模型配置
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeModal"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-[720px] max-w-[95vw] border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900">
              {{ isEdit ? '编辑模型' : '新增模型' }}
            </h3>
            <p class="text-sm text-gray-500">
              {{ isEdit ? '更新模型配置与密钥' : '添加新的模型配置' }}
            </p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="closeModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="p-6 overflow-y-auto space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">提供商</label>
              <select
                v-model="form.provider"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">接口规范</label>
              <select
                v-model="form.apiProtocol"
                :disabled="protocolDisabled"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option v-for="opt in protocolOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">模型ID</label>
              <input
                v-model="form.name"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 font-mono text-sm"
                placeholder="自定义模型ID"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
              <input
                v-model="form.displayName"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="用于界面显示的名称"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">类型</label>
              <select
                v-model="form.type"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select
                v-model="form.status"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                v-model="form.apiKey"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 font-mono text-sm"
                :placeholder="isEdit ? '留空表示不修改' : '请输入密钥'"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">BaseURL</label>
              <input
                v-model="form.baseURL"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="可选，OpenAI 兼容时可配置"
              />
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea
                v-model="form.description"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                rows="3"
                placeholder="描述模型用途"
              ></textarea>
            </div>
            <div class="h-10 px-3 rounded-lg border border-gray-200 flex items-center gap-3">
              <input
                id="ai-model-enabled"
                v-model="form.enabled"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20"
              />
              <label for="ai-model-enabled" class="text-sm text-gray-700">
                启用模型
              </label>
            </div>
          </div>

          <div
            v-if="testResult"
            class="px-3 py-2 rounded-lg text-sm"
            :class="testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
          >
            {{ testResult.message }}
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100" @click="closeModal">
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            :disabled="testingConnection"
            @click="handleTestConnection"
          >
            {{ testingConnection ? '测试中' : '连通测试' }}
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
            @click="handleSubmit"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title AI Provider Management
 * @description AI提供商模型管理页面，支持增删改查与筛选。
 * @keywords-cn AI提供商管理, 模型配置, 模型列表
 * @keywords-en ai-provider-management, model-config, model-list
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useAiProviders } from '../hooks/useAiProviders';
import type { AiModelItem } from '../types/ai-provider.types';
import {
  AI_MODEL_STATUS_OPTIONS,
  AI_MODEL_TYPE_OPTIONS,
  AI_PROTOCOL_OPTIONS,
  AI_PROVIDER_OPTIONS,
} from '../constants/ai-provider.constants';

const { items, loading, list, create, update, remove, testConnection } =
  useAiProviders();

const query = reactive({
  q: '',
  provider: '',
  type: '',
  status: '',
  enabled: '',
});

const showModal = ref(false);
const isEdit = ref(false);
const form = reactive({
  id: '',
  name: '',
  displayName: '',
  provider: 'openai',
  apiProtocol: 'openai',
  type: 'chat',
  status: 'active',
  apiKey: '',
  baseURL: '',
  description: '',
  enabled: true,
});

const testingConnection = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);

const providerOptions = AI_PROVIDER_OPTIONS;
const protocolOptions = AI_PROTOCOL_OPTIONS;
const typeOptions = AI_MODEL_TYPE_OPTIONS;
const statusOptions = AI_MODEL_STATUS_OPTIONS;

const protocolDisabled = computed(() => form.provider !== 'custom');

const providerProtocolMap: Record<string, 'openai' | 'anthropic'> = {
  anthropic: 'anthropic',
};

function resolveProtocol(provider: string): 'openai' | 'anthropic' {
  return providerProtocolMap[provider] ?? 'openai';
}

watch(
  () => form.provider,
  (provider) => {
    if (provider !== 'custom') {
      form.apiProtocol = resolveProtocol(provider);
    }
    testResult.value = null;
  },
);

function formatProvider(value: string) {
  return providerOptions.find((i) => i.value === value)?.label || value;
}

function formatProtocol(value: string) {
  return protocolOptions.find((i) => i.value === value)?.label || value;
}

function formatType(value: string) {
  return typeOptions.find((i) => i.value === value)?.label || value;
}

function formatStatus(value: string) {
  return statusOptions.find((i) => i.value === value)?.label || value;
}

function statusClass(value: string) {
  if (value === 'active') return 'bg-green-100 text-green-700';
  if (value === 'inactive') return 'bg-gray-100 text-gray-600';
  if (value === 'deprecated') return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
}

async function fetchData() {
  await list({
    q: query.q || undefined,
    provider: query.provider || undefined,
    type: query.type || undefined,
    status: query.status || undefined,
    enabled: query.enabled === '' ? undefined : query.enabled === 'true',
  });
}

function handleSearch() {
  fetchData();
}

function openCreateModal() {
  isEdit.value = false;
  form.id = '';
  form.name = '';
  form.provider = 'openai';
  form.apiProtocol = resolveProtocol('openai');
  form.type = 'chat';
  form.status = 'active';
  form.apiKey = '';
  form.baseURL = '';
  form.displayName = '';
  form.description = '';
  form.enabled = true;
  testResult.value = null;
  showModal.value = true;
}

function openEditModal(item: AiModelItem) {
  isEdit.value = true;
  form.id = item.id;
  form.name = item.name;
  form.displayName = item.displayName || '';
  form.provider = providerOptions.some((i) => i.value === item.provider)
    ? item.provider
    : 'custom';
  form.apiProtocol =
    item.apiProtocol === 'anthropic'
      ? 'anthropic'
      : resolveProtocol(form.provider);
  form.type = item.type;
  form.status = item.status;
  form.apiKey = '';
  form.baseURL = item.baseURL || '';
  form.description = item.description || '';
  form.enabled = item.enabled;
  testResult.value = null;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  testResult.value = null;
}

async function handleSubmit() {
  if (!form.name.trim()) return;
  if (!form.provider) return;
  if (!form.type) return;
  if (!isEdit.value && !form.apiKey.trim()) return;

  if (isEdit.value) {
    const payload: Record<string, unknown> = {
      name: form.name,
      displayName: form.displayName || null,
      provider: form.provider,
      apiProtocol: form.apiProtocol,
      type: form.type,
      status: form.status,
      baseURL: form.baseURL || null,
      description: form.description || null,
      enabled: form.enabled,
    };
    if (form.apiKey && form.apiKey.trim()) {
      payload.apiKey = form.apiKey.trim();
    }
    await update(form.id, payload);
  } else {
    await create({
      name: form.name,
      displayName: form.displayName || null,
      provider: form.provider,
      apiProtocol: form.apiProtocol,
      type: form.type,
      status: form.status,
      apiKey: form.apiKey,
      baseURL: form.baseURL || null,
      description: form.description || null,
      enabled: form.enabled,
    });
  }
  closeModal();
  fetchData();
}

async function handleTestConnection() {
  if (!form.apiKey.trim()) {
    testResult.value = { ok: false, message: '请先填写 API Key' };
    return;
  }
  if (!form.name.trim()) {
    testResult.value = { ok: false, message: '请先填写模型ID' };
    return;
  }
  const protocol: 'openai' | 'anthropic' =
    form.apiProtocol === 'anthropic' ? 'anthropic' : 'openai';
  testingConnection.value = true;
  try {
    const result = await testConnection({
      provider: form.provider,
      apiProtocol: protocol,
      apiKey: form.apiKey.trim(),
      baseURL: form.baseURL || null,
      modelId: form.name.trim(),
    });
    testResult.value = { ok: result.ok, message: result.message };
  } finally {
    testingConnection.value = false;
  }
}

async function handleDelete(item: AiModelItem) {
  if (!confirm(`确认删除模型 "${item.displayName || item.name}" 吗？`)) return;
  await remove(item.id);
  fetchData();
}

onMounted(() => {
  fetchData();
});
</script>
