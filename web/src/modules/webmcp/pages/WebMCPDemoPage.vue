<template>
  <!-- WebMCP 完整演示主页 keyword: webmcp-demo, tabs, form, iframe, mcp-control -->
  <div class="min-h-screen bg-gray-950 text-white font-sans overflow-x-hidden">

    <!-- 顶部标题栏 header-area keyword: demo-header -->
    <div class="border-b border-white/10 bg-gray-900/80 backdrop-blur px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
      <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-sm">🤖</div>
      <div>
        <h1 class="text-sm font-bold text-white leading-none">WebMCP 演示页</h1>
        <p class="text-xs text-gray-500 mt-0.5">完整功能测试</p>
      </div>
      <span class="ml-auto text-xs px-2 py-1 rounded-full"
        :class="registered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'">
        {{ registered ? '✓ MCP已注册' : '⏳ 未注册' }}
      </span>
    </div>

    <!-- 主页签栏 main-tab-bar keyword: page-tabs -->
    <div class="border-b border-white/8 bg-gray-900/60 px-6 flex gap-0">
      <button
        v-for="t in PAGE_TABS"
        :key="t.key"
        @click="pageTab = t.key"
        class="px-4 py-3 text-xs font-semibold border-b-2 transition-colors"
        :class="pageTab === t.key
          ? 'border-white text-white'
          : 'border-transparent text-gray-500 hover:text-gray-300'"
      >{{ t.label }}</button>
    </div>

    <!-- Tab 1: 基础 Demo basic-tab-content -->
    <div v-show="pageTab === 'basic'" class="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

      <!-- 基础数据卡片 basic-data-cards -->
      <section class="bg-gray-900 rounded-2xl p-6 border border-white/10">
        <h2 class="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">📦 数据变量 (data)</h2>
        <div class="grid grid-cols-2 gap-4">

          <!-- 计数器 counter-card -->
          <div class="bg-gray-800 rounded-xl p-4">
            <p class="text-xs text-gray-400 mb-1">$count$ — 计数器</p>
            <p class="text-3xl font-bold text-white">{{ count }}</p>
            <div class="flex gap-2 mt-3">
              <button @click="count--" class="flex-1 py-1.5 text-sm bg-gray-700 hover:bg-white/10 rounded-lg transition-colors">－</button>
              <button @click="count++" class="flex-1 py-1.5 text-sm bg-white text-black hover:bg-gray-100 rounded-lg transition-colors">＋</button>
            </div>
          </div>

          <!-- 消息输入 message-card -->
          <div class="bg-gray-800 rounded-xl p-4">
            <p class="text-xs text-gray-400 mb-1">$message$ — 消息</p>
            <input v-model="message"
              class="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-transparent focus:border-white/30 mt-1"
              placeholder="输入消息..." />
          </div>

          <!-- 开关 toggle-card -->
          <div class="bg-gray-800 rounded-xl p-4">
            <p class="text-xs text-gray-400 mb-2">$enabled$ — 开关</p>
            <button @click="enabled = !enabled"
              class="w-10 h-5 rounded-full relative transition-colors"
              :class="enabled ? 'bg-white' : 'bg-gray-600'">
              <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform"
                :class="enabled ? 'translate-x-5 bg-black' : 'bg-white'"></span>
            </button>
            <p class="text-xs mt-2" :class="enabled ? 'text-white' : 'text-gray-500'">{{ enabled ? 'ON' : 'OFF' }}</p>
          </div>

          <!-- 状态选择 status-card -->
          <div class="bg-gray-800 rounded-xl p-4">
            <p class="text-xs text-gray-400 mb-2">$status$ — 状态</p>
            <select v-model="status"
              class="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-transparent focus:border-white/30">
              <option v-for="s in STATUS_OPTS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- 动作区 basic-emits-section -->
      <section class="bg-gray-900 rounded-2xl p-6 border border-white/10">
        <h2 class="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">⚡ 动作 (emit)</h2>
        <div class="flex flex-col gap-3">
          <!-- 重置 reset-emit-card -->
          <div class="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
            <div class="flex-1">
              <p class="text-sm font-medium">$reset$ — 重置全部</p>
              <p class="text-xs text-gray-400 mt-0.5">重置所有基础数据</p>
            </div>
            <button @click="handleReset()" class="px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm transition-colors">执行</button>
          </div>
          <!-- 弹窗 alert-emit-card -->
          <div class="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
            <div class="flex-1">
              <p class="text-sm font-medium">$alert$ — 弹出提示</p>
              <p class="text-xs text-gray-400 mt-0.5">schema: string</p>
            </div>
            <div class="flex gap-2">
              <input v-model="alertArg" class="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-transparent focus:border-white/30 w-32" placeholder="消息..." />
              <button @click="handleAlert(alertArg)" class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">执行</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 日志 log-section -->
      <LogPanel :logs="logs" @clear="logs = []" />
    </div>

    <!-- Tab 2: 表单控件 form-tab-content -->
    <div v-show="pageTab === 'form'" class="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

      <!-- 下拉选择 select-control-section keyword: select-mcp -->
      <section class="bg-gray-900 rounded-2xl p-6 border border-white/10">
        <h2 class="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">🎛 下拉选择控件</h2>
        <div class="relative">
          <!-- 搜索/触发框 select-trigger -->
          <div class="flex gap-2 mb-2">
            <input
              v-model="selectSearch"
              @focus="selectOpen = true"
              @blur="delayCloseSelect"
              class="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/10 focus:border-white/30 transition-colors"
              :placeholder="selectValue ? selectValue : '搜索或选择...'"
            />
            <button @click="selectOpen = !selectOpen" class="px-3 py-2 bg-gray-800 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
              {{ selectOpen ? '▲' : '▼' }}
            </button>
          </div>
          <!-- 下拉列表 select-dropdown -->
          <div v-if="selectOpen"
            class="absolute z-20 left-0 right-8 bg-gray-800 border border-white/15 rounded-xl shadow-2xl overflow-hidden">
            <div v-for="(opt, idx) in filteredSelectOpts" :key="opt.value"
              @mousedown="pickSelectOption(idx)"
              class="px-4 py-2.5 text-sm cursor-pointer transition-colors"
              :class="opt.value === selectValue ? 'bg-white/15 text-white' : 'text-gray-300 hover:bg-white/8'">
              <span class="text-gray-500 text-xs mr-2">[{{ idx }}]</span>{{ opt.label }}
            </div>
            <div v-if="filteredSelectOpts.length === 0" class="px-4 py-3 text-sm text-gray-500">无匹配结果</div>
          </div>
          <p class="text-xs text-gray-500 mt-2">当前值: <span class="text-white font-mono">{{ selectValue || '(未选)' }}</span></p>
        </div>
      </section>

      <!-- 输入框控件 input-fields-section keyword: input-mcp -->
      <section class="bg-gray-900 rounded-2xl p-6 border border-white/10">
        <h2 class="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">✏️ 输入框控件</h2>
        <div class="flex flex-col gap-3">
          <div v-for="field in INPUT_FIELDS" :key="field.key" class="flex items-center gap-3">
            <label class="text-xs text-gray-400 w-16 shrink-0">{{ field.label }}</label>
            <input
              v-model="inputValues[field.key]"
              :type="field.type"
              :placeholder="field.placeholder"
              class="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/10 focus:border-white/30 transition-colors"
            />
            <button @click="inputValues[field.key] = ''" class="text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">清空</button>
          </div>
        </div>
      </section>

      <!-- 表单验证 form-validation-section keyword: form-validator -->
      <section class="bg-gray-900 rounded-2xl p-6 border border-white/10">
        <h2 class="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">📋 表单验证</h2>
        <div class="flex flex-col gap-3">

          <!-- 姓名 form-name-field -->
          <div>
            <label class="text-xs text-gray-400">姓名 *</label>
            <input v-model="form.name"
              class="w-full mt-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none border transition-colors"
              :class="formErrors.name ? 'border-red-500/60' : 'border-white/10 focus:border-white/30'"
              placeholder="请输入姓名（2-20字）" />
            <p v-if="formErrors.name" class="text-xs text-red-400 mt-1">{{ formErrors.name }}</p>
          </div>

          <!-- 邮箱 form-email-field -->
          <div>
            <label class="text-xs text-gray-400">邮箱 *</label>
            <input v-model="form.email" type="email"
              class="w-full mt-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none border transition-colors"
              :class="formErrors.email ? 'border-red-500/60' : 'border-white/10 focus:border-white/30'"
              placeholder="请输入邮箱" />
            <p v-if="formErrors.email" class="text-xs text-red-400 mt-1">{{ formErrors.email }}</p>
          </div>

          <!-- 年龄 form-age-field -->
          <div>
            <label class="text-xs text-gray-400">年龄 *</label>
            <input v-model.number="form.age" type="number"
              class="w-full mt-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none border transition-colors"
              :class="formErrors.age ? 'border-red-500/60' : 'border-white/10 focus:border-white/30'"
              placeholder="1-120" min="1" max="120" />
            <p v-if="formErrors.age" class="text-xs text-red-400 mt-1">{{ formErrors.age }}</p>
          </div>

          <!-- 角色 form-role-field -->
          <div>
            <label class="text-xs text-gray-400">角色</label>
            <select v-model="form.role"
              class="w-full mt-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/10 focus:border-white/30">
              <option value="user">用户</option>
              <option value="admin">管理员</option>
              <option value="guest">访客</option>
            </select>
          </div>

          <!-- 操作按钮 form-actions -->
          <div class="flex gap-3 pt-2">
            <button @click="handleFormValidate()" class="flex-1 py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/20 rounded-xl transition-colors">验证</button>
            <button @click="handleFormSubmit()" class="flex-1 py-2.5 text-sm font-semibold bg-white text-black hover:bg-gray-100 rounded-xl transition-colors">提交</button>
            <button @click="handleFormReset()" class="px-4 py-2.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors">重置</button>
          </div>

          <!-- 验证结果 form-result -->
          <div v-if="formSubmitResult" class="text-xs rounded-xl px-4 py-3 mt-1"
            :class="formSubmitResult.ok ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/40 text-red-400 border border-red-500/20'">
            {{ formSubmitResult.msg }}
          </div>
        </div>
      </section>

      <!-- 日志 log-section -->
      <LogPanel :logs="logs" @clear="logs = []" />
    </div>

    <!-- Tab 3: Tab 切换测试 tabs-tab-content -->
    <div v-show="pageTab === 'tabs'" class="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

      <!-- 可操控的 Tab 组件 inner-tab-section keyword: inner-tab-control -->
      <section class="bg-gray-900 rounded-2xl border border-white/10 overflow-hidden">
        <!-- 内部 tab bar inner-tab-bar -->
        <div class="border-b border-white/10 bg-gray-800/60 px-4 flex items-center gap-2 min-h-[44px]">
          <button
            v-for="(tab, idx) in innerTabs"
            :key="tab.id"
            @click="innerTab = idx"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors group"
            :class="innerTab === idx ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'">
            {{ tab.title }}
            <span v-if="innerTabs.length > 1"
              @click.stop="closeInnerTab(idx)"
              class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity ml-0.5 text-xs leading-none">×</span>
          </button>
          <!-- 新建 tab new-tab-btn -->
          <button @click="newInnerTab()" class="ml-1 w-6 h-6 rounded-md bg-white/6 hover:bg-white/12 text-gray-400 hover:text-white transition-colors text-sm flex items-center justify-center">+</button>
        </div>
        <!-- tab 内容区 inner-tab-content -->
        <div class="p-6">
          <div v-if="innerTabs[innerTab]" class="flex flex-col gap-3">
            <p class="text-sm text-gray-300">
              当前标签: <span class="text-white font-semibold">{{ innerTabs[innerTab].title }}</span>
              <span class="text-gray-500 ml-2">(index {{ innerTab }})</span>
            </p>
            <div class="bg-gray-800 rounded-xl p-4 text-xs text-gray-400 font-mono">
              tab[{{ innerTab }}] = {{ JSON.stringify(innerTabs[innerTab]) }}
            </div>
            <textarea v-model="innerTabs[innerTab].content"
              class="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white outline-none border border-white/10 focus:border-white/30 resize-none"
              rows="4" placeholder="在此标签页中输入内容..."></textarea>
          </div>
        </div>
      </section>

      <!-- 日志 log-section -->
      <LogPanel :logs="logs" @clear="logs = []" />
    </div>

    <!-- Tab 4: 子页面 iframe iframe-tab-content -->
    <div v-show="pageTab === 'iframe'" class="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

      <!-- iframe 容器 iframe-section keyword: child-page, postmessage -->
      <section class="bg-gray-900 rounded-2xl border border-white/10 overflow-hidden">
        <div class="border-b border-white/10 bg-gray-800/60 px-5 py-3 flex items-center gap-2">
          <span class="text-xs font-semibold text-gray-300">子页面 iframe</span>
          <span class="text-xs px-2 py-0.5 rounded-full ml-2"
            :class="childReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'">
            {{ childReady ? '✓ 已连接' : '⏳ 等待...' }}
          </span>
          <button @click="reloadChild()" class="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors">重新加载</button>
        </div>
        <!-- iframe 嵌入 iframe-embed -->
        <iframe
          ref="childIframe"
          src="/webmcp-child"
          class="w-full border-0 bg-transparent"
          style="height: 420px;"
          title="WebMCP 子页面"
        ></iframe>
      </section>

      <!-- 子页面描述 child-descriptor-section -->
      <section v-if="childDescriptor" class="bg-gray-900 rounded-2xl p-5 border border-white/10">
        <h2 class="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">子页面 MCP 描述符</h2>
        <pre class="text-xs bg-gray-950 rounded-xl p-4 overflow-x-auto text-green-400 leading-relaxed">{{ JSON.stringify(childDescriptor, null, 2) }}</pre>
      </section>

      <!-- 日志 log-section -->
      <LogPanel :logs="logs" @clear="logs = []" />
    </div>

  </div>
