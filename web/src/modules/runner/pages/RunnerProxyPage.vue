<!--
  @title RunnerProxyPage
  @description Runner 控制面板页面，包含面包屑和返回按钮
  @keywords-cn Runner控制面板, 面包屑, 返回按钮
  @keywords-en runner-proxy-page, breadcrumb, back-button
-->
<template>
  <div class="h-full w-full flex flex-col bg-white relative overflow-y-auto md:overflow-hidden text-[13px] md:text-sm">
    <!-- 顶部导航栏 -->
    <div class="px-3 py-3 flex-shrink-0 flex items-center gap-2 border-b border-gray-100">
      <button
        @click="goBack"
        class="ps-0 pe-0 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <span class="text-sm font-medium text-gray-900">Runner 控制面板</span>
    </div>

    <!-- Tab 内容 -->
    <div class="flex-1 overflow-hidden">
      <RunnerProxyPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title RunnerProxyPage
 * @description Runner 控制面板页面入口。
 * @keywords-cn Runner控制面板, 页面入口
 * @keywords-en runner-proxy-page, page-entry
 */
import { computed } from 'vue';
import RunnerProxyPanel from '../components/RunnerProxyPanel.vue';

const props = defineProps<{
  runnerId?: string;
  onBack?: () => void;
}>();

const runnerId = computed(() => props.runnerId || '');

const goBack = () => {
  props.onBack?.();
};
</script>
