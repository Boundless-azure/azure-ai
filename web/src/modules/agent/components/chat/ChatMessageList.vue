<template>
  <div>
    <div
      v-if="mode === 'chat' && isLoadingHistory"
      class="flex flex-col items-center justify-center h-full space-y-4"
    >
      <div
        class="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"
      ></div>
    </div>

    <div
      v-else-if="mode === 'chat' && isHistoryEmpty"
      class="flex flex-col items-center justify-center h-full space-y-6 text-center animate-fade-in-up"
    ></div>

    <div v-else-if="mode === 'chat'">
      <!-- 虚拟滑动占位 + 顶部哨兵 top-padding-sentinel keyword: virtual-scroll-sentinel -->
      <div :style="{ height: topPaddingPx + 'px' }" class="relative">
        <div ref="topSentinel" class="absolute bottom-0 w-full h-px"></div>
      </div>

      <template v-for="msg in visibleMessages" :key="msg.id">
        <div
          v-if="msg.role === ChatRole.System"
          class="px-2 my-4 w-full"
          :class="isNewMessage(msg.id) ? 'message-enter' : ''"
        >
          <div class="text-center text-xs text-gray-400 select-none">
            {{ msg.content }}
          </div>
        </div>

        <div
          v-else
          class="mb-5 px-2 group/message w-full"
          :class="[isNewMessage(msg.id) ? 'message-enter' : '']"
        >
          <div
            class="flex flex-col min-w-0 w-full"
            :class="msg.senderId === selfId ? 'items-end' : 'items-start'"
          >
            <div
              class="flex items-center gap-2 mb-2 w-full"
              :class="msg.senderId === selfId ? 'flex-row-reverse' : 'flex-row'"
            >
              <button
                class="block flex-shrink-0 select-none"
                :title="
                  displayNameById[msg.senderId || ''] || msg.senderName || ''
                "
                @click.stop="handleAvatarClick(msg)"
              >
                <div
                  class="w-[34px] h-[34px] rounded-full bg-[linear-gradient(180deg,#f4f5f7_0%,#e5e7eb_100%)] flex items-center justify-center text-[11px] font-semibold text-gray-700 shadow-sm overflow-hidden ring-1 ring-black/5"
                >
                  <img
                    v-if="avatarSrcById[(msg.senderId || '').trim()]"
                    :src="avatarSrcById[(msg.senderId || '').trim()]"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>
                    {{
                      (msg.senderId === selfId
                        ? '我'
                        : displayNameById[(msg.senderId || '').trim()] ||
                          msg.senderName ||
                          ''
                      ).slice(0, 1) || (msg.senderId === selfId ? '我' : '他')
                    }}
                  </span>
                </div>
              </button>

              <div
                class="flex items-center gap-2 min-w-0"
                :class="msg.senderId === selfId ? 'flex-row-reverse' : 'flex-row'"
              >
                <span
                  class="text-[11px] font-medium text-gray-500 select-none truncate"
                >
                  {{
                    msg.senderId === selfId
                      ? '我'
                      : displayNameById[msg.senderId || ''] ||
                        msg.senderName ||
                        'Azure AI 助手'
                  }}
                </span>
                <template
                  v-if="
                    sessionType === 'group' &&
                    msg.senderId !== selfId &&
                    msg.mentions &&
                    msg.mentions.length > 0
                  "
                >
                  <span
                    v-for="mention in msg.mentions"
                    :key="mention.agentPrincipalId"
                    class="text-[11px] text-blue-500 font-medium truncate"
                  >
                    {{ mention.mentionText }}
                  </span>
                </template>
              </div>
            </div>

            <!-- Message Bubble Row -->
            <div
              class="flex items-start gap-2 w-full"
              :class="msg.senderId === selfId ? 'flex-row-reverse' : 'flex-row'"
            >
              <!-- Sending Status -->
              <div
                v-if="msg.status === 'sending'"
                class="text-gray-400 flex-shrink-0 self-center"
              >
                <i class="fa-solid fa-spinner fa-spin"></i>
              </div>

              <!-- Error Status -->
              <div
                v-if="msg.status === 'error'"
                class="text-red-500 flex-shrink-0 cursor-pointer self-center"
                title="发送失败"
              >
                <i class="fa-solid fa-circle-exclamation"></i>
              </div>

              <!-- Bubble :: AI 待响应胶囊放在气泡内底部 -->
              <div
                class="message-panel w-full text-sm relative group transition-all break-words"
                :class="
                  msg.senderId === selfId
                    ? 'message-panel-self rounded-[10px] bg-[linear-gradient(180deg,#262626_0%,#111111_100%)] px-4 py-3 text-white shadow-[0_10px_28px_rgba(17,17,17,0.24)]'
                    : 'assistant-card rounded-[10px] bg-[linear-gradient(180deg,#fbfbfc_0%,#f1f3f5_100%)] border border-[#d9dde3] px-4 py-3 text-gray-800 shadow-[0_10px_28px_rgba(15,23,42,0.10)]'
                "
              >
                <div
                  v-if="msg.tool_calls && msg.tool_calls.length > 0"
                  class="mb-3 space-y-2 relative z-10"
                >
                  <div
                    v-for="tool in msg.tool_calls"
                    :key="tool.id"
                    class="rounded-[8px] border border-[#d7dbe0] bg-white/82 p-2.5 text-xs font-mono text-gray-600 overflow-x-auto"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-bold text-blue-600 flex items-center">
                        <i class="fa-solid fa-wrench mr-1"></i>
                        {{ tool.name }}
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                        :class="{
                          'bg-yellow-100 text-yellow-600':
                            tool.status === ToolCallStatus.Calling,
                          'bg-green-100 text-green-600':
                            tool.status === ToolCallStatus.Completed,
                          'bg-red-100 text-red-600':
                            tool.status === ToolCallStatus.Failed,
                        }"
                      >
                        {{ tool.status }}
                      </span>
                    </div>
                    <div class="truncate opacity-75">
                      {{ tool.arguments }}
                    </div>
                    <div
                      v-if="tool.result"
                      class="mt-1 text-[11px] text-green-700 whitespace-pre-wrap"
                    >
                      {{ tool.result }}
                    </div>
                  </div>
                </div>

                <div
                  v-if="msg.role === ChatRole.Assistant"
                  class="markdown-body prose prose-sm max-w-none overflow-x-auto relative z-10 assistant-markdown"
                  v-html="renderMarkdown(msg.content)"
                  @click="handleMessageClick"
                ></div>
                <div
                  v-else
                  class="markdown-body prose prose-sm max-w-none relative z-10 user-markdown leading-relaxed"
                  v-html="renderUserMarkdown(msg.content)"
                  @click="handleMessageClick"
                ></div>

                <!-- AI 待响应胶囊 :: 气泡内底部, emoji 翻转动效 + 等待语; phrase per 队列实例随机, AI 回完队列空时一起消失 -->
                <div
                  v-if="
                    msg.senderId === selfId && getAwaitingPhraseFor(msg.id)
                  "
                  class="awaiting-pill mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] select-none animate-fade-in relative z-10"
                  :class="
                    msg.senderId === selfId
                      ? 'bg-white/15 text-white/90 backdrop-blur-sm'
                      : 'bg-gray-200/70 text-gray-700'
                  "
                >
                  <span class="awaiting-emoji inline-block">{{
                    AI_AWAITING_EMOJI
                  }}</span>
                  <span class="italic">{{ getAwaitingPhraseFor(msg.id) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="mode === 'chat' && isProcessing"
      class="fixed bottom-24 left-6 z-20"
    >
      <div
        class="bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm flex items-center space-x-2"
      >
        <div
          class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style="animation-delay: 0ms"
        ></div>
        <div
          class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style="animation-delay: 150ms"
        ></div>
        <div
          class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style="animation-delay: 300ms"
        ></div>
        <span class="text-xs text-gray-400 ml-2">
          {{ t('chat.processing') }}
        </span>
      </div>
    </div>

    <!-- Image Preview (Teleport to body, 避祖先 transform 锚定 fixed) -->
    <ImageViewer
      :open="!!previewUrl"
      :src="previewUrl"
      :alt="previewAlt"
      @close="previewUrl = null"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Message List
 * @description 聊天消息气泡与工具调用展示区域。支持虚拟窗口渲染（只渲染可见的消息）和 markdown 缓存。
 * @keywords-cn 消息列表, 工具调用, 聊天内容, 虚拟滑动
 * @keywords-en message-list, tool-calls, chat-content, virtual-scroll
 */
import { computed, watch, ref, onUnmounted, onMounted, nextTick, createApp } from 'vue';
import { storeToRefs } from 'pinia';
import type { ChatMessage } from '../../types/agent.types';
import { ChatRole, ToolCallStatus } from '../../enums/agent.enums';
import { useI18n } from '../../composables/useI18n';
import { resolveImageUrl } from '../../../resource/services/resource-url.service';
import { usePanelStore } from '../../store/panel.store';
import { useImStore } from '../../../im/im.module';
import { AI_AWAITING_EMOJI } from '../../../im/constants/im.constants';
import MarkdownIt from 'markdown-it';
import ImageViewer from '../../../resource/components/ImageViewer.vue';
import HookComponentRenderer from './HookComponentRenderer.vue';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface Props {
  mode: string;
  isLoadingHistory: boolean;
  isHistoryEmpty: boolean;
  isProcessing: boolean;
  messages: ChatMessage[];
  selfPrincipalId?: string;
  sessionMembers: Array<{
    principalId: string;
    displayName: string;
    avatarUrl?: string | null;
  }>;
  sessionType?: string;
  /** 用于 IntersectionObserver root（滚动容器元素）
   * @keyword-en scroll-container-el virtual-scroll
   */
  scrollContainerEl?: HTMLElement | null;
  /** 会话 ID，切换时重置虚拟窗口
   * @keyword-en session-id window-reset
   */
  sessionId?: string;
}

const props = defineProps<Props>();

type SessionMember = Props['sessionMembers'][number];

const imStore = useImStore();
const { activeSession, awaitingAiByQueue } = storeToRefs(imStore);

/**
 * 取某条消息当前的 AI 等待语 (后端 ai:awaiting:add 入队后的状态)
 *  - awaitingAiByQueue 作为响应式依赖, 后端推 add/end 时自动重渲染
 *  - 不依赖 msg.sessionId (history 拉取路径未必填字段), 用 props.sessionId / activeSession.sessionId
 *  - 私聊单 agent / 群聊多 agent @mention 都覆盖 (按 sessionId 前缀扫一遍队列)
 * @keyword-en compute-awaiting-phrase-for-msg
 */
const getAwaitingPhraseFor = (messageId: string): string | null => {
  const sid = (
    props.sessionId ??
    activeSession.value?.sessionId ??
    ''
  ).trim();
  if (!sid) return null;
  const prefix = `${sid}:`;
  const map = awaitingAiByQueue.value;
  for (const k in map) {
    if (!k.startsWith(prefix)) continue;
    if (map[k]?.messageIds?.has(messageId)) return map[k].phrase;
  }
  return null;
};

const { t } = useI18n();
const panelStore = usePanelStore();
const previewUrl = ref<string | null>(null);
const previewAlt = ref<string>('');

// ===== 虚拟窗口 virtual-window =====
/** 默认每次渲染的最大条数 */
const WINDOW_SIZE = 30;
/** 每次向上展开的条数 */
const EXPAND_STEP = 20;
/** 每条消息预估高度（px），仅用于占位 */
const ESTIMATED_MSG_HEIGHT = 80;

const windowExpand = ref(0);
const isExpanding = ref(false);
const topSentinel = ref<HTMLElement | null>(null);

/**
 * 切换 session 时重置虚拟窗口
 * @keyword-en reset-virtual-window on-session-change
 */
watch(() => props.sessionId, () => {
  windowExpand.value = 0;
});

/**
 * 重置虚拟窗口到尾部, 用于主动跳到底部或发送消息后的强制置底。
 * @keyword-en reset-window-to-tail virtual-scroll-bottom
 */
const resetWindowToTail = () => {
  windowExpand.value = 0;
};

defineExpose({
  resetWindowToTail,
});

/**
 * 可见消息切片（尾部 WINDOW_SIZE + 展开量）
 * @keyword-en visible-messages virtual-window-slice
 */
const visibleMessages = computed(() => {
  const total = props.messages.length;
  const start = Math.max(0, total - WINDOW_SIZE - windowExpand.value);
  return props.messages.slice(start);
});

/**
 * 隐藏消息的顶部占位高度
 * @keyword-en top-padding-height virtual-spacer
 */
const topPaddingPx = computed(() => {
  const total = props.messages.length;
  const hidden = Math.max(0, total - WINDOW_SIZE - windowExpand.value);
  return hidden * ESTIMATED_MSG_HEIGHT;
});

/**
 * 向上展开虚拟窗口，并恢复滚动位置防止跳动
 * @keyword-en expand-virtual-window restore-scroll
 */
const expandWindow = async () => {
  if (isExpanding.value) return;
  const total = props.messages.length;
  if (windowExpand.value + WINDOW_SIZE >= total) return;

  const scrollEl = props.scrollContainerEl;
  const prevScrollHeight = scrollEl?.scrollHeight ?? 0;
  const prevScrollTop = scrollEl?.scrollTop ?? 0;

  isExpanding.value = true;
  windowExpand.value = Math.min(windowExpand.value + EXPAND_STEP, total - WINDOW_SIZE);

  await nextTick();

  if (scrollEl) {
    scrollEl.scrollTop = prevScrollTop + (scrollEl.scrollHeight - prevScrollHeight);
  }
  isExpanding.value = false;
};

/** IntersectionObserver实例 @keyword-en intersection-observer-instance */
let intersectionObserver: IntersectionObserver | null = null;

/**
 * 初始化顶部哨兵的 IntersectionObserver
 * @keyword-en setup-intersection-observer virtual-scroll-trigger
 */
const setupObserver = () => {
  intersectionObserver?.disconnect();
  if (!topSentinel.value) return;
  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) void expandWindow();
    },
    { root: props.scrollContainerEl ?? null, threshold: 0.1 },
  );
  intersectionObserver.observe(topSentinel.value);
};

