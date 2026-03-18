<template>
  <div class="h-screen bg-white text-gray-900 flex">
    <aside class="w-[340px] border-r border-gray-200 flex flex-col">
      <div class="p-4 border-b border-gray-200 space-y-3">
        <div class="text-sm font-semibold">连接端点</div>
        <div class="space-y-2">
          <input
            v-model="endpoint"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="http://localhost:4310 (不要带 /hookbus)"
          />
          <input
            v-model="connectKey"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="debug key (optional)"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-2 rounded bg-black text-white text-sm hover:bg-gray-800"
            @click="connect()"
          >
            {{ connected ? '重连' : connecting ? '连接中...' : '连接' }}
          </button>
          <button
            class="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            @click="disconnect"
          >
            断开
          </button>
        </div>
        <div class="text-xs" :class="connected ? 'text-green-700' : 'text-gray-500'">
          {{ connected ? '已连接' : '未连接' }}
        </div>
        <div class="text-[11px] text-gray-400">
          端点只填协议+主机+端口，例如 http://localhost:4310
        </div>
        <div class="mt-2 rounded-lg border border-gray-200 p-2">
          <div class="text-xs text-gray-500 mb-2">SaaS 调试网关开关</div>
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-1 rounded text-xs border border-gray-300 hover:bg-gray-50"
              :disabled="gatewayUpdating"
              @click="setGatewayEnabled(!gatewayEnabled)"
            >
              {{ gatewayUpdating ? '处理中...' : gatewayEnabled ? '关闭' : '开启' }}
            </button>
            <span class="text-xs" :class="gatewayEnabled ? 'text-green-700' : 'text-gray-500'">
              {{ gatewayEnabled ? '已开启' : '已关闭' }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 p-4 overflow-auto">
        <div class="text-sm font-semibold mb-3">请求历史</div>
        <div class="space-y-2">
          <button
            v-for="item in history"
            :key="item.id"
            class="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            @click="loadHistory(item.id)"
          >
            <div class="text-sm font-medium truncate">{{ item.hookName }}</div>
            <div class="text-xs text-gray-500 mt-1">
              {{ new Date(item.createdAt).toLocaleString() }}
            </div>
            <div class="text-xs mt-1" :class="item.ok ? 'text-green-700' : 'text-red-600'">
              {{ item.ok ? 'success' : 'failed' }}
            </div>
          </button>
          <div v-if="history.length === 0" class="text-xs text-gray-400">暂无历史</div>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col min-w-0">
      <header class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold">HookBus Debug</h1>
          <p class="text-xs text-gray-500 mt-1">简约调试台（APIFox 风格）</p>
        </div>
        <button
          class="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
          @click="showHooksModal = true"
        >
          已加载 Hook：{{ hookCount }}
        </button>
      </header>

      <section class="p-6 flex-1 min-h-0 overflow-auto space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Hook 选择</label>
            <select
              v-model="selectedHook"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="">请选择 Hook</option>
              <option v-for="opt in hookOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="flex items-end">
            <button
              class="px-4 py-2 rounded bg-black text-white text-sm hover:bg-gray-800"
              @click="sendDebug"
            >
              发送调试请求
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Payload(JSON)</label>
          <textarea
            v-model="payloadText"
            class="w-full min-h-[180px] px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        <div>
          <div class="text-sm font-medium mb-1">返回结果</div>
          <pre
            class="w-full min-h-[220px] rounded-lg border border-gray-300 bg-gray-50 p-3 text-xs overflow-auto"
          >{{ resultText || '等待请求返回...' }}</pre>
        </div>

        <div v-if="errorText" class="text-sm text-red-600">{{ errorText }}</div>
      </section>
    </main>

    <div
      v-if="showHooksModal"
      class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"
      @click.self="showHooksModal = false"
    >
      <div class="bg-white w-[760px] max-w-[95vw] max-h-[80vh] overflow-auto rounded-xl border border-gray-200">
        <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div class="font-semibold">所有 Hook</div>
          <button class="text-gray-500 hover:text-gray-900" @click="showHooksModal = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="p-4 space-y-2">
          <div
            v-for="item in hooks"
            :key="item.name"
            class="rounded-lg border border-gray-200 p-3"
          >
            <div class="font-mono text-sm">{{ item.name }}</div>
            <div class="text-xs text-gray-500 mt-1">
              {{ item.metadata?.pluginName || '-' }}
            </div>
            <div class="text-xs text-gray-500 mt-1">
              {{ (item.metadata?.tags || []).join(', ') || '-' }}
            </div>
          </div>
          <div v-if="hooks.length === 0" class="text-sm text-gray-400">暂无 hook</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title HookbusDebugWorkbench
 * @description HookBus 调试页面主工作台，提供连接、请求、历史与结果展示。
 * @keywords-cn hookbus调试页, 调试工作台, 请求历史
 * @keywords-en hookbus-debug-workbench, debug-workbench, request-history
 */
import { onMounted, ref } from 'vue';
import { useHookbusDebug } from '../hooks/useHookbusDebug';

const showHooksModal = ref(false);

const {
  endpoint,
  connectKey,
  connected,
  connecting,
  selectedHook,
  payloadText,
  resultText,
  errorText,
  hooks,
  gatewayEnabled,
  gatewayUpdating,
  hookCount,
  hookOptions,
  history,
  connect,
  disconnect,
  sendDebug,
  loadHistory,
  refreshGatewayState,
  setGatewayEnabled,
} = useHookbusDebug();

onMounted(() => {
  void refreshGatewayState();
});
</script>
