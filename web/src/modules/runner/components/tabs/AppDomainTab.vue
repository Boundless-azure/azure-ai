<!--
  @title AppDomainTab Component
  @description Runner 应用域名绑定管理（增删改查）。域名从域名管理数据选择，应用从 Runner 接口选择。
  @keywords-cn 应用域名管理, 增删改查, 域名选择, 应用绑定
  @keywords-en app-domain-tab, crud, domain-select, app-binding
-->
<template>
  <div class="space-y-4">
    <!-- 操作栏区域 -->
    <div class="flex justify-end">
      <button
        @click="openAddModal"
        class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
      >
        <i class="fa-solid fa-plus"></i>
        添加绑定
      </button>
    </div>

    <!-- 应用域名绑定表格区域 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">绑定域名</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">路径</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">关联应用</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="binding in bindings" :key="binding.domain">
            <td class="px-4 py-3 text-sm text-gray-900">{{ binding.domain }}</td>
            <td class="px-4 py-3 text-xs text-gray-500 font-mono">{{ binding.pathPattern || '/' }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ getAppName(binding.appId) || '-' }}</td>
            <td class="px-4 py-3 text-sm">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="binding.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ binding.active !== false ? '活跃' : '停用' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm flex justify-end gap-3">
              <button @click="openEditModal(binding)" class="text-blue-600 hover:text-blue-800">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button @click="handleDelete(binding)" class="text-red-600 hover:text-red-800">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="bindings.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
              暂无应用域名绑定
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/编辑弹窗区域 -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showModal = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-bold mb-4">{{ editTarget ? '编辑绑定' : '添加绑定' }}</h3>
        <div class="space-y-4">
          <!-- 域名选择区域：从域名管理的数据中选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">绑定域名</label>
            <select
              v-model="form.domain"
              :disabled="!!editTarget"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50"
            >
              <option value="" disabled>请选择域名</option>
              <option v-for="d in availableDomains" :key="d.id" :value="d.domain">
                {{ d.domain }}
              </option>
            </select>
          </div>
          <!-- 路径规则输入区域 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">路径 (path)</label>
            <input
              v-model="form.pathPattern"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="/"
            />
          </div>
          <!-- 应用选择区域：从 Runner 应用接口选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">关联应用</label>
            <select
              v-model="form.appId"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="">不关联</option>
              <option v-for="app in runnerApps" :key="app.appId" :value="app.appId">
                {{ app.name }} ({{ app.appPort }})
              </option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showModal = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            取消
          </button>
          <button
            @click="handleSubmit"
            :disabled="saving"
            class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            <span v-if="saving"><i class="fa-solid fa-spinner fa-spin mr-1"></i>保存中...</span>
            <span v-else>保存</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title AppDomainTab
 * @description Runner 应用域名绑定管理，支持增删改查。
 *   域名从 DomainTab（SaaS）数据选择，应用从 Runner 接口选择。
 * @keywords-cn 应用域名管理, 增删改查, 域名选择, 应用绑定
 * @keywords-en app-domain-tab, crud, domain-select, app-binding
 */
import { ref, onMounted } from 'vue';
import { runnerControlApi, type RunnerControlAppDomain, type RunnerControlApp } from '../../../../api/runner-control';
import { runnerPanelApi, type RunnerDomain } from '../../../../api/runner';

const props = defineProps<{
  runnerId: string;
}>();

const bindings = ref<RunnerControlAppDomain[]>([]);
const availableDomains = ref<RunnerDomain[]>([]);
const runnerApps = ref<RunnerControlApp[]>([]);
const showModal = ref(false);
const saving = ref(false);
const editTarget = ref<RunnerControlAppDomain | null>(null);

const form = ref({
  domain: '',
  pathPattern: '/',
  appId: '',
});

/**
 * @title 获取 Runner 控制域名
 * @keywords-en get-control-domain
 */
function getControlDomain(): string {
  return sessionStorage.getItem('runner_control_domain') || '';
}

/**
 * @title 根据 appId 获取应用名称
 * @keywords-en get-app-name
 */
function getAppName(appId?: string): string {
  if (!appId) return '';
  const app = runnerApps.value.find(a => a.appId === appId);
  return app ? `${app.name} (${app.appPort})` : appId;
}

/**
 * @title 加载所有数据
 * @description 并行加载绑定列表、SaaS 域名列表和 Runner 应用列表。
 * @keywords-en load-all, parallel-fetch
 */
async function loadAll() {
  const controlDomain = getControlDomain();
  const [bindingsRes, domainsRes, appsRes] = await Promise.allSettled([
    controlDomain ? runnerControlApi.listAppDomains(controlDomain) : Promise.resolve({ data: [] }),
    runnerPanelApi.listDomains(props.runnerId),
    controlDomain ? runnerControlApi.listApps(controlDomain) : Promise.resolve({ data: [] }),
  ]);

  if (bindingsRes.status === 'fulfilled') {
    bindings.value = (bindingsRes.value.data || []).map(b => ({ ...b, id: b.id || b.domain }));
  }
  if (domainsRes.status === 'fulfilled') {
    availableDomains.value = domainsRes.value.data || [];
  }
  if (appsRes.status === 'fulfilled') {
    runnerApps.value = appsRes.value.data || [];
  }
}

/**
 * @title 打开新增弹窗
 * @keywords-en open-add-modal
 */
function openAddModal() {
  editTarget.value = null;
  form.value = { domain: '', pathPattern: '/', appId: '' };
  showModal.value = true;
}

/**
 * @title 打开编辑弹窗
 * @keywords-en open-edit-modal
 */
function openEditModal(binding: RunnerControlAppDomain) {
  editTarget.value = binding;
  form.value = {
    domain: binding.domain,
    pathPattern: binding.pathPattern || '/',
    appId: binding.appId || '',
  };
  showModal.value = true;
}

/**
 * @title 提交新增或编辑
 * @keywords-en handle-submit, create-or-update
 */
async function handleSubmit() {
  if (!form.value.domain) return;
  const controlDomain = getControlDomain();
  if (!controlDomain) return;
  saving.value = true;
  try {
    if (editTarget.value) {
      await runnerControlApi.updateAppDomain(controlDomain, form.value.domain, {
        pathPattern: form.value.pathPattern,
        appId: form.value.appId || undefined,
      });
    } else {
      await runnerControlApi.createAppDomain(controlDomain, {
        domain: form.value.domain,
        pathPattern: form.value.pathPattern,
        appId: form.value.appId || undefined,
      });
    }
    showModal.value = false;
    await loadAll();
  } catch (err) {
    console.error('[AppDomainTab] Save failed:', err);
  } finally {
    saving.value = false;
  }
}

/**
 * @title 删除绑定
 * @keywords-en handle-delete, remove-binding
 */
async function handleDelete(binding: RunnerControlAppDomain) {
  if (!confirm(`确定删除域名 "${binding.domain}" 的绑定吗？`)) return;
  const controlDomain = getControlDomain();
  if (!controlDomain) return;
  try {
    await runnerControlApi.deleteAppDomain(controlDomain, binding.domain);
    await loadAll();
  } catch (err) {
    console.error('[AppDomainTab] Delete failed:', err);
  }
}

onMounted(async () => {
  await loadAll();
});
</script>