watch([topSentinel, () => props.scrollContainerEl], setupObserver);
onMounted(setupObserver);

const selfId = computed(() => (props.selfPrincipalId || '').trim());

const effectiveSessionMembers = computed<
  Array<{ principalId: string; displayName: string; avatarUrl?: string | null }>
>(() => {
  const members = activeSession.value?.members;
  if (Array.isArray(members) && members.length > 0) {
    return members;
  }
  return props.sessionMembers;
});

const memberById = computed<Record<string, SessionMember>>(() => {
  const out: Record<string, SessionMember> = Object.create(null);
  for (const item of effectiveSessionMembers.value) {
    if (item?.principalId) {
      out[item.principalId] = item;
    }
  }
  return out;
});

const displayNameById = computed<Record<string, string>>(() => {
  const out: Record<string, string> = Object.create(null);
  for (const item of effectiveSessionMembers.value) {
    if (item?.principalId) {
      out[item.principalId] = item.displayName || '';
    }
  }
  return out;
});

const avatarSrcById = computed<Record<string, string>>(() => {
  const out: Record<string, string> = Object.create(null);
  for (const item of effectiveSessionMembers.value) {
    const pid = (item?.principalId || '').trim();
    const raw = typeof item.avatarUrl === 'string' ? item.avatarUrl.trim() : '';
    if (!pid || !raw) continue;
    out[pid] = (resolveImageUrl(raw) || raw).trim();
  }
  return out;
});

