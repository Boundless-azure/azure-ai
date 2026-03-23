<!--
  @title AppTab Component
  @description Runner 应用管理表格
  @keywords-cn 应用管理, 表格, 应用列表
  @keywords-en app-tab, table, app-list
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
        添加应用
      </button>
    </div>

    <!-- 应用表格 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-[720px] divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">应用名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">绑定 Solution</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">应用端口</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">描述</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="app in apps" :key="app.appId">
            <td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{{ app.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ app.solutionName || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 font-mono whitespace-nowrap">{{ app.appPort }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{{ app.description || '-' }}</td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="app.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ app.status === 'running' ? '运行中' : '已停止' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm whitespace-nowrap">
              <button
                @click="handleDelete(app)"
                class="text-red-600 hover:text-red-800 ml-2"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="apps.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
              暂无应用配置
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加应用弹窗 -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showAddModal = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-bold mb-4">添加应用</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">应用名称</label>
            <input
              v-model="newApp.name"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="My App"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">应用端口</label>
            <input
              v-model.number="newApp.appPort"
              type="number"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="3000"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">绑定 Solution</label>
            <select
              v-model="newApp.solutionId"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="">不绑定</option>
              <option v-for="sol in solutions" :key="sol.id" :value="sol.id">
                {{ sol.name }} ({{ sol.version }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              v-model="newApp.description"
              rows="2"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
              placeholder="应用描述..."
            ></textarea>
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
            @click="handleAdd"
            class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface AppItem {
  appId: string;
  name: string;
  solutionId?: string;
  solutionName?: string;
  appPort: number;
  description?: string;
  status: 'running' | 'stopped';
}

interface SolutionItem {
  id: string;
  name: string;
  version: string;
}

const apps = ref<AppItem[]>([]);
const solutions = ref<SolutionItem[]>([]);
const showAddModal = ref(false);
const newApp = ref({
  name: '',
  appPort: 3000,
  solutionId: '',
  description: '',
});

const handleAdd = async () => {
  if (!newApp.value.name || !newApp.value.appPort) return;
  const solution = solutions.value.find(s => s.id === newApp.value.solutionId);
  const app: AppItem = {
    appId: Date.now().toString(),
    name: newApp.value.name,
    appPort: newApp.value.appPort,
    solutionId: newApp.value.solutionId || undefined,
    solutionName: solution?.name,
    description: newApp.value.description,
    status: 'running',
  };
  // TODO: 调用 API 创建应用，同时删除应用域名绑定
  apps.value.push(app);
  showAddModal.value = false;
  newApp.value = { name: '', appPort: 3000, solutionId: '', description: '' };
};

const handleDelete = async (app: AppItem) => {
  if (!confirm(`确定删除应用 "${app.name}" 吗？\n这将同时删除该应用的所有域名绑定。`)) {
    return;
  }
  // TODO: 调用 API 删除应用，会同步删除应用域名绑定
  apps.value = apps.value.filter(a => a.appId !== app.appId);
};
</script>
