<!--
  @title RunnerProxyPanel Component
  @description Runner 控制面板主容器，包含 5 个 Tab 页。无域名时其他 Tab 显示遮罩。
  @keywords-cn Runner控制面板, Tab页, 性能面板, 域名管理
  @keywords-en runner-proxy-panel, tabs, performance, domain-management
-->
<template>
  <div class="h-full w-full flex flex-col bg-white">
    <!-- Tab 头部 -->
    <div class="border-b border-gray-200 px-4 pt-4">
      <div class="flex flex-wrap gap-x-4 gap-y-2 justify-start">
        <button
          v-for="tab in availableTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="pb-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
          :class="activeTab === tab.id
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          <i :class="tab.icon" class="mr-2"></i>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Tab 内容 -->
    <div class="flex-1 overflow-y-auto p-2 md:p-4">
      <!-- 性能面板 -->
      <PerformanceTab v-if="activeTab === 'performance'" :runner-id="runnerId" />

      <!-- 域名管理 -->
      <DomainTab v-if="activeTab === 'domains'" :runner-id="runnerId" />

      <!-- 应用域名管理 -->
      <AppDomainTab v-if="activeTab === 'app-domains'" :runner-id="runnerId" />

      <!-- 应用管理 -->
      <template v-if="activeTab === 'apps'">
        <AppTab v-if="firstDomain" />
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center">
            <i class="fa-solid fa-globe text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-500">{{ t('runner.proxy.need_domain') || '请先绑定域名后再访问应用管理' }}</p>
          </div>
        </div>
      </template>

      <!-- Solution 管理 -->
      <template v-if="activeTab === 'solutions'">
        <SolutionTab v-if="firstDomain" />
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center">
            <i class="fa-solid fa-globe text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-500">{{ t('runner.proxy.need_domain') || '请先绑定域名后再访问 Solution' }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title RunnerProxyPanel
 * @description Runner 控制面板主组件，包含性能、域名、应用、Solution 等 Tab 页。
 *        无域名时除域名管理外其他 Tab 显示遮罩提示。
 * @keywords-cn Runner控制面板, Tab容器, 性能监控, 域名遮罩
 * @keywords-en runner-proxy-panel, tab-container, performance-monitor, domain-mask
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import PerformanceTab from './tabs/PerformanceTab.vue';
import DomainTab from './tabs/DomainTab.vue';
import AppDomainTab from './tabs/AppDomainTab.vue';
import AppTab from './tabs/AppTab.vue';
import SolutionTab from './tabs/SolutionTab.vue';
import { runnerPanelApi } from '../../../api/runner';

const props = defineProps<{
  runnerId: string;
}>();

const { t } = useI18n();
const runnerId = props.runnerId;
const activeTab = ref('performance');
const firstDomain = ref<string | null>(null);
const runnerDomains = ref<Array<{ domain: string; pathPattern: string }>>([]);

/**
 * @title 获取当前协议
 * @description 根据当前页面 URL 获取协议
 */
function getCurrentProtocol(): string {
  return window.location.protocol === 'https:' ? 'https' : 'http';
}

/**
 * @title 拼接完整访问地址
 * @description 拼接 protocol + domain + '/' + pathPattern
 * @param domain 域名（纯域名，不含协议）
 * @param pathPattern 路径规则
 */
function buildFullDomain(domain: string, pathPattern: string): string {
  const normalizedPath = pathPattern.startsWith('/') ? pathPattern : `/${pathPattern}`;
  return `${getCurrentProtocol()}://${domain}${normalizedPath}`;
}

/**
 * @title 加载 Runner 信息
 * @description 获取 Runner 详情，包括域名列表
 */
async function loadRunnerInfo() {
  try {
    // 获取域名列表
    const domainRes = await runnerPanelApi.listDomains(runnerId);
    runnerDomains.value = domainRes.data || [];

    // 拼接完整访问地址
    const firstBinding = runnerDomains.value[0];
    if (firstBinding) {
      firstDomain.value = buildFullDomain(firstBinding.domain, firstBinding.pathPattern);
      sessionStorage.setItem('runner_control_domain', firstDomain.value);
      sessionStorage.setItem('runner_control_runner_id', runnerId);
    }
  } catch (err) {
    console.error('[RunnerProxyPanel] Failed to load runner info:', err);
  }
}

/**
 * @title 可用 Tab 列表
 * @description 根据是否有域名返回可访问的 Tab 列表
 */
const availableTabs = computed(() => {
  if (firstDomain.value) {
    return tabs;
  }
  // 无域名时只显示域名管理 Tab
  return tabs.filter(tab => tab.id === 'domains');
});

const tabs = [
  { id: 'performance', label: '性能面板', icon: 'fa-solid fa-chart-line' },
  { id: 'domains', label: '域名管理', icon: 'fa-solid fa-globe' },
  { id: 'app-domains', label: '应用域名', icon: 'fa-solid fa-link' },
  { id: 'apps', label: '应用管理', icon: 'fa-solid fa-cube' },
  { id: 'solutions', label: 'Solution', icon: 'fa-solid fa-box' },
];

onMounted(async () => {
  await loadRunnerInfo();
  // 如果没有域名，强制切换到域名管理 Tab
  if (!firstDomain.value) {
    activeTab.value = 'domains';
  }
});
</script>