const newMessageIds = ref<Set<string>>(new Set());
const newMessageTimeoutById = new Map<string, number>();

const setNewMessageIds = (next: Set<string>) => {
  newMessageIds.value = next;
};

const markNewMessage = (id: string) => {
  const existingTimeout = newMessageTimeoutById.get(id);
  if (existingTimeout) {
    window.clearTimeout(existingTimeout);
  }

  const next = new Set(newMessageIds.value);
  next.add(id);
  setNewMessageIds(next);

  const timeoutId = window.setTimeout(() => {
    const after = new Set(newMessageIds.value);
    after.delete(id);
    setNewMessageIds(after);
    newMessageTimeoutById.delete(id);
  }, 240);
  newMessageTimeoutById.set(id, timeoutId);
};

const isNewMessage = (id: string) => {
  return newMessageIds.value.has(id);
};

// ===== markdown 缓存 markdown-cache =====
/** LRU 简化版：最多缓存 200 条渲染结果 */
const markdownCache = new Map<string, string>();
const MAX_CACHE_SIZE = 200;

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch (__) {}
    }
    return (
      '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    );
  },
});

const defaultImageRender =
  md.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const srcIndex = token.attrIndex('src');
  if (srcIndex >= 0 && token.attrs) {
    const src = token.attrs[srcIndex][1];
    const resolved = resolveImageUrl(src);
    if (resolved) {
      token.attrs[srcIndex][1] = resolved;
    }
  }
  return defaultImageRender(tokens, idx, options, env, self);
};

