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
      <div v-if="frpcError" class="text-sm text-red-500 mt-2">
        {{ frpcError }}
      </div>
    </div>

    <!-- 统计数字 -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
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
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title PerformanceTab
 * @description Runner 性能面板，显示 CPU、内存、统计数字和 FRPC 状态。
 * @keywords-cn 性能面板, CPU, 内存, 统计, FRPC
 * @keywords-en performance-tab, cpu, memory, stats, frpc
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { runnerPanelApi } from '../../../../api/runner';

const props = defineProps<{
  runnerId: string;
}>();

const cpuUsage = ref(0);
const memoryUsage = ref(0);
const frpcRunning = ref(false);
const loading = ref(false);
const frpcError = ref('');
const stats = ref({
  solutions: 0,
  domainBindings: 0,
  apps: 0,
});

// 定时刷新任务 ID
let statsInterval: ReturnType<typeof setInterval> | null = null;

/**
 * @title 加载性能统计数据
 * @description 通过 SaaS 接口（WS 中继）获取 CPU、内存、FRPC 状态和统计数字。
 * @keywords-en load-stats, saas-relay
 */
async function loadStats() {
  try {
    const res = await runnerPanelApi.getStats(props.runnerId);
    const data = res.data;
    cpuUsage.value = data.cpuUsage;
    memoryUsage.value = data.memoryUsage;
    frpcRunning.value = data.frpcRunning;
    stats.value = {
      solutions: data.solutions,
      domainBindings: data.domainBindings,
      apps: data.apps,
    };
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

/**
 * @title 启动 FRPC
 * @description 通过 SaaS 后端 WS 中继向 Runner 发送启动指令（FRPC 停止时域名不可达，需走 SaaS WS）。
 * @keywords-en handle-start, frpc-start, saas-relay
 */
async function handleStart() {
  loading.value = true;
  frpcError.value = '';
  try {
    await runnerPanelApi.startFrp(props.runnerId);
    frpcRunning.value = true;
  } catch (err) {
    frpcError.value = err instanceof Error ? err.message : '启动 FRP 失败';
  } finally {
    loading.value = false;
  }
}

/**
 * @title 停止 FRPC
 * @description 通过 SaaS 接口（WS 中继）向 Runner 发送停止指令。
 * @keywords-en handle-stop, saas-relay
 */
async function handleStop() {
  loading.value = true;
  frpcError.value = '';
  try {
    await runnerPanelApi.stopFrp(props.runnerId);
    frpcRunning.value = false;
  } catch (err) {
    frpcError.value = err instanceof Error ? err.message : '停止 FRP 失败';
  } finally {
    loading.value = false;
  }
}

/**
 * @title 重载 FRPC
 * @description 通过 SaaS 接口（WS 中继）向 Runner 发送重载配置指令。
 * @keywords-en handle-reload, saas-relay
 */
async function handleReload() {
  loading.value = true;
  frpcError.value = '';
  try {
    await runnerPanelApi.reloadFrp(props.runnerId);
  } catch (err) {
    frpcError.value = err instanceof Error ? err.message : '重载 FRP 失败';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  // 预热 CPU 采样（首次调用返回 0）
  await loadStats();
  // 立即再次获取以获得真实 CPU 使用率
  await loadStats();
  // 每 3 秒定时刷新性能数据
  statsInterval = setInterval(loadStats, 3000);
});

onUnmounted(() => {
  // 清除定时任务
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
});
</script>
