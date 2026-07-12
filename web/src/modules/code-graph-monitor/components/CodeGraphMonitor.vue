<!-- AGENT-MONITOR-TEMP :: 临时调试监听页, 后期整体删除 (grep AGENT-MONITOR-TEMP) -->
<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header: session + connect -->
    <div
      class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0"
    >
      <div class="flex items-center gap-2 text-blue-600">
        <i class="fa-solid fa-diagram-project text-lg"></i>
        <span class="font-bold text-gray-800">Code Agent 运行监听</span>
      </div>
      <input
        v-model="sessionInput"
        placeholder="会话 sessionId"
        class="ml-2 flex-1 max-w-md border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        v-if="status !== 'connected'"
        @click="start"
        class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
      >
        连接监听
      </button>
      <button
        v-else
        @click="stop"
        class="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm hover:bg-gray-300"
      >
        断开
      </button>
      <button
        @click="clearAll"
        class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-100"
        title="清空事件"
      >
        <i class="fa-solid fa-trash-can"></i>
      </button>
      <span
        class="text-xs px-2 py-1 rounded-full"
        :class="{
          'bg-green-100 text-green-700': status === 'connected',
          'bg-yellow-100 text-yellow-700': status === 'connecting',
          'bg-gray-100 text-gray-500': status === 'disconnected',
        }"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div v-if="errorMsg" class="px-4 py-2 bg-red-50 text-red-600 text-xs">
      {{ errorMsg }}
    </div>

    <!-- Body: node topology + detail -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Nodes -->
      <div
        class="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-3 space-y-1.5"
      >
        <!-- 全部活动 (通用: 整会话所有 agent 的 LLM 调用, 不止 code-graph) -->
        <div
          @click="selectedNode = ALL_NODE"
          class="rounded-xl border px-3 py-2 cursor-pointer transition-all"
          :class="[
            selectedNode === ALL_NODE
              ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-100'
              : 'border-gray-100 hover:border-blue-200',
          ]"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold text-sm text-gray-800"
              ><i class="fa-solid fa-layer-group mr-1.5 text-blue-500"></i>全部活动</span
            >
          </div>
          <div class="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
            <span
              ><i class="fa-regular fa-file-lines mr-1"></i>{{ allLog.length }}</span
            >
            <span
              ><i class="fa-solid fa-brain mr-1"></i>{{ mergedLlm.length }} LLM</span
            >
          </div>
        </div>
        <div class="text-[10px] text-gray-300 px-1 pt-1">CODE GRAPH 节点</div>
        <div
          v-for="node in CODE_GRAPH_NODES"
          :key="node"
          @click="selectedNode = node"
          class="rounded-xl border px-3 py-2 cursor-pointer transition-all"
          :class="[
            selectedNode === node
              ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-100'
              : 'border-gray-100 hover:border-blue-200',
          ]"
        >
          <div class="flex items-center justify-between">
            <span
              class="font-semibold text-sm truncate"
              :class="
                nodeStatus[node] === 'pending'
                  ? 'text-gray-400'
                  : 'text-gray-800'
              "
              >{{ node }}</span
            >
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :class="{
                'bg-gray-300': nodeStatus[node] === 'pending',
                'bg-blue-500 animate-pulse': nodeStatus[node] === 'active',
                'bg-green-500': nodeStatus[node] === 'done',
                'bg-red-500': nodeStatus[node] === 'error',
              }"
            ></span>
          </div>
          <div class="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
            <span><i class="fa-regular fa-file-lines mr-1"></i>{{ nodeLog[node]?.length || 0 }}</span>
            <span><i class="fa-solid fa-brain mr-1"></i>{{ nodeLlm[node]?.length || 0 }} LLM</span>
          </div>
        </div>
      </div>

      <!-- Detail -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div v-if="!selectedNode" class="text-gray-400 text-sm mt-8 text-center">
          选择左侧一个节点查看该层的日志与 LLM 调用
        </div>
        <template v-else>
          <h3 class="font-bold text-gray-700 mb-2">
            {{ selectedNode === ALL_NODE ? '全部活动' : selectedNode }} · 时间线
          </h3>

          <!-- LLM calls -->
          <div
            v-for="call in detailLlm"
            :key="call.callId"
            class="border border-purple-100 bg-purple-50/40 rounded-xl overflow-hidden"
          >
            <div
              @click="toggle(call.callId)"
              class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-purple-50"
            >
              <i class="fa-solid fa-brain text-purple-500 text-xs"></i>
              <span class="text-sm font-medium text-gray-700">{{ call.node || 'LLM' }}</span>
              <span class="text-[10px] text-gray-400 font-mono">{{ call.source }}</span>
              <span class="text-[11px] text-gray-500">{{ call.model || '—' }}</span>
              <span
                v-if="call.phase === 'error'"
                class="text-[11px] text-red-600"
                >error</span
              >
              <span
                v-else-if="call.durationMs != null"
                class="text-[11px] text-gray-500"
                >{{ call.durationMs }}ms</span
              >
              <span
                v-if="call.tools.length"
                class="text-[11px] text-purple-600"
                >{{ call.tools.length }} tools</span
              >
              <span
                v-if="!['done', 'error'].includes(call.phase)"
                class="text-[10px] text-blue-500 flex items-center gap-1"
                ><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>streaming</span
              >
              <span class="ml-auto text-[10px] text-gray-400">{{
                fmt(call.ts)
              }}</span>
              <i
                class="fa-solid text-gray-400 text-xs"
                :class="expanded.has(call.callId) ? 'fa-chevron-up' : 'fa-chevron-down'"
              ></i>
            </div>
            <div v-if="expanded.has(call.callId)" class="px-3 pb-3 space-y-2">
              <div v-if="call.error" class="text-xs text-red-600">
                {{ call.error }}
              </div>
              <div>
                <div class="text-[11px] font-semibold text-gray-400 mb-1">
                  PROMPT
                </div>
                <pre
                  class="text-[11px] bg-white border border-gray-100 rounded-lg p-2 whitespace-pre-wrap break-words max-h-72 overflow-y-auto text-gray-700"
                  >{{ call.prompt || '(空)' }}</pre
                >
              </div>
              <div v-if="call.tools.length">
                <div class="text-[11px] font-semibold text-gray-400 mb-1">
                  TOOL CALLS ({{ call.tools.length }})
                </div>
                <div class="space-y-1">
                  <div
                    v-for="(tool, ti) in call.tools"
                    :key="ti"
                    class="text-[11px] bg-white border border-gray-100 rounded-lg p-2"
                  >
                    <div class="flex items-center gap-2">
                      <i
                        class="fa-solid text-[10px]"
                        :class="tool.done ? 'fa-check text-green-500' : 'fa-spinner fa-spin text-blue-500'"
                      ></i>
                      <span class="font-mono font-medium text-purple-700">{{ tool.name }}</span>
                    </div>
                    <pre
                      v-if="tool.input !== undefined"
                      class="mt-1 text-[10px] text-gray-500 whitespace-pre-wrap break-words max-h-32 overflow-y-auto"
                      >in: {{ stringify(tool.input) }}</pre
                    >
                    <pre
                      v-if="tool.output !== undefined"
                      class="mt-1 text-[10px] text-gray-500 whitespace-pre-wrap break-words max-h-32 overflow-y-auto"
                      >out: {{ stringify(tool.output) }}</pre
                    >
                  </div>
                </div>
              </div>
              <div>
                <div class="text-[11px] font-semibold text-gray-400 mb-1">
                  RESPONSE
                  <span
                    v-if="!['done', 'error'].includes(call.phase)"
                    class="text-blue-500"
                    >▍</span
                  >
                </div>
                <pre
                  class="text-[11px] bg-white border border-gray-100 rounded-lg p-2 whitespace-pre-wrap break-words max-h-72 overflow-y-auto text-gray-700"
                  >{{ call.response || (call.phase === 'done' ? '(空)' : '…') }}</pre
                >
              </div>
            </div>
          </div>

          <!-- Node log entries -->
          <div
            v-for="(entry, idx) in detailLog"
            :key="idx"
            class="flex items-start gap-2 text-xs px-2 py-1 rounded"
            :class="{
              'text-red-600': entry.level === 'error',
              'text-yellow-700': entry.level === 'warn',
              'text-gray-600': entry.level === 'info',
            }"
          >
            <span class="text-[10px] text-gray-400 flex-shrink-0 w-16">{{
              fmt(entry.ts)
            }}</span>
            <span class="font-mono text-[11px] text-gray-400 flex-shrink-0">{{
              entry.step
            }}</span>
            <span class="flex-1">{{ entry.message }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Code Graph 监听页
 * @description 实时监听 code-agent 一次运行的每层进度: 左侧固定 10 节点拓扑显示状态/日志数/LLM 数, 右侧展开
 *   选中节点的日志时间线与每次 LLM 调用 (可展开看 prompt/response 全文)。经 `/code-graph` WebSocket 订阅。
 * @keywords-cn 监听页, 实时进度, LLM调用, 节点拓扑
 * @keywords-en monitor-page, realtime-progress, llm-call, node-topology
 */
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAgentStore } from '../../agent/store/agent.store';
import { CodeGraphMonitorSocket } from '../services/code-graph-monitor.socket';
import {
  CODE_GRAPH_NODES,
  type CodeGraphProgressMessage,
  type CodeGraphNodeEntry,
  type CodeGraphLlmCall,
  type CodeGraphNodeStatus,
} from '../types/code-graph-monitor.types';

