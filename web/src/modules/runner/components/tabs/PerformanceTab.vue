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
          <span v-if="wsConnected" class="text-xs text-green-600">
            <i class="fa-solid fa-wifi mr-1"></i>WebSocket 已连接
          </span>
          <span v-else class="text-xs text-gray-400">
            <i class="fa-solid fa-wifi mr-1"></i>WebSocket 未连接
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            @click="handleReload"
            :disabled="loading || !frpcRunning || !wsConnected"
            class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            <i class="fa-solid fa-rotate mr-1"></i>
            重载配置
          </button>
          <button
            v-if="!frpcRunning"
            @click="handleStart"
            :disabled="loading || !wsConnected"
            class="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <i class="fa-solid fa-play mr-1"></i>
            启动
          </button>
          <button
            v-else
            @click="handleStop"
            :disabled="loading || !wsConnected"
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
      <div v-if="wsError" class="text-sm text-red-500 mt-2">
        {{ wsError }}
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
/**
 * @title PerformanceTab
 * @description Runner 性能面板，显示 CPU、内存、统计数字和 FRPC 状态。通过 WebSocket 控制 FRP。
 * @keywords-cn 性能面板, CPU, 内存, 统计, FRPC, WebSocket
 * @keywords-en performance-tab, cpu, memory, stats, frpc, websocket
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { runnerPanelApi, runnerApi } from '../../../../api/runner';
import { runnerSocketService } from '../../services/runner-ws.service';

const props = defineProps<{
  runnerId: string;
}>();

const cpuUsage = ref(0);
const memoryUsage = ref(0);
const frpcRunning = ref(false);
const loading = ref(false);
const wsConnected = ref(false);
const wsError = ref('');
const stats = ref({
  solutions: 0,
  domainBindings: 0,
  apps: 0,
  runners: 0,
});

// Runner 注册信息
let runnerKey = '';

async function loadRunnerKey() {
  try {
    const res = await runnerApi.get(props.runnerId);
    // runnerKey 应该在创建时显示的 key，需要从后端获取或前端存储
    // 暂时从 localStorage 获取
    runnerKey = localStorage.getItem(`runner_key_${props.runnerId}`) || '';
  } catch (err) {
    console.error('Failed to load runner key:', err);
  }
}

async function connectWs() {
  try {
    await loadRunnerKey();
    if (!runnerKey) {
      wsError.value = 'Runner Key 未找到，请重新创建 Runner';
      return;
    }
    await runnerSocketService.connect(props.runnerId, runnerKey);
    wsConnected.value = runnerSocketService.connected.value;
  } catch (err) {
    wsError.value = err instanceof Error ? err.message : 'WebSocket 连接失败';
    wsConnected.value = false;
  }
}

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
      runners: data.runners,
    };
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadFrpStatus() {
  try {
    const res = await runnerPanelApi.getFrpStatus(props.runnerId);
    frpcRunning.value = res.data?.running ?? false;
  } catch (err) {
    console.error('Failed to load FRPC status:', err);
  }
}

async function handleStart() {
  loading.value = true;
  wsError.value = '';
  try {
    await runnerSocketService.startFrp();
    frpcRunning.value = true;
  } catch (err) {
    wsError.value = err instanceof Error ? err.message : '启动 FRP 失败';
  } finally {
    loading.value = false;
  }
}

async function handleStop() {
  loading.value = true;
  wsError.value = '';
  try {
    await runnerSocketService.stopFrp();
    frpcRunning.value = false;
  } catch (err) {
    wsError.value = err instanceof Error ? err.message : '停止 FRP 失败';
  } finally {
    loading.value = false;
  }
}

async function handleReload() {
  loading.value = true;
  wsError.value = '';
  try {
    await runnerSocketService.reloadFrp();
  } catch (err) {
    wsError.value = err instanceof Error ? err.message : '重载 FRP 失败';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadStats(), loadFrpStatus()]);
  // 尝试 WebSocket 连接（需要 runnerKey）
  await connectWs();
});

onUnmounted(() => {
  runnerSocketService.disconnect();
});
</script>