// 表格包一层 wrapper :: 让 table 用内容宽度自然排列, 容器溢出时横向滚动 (而不是压缩列宽)
// @keyword-en md-table-wrapper horizontal-scroll preserve-column-width
md.renderer.rules.table_open = () => '<div class="md-table-wrapper"><table>';
md.renderer.rules.table_close = () => '</table></div>';

// hook fence :: ```hook { "actionHook": "...", "payload": {...}, "runnerId": "..." }```
// 解析后输出占位 div，由 mountHookComponents 动态挂载 HookComponentRenderer Vue 应用。
// @keyword-en hook-fence-renderer dynamic-hook-component-slot
const defaultFenceRenderer = md.renderer.rules.fence || function (tokens, idx, options, _env, self) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token.info.trim() === 'hook') {
    try {
      const raw = JSON.parse(token.content.trim()) as Record<string, unknown>;
      const actionHook = typeof raw.actionHook === 'string' ? raw.actionHook : '';
      if (actionHook) {
        const payload = JSON.stringify(raw.payload ?? null);
        const escapedHook = actionHook.replace(/"/g, '&quot;');
        const escapedPayload = payload.replace(/"/g, '&quot;');
        return `<div class="hook-component-slot" data-action-hook="${escapedHook}" data-payload="${escapedPayload}"></div>`;
      }
    } catch {
      // fall through to default fence render
    }
  }
  return defaultFenceRenderer(tokens, idx, options, env, self);
};

// 用户消息单独的 markdown 实例: html=false 关闭 raw HTML 注入, 防 XSS
// 用户输入是不可信源, 不允许走 <agent-lazy-guard> 等系统自定义标签那条路。
// 仍然支持 markdown 语法生成的 <img> / <a> / <code> / 列表等, 让用户发的图片/链接能正常渲染。
// @keyword-en user-md-renderer, safe-markdown, no-raw-html
const mdUser = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

const defaultUserImageRender =
  mdUser.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

mdUser.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const srcIndex = token.attrIndex('src');
  if (srcIndex >= 0 && token.attrs) {
    const src = token.attrs[srcIndex][1];
    const resolved = resolveImageUrl(src);
    if (resolved) {
      token.attrs[srcIndex][1] = resolved;
    }
  }
  return defaultUserImageRender(tokens, idx, options, env, self);
};

