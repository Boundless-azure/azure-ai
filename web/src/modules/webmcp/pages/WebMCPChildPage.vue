<template>
  <!-- WebMCP 子页面 — 嵌入 iframe 中的计数器 keyword: webmcp-child, counter, postmessage -->
  <div class="min-h-screen bg-gray-950 text-white font-sans flex flex-col items-center justify-center p-8 gap-6">

    <!-- 标识栏 child-header keyword: child-identity -->
    <div class="text-center">
      <p class="text-xs text-gray-500 uppercase tracking-widest mb-1">WebMCP 子页面</p>
      <h1 class="text-lg font-bold text-white">计数器</h1>
    </div>

    <!-- 计数显示 counter-display keyword: counter-value -->
    <div class="w-40 h-40 rounded-full border-2 border-white/15 flex items-center justify-center bg-gray-900">
      <span class="text-5xl font-bold tabular-nums">{{ count }}</span>
    </div>

    <!-- 操作按钮 counter-buttons keyword: counter-actions -->
    <div class="flex gap-3">
      <button @click="decrement()" class="w-12 h-12 rounded-full bg-gray-800 border border-white/10 hover:bg-white/10 text-xl transition-colors">－</button>
      <button @click="resetCount()" class="px-5 h-12 rounded-full bg-gray-800 border border-white/10 hover:bg-white/10 text-sm transition-colors">重置</button>
      <button @click="increment()" class="w-12 h-12 rounded-full bg-white text-black hover:bg-gray-100 text-xl font-bold transition-colors">＋</button>
    </div>

    <!-- 连接状态 connection-status keyword: mcp-status -->
    <div class="text-center">
      <span class="text-xs px-3 py-1.5 rounded-full"
        :class="ready ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-800 text-gray-500'">
        {{ ready ? '✓ 已连接父页面' : '⏳ 初始化中...' }}
      </span>
    </div>

    <!-- 操作日志 child-log keyword: child-log -->
    <div class="w-full max-w-xs bg-gray-900 rounded-xl p-4 border border-white/8">
      <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider">操作日志</p>
      <div class="font-mono text-xs text-gray-400 max-h-28 overflow-y-auto flex flex-col gap-0.5">
        <p v-for="(log, i) in logs" :key="i" class="leading-relaxed">
          <span class="text-gray-600">{{ log.time }}</span>
          <span class="ml-1.5" :class="log.cls">{{ log.text }}</span>
        </p>
        <p v-if="!logs.length" class="text-gray-600">暂无操作...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title WebMCPChildPage
 * @description 子页面计数器，嵌入父页面 iframe，通过 postMessage 与父页面通信。
 * @keyword-en webmcp-child-page, postmessage, counter, child-ready, op-handler
 */
import { ref, onMounted, onUnmounted } from 'vue';

// ========== 状态 state ==========
const count = ref(0);
const ready = ref(false);
const logs  = ref<{ time: string; text: string; cls: string }[]>([]);

/**
 * 追加日志
 * @keyword-en add-log
 */
function addLog(text: string, cls = 'text-gray-300') {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  logs.value.unshift({ time, text, cls });
  if (logs.value.length > 30) logs.value.pop();
}

// ========== 动作 actions ==========
/** 计数 +1 @keyword-en increment */
function increment() { count.value++; addLog(`increment → ${count.value}`, 'text-emerald-400'); }

/** 计数 -1 @keyword-en decrement */
function decrement() { count.value--; addLog(`decrement → ${count.value}`, 'text-amber-400'); }

/** 重置计数 @keyword-en reset-count */
function resetCount() { count.value = 0; addLog('reset → 0', 'text-indigo-400'); }

/** 设置计数到指定值 @keyword-en set-count */
function setCount(v: number) { count.value = v; addLog(`setCount → ${v}`, 'text-indigo-400'); }

// ========== postMessage 处理 postmessage-handler ==========

/**
 * 向父页面发送 op 执行结果
 * @keyword-en reply-to-parent
 */
function replyParent(id: unknown, result: unknown, error?: string) {
  window.parent.postMessage({ type: 'webmcp:op_result', id, result, error }, '*');
}

/**
 * 处理父页面发来的 webmcp:op 消息
 * @keyword-en handle-parent-op
 */
function handleParentOp(data: { id: unknown; op: { op: string; key?: string; args?: unknown[]; value?: unknown } }) {
  const { id, op } = data;
  try {
    if (op.op === 'callEmit') {
      const key = op.key;
      if (key === 'increment') { increment(); replyParent(id, { ok: true }); }
      else if (key === 'decrement') { decrement(); replyParent(id, { ok: true }); }
      else if (key === 'reset')     { resetCount(); replyParent(id, { ok: true }); }
      else { replyParent(id, null, `unknown emit: ${key}`); }
    } else if (op.op === 'setData') {
      const key = op.key;
      if (key === 'count') { setCount(Number(op.value)); replyParent(id, { ok: true }); }
      else { replyParent(id, null, `unknown data: ${key}`); }
    } else {
      replyParent(id, null, `unknown op: ${op.op}`);
    }
  } catch (e) {
    replyParent(id, null, String(e));
  }
}

/**
 * 监听来自父页面的 message 事件
 * @keyword-en on-window-message
 */
function onWindowMessage(e: MessageEvent) {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'webmcp:op') {
    addLog(`op: ${d.op?.op}(${d.op?.key ?? ''})`, 'text-amber-400');
    handleParentOp(d);
  }
}

// ========== 初始化 init ==========

/**
 * 初始化子页面 MCP，通知父页面就绪
 * @keyword-en init-child-mcp
 */
function initChildMCP() {
  const descriptor = {
    pageName: 'webmcp-child',
    pageDesc: '子页面计数器',
    data: [
      { key: 'count', name: '计数值', desc: '当前计数', schema: { type: 'number' } },
    ],
    emits: [
      { key: 'increment', name: '计数 +1',      desc: '计数加一' },
      { key: 'decrement', name: '计数 -1',      desc: '计数减一' },
      { key: 'reset',     name: '重置计数',     desc: '重置为 0' },
      { key: 'setCount',  name: '设置计数',     desc: '设置到指定值', schema: { type: 'number' } },
    ],
  };

  window.parent.postMessage({ type: 'webmcp:child_ready', descriptor }, '*');
  ready.value = true;
  addLog('✓ 已通知父页面', 'text-emerald-400');
}

// ========== 生命周期 lifecycle ==========
onMounted(() => {
  window.addEventListener('message', onWindowMessage);
  // 短暂延迟等待父页面就绪
  setTimeout(initChildMCP, 100);
});
onUnmounted(() => {
  window.removeEventListener('message', onWindowMessage);
});
</script>
