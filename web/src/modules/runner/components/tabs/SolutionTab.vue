<!--
  @title SolutionTab Component
  @description Runner Solution 管理表格
  @keywords-cn Solution管理, 表格, Solution列表
  @keywords-en solution-tab, table, solution-list
-->
<template>
  <div class="space-y-4">
    <!-- Solution 表格 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solution 名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">版本</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">应用数量</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="sol in solutions" :key="sol.id">
            <td class="px-4 py-3 text-sm text-gray-900">{{ sol.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 font-mono">{{ sol.version }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ sol.appCount }}</td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                :class="sol.installed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ sol.installed ? '已安装' : '未安装' }}
              </span>
            </td>
          </tr>
          <tr v-if="solutions.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              暂无 Solution
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface SolutionItem {
  id: string;
  name: string;
  version: string;
  appCount: number;
  installed: boolean;
}

const solutions = ref<SolutionItem[]>([]);

onMounted(async () => {
  // TODO: 从 Runner API 获取 Solution 列表
  // 暂时使用模拟数据
  solutions.value = [
    { id: '1', name: 'AI Chat Solution', version: '1.0.0', appCount: 3, installed: true },
    { id: '2', name: 'Data Processing', version: '2.1.0', appCount: 1, installed: true },
  ];
});
</script>
