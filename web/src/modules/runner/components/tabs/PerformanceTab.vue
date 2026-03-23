<!--
  @title PerformanceTab Component
  @description Runner 性能面板，显示 CPU、内存、统计数字和 FRPC 状态
  @keywords-cn 性能面板, CPU, 内存, 统计, FRPC
  @keywords-en performance-tab, cpu, memory, stats, frpc
-->
<template>
  <div class="space-y-4 md:space-y-6">
    <!-- CPU/内存进度条 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      <div class="bg-gray-50 rounded-lg p-3 md:p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">CPU 使用率</span>
          <span class="text-2xl font-bold text-gray-900">{{ cpuUsage }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-blue-500 h-2 rounded-full transition-all"
            :style="{ width: `${cpuUsage}%` }"
          ></div>
        </div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 md:p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">内存使用率</span>
          <span class="text-2xl font-bold text-gray-900">{{ memoryUsage }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-green-500 h-2 rounded-full transition-all"
            :style="{ width: `${memoryUsage}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- FRPC 状态管理 -->
    <div class="bg-gray-50 rounded-lg p-3 md:p-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-700">FRPC 状态</span>
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="frpcRunning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
          >
            {{ frpcRunning ? '运行中' : '已停止' }}
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            @click="handleReload"
            :disabled="loading || !frpcRunning"
            class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            <i class="fa-solid fa-rotate mr-1"></i>
            重载配置
          </button>
          <button
            v-if="!frpcRunning"
            @click="handleStart"
            :disabled="loading"
            class="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <i class="fa-solid fa-play mr-1"></i>
            启动
          </button>
          <button
            v-else
            @click="handleStop"
            :disabled="loading"
            class="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <i class="fa-solid fa-stop mr-1"></i>
            停止
          </button>
        </div>
      </div>
      <div v-if="loading" class="text-sm text-gray-500">
        <i class="fa-solid fa-spinner fa-spin mr-1"></i>
        处理中...
      </div>
    </div>

    <!-- 统计数字 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <div class="bg-gray-50 rounded-lg p-3 md:p-4 text-center">
        <div class="text-3xl font-bold text-gray-900">{{ stats.solutions }}</div>
        <div class="text-sm text-gray-500 mt-1">Solution 数量</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 md:p-4 text-center">
        <div class="text-3xl font-bold text-gray-900">{{ stats.domainBindings }}</div>
        <div class="text-sm text-gray-500 mt-1">绑定域名</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 md:p-4 text-center">
        <div class="text-3xl font-bold text-gray-900">{{ stats.apps }}</div>
        <div class="text-sm text-gray-500 mt-1">应用数量</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 md:p-4 text-center">
        <div class="text-3xl font-bold text-gray-900">{{ stats.runners }}</div>
        <div class="text-sm text-gray-500 mt-1">在线 Runner</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { runnerFrpcApi } from '../../../../api/runner';

const cpuUsage = ref(0);
const memoryUsage = ref(0);
const frpcRunning = ref(false);
const loading = ref(false);
const stats = ref({
  solutions: 0,
  domainBindings: 0,
  apps: 0,
  runners: 0,
});

async function loadFrpcStatus() {
  try {
    const res = await runnerFrpcApi.status();
    frpcRunning.value = res.data?.running ?? false;
  } catch (err) {
    console.error('Failed to load FRPC status:', err);
  }
}

async function handleStart() {
  loading.value = true;
  try {
    // TODO: 需要获取 FRPC 配置才能启动
    // 暂时提示用户
    alert('请先配置 FRPC');
  } finally {
    loading.value = false;
  }
}

async function handleStop() {
  loading.value = true;
  try {
    await runnerFrpcApi.stop();
    frpcRunning.value = false;
  } catch (err) {
    console.error('Failed to stop FRPC:', err);
  } finally {
    loading.value = false;
  }
}

async function handleReload() {
  loading.value = true;
  try {
    await runnerFrpcApi.reload();
  } catch (err) {
    console.error('Failed to reload FRPC:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadFrpcStatus();

  // 模拟数据
  cpuUsage.value = 35;
  memoryUsage.value = 62;
  stats.value = {
    solutions: 12,
    domainBindings: 5,
    apps: 8,
    runners: 3,
  };
});
</script>
