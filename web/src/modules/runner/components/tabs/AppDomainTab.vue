<!--
  @title AppDomainTab Component
  @description Runner 应用域名管理表格
  @keywords-cn 应用域名管理, 表格, 应用域名绑定
  @keywords-en app-domain-tab, table, app-domain-binding
-->
<template>
  <div class="space-y-4">
    <!-- 操作栏 -->
    <div class="flex justify-end">
      <button
        @click="showAddModal = true"
        class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
      >
        <i class="fa-solid fa-plus"></i>
        绑定域名
      </button>
    </div>

    <!-- 应用域名表格 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">应用名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">绑定域名</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">路径规则</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="binding in bindings" :key="binding.id">
            <td class="px-4 py-3 text-sm text-gray-900">{{ binding.appName }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ binding.domain }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{{ binding.pathPattern }}</td>
            <td class="px-4 py-3 text-right text-sm">
              <button
                @click="handleUnbind(binding)"
                class="text-red-600 hover:text-red-800"
              >
                <i class="fa-solid fa-unlink"></i>
              </button>
            </td>
          </tr>
          <tr v-if="bindings.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              暂无应用域名绑定
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 绑定域名弹窗 -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showAddModal = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-bold mb-4">绑定域名到应用</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">选择应用</label>
            <select
              v-model="newBinding.appId"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="">请选择应用</option>
              <option v-for="app in apps" :key="app.appId" :value="app.appId">
                {{ app.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">域名</label>
            <input
              v-model="newBinding.domain"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="app.example.com"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">路径规则</label>
            <input
              v-model="newBinding.pathPattern"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder=".* (默认全部)"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showAddModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            取消
          </button>
          <button
            @click="handleBind"
            class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            绑定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface AppDomainBinding {
  id: string;
  appId: string;
  appName: string;
  domain: string;
  pathPattern: string;
}

interface AppItem {
  appId: string;
  name: string;
}

const bindings = ref<AppDomainBinding[]>([]);
const apps = ref<AppItem[]>([]);
const showAddModal = ref(false);
const newBinding = ref({
  appId: '',
  domain: '',
  pathPattern: '.*',
});

const handleBind = async () => {
  if (!newBinding.value.appId || !newBinding.value.domain) return;
  // TODO: 调用 API 绑定域名
  const app = apps.value.find(a => a.appId === newBinding.value.appId);
  bindings.value.push({
    id: Date.now().toString(),
    appId: newBinding.value.appId,
    appName: app?.name || newBinding.value.appId,
    domain: newBinding.value.domain,
    pathPattern: newBinding.value.pathPattern,
  });
  showAddModal.value = false;
  newBinding.value = { appId: '', domain: '', pathPattern: '.*' };
};

const handleUnbind = async (binding: AppDomainBinding) => {
  // TODO: 调用 API 解绑域名
  bindings.value = bindings.value.filter(b => b.id !== binding.id);
};
</script>
