<!--
  @title AppDomainTab Component
  @description Runner 应用域名管理表格（app_id 已移除，功能已合并至 DomainTab）
  @keywords-cn 应用域名管理, 表格, 应用域名绑定
  @keywords-en app-domain-tab, table, app-domain-binding
-->
<template>
  <div class="space-y-4">
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">绑定域名</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">路径规则</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="bindings.length === 0">
            <td colspan="3" class="px-4 py-8 text-center text-gray-500">
              暂无应用域名绑定（请使用域名管理中的"添加域名"功能）
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title AppDomainTab
 * @description Runner 应用域名管理表格（app_id 已移除，功能已合并至 DomainTab）。
 * @keywords-cn 应用域名管理, 表格, 应用域名绑定
 * @keywords-en app-domain-tab, table, app-domain-binding
 */
import { ref, onMounted } from 'vue';
import { runnerPanelApi, type RunnerDomain } from '../../../../api/runner';

const props = defineProps<{
  runnerId: string;
}>();

const bindings = ref<RunnerDomain[]>([]);

async function loadBindings() {
  try {
    const res = await runnerPanelApi.listDomains(props.runnerId);
    bindings.value = res.data;
  } catch (err) {
    console.error('Failed to load bindings:', err);
  }
}

onMounted(async () => {
  await loadBindings();
});
</script>