const props = defineProps<{ sessionId?: string }>();

const agentStore = useAgentStore();
const sessionInput = ref(
  props.sessionId || agentStore.currentSessionId || '',
);
const status = ref<'connecting' | 'connected' | 'disconnected'>('disconnected');
const errorMsg = ref('');
const selectedNode = ref<string | null>(null);
const expanded = reactive(new Set<string>());
const messages = ref<CodeGraphProgressMessage[]>([]);

const socket = new CodeGraphMonitorSocket();

const statusLabel = computed(() =>
  status.value === 'connected'
    ? '已连接'
    : status.value === 'connecting'
      ? '连接中…'
      : '未连接',
);

const nodeLog = computed<Record<string, CodeGraphNodeEntry[]>>(() => {
  const map: Record<string, CodeGraphNodeEntry[]> = {};
  for (const msg of messages.value) {
    if (msg.entry.kind !== 'node') continue;
    (map[msg.entry.node] ??= []).push(msg.entry);
  }
  return map;
});

// LLM 调用: 按 callId 合并流式事件 (start→delta*→tool_start/tool_end→done), 累积正文与工具调用
const mergedLlm = computed<CodeGraphLlmCall[]>(() => {
  const byCall = new Map<string, CodeGraphLlmCall>();
  const order: string[] = [];
  for (const msg of messages.value) {
    if (msg.entry.kind !== 'llm') continue;
    const e = msg.entry;
    let call = byCall.get(e.callId);
    if (!call) {
      call = {
        callId: e.callId,
        node: e.node,
        source: e.source,
        phase: e.phase,
        prompt: '',
        response: '',
        tools: [],
        ts: e.ts,
      };
      byCall.set(e.callId, call);
      order.push(e.callId);
    }
    call.phase = e.phase;
    if (e.phase === 'start') call.prompt = e.prompt ?? call.prompt;
    else if (e.phase === 'delta') call.response += e.delta ?? '';
    else if (e.phase === 'tool_start')
      call.tools.push({ name: e.toolName, input: e.toolInput, done: false });
    else if (e.phase === 'tool_end') {
      const open = [...call.tools].reverse().find((t) => !t.done && t.name === e.toolName);
      if (open) {
        open.output = e.toolOutput;
        open.done = true;
      } else {
        call.tools.push({ name: e.toolName, output: e.toolOutput, done: true });
      }
    } else if (e.phase === 'done') {
      call.model = e.model;
      call.durationMs = e.durationMs;
      if (!call.response) call.response = e.response ?? '';
    } else if (e.phase === 'error') {
      call.error = e.error;
    }
  }
  return order.map((id) => byCall.get(id) as CodeGraphLlmCall);
});

