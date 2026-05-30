<template>
  <div class="hook-component-renderer">
    <!-- Loading state -->
    <div
      v-if="state === 'loading'"
      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-xs"
    >
      <div class="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin flex-shrink-0"></div>
      <span class="font-mono opacity-70">{{ actionHook }}</span>
    </div>

    <!-- Offline state -->
    <div
      v-else-if="state === 'offline'"
      class="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 text-xs"
    >
      <i class="fa-solid fa-circle-xmark text-gray-300 flex-shrink-0"></i>
      <span class="font-mono opacity-60 truncate">{{ actionHook }}</span>
      <span class="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-500 font-semibold uppercase tracking-wide">offline</span>
    </div>

    <!-- Component mount target -->
    <div v-else ref="mountRef" class="hook-component-mount"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Hook Component Renderer
 * @description 根据 actionHook 动态从 Runner 拉取并渲染 Web Component JS 模块。
 *              SaaS 端自动路由到持有该 hook 的 runner，无需前端显式传 runnerId。
 *              支持 loading / offline / ready 三种状态，组件 JS 通过 Blob URL 动态 import。
 *              组件挂载进 Shadow DOM (mode:'open')：宿主全局样式 (Tailwind preflight / class)
 *              不会穿透污染组件，组件内样式也不会泄漏到聊天页；仅继承属性 (font/color) 跨边界。
 * @keywords-cn hook组件渲染, 动态组件, solution组件, 离线状态, 样式隔离, shadowDOM
 * @keywords-en hook-component-renderer, dynamic-component, solution-component, offline-state, style-isolation, shadow-dom
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRightPanelStore } from '../../store/right-panel.store';
import { createHookComponentCtx } from './hook-component-ctx';

/**
 * 注入每个 shadow root 的最小 base reset。
 * shadow 边界切断了宿主 Tailwind preflight，组件历史上隐式依赖 box-sizing:border-box，
 * 这里补齐以保持既有布局；不引入其它全局规则，隔离性由 shadow 边界本身保证。
 * @keyword-en shadow-base-reset
 */
const SHADOW_BASE_RESET = '*,*::before,*::after{box-sizing:border-box}';

interface Props {
  /** actionHook 地址，如 runner.app.todo.card
   * @keyword-en action-hook-name
   */
  actionHook: string;
  /** 传给组件 render 函数的动态载荷
   * @keyword-en component-payload
   */
  payload?: unknown;
  /** 组件所属消息 id，注入 ctx 供快照锚定
   * @keyword-en renderer-message-id
   */
  messageId?: string;
  /** 组件所属会话 id，注入 ctx
   * @keyword-en renderer-session-id
   */
  sessionId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  payload: () => null,
  messageId: '',
  sessionId: '',
});

type State = 'loading' | 'offline' | 'ready';
const state = ref<State>('loading');
const mountRef = ref<HTMLElement | null>(null);

/**
 * 组件 JS Blob URL 模块级缓存，同一 hookName 只 fetch 一次。
 * LRU 上限 50，超出时淘汰最早项并 revoke 其 Blob URL。
 * @keyword-en blob-url-cache lru-eviction
 */
const MAX_CACHE = 50;
const componentCache = new Map<string, string>();

function setCached(key: string, url: string) {
  if (componentCache.size >= MAX_CACHE) {
    const oldest = componentCache.keys().next().value;
    if (oldest !== undefined) {
      URL.revokeObjectURL(componentCache.get(oldest)!);
      componentCache.delete(oldest);
    }
  }
  componentCache.set(key, url);
}

/** 当前挂载的卸载回调（组件可选导出 unmount），接收的目标与 render 一致（shadow root） */
let unmountFn: ((root: ShadowRoot) => void) | null = null;

/** 当前组件挂载的 shadow root，复用同一宿主元素上已创建的实例（attachShadow 不可重复调用） */
let shadowTarget: ShadowRoot | null = null;

/**
 * 在挂载元素上获取/创建 shadow root 并清空、注入 base reset，返回供组件 render 写入的隔离容器。
 * @keyword-en ensure-shadow-root
 */
function ensureShadowRoot(host: HTMLElement): ShadowRoot {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = SHADOW_BASE_RESET;
  root.appendChild(style);
  return root;
}

/**
 * 监听组件 JS 派发的导航事件，跳转右侧面板对应 Tab。
 * 例如文件列表组件点击文件夹后派发: new CustomEvent('hookComponent:navigate',
 *   { detail: { tab: 'storage', label: '文件库', props: { jumpRequest: { path, ts } } } })
 * @keyword-en hook-component-navigate-handler
 */
const rightPanel = useRightPanelStore();
function onNavigate(e: Event) {
  const { tab, label, props } = (e as CustomEvent<{ tab: string; label?: string; props?: Record<string, unknown> }>).detail;
  if (tab) rightPanel.openTab(tab, label ?? tab, props ?? {});
}
onMounted(() => window.addEventListener('hookComponent:navigate', onNavigate));

/**
 * 拉取并挂载 hook 组件。SaaS 根据 hookName 自动路由到正确 runner。
 * @keyword-en fetch-and-mount-hook-component
 */
const fetchAndMount = async () => {
  state.value = 'loading';
  if (unmountFn && shadowTarget) {
    unmountFn(shadowTarget);
    unmountFn = null;
  }
  shadowTarget = null;

  try {
    let blobUrl = componentCache.get(props.actionHook);

    if (!blobUrl) {
      const url = `/api/hook-component?hookName=${encodeURIComponent(props.actionHook)}`;
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        state.value = 'offline';
        return;
      }
      const js = await res.text();
      const blob = new Blob([js], { type: 'application/javascript' });
      blobUrl = URL.createObjectURL(blob);
      setCached(props.actionHook, blobUrl);
    }

    const mod = await import(/* @vite-ignore */ blobUrl);
    state.value = 'ready';

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    if (!mountRef.value) return;

    // 组件统一写入 shadow root，宿主与组件样式互不穿透
    const target = ensureShadowRoot(mountRef.value);
    shadowTarget = target;

    // 能力注入对象：组件经 ctx 访问数据，不碰 URL / token / 全局事件
    const ctx = createHookComponentCtx({
      messageId: props.messageId,
      sessionId: props.sessionId,
      openTab: rightPanel.openTab,
      refresh: () => fetchAndMount(),
    });

    if (typeof mod.default === 'function') {
      mod.default(target, props.payload, ctx);
    } else if (mod.default && typeof mod.default.render === 'function') {
      mod.default.render(target, props.payload, ctx);
      if (typeof mod.default.unmount === 'function') {
        unmountFn = mod.default.unmount;
      }
    } else if (typeof mod.render === 'function') {
      mod.render(target, props.payload, ctx);
      if (typeof mod.unmount === 'function') {
        unmountFn = mod.unmount;
      }
    }
  } catch {
    state.value = 'offline';
  }
};

watch(() => props.actionHook, () => { void fetchAndMount(); }, { immediate: true });

onUnmounted(() => {
  window.removeEventListener('hookComponent:navigate', onNavigate);
  if (unmountFn && shadowTarget) {
    unmountFn(shadowTarget);
  }
});
</script>