</template>

<script setup lang="ts">
/**
 * @title WebMCPDemoPage
 * @description WebMCP 完整功能演示页：基础数据/动作 + 表单控件 + Tab + 子页面 iframe。
 * @keyword-en webmcp-demo, form-controls, tabs, iframe, child-page, schema, setData-handle
 */
import { ref, reactive, computed, watch, onMounted, onUnmounted, defineComponent, h } from 'vue';
import { z } from 'zod';

// ========== GlobalThis 类型扩展 webmcp-type-extend ==========
declare global {
  interface WebMcpSDKInstance {
    setData:             (m: Record<string, WebMcpDataEntry>) => void;
    setEmit:             (m: Record<string, WebMcpEmitEntry>) => void;
    getDescriptor:       () => WebMcpDescriptor;
    reRegister:          () => void;
    setDataValue:        (key: string, value: unknown) => { ok: boolean; error?: string };
    getDataValue:        (key: string) => unknown;
    registerChildFrame:  (childKey: string, iframe: HTMLIFrameElement) => () => void;
  }
  interface WebMcpDataEntry {
    name:    string;
    desc:    string;
    schema?: unknown;
    value:   () => unknown;
    handle:  (payload: unknown) => void;
  }
  interface WebMcpEmitEntry {
    name:    string;
    desc:    string;
    schema?: unknown;
    handle:  (...args: unknown[]) => unknown;
  }
  interface WebMcpDescriptor {
    pageName: string; pageDesc: string;
    data: unknown[]; emits: unknown[]; children?: unknown[];
  }
  interface Window {
    WebMCP?: {
      initWebMCP:               (opts: { pageName: string; pageDesc: string }) => WebMcpSDKInstance;
      registerWebMCPComponents: () => void;
    };
  }
}

