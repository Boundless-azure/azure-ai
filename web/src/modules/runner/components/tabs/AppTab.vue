<!--
  @title AppTab Component
  @description Runner 应用管理表格（仅查看）
  @keywords-cn 应用管理, 表格, 应用列表, 只读
  @keywords-en app-tab, table, app-list, read-only
-->
<template>
  <div class="space-y-4">
    <!-- 应用表格 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-[720px] divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">应用名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">应用端口</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">描述</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="app in apps" :key="app.appId">
            <td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{{ app.name }}</td>
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
          </tr>
          <tr v-if="apps.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              暂无应用配置
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title AppTab
 * @description Runner 应用管理表格（仅查看）。使用 runnerControlApi 通过 Runner 域名访问。
 * @keywords-cn 应用管理, 表格, 应用列表, 只读
 * @keywords-en app-tab, table, app-list, read-only
 */
import { ref, onMounted } from 'vue';
import { runnerControlApi, type RunnerControlApp } from '../../../../api/runner-control';

const apps = ref<RunnerControlApp[]>([]);
const loading = ref(false);

/**
 * @title 获取 API 域名
 * @keywords-en get-domain
 */
function getDomain(): string {
  return sessionStorage.getItem('runner_control_domain') || '';
}

/**
 * @title 加载应用列表
 * @keywords-en load-apps
 */
async function loadApps() {
  loading.value = true;
  try {
    const domain = getDomain();
    if (!domain) return;
    const res = await runnerControlApi.listApps(domain);
    apps.value = res.data || [];
  } catch (err) {
    console.error('[AppTab] Failed to load apps:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadApps();
});
</script>
