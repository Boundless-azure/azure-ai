<!--
  @title RunnerProxyPanel Component
  @description Runner 控制面板主容器，包含 5 个 Tab 页
  @keywords-cn Runner控制面板, Tab页, 性能面板, 域名管理
  @keywords-en runner-proxy-panel, tabs, performance, domain-management
-->
<template>
  <div class="h-full w-full flex flex-col bg-white">
    <!-- Tab 头部 -->
    <div class="border-b border-gray-200 px-4 pt-4">
      <div class="flex flex-wrap gap-x-4 gap-y-2 justify-start">
        <button
          v-for="tab in tabs"
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
      <AppTab v-if="activeTab === 'apps'" :runner-id="runnerId" />

      <!-- Solution 管理 -->
      <SolutionTab v-if="activeTab === 'solutions'" :runner-id="runnerId" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title RunnerProxyPanel
 * @description Runner 控制面板主组件，包含性能、域名、应用、Solution 等 Tab 页。
 * @keywords-cn Runner控制面板, Tab容器, 性能监控
 * @keywords-en runner-proxy-panel, tab-container, performance-monitor
 */
import { ref } from 'vue';
import PerformanceTab from './tabs/PerformanceTab.vue';
import DomainTab from './tabs/DomainTab.vue';
import AppDomainTab from './tabs/AppDomainTab.vue';
import AppTab from './tabs/AppTab.vue';
import SolutionTab from './tabs/SolutionTab.vue';

const props = defineProps<{
  runnerId: string;
}>();

const runnerId = props.runnerId;
const activeTab = ref('performance');

const tabs = [
  { id: 'performance', label: '性能面板', icon: 'fa-solid fa-chart-line' },
  { id: 'domains', label: '域名管理', icon: 'fa-solid fa-globe' },
  { id: 'app-domains', label: '应用域名', icon: 'fa-solid fa-link' },
  { id: 'apps', label: '应用管理', icon: 'fa-solid fa-cube' },
  { id: 'solutions', label: 'Solution', icon: 'fa-solid fa-box' },
];
</script>