// ========== 常量 constants ==========
const PAGE_TABS = [
  { key: 'basic',  label: '📦 基础 Demo' },
  { key: 'form',   label: '📋 表单控件' },
  { key: 'tabs',   label: '🗂 标签切换' },
  { key: 'iframe', label: '🖼 子页面' },
];
const STATUS_OPTS = ['idle', 'loading', 'success', 'error'] as const;
const SELECT_OPTIONS = [
  { value: 'apple',  label: '🍎 苹果' },
  { value: 'banana', label: '🍌 香蕉' },
  { value: 'orange', label: '🍊 橙子' },
  { value: 'grape',  label: '🍇 葡萄' },
  { value: 'mango',  label: '🥭 芒果' },
  { value: 'lemon',  label: '🍋 柠檬' },
];
const INPUT_FIELDS = [
  { key: 'name',  label: '姓名', type: 'text', placeholder: '请输入姓名' },
  { key: 'phone', label: '手机', type: 'tel',  placeholder: '请输入手机号' },
  { key: 'addr',  label: '地址', type: 'text', placeholder: '请输入地址' },
];

// ========== 状态 state-refs ==========
const pageTab = ref<string>('basic');

// 基础 Demo
const count    = ref(0);
const message  = ref('Hello WebMCP');
const enabled  = ref(true);
const status   = ref<string>('idle');
const alertArg = ref('这是来自 MCP 的消息');