const nodeLlm = computed<Record<string, CodeGraphLlmCall[]>>(() => {
  const map: Record<string, CodeGraphLlmCall[]> = {};
  for (const call of mergedLlm.value) (map[call.node] ??= []).push(call);
  return map;
});

const allLog = computed<CodeGraphNodeEntry[]>(() =>
  messages.value
    .filter((m) => m.entry.kind === 'node')
    .map((m) => m.entry as CodeGraphNodeEntry),
);

// 选中"全部活动"时看整会话所有 LLM 调用 + 所有节点日志 (含非 code-graph 的通用 agent 活动)
const ALL_NODE = '__all__';
const detailLlm = computed<CodeGraphLlmCall[]>(() =>
  selectedNode.value === ALL_NODE
    ? mergedLlm.value
    : (nodeLlm.value[selectedNode.value ?? ''] ?? []),
);
const detailLog = computed<CodeGraphNodeEntry[]>(() =>
  selectedNode.value === ALL_NODE
    ? allLog.value
    : (nodeLog.value[selectedNode.value ?? ''] ?? []),
);

const latestNode = computed<string | null>(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const n = messages.value[i].entry.node;
    if (CODE_GRAPH_NODES.includes(n)) return n;
  }
  return null;
});

const nodeStatus = computed<Record<string, CodeGraphNodeStatus>>(() => {
  const map: Record<string, CodeGraphNodeStatus> = {};
  CODE_GRAPH_NODES.forEach((node, idx) => {
    const logs = nodeLog.value[node] ?? [];
    const llms = nodeLlm.value[node] ?? [];
    const hasEvents = logs.length > 0 || llms.length > 0;
    const hasError =
      logs.some((l) => l.level === 'error' || /blocked/i.test(l.step)) ||
      llms.some((l) => l.phase === 'error');
    if (hasError) {
      map[node] = 'error';
    } else if (!hasEvents) {
      map[node] = 'pending';
    } else if (node === latestNode.value) {
      map[node] = 'active';
    } else {
      // 有更靠后的节点也有事件 → 本节点视为完成
      const laterHasEvents = CODE_GRAPH_NODES.slice(idx + 1).some(
        (n) => (nodeLog.value[n]?.length ?? 0) + (nodeLlm.value[n]?.length ?? 0) > 0,
      );
      map[node] = laterHasEvents ? 'done' : 'active';
    }
  });
  return map;
});

function toggle(callId: string): void {
  if (expanded.has(callId)) expanded.delete(callId);
  else expanded.add(callId);
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 2000);
  try {
    return JSON.stringify(value)?.slice(0, 2000) ?? String(value);
  } catch {
    return String(value);
  }
}

function start(): void {
  const sid = sessionInput.value.trim();
  if (!sid) {
    errorMsg.value = '请先填入 sessionId';
    return;
  }
  errorMsg.value = '';
  const token = (localStorage.getItem('token') || '').trim();
  socket.connect(sid, token, {
    onEvent: (msg) => messages.value.push(msg),
    onStatus: (s) => (status.value = s),
    onError: (m) => (errorMsg.value = m),
  });
}

function stop(): void {
  socket.disconnect();
  status.value = 'disconnected';
}

function clearAll(): void {
  messages.value = [];
  expanded.clear();
}

// 自动选中当前活跃节点 (未手动选时)
watch(latestNode, (n) => {
  if (n && !selectedNode.value) selectedNode.value = n;
});

onMounted(() => {
  selectedNode.value = ALL_NODE;
  if (sessionInput.value) start();
});
onUnmounted(() => socket.disconnect());
</script>
