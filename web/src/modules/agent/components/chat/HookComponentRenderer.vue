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
 * @keywords-cn hook组件渲染, 动态组件, solution组件, 离线状态
 * @keywords-en hook-component-renderer, dynamic-component, solution-component, offline-state
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRightPanelStore } from '../../store/right-panel.store';

interface Props {
  /** actionHook 地址，如 runner.app.todo.card
   * @keyword-en action-hook-name
   */
  actionHook: string;
  /** 传给组件 render 函数的动态载荷
   * @keyword-en component-payload
   */
  payload?: unknown;
}

const props = withDefaults(defineProps<Props>(), {
  payload: () => null,
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

/** 当前挂载的卸载回调（组件可选导出 unmount） */
let unmountFn: ((el: HTMLElement) => void) | null = null;

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
  if (unmountFn && mountRef.value) {
    unmountFn(mountRef.value);
    unmountFn = null;
  }

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

    if (typeof mod.default === 'function') {
      mod.default(mountRef.value, props.payload);
    } else if (mod.default && typeof mod.default.render === 'function') {
      mod.default.render(mountRef.value, props.payload);
      if (typeof mod.default.unmount === 'function') {
        unmountFn = mod.default.unmount;
      }
    } else if (typeof mod.render === 'function') {
      mod.render(mountRef.value, props.payload);
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
  if (unmountFn && mountRef.value) {
    unmountFn(mountRef.value);
  }
});
</script>