mdUser.renderer.rules.table_open = () =>
  '<div class="md-table-wrapper"><table>';
mdUser.renderer.rules.table_close = () => '</table></div>';

// 链接强制 target=_blank + rel=noopener
const defaultUserLinkOpen =
  mdUser.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
mdUser.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const targetIdx = token.attrIndex('target');
  if (targetIdx < 0) token.attrPush(['target', '_blank']);
  else if (token.attrs) token.attrs[targetIdx][1] = '_blank';
  const relIdx = token.attrIndex('rel');
  if (relIdx < 0) token.attrPush(['rel', 'noopener noreferrer']);
  else if (token.attrs) token.attrs[relIdx][1] = 'noopener noreferrer';
  return defaultUserLinkOpen(tokens, idx, options, env, self);
};

/**
 * 固定 lazy guard markdown 标签匹配。
 * @keyword-en lazy-guard-tag-regex
 */
const LAZY_GUARD_TAG_RE =
  /<agent-lazy-guard(?:\s+[^>]*)?><\/agent-lazy-guard>/gi;

/**
 * 把后端固定 lazy guard 标签渲染成本地化提示块。
 * @keyword-en render-lazy-guard-tag i18n
 */
const renderLazyGuardTags = (content: string): string => {
  return content.replace(LAZY_GUARD_TAG_RE, () => {
    const title = md.utils.escapeHtml(t('chat.lazyToolTitle'));
    const hint = md.utils.escapeHtml(t('chat.lazyToolRequired'));
    return [
      '<div class="agent-lazy-guard" role="status">',
      '<span class="agent-lazy-guard__icon"><i class="fa-solid fa-shield-halved"></i></span>',
      '<span class="agent-lazy-guard__body">',
      `<strong>${title}</strong>`,
      `<span>${hint}</span>`,
      '</span>',
      '</div>',
    ].join('');
  });
};

const handleMessageClick = (e: MouseEvent) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  // Image Preview
  if (target instanceof HTMLImageElement && target.tagName === 'IMG') {
    const src = target.src;
    if (src) {
      previewUrl.value = src;
      previewAlt.value = target.alt || '';
      e.preventDefault();
      e.stopPropagation();
    }
  }
  // Link Handling
  else if (target instanceof HTMLAnchorElement && target.tagName === 'A') {
    const href = target.getAttribute('href');
    if (href) {
      e.preventDefault();
      e.stopPropagation();
      window.open(href, '_blank');
    }
  }
};