// 表单控件
const selectValue  = ref('');
const selectSearch = ref('');
const selectOpen   = ref(false);
const inputValues  = reactive<Record<string, string>>({ name: '', phone: '', addr: '' });
const form         = reactive({ name: '', email: '', age: null as number | null, role: 'user' });
const formErrors   = reactive({ name: '', email: '', age: '' });
const formSubmitResult = ref<{ ok: boolean; msg: string } | null>(null);

// 内部 Tab
const innerTab  = ref(0);
const innerTabs = ref([
  { id: 1, title: 'Tab 1', content: '' },
  { id: 2, title: 'Tab 2', content: '' },
]);
let tabIdSeq = 3;

// iframe 子页面
const childIframe    = ref<HTMLIFrameElement | null>(null);
const childReady     = ref(false);
const childDescriptor = ref<WebMcpDescriptor | null>(null);

// 日志
const registered = ref(false);
const logs = ref<{ time: string; type: string; text: string }[]>([]);

/**
 * 添加操作日志条目
 * @keyword-en add-log
 */
function addLog(type: string, text: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  logs.value.unshift({ time, type, text });
  if (logs.value.length > 80) logs.value.pop();
}

// ========== LogPanel 内联组件 log-panel-component ==========
/**
 * 操作日志面板（内联组件）
 * @keyword-en log-panel-component
 */
