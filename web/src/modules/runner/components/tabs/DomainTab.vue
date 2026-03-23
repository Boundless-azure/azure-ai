<!--
  @title DomainTab Component
  @description Runner 域名管理表格
  @keywords-cn 域名管理, 表格, 域名列表
  @keywords-en domain-tab, table, domain-list
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
        添加域名
      </button>
    </div>

    <!-- 域名表格 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">域名</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">解析数量</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="domain in domains" :key="domain.id">
            <td class="px-4 py-3 text-sm text-gray-900">{{ domain.domain }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ domain.resolveCount }}</td>
            <td class="px-4 py-3 text-sm">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="domain.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ domain.active ? '活跃' : '停用' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm">
              <button
                @click="handleDelete(domain)"
                class="text-red-600 hover:text-red-800"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="domains.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              暂无域名配置
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加域名弹窗 -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showAddModal = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-bold mb-4">添加域名</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">域名</label>
            <input
              v-model="newDomain"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="app.example.com"
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

interface DomainItem {
  id: string;
  domain: string;
  resolveCount: number;
  active: boolean;
}

const domains = ref<DomainItem[]>([]);
const showAddModal = ref(false);
const newDomain = ref('');

const handleAdd = async () => {
  if (!newDomain.value.trim()) return;
  // TODO: 调用 API 添加域名
  domains.value.push({
    id: Date.now().toString(),
    domain: newDomain.value,
    resolveCount: 0,
    active: true,
  });
  showAddModal.value = false;
  newDomain.value = '';
};

const handleDelete = async (domain: DomainItem) => {
  // TODO: 调用 API 删除域名
  domains.value = domains.value.filter(d => d.id !== domain.id);
};
</script>