// ===== 消息进场动画：只对最近 3s 内新到的消息播放，防止虚拟窗口展开时说历史消息重播 message-enter-animation =====
watch(
  () => visibleMessages.value,
  (msgs, prevMsgs) => {
    const prev = new Set((prevMsgs ?? []).map((m) => m.id));
    const recentCutoff = Date.now() - 3000;
    for (const msg of msgs) {
      if (!prev.has(msg.id) && msg.timestamp > recentCutoff) {
        markNewMessage(msg.id);
      }
    }
    void mountHookComponents();
  },
  { flush: 'post' },
);

onUnmounted(() => {
  intersectionObserver?.disconnect();
  for (const t of newMessageTimeoutById.values()) {
    window.clearTimeout(t);
  }
  newMessageTimeoutById.clear();
  for (const app of hookApps.values()) {
    app.unmount();
  }
  hookApps.clear();
});

// ===== hook component dynamic mounting hook-component-mount =====
/**
 * Map of slot HTMLElement → mounted Vue app instance，用于生命周期清理。
 * @keyword-en hook-component-apps-map cleanup-on-unmount
 */
const hookApps = new Map<HTMLElement, ReturnType<typeof createApp>>();

/**
 * 扫描 DOM 中未挂载的 .hook-component-slot，为每个创建并挂载 HookComponentRenderer 实例。
 * 已标记 data-mounted 的跳过，防止重复挂载。
 * @keyword-en mount-hook-components dynamic-vue-mount
 */
const mountHookComponents = async () => {
  await nextTick();
  const container = document.querySelector('.assistant-card, .message-panel');
  // 搜索当前页面所有未挂载的 slot（不限于某个容器，避免 DOM 结构不确定）
  const slots = document.querySelectorAll<HTMLElement>(
    '.hook-component-slot:not([data-mounted])',
  );
  for (const slot of slots) {
    const actionHook = slot.dataset.actionHook;
    if (!actionHook) continue;
    let payload: unknown = null;
    try {
      payload = JSON.parse(slot.dataset.payload ?? 'null');
    } catch {
      payload = null;
    }
    slot.dataset.mounted = 'true';
    const app = createApp(HookComponentRenderer, { actionHook, payload });
    app.mount(slot);
    hookApps.set(slot, app);
  }
  void container; // suppress unused
};

const handleAvatarClick = (msg: ChatMessage) => {
  const senderId = (msg.senderId || selfId.value).trim();
  if (!senderId) return;

  const member = memberById.value[senderId];
  const displayName = (
    member?.displayName ||
    msg.senderName ||
    senderId
  ).trim();
  const avatarUrl =
    typeof member?.avatarUrl === 'string' ? member.avatarUrl.trim() : null;

  const user = {
    id: senderId,
    principalId: senderId,
    title: displayName,
    displayName,
    threadType: 'dm',
    chatClientId: null,
    isPinned: false,
    isAiInvolved: false,
    avatarUrl,
    createdAt: '',
    updatedAt: '',
  };

  panelStore.openDrawer('profile', { user });
};

/**
 * 渲染 markdown，结果缓存避免重复计算
 * @keyword-en render-markdown markdown-cache
 */
const renderMarkdown = (content: string): string => {
  const cacheKey = `${t('chat.lazyToolTitle')}::${t('chat.lazyToolRequired')}::${content}`;
  const cached = markdownCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = md.render(renderLazyGuardTags(content));
  if (markdownCache.size >= MAX_CACHE_SIZE) {
    const firstKey = markdownCache.keys().next().value;
    if (firstKey !== undefined) markdownCache.delete(firstKey);
  }
  markdownCache.set(cacheKey, result);
  return result;
};

/**
 * 渲染用户消息 markdown (html=false, 安全模式), 主要让 ![](url) 出图, [text](url) 出链接。
 * 单独缓存键防止跟 assistant 渲染串台。
 * @keyword-en render-user-markdown, safe-markdown
 */
const renderUserMarkdown = (content: string): string => {
  const cacheKey = `user::${content}`;
  const cached = markdownCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = mdUser.render(content);
  if (markdownCache.size >= MAX_CACHE_SIZE) {
    const firstKey = markdownCache.keys().next().value;
    if (firstKey !== undefined) markdownCache.delete(firstKey);
  }
  markdownCache.set(cacheKey, result);
  return result;
};
</script>