const LogPanel = defineComponent({
  props: { logs: Array },
  emits: ['clear'],
  setup(props, { emit }) {
    return () => h('section', { class: 'bg-gray-900 rounded-2xl p-5 border border-white/10' }, [
      h('div', { class: 'flex items-center justify-between mb-3' }, [
        h('h2', { class: 'text-xs font-semibold text-gray-400 uppercase tracking-wider' }, '📋 操作日志'),
        h('button', { class: 'text-xs text-gray-600 hover:text-gray-300 transition-colors', onClick: () => emit('clear') }, '清空'),
      ]),
      h('div', { class: 'bg-gray-950 rounded-xl p-4 font-mono text-xs leading-relaxed max-h-40 overflow-y-auto' },
        (props.logs as { time: string; type: string; text: string }[]).length === 0
          ? [h('p', { class: 'text-gray-600' }, '暂无操作...')]
          : (props.logs as { time: string; type: string; text: string }[]).map((log, i) =>
              h('p', { key: i, class: 'text-gray-300' }, [
                h('span', { class: 'text-gray-600' }, log.time),
                h('span', { class: 'ml-2 ' + (log.type === 'emit' ? 'text-amber-400' : log.type === 'data' ? 'text-indigo-400' : 'text-emerald-400') }, log.text),
              ])
            )
      ),
    ]);
  },
});

// ========== 计算属性 ==========
/** 下拉选项过滤 @keyword-en filter-select-options */
const filteredSelectOpts = computed(() => {
  const q = selectSearch.value.toLowerCase();
  if (!q) return SELECT_OPTIONS;
  return SELECT_OPTIONS.filter(o => o.label.toLowerCase().includes(q) || o.value.includes(q));
});

// ========== 处理函数 handlers ==========

/** @keyword-en handle-basic-reset */
function handleReset() {
  count.value = 0; message.value = ''; enabled.value = false; status.value = 'idle';
  addLog('emit', '[reset] 已重置所有基础数据');
}

/** @keyword-en handle-alert */
function handleAlert(msg: string) {
  window.alert(msg || '(空消息)');
  addLog('emit', '[alert] ' + (msg || '(空消息)'));
}

/** 选中下拉第 idx 个可见选项 @keyword-en pick-select-option */
function pickSelectOption(idx: number) {
  const opt = filteredSelectOpts.value[idx];
  if (!opt) return;
  selectValue.value = opt.value;
  selectSearch.value = '';
  selectOpen.value = false;
  addLog('data', '[select] → ' + opt.value);
}