<style scoped>
.message-panel {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.message-panel-self {
  box-shadow:
    0 10px 28px rgba(17, 17, 17, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.assistant-card {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    0 10px 28px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    inset 0 0 0 1px rgba(217, 221, 227, 0.72);
}

.assistant-markdown :deep(p),
.assistant-markdown :deep(ul),
.assistant-markdown :deep(ol),
.assistant-markdown :deep(pre),
.assistant-markdown :deep(blockquote) {
  margin-top: 0;
  margin-bottom: 0.7em;
}

/* 用户气泡 (深色) 的 markdown 渲染样式 */
.user-markdown {
  color: rgba(255, 255, 255, 0.96);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.user-markdown :deep(p),
.user-markdown :deep(ul),
.user-markdown :deep(ol),
.user-markdown :deep(blockquote) {
  margin-top: 0;
  margin-bottom: 0.55em;
}

.user-markdown :deep(p:last-child),
.user-markdown :deep(ul:last-child),
.user-markdown :deep(ol:last-child) {
  margin-bottom: 0;
}

.user-markdown :deep(img) {
  /* 缩略图风格: 单行的小格子, 点击放大 */
  display: inline-block;
  width: 140px;
  height: 140px;
  object-fit: cover;
  margin: 0.3em 0.3em 0.3em 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  cursor: zoom-in;
  vertical-align: middle;
  /* 用 outline 取代 scale: outline 不占布局, 不会撑大气泡触发滚动条 */
  outline: 0 solid rgba(255, 255, 255, 0);
  transition: outline 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
}

.user-markdown :deep(img:hover) {
  /* outline 在元素外侧绘制, 不影响 layout, 不会触发父容器 overflow */
  outline: 2px solid rgba(255, 255, 255, 0.55);
  outline-offset: 2px;
  filter: brightness(1.06);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.user-markdown :deep(a) {
  color: #93c5fd;
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.user-markdown :deep(a:hover) {
  color: #bfdbfe;
}

.user-markdown :deep(code:not(pre code)) {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 0.35rem;
  padding: 0.1rem 0.3rem;
  font-size: 0.88em;
}

.user-markdown :deep(pre) {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  padding: 0.55rem 0.7rem;
  overflow-x: auto;
  font-size: 0.84em;
}

.user-markdown :deep(blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.35);
  padding-left: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
}

.user-markdown :deep(ul),
.user-markdown :deep(ol) {
  padding-left: 1.1rem;
}

.assistant-markdown :deep(ul),
.assistant-markdown :deep(ol) {
  padding-left: 1.1rem;
}

.assistant-markdown :deep(li + li) {
  margin-top: 0.2rem;
}

.assistant-markdown :deep(blockquote) {
  border-left: 3px solid #d4d4d8;
  padding-left: 0.85rem;
  color: #52525b;
  background: rgba(255, 255, 255, 0.44);
  border-radius: 0 0.65rem 0.65rem 0;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
}

.assistant-markdown :deep(pre) {
  box-shadow: inset 0 0 0 1px rgba(161, 161, 170, 0.2);
}

.assistant-markdown :deep(code:not(pre code)) {
  background: rgba(212, 212, 216, 0.35);
  border-radius: 0.4rem;
  padding: 0.12rem 0.35rem;
}

.assistant-markdown :deep(.agent-lazy-guard) {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.72rem;
  width: min(100%, 28rem);
  overflow: hidden;
  border: 1px solid rgba(37, 99, 235, 0.18);
  background:
    linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(248, 250, 252, 0.98)),
    #f8fafc;
  color: #1e293b;
  border-radius: 8px;
  padding: 0.78rem 0.88rem;
  font-size: 0.84rem;
  line-height: 1.38;
  box-shadow:
    0 12px 30px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.assistant-markdown :deep(.agent-lazy-guard::before) {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  content: '';
  background: linear-gradient(180deg, #2563eb, #14b8a6);
}

.assistant-markdown :deep(.agent-lazy-guard__icon) {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
}

.assistant-markdown :deep(.agent-lazy-guard__body) {
  display: grid;
  gap: 0.16rem;
  min-width: 0;
}

.assistant-markdown :deep(.agent-lazy-guard__body strong) {
  font-size: 0.9rem;
  font-weight: 650;
  color: #0f172a;
}

.assistant-markdown :deep(.agent-lazy-guard__body span) {
  color: #64748b;
}

/* ===== 标题层级 :: 让 LLM 输出的 h1~h4 视觉层次清晰 md-headings ===== */
.assistant-markdown :deep(h1),
.assistant-markdown :deep(h2),
.assistant-markdown :deep(h3),
.assistant-markdown :deep(h4) {
  margin: 1.05em 0 0.42em;
  font-weight: 600;
  color: #18181b;
  line-height: 1.35;
  letter-spacing: 0.01em;
}
.assistant-markdown :deep(h1) {
  font-size: 1.18em;
}
.assistant-markdown :deep(h2) {
  font-size: 1.08em;
}
.assistant-markdown :deep(h3) {
  font-size: 1em;
}
.assistant-markdown :deep(h4) {
  font-size: 0.95em;
  color: #27272a;
}
.assistant-markdown :deep(h1:first-child),
.assistant-markdown :deep(h2:first-child),
.assistant-markdown :deep(h3:first-child),
.assistant-markdown :deep(h4:first-child) {
  margin-top: 0;
}

/* ===== 分隔线 :: 渐隐两端的细线, 替代生硬的硬线 md-hr ===== */
.assistant-markdown :deep(hr) {
  margin: 1.1em 0;
  border: 0;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(161, 161, 170, 0.45) 18%,
    rgba(161, 161, 170, 0.45) 82%,
    transparent 100%
  );
}

/* ===== 强调与链接 ===== */
.assistant-markdown :deep(strong) {
  color: #18181b;
  font-weight: 600;
}
.assistant-markdown :deep(em) {
  color: #3f3f46;
}
.assistant-markdown :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: rgba(37, 99, 235, 0.4);
  transition: text-decoration-color 0.15s ease;
}
.assistant-markdown :deep(a:hover) {
  text-decoration-color: rgba(37, 99, 235, 0.85);
}

/* ===== 列表 marker 淡化 ===== */
.assistant-markdown :deep(ul) {
  list-style: disc;
}
.assistant-markdown :deep(ol) {
  list-style: decimal;
}
.assistant-markdown :deep(li::marker) {
  color: rgba(113, 113, 122, 0.7);
}

/* ===== markdown 表格 :: 列宽随内容, 容器横滚, 清晰边框 md-table ===== */
.assistant-markdown :deep(.md-table-wrapper) {
  margin: 0.7em 0;
  overflow-x: auto;
  border: 1px solid rgba(212, 212, 216, 0.85);
  border-radius: 0.55rem;
  background: rgba(255, 255, 255, 0.6);
}
.assistant-markdown :deep(.md-table-wrapper table) {
  width: max-content;
  min-width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: 0.92em;
}
.assistant-markdown :deep(.md-table-wrapper th),
.assistant-markdown :deep(.md-table-wrapper td) {
  border: 1px solid rgba(212, 212, 216, 0.85);
  padding: 0.4rem 0.7rem;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  max-width: 28rem;
  overflow-wrap: anywhere;
}
.assistant-markdown :deep(.md-table-wrapper th) {
  background: rgba(244, 244, 245, 0.95);
  font-weight: 600;
  color: #18181b;
  position: sticky;
  top: 0;
}
.assistant-markdown :deep(.md-table-wrapper tbody tr:nth-child(even) td) {
  background: rgba(248, 248, 250, 0.55);
}

.markdown-body :deep(p) {
  margin-bottom: 0.5em;
}
.markdown-body :deep(*:last-child) {
  margin-bottom: 0 !important;
}
.markdown-body :deep(pre) {
  background-color: #0d1117;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  color: #c9d1d9;
}
.markdown-body :deep(code) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.85em;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}

@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-enter {
  animation: message-enter 0.22s ease-out both;
  will-change: transform, opacity;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.animate-fade-in {
  animation: fade-in 0.5s ease-in-out forwards;
}

/* AI 待响应胶囊 :: emoji 翻转动效 (沙漏隐喻 — 倒一倒, 表示在工作) */
@keyframes hourglass-flip {
  0%,
  45% {
    transform: rotate(0deg);
  }
  50%,
  95% {
    transform: rotate(180deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.awaiting-emoji {
  animation: hourglass-flip 2.4s ease-in-out infinite;
  transform-origin: center;
  display: inline-block;
}

/* 胶囊整体淡入 + 轻微浮动 */
@keyframes pill-pulse {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}
.awaiting-pill {
  animation:
    fade-in 0.3s ease-out,
    pill-pulse 2.4s ease-in-out infinite;
}
</style>