/** 延迟关闭下拉选择（blur 时使用） @keyword-en delay-close-select */
function delayCloseSelect() {
  setTimeout(() => { selectOpen.value = false; }, 150);
}

/** 表单字段验证 @keyword-en validate-form */
function validateForm(): boolean {
  formErrors.name = ''; formErrors.email = ''; formErrors.age = '';
  let ok = true;
  if (!form.name || form.name.length < 2 || form.name.length > 20) { formErrors.name = '姓名需为 2-20 个字符'; ok = false; }
  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { formErrors.email = '请输入有效邮箱'; ok = false; }
  if (form.age === null || form.age < 1 || form.age > 120) { formErrors.age = '年龄需在 1-120 之间'; ok = false; }
  return ok;
}

/** @keyword-en handle-form-validate */
function handleFormValidate() {
  const ok = validateForm();
  formSubmitResult.value = ok ? { ok: true, msg: '✓ 表单验证通过' } : { ok: false, msg: '✗ 表单存在验证错误' };
  addLog('emit', '[form.validate] ' + (ok ? '通过' : '失败'));
}

/** @keyword-en handle-form-submit */
function handleFormSubmit() {
  if (!validateForm()) {
    formSubmitResult.value = { ok: false, msg: '✗ 验证失败，请修正后提交' };
    addLog('emit', '[form.submit] 失败');
    return;
  }
  formSubmitResult.value = { ok: true, msg: `✓ 提交: ${form.name} / ${form.email} / ${form.age} / ${form.role}` };
  addLog('emit', `[form.submit] ${form.name} <${form.email}>`);
}

/** @keyword-en handle-form-reset */
function handleFormReset() {
  form.name = ''; form.email = ''; form.age = null; form.role = 'user';
  formErrors.name = ''; formErrors.email = ''; formErrors.age = '';
  formSubmitResult.value = null;
  addLog('emit', '[form.reset]');
}

/** 新建内部 Tab @keyword-en new-inner-tab */
function newInnerTab(title?: string) {
  const id = tabIdSeq++;
  innerTabs.value.push({ id, title: title || `Tab ${id}`, content: '' });
  innerTab.value = innerTabs.value.length - 1;
  addLog('emit', '[tabs.new] → Tab ' + id);
}

/** 关闭内部 Tab @keyword-en close-inner-tab */
function closeInnerTab(idx: number) {
  if (innerTabs.value.length <= 1) return;
  innerTabs.value.splice(idx, 1);
  if (innerTab.value >= innerTabs.value.length) innerTab.value = innerTabs.value.length - 1;
  addLog('emit', '[tabs.close] idx=' + idx);
}

/** 子页面重载 @keyword-en reload-child-iframe */
function reloadChild() {
  childReady.value = false; childDescriptor.value = null;
  const iframe = childIframe.value;
  if (iframe) { const src = iframe.src; iframe.src = ''; iframe.src = src; }
}

// ========== WebMCP 初始化 mcp-init ==========
let mcpInstance: WebMcpSDKInstance | null = null;

/** 初始化 MCP，注册全部 data + emit @keyword-en init-mcp */
function initMCP() {
  const WebMCP = window.WebMCP;
  if (!WebMCP) { setTimeout(initMCP, 200); return; }

  mcpInstance = WebMCP.initWebMCP({ pageName: 'webmcp-demo', pageDesc: 'WebMCP 完整功能演示页' });

  mcpInstance.setData({
    '$count$':        { name: '计数',   desc: '当前计数值',   schema: z.number().describe('计数必须为数字'),  value: () => count.value,   handle: (v) => { count.value   = Number(v); } },
    '$message$':      { name: '消息',   desc: '当前消息文本', schema: z.string().min(1).max(100).describe('消息文本，1-100字'),  value: () => message.value, handle: (v) => { message.value = String(v ?? ''); } },
    '$enabled$':      { name: '开关',   desc: '功能开关状态', schema: z.boolean().describe('布尔开关'), value: () => enabled.value, handle: (v) => { enabled.value = Boolean(v); } },
    '$status$':       { name: '状态',   desc: '运行状态', schema: z.enum(['idle','loading','success','error']).describe('状态枚举'), value: () => status.value, handle: (v) => { status.value = String(v ?? 'idle'); } },
    '$select.value$': { name: '下拉选中值', desc: '当前选中选项 value', schema: z.string().describe('下拉选项值'), value: () => selectValue.value, handle: (v) => { selectValue.value = String(v ?? ''); } },
    '$input.name$':   { name: '姓名输入框', desc: 'name 输入框',  schema: z.string().min(2).max(20).describe('姓名2-20字'), value: () => inputValues.name,  handle: (v) => { inputValues.name  = String(v ?? ''); } },
    '$input.phone$':  { name: '手机输入框', desc: 'phone 输入框', schema: z.string().regex(/^1\d{10}$/).describe('手机号11位'), value: () => inputValues.phone, handle: (v) => { inputValues.phone = String(v ?? ''); } },
    '$input.addr$':   { name: '地址输入框', desc: 'addr 输入框',  schema: z.string().max(50).describe('地址最多50字'), value: () => inputValues.addr,  handle: (v) => { inputValues.addr  = String(v ?? ''); } },
    '$form.name$':    { name: '表单-姓名', desc: '表单姓名字段', schema: z.string().min(2).max(20).describe('姓名2-20字'), value: () => form.name,  handle: (v) => { form.name  = String(v ?? ''); } },
    '$form.email$':   { name: '表单-邮箱', desc: '表单邮箱字段', schema: z.string().email().describe('邮箱格式'), value: () => form.email, handle: (v) => { form.email = String(v ?? ''); } },
    '$form.age$':     { name: '表单-年龄', desc: '表单年龄字段', schema: z.number().int().min(1).max(120).describe('年龄1-120'), value: () => form.age,   handle: (v) => { form.age   = Number(v); } },
    '$form.role$':    { name: '表单-角色', desc: '表单角色字段', schema: z.enum(['user','admin','guest']).describe('角色枚举'), value: () => form.role, handle: (v) => { form.role = String(v ?? 'user'); } },
    '$form.errors$':  { name: '表单错误',  desc: '验证错误（只读）', value: () => ({ ...formErrors }), handle: () => {} },
    '$tabs.current$': { name: '当前标签序号', desc: '激活的 Tab index', schema: z.number().int().min(0).describe('Tab索引'), value: () => innerTab.value, handle: (v) => { const i = Number(v); if (i >= 0 && i < innerTabs.value.length) innerTab.value = i; } },
    '$tabs.count$':   { name: '标签总数', desc: '当前打开的 Tab 数', value: () => innerTabs.value.length, handle: () => {} },
  });

  mcpInstance.setEmit({
    '$reset$': { name: '重置全部', desc: '重置所有基础演示数据', handle: () => handleReset() },
    '$alert$': { name: '弹出提示', desc: '显示 alert 弹窗', schema: { type: 'string' }, handle: (msg: unknown) => handleAlert(String(msg ?? '')) },
    '$select.open$':   { name: '打开下拉', desc: '展开选择框', handle: () => { selectOpen.value = true;  addLog('emit', '[select.open]'); } },
    '$select.close$':  { name: '关闭下拉', desc: '收起选择框', handle: () => { selectOpen.value = false; addLog('emit', '[select.close]'); } },
    '$select.pick$':   { name: '选择第N项', desc: '选择第 index 个可见选项（0-based）', schema: { type: 'number' }, handle: (idx: unknown) => { pickSelectOption(Number(idx)); } },
    '$select.search$': { name: '搜索下拉', desc: '在选择框中搜索过滤', schema: { type: 'string' }, handle: (q: unknown) => { selectSearch.value = String(q ?? ''); selectOpen.value = true; addLog('emit', '[select.search] ' + q); } },
    '$input.fill$': { name: '填写输入框', desc: '向指定框写内容 { field, value }', schema: { type: 'object' }, handle: (p: unknown) => {
      const { field, value } = (p as { field: string; value: string }) ?? {};
      if (field && field in inputValues) { inputValues[field] = String(value ?? ''); addLog('emit', `[input.fill] ${field}="${value}"`); }
    }},
    '$input.clear$': { name: '清空输入框', desc: '清空指定框：name/phone/addr', schema: { type: 'string', enum: ['name','phone','addr'] }, handle: (f: unknown) => {
      const field = String(f ?? '');
      if (field in inputValues) { inputValues[field] = ''; addLog('emit', `[input.clear] ${field}`); }
    }},
    '$input.get$': { name: '获取输入框内容', desc: '返回指定框当前值', schema: { type: 'string', enum: ['name','phone','addr'] }, handle: (f: unknown) => {
      const field = String(f ?? ''); return inputValues[field] ?? null;
    }},
    '$form.validate$': { name: '触发验证', desc: '执行表单验证',      handle: () => { handleFormValidate(); } },
    '$form.submit$':   { name: '提交表单', desc: '提交表单（含验证）', handle: () => { handleFormSubmit(); } },
    '$form.reset$':    { name: '重置表单', desc: '清空所有字段',       handle: () => { handleFormReset(); } },
    '$tabs.new$':    { name: '新建标签', desc: '新建 Tab，可传 title', schema: { type: 'string' }, handle: (title: unknown) => { newInnerTab(title ? String(title) : undefined); } },
    '$tabs.close$':  { name: '关闭标签', desc: '关闭第 index 个 Tab', schema: { type: 'number' }, handle: (idx: unknown) => { closeInnerTab(Number(idx)); } },
    '$tabs.switch$': { name: '切换标签', desc: '切换到第 index 个 Tab', schema: { type: 'number' }, handle: (idx: unknown) => {
      const i = Number(idx);
      if (i >= 0 && i < innerTabs.value.length) { innerTab.value = i; addLog('emit', '[tabs.switch] → ' + i); }
    }},
    '$child.increment$': { name: '子页面 +1',      desc: '子页面计数 +1',          handle: () => callChild({ op: 'callEmit', key: 'increment', args: [] }) },
    '$child.decrement$': { name: '子页面 -1',      desc: '子页面计数 -1',          handle: () => callChild({ op: 'callEmit', key: 'decrement', args: [] }) },
    '$child.reset$':     { name: '子页面重置',     desc: '重置子页面计数到 0',     handle: () => callChild({ op: 'callEmit', key: 'reset', args: [] }) },
    '$child.setCount$':  { name: '子页面设置计数', desc: '设置子页面计数到指定值', schema: { type: 'number' }, handle: (v: unknown) => callChild({ op: 'setData', key: 'count', value: Number(v) }) },
  });

  WebMCP.registerWebMCPComponents();
  registered.value = true;
  addLog('init', '✓ WebMCP 初始化完成');

  if (!document.querySelector('webmcp-float')) document.body.appendChild(document.createElement('webmcp-float'));
  if (!document.querySelector('webmcp-debug')) document.body.appendChild(document.createElement('webmcp-debug'));
}

/** 向子页面 iframe 转发 op @keyword-en call-child-op */
async function callChild(op: Record<string, unknown>) {
  if (!childIframe.value || !childReady.value) {
    addLog('emit', '[child] iframe 未就绪');
    return;
  }
  childIframe.value.contentWindow?.postMessage({ type: 'webmcp:op', id: Date.now(), op }, '*');
}

/** 监听子页面 postMessage @keyword-en on-window-message */
function onWindowMessage(e: MessageEvent) {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'webmcp:child_ready') {
    childReady.value = true;
    childDescriptor.value = d.descriptor ?? null;
    addLog('init', '[child] 子页面已就绪: ' + (d.descriptor?.pageName ?? '?'));
    mcpInstance?.reRegister();
  }
}

// ========== 数据变化日志 data-watchers ==========
watch(count,       (v) => addLog('data', `[count] → ${v}`));
watch(message,     (v) => addLog('data', `[message] → "${v}"`));
watch(enabled,     (v) => addLog('data', `[enabled] → ${v}`));
watch(status,      (v) => addLog('data', `[status] → ${v}`));
watch(selectValue, (v) => addLog('data', `[select] → ${v}`));
watch(innerTab,    (v) => addLog('data', `[tabs.current] → ${v}`));

// ========== 生命周期 lifecycle ==========
onMounted(() => {
  initMCP();
  window.addEventListener('message', onWindowMessage);
});
onUnmounted(() => {
  window.removeEventListener('message', onWindowMessage);
  document.querySelector('webmcp-float')?.remove();
  document.querySelector('webmcp-debug')?.remove();
});
</script>
