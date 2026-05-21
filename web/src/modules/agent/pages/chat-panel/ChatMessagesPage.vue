<template>
  <div class="flex flex-col h-full bg-white relative">
    <div
      class="flex-1 overflow-y-auto p-2 custom-scrollbar relative"
      ref="chatContainer"
    >
      <ChatMessageList
        :mode="'chat'"
        :isLoadingHistory="isLoadingHistory"
        :isHistoryEmpty="isHistoryEmpty"
        :isProcessing="isProcessing || isAgentTyping"
        :messages="currentMessages"
        :selfPrincipalId="selfPrincipalId"
        :sessionMembers="currentSessionMembers"
        :sessionType="currentSession?.threadType"
        :scrollContainerEl="chatContainer"
        :sessionId="currentSessionId ?? undefined"
      />
    </div>

    <!-- 新消息浮动按钮 :: 锚在 chatContainer 跟 InputArea 边界上方
         h-0 父 div 不占 flex 空间, 不影响任何 scroll 计算, button absolute 相对它定位 -->
    <div class="relative h-0 z-20">
      <Transition name="new-msg-fade">
        <button
          v-if="unreadNewCount > 0"
          type="button"
          class="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[linear-gradient(180deg,#262626_0%,#111111_100%)] text-white text-xs font-medium shadow-[0_8px_20px_rgba(0,0,0,0.25)] flex items-center gap-1.5 hover:bg-black transition-colors border border-white/10 whitespace-nowrap"
          @click="onClickJumpToBottom"
        >
          <span>新消息 {{ unreadNewCount }} 条</span>
          <span class="text-white/70">↓</span>
        </button>
      </Transition>
    </div>

    <div class="p-4 bg-white border-t border-gray-200 flex-shrink-0 z-20">
      <div class="max-w-4xl mx-auto">
        <InputArea
          :placeholder="t('chat.inputPlaceholder')"
          :disabled="isProcessing"
          :mentions="
            currentSession?.threadType === 'group' ? mentionCandidates : []
          "
          @send="sendMessage"
        />
        <div class="text-center mt-2">
          <p class="text-[10px] text-gray-400">
            {{ t('chat.footerDisclaimer') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Messages Page
 * @description 会话内聊天记录页面：历史加载、实时同步与消息发送。发送均为水容第一时间展示，后台异步处理接口。
 * @keywords-cn 会话内聊天记录, 消息发送, 历史加载, 实时同步
 * @keywords-en chat-messages, send-message, history-load, realtime-sync, optimistic-send
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import InputArea from '../../components/chat/InputArea.vue';
import ChatMessageList from '../../components/chat/ChatMessageList.vue';
import { useI18n } from '../../composables/useI18n';
import { useAgentStore } from '../../store/agent.store';
import { useAgentSessionStore } from '../../store/session.store';
import { useChatContacts } from '../../hooks/useChatContacts';
import type { SessionListItem } from '../../types/agent.types';
import { useImStore } from '../../../im/im.module';
import { ChatRole } from '../../enums/agent.enums';
import type { Attachment, ChatMessage } from '../../types/agent.types';
import { useUIStore } from '../../store/ui.store';
import { resourceApi } from '../../../../api/resource';
import { resolveResourceUrl } from '../../../resource/services/resource-url.service';

const props = defineProps<{
  selfPrincipalId?: string;
}>();

const emit = defineEmits<{
  (e: 'titleLoadingChange', value: boolean): void;
}>();

const { t } = useI18n();
const ui = useUIStore();

const agentStore = useAgentStore();
const { currentSessionId } = storeToRefs(agentStore);

const sessionStore = useAgentSessionStore();
const { sessions } = storeToRefs(sessionStore);

// loadContacts 仍用于无 session 时的消息路由匹配
const { allContacts, loadContacts } = useChatContacts();
void allContacts; // suppress unused warning

const imStore = useImStore();
const {
  activeMessages,
  activeSession,
  activeLoadingMessages,
  activeSendStatusByMessageId,
  typingBySession,
  awaitingAiByQueue,
} = storeToRefs(imStore);

const chatContainer = ref<HTMLElement | null>(null);

const isPinnedToBottom = ref(true);
const bottomThresholdPx = 80;

/** 上滚看历史期间累积的新消息条数 :: 回到底部 / 主动跳到底 时清零 */
const unreadNewCount = ref(0);

const updatePinnedState = () => {
  const el = chatContainer.value;
  if (!el) return;
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  const wasPinned = isPinnedToBottom.value;
  isPinnedToBottom.value = distance <= bottomThresholdPx;
  // 滚回底部 → 清零未读
  if (!wasPinned && isPinnedToBottom.value) {
    unreadNewCount.value = 0;
  }
};

/**
 * 主动跳到底部按钮: 强制 pin + 清零未读 + 滚到底
 * @keyword-en jump-to-bottom-on-click
 */
const onClickJumpToBottom = () => {
  isPinnedToBottom.value = true;
  unreadNewCount.value = 0;
  scrollToBottom();
};

const isProcessing = ref(false);

/** 当前 session 中是否有 agent 正在输入 */
const isAgentTyping = computed(() => {
  const sid = currentSessionId.value;
  if (!sid) return false;
  const typingSet = typingBySession.value[sid];
  return !!typingSet && typingSet.size > 0;
});
const isTitleLoading = ref(false);

watch(isTitleLoading, (v) => emit('titleLoadingChange', v), {
  immediate: true,
});

const currentSessionMembers = computed(() => {
  const detail = activeSession.value;
  const members = detail?.members || [];
  return members.map((m) => ({
    principalId: m.principalId,
    displayName: m.displayName,
    avatarUrl: m.avatarUrl,
  }));
});

/**
 * 群聊 @提及候选列表：仅取当前会话成员，且排除自己
 */
const mentionCandidates = computed((): SessionListItem[] => {
  const selfId = getPrincipalId();
  const nowIso = new Date().toISOString();
  return currentSessionMembers.value
    .filter((m) => m.principalId && m.principalId !== selfId)
    .map((m) => ({
      id: m.principalId!,
      title: m.displayName ?? m.principalId!,
      chatClientId: null,
      threadType: 'dm' as const,
      isPinned: false,
      isAiInvolved: false,
      avatarUrl: m.avatarUrl ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
});

const currentSession = computed(() => {
  return sessionStore.getSession(currentSessionId.value);
});

const currentMessages = computed(() => {
  const selfId = getPrincipalId();
  const list = activeMessages.value;
  const statuses = activeSendStatusByMessageId.value;
  return list.map((m) => {
    const senderId = m.senderId ? m.senderId.trim() : undefined;
    const role =
      m.messageType === 'system'
        ? ChatRole.System
        : selfId && senderId === selfId
          ? ChatRole.User
          : ChatRole.Assistant;
    const status = statuses[m.id];
    const msg: ChatMessage = {
      id: m.id,
      role,
      content: m.content,
      timestamp: new Date(m.createdAt).getTime(),
      tool_calls: [],
      senderId: senderId,
      senderName: m.senderName,
      status,
    };
    return msg;
  });
});

const isLoadingHistory = computed(() => {
  return activeLoadingMessages.value && currentMessages.value.length === 0;
});

const isHistoryEmpty = computed(() => {
  return currentMessages.value.length === 0;
});

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return typeof v === 'object' && v !== null;
};

const getPrincipalId = (): string | undefined => {
  if (props.selfPrincipalId) return props.selfPrincipalId;
  try {
    const principalRaw = localStorage.getItem('principal');
    if (principalRaw) {
      const parsed: unknown = JSON.parse(principalRaw);
      if (isRecord(parsed)) {
        const idVal = parsed['id'];
        if (typeof idVal === 'string') {
          const pid = idVal.trim();
          if (pid) return pid;
        }
      }
    }
    const legacy = localStorage.getItem('identity.currentPrincipalId');
    const id = (legacy || '').trim();
    return id || undefined;
  } catch {
    return undefined;
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (!chatContainer.value) return;
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    requestAnimationFrame(() => {
      if (!chatContainer.value) return;
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    });
  });
};

const openSessionAndLoadHistory = async (
  sessionId: string,
  prevSessionId?: string | null,
  title?: string,
) => {
  void prevSessionId;
  void title;

  isTitleLoading.value = true;
  try {
    await imStore.openSession(sessionId);
  } finally {
    isTitleLoading.value = false;
  }

  isPinnedToBottom.value = true;
  unreadNewCount.value = 0;
  scrollToBottom();
};

watch(
  currentSessionId,
  (id, prev) => {
    if (!id) {
      if (prev) {
        imStore.leaveSession();
      }
      return;
    }
    const title = sessionStore.getSession(id)?.title ?? '';
    void openSessionAndLoadHistory(id, prev || null, title);
  },
  { immediate: true },
);

onMounted(() => {
  void loadContacts();
});

const onScroll = () => {
  updatePinnedState();
};

/**
 * 内容高度持续变化时跟随到底 :: ResizeObserver 监听消息列表 root div
 * 关键场景: temp 插入后 markdown/图片慢渲染, 高度持续增长, 单次 scrollToBottom 滚不到真正底部
 *  - pinned=true 时, 高度任何变化都跟随
 *  - pinned=false 时, 高度变化无视, 不打扰用户阅读历史
 *  - inner 第一次可能还没渲染 (chatContainer 先 mount, ChatMessageList 后 render),
 *    用 MutationObserver 监听 chatContainer 子节点出现, 出现后才装 ResizeObserver
 * @keyword-en content-resize-follow scroll-to-bottom-tracker
 */
let containerResizeObserver: ResizeObserver | null = null;
let containerMutationObserver: MutationObserver | null = null;

const attachContainerResizeObserver = (el: HTMLElement | null) => {
  containerResizeObserver?.disconnect();
  containerResizeObserver = null;
  containerMutationObserver?.disconnect();
  containerMutationObserver = null;
  if (!el || typeof ResizeObserver === 'undefined') return;

  const observeInner = (inner: HTMLElement) => {
    containerResizeObserver?.disconnect();
    containerResizeObserver = new ResizeObserver(() => {
      if (isPinnedToBottom.value && chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    });
    containerResizeObserver.observe(inner);
  };

  const tryAttach = (): boolean => {
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return false;
    observeInner(inner);
    return true;
  };

  if (tryAttach()) return;
  // inner 还没渲染, MutationObserver 等子元素出现
  containerMutationObserver = new MutationObserver(() => {
    if (tryAttach()) {
      containerMutationObserver?.disconnect();
      containerMutationObserver = null;
    }
  });
  containerMutationObserver.observe(el, { childList: true });
};

watch(
  chatContainer,
  (el, prev) => {
    prev?.removeEventListener('scroll', onScroll);
    el?.addEventListener('scroll', onScroll, { passive: true });
    nextTick(() => {
      updatePinnedState();
      attachContainerResizeObserver(el ?? null);
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  chatContainer.value?.removeEventListener('scroll', onScroll);
  containerResizeObserver?.disconnect();
  containerResizeObserver = null;
  containerMutationObserver?.disconnect();
  containerMutationObserver = null;
  imStore.leaveSession();
});

watch(
  () => currentMessages.value.length,
  (len, prevLen) => {
    if (len <= prevLen) return;
    const delta = len - prevLen;
    if (isPinnedToBottom.value) {
      // 在底部: 自动滚到底, 未读清零
      unreadNewCount.value = 0;
      scrollToBottom();
    } else {
      // 上滚看历史: 累积未读计数, 不打扰当前阅读位置
      unreadNewCount.value += delta;
    }
  },
  { flush: 'post' },
);

/**
 * AI 待响应胶囊渲染会改变气泡高度 (温度 +24px), WS event 比 temp 插入晚 100~300ms
 * watch(currentMessages.length) 已经在 temp 插入时滚过, 胶囊后续插入需要单独补滚
 * 这是独立的 reactive 触发, 不依赖 ResizeObserver 是否 attach 成功
 * @keyword-en awaiting-pill-resize-tracker
 */
watch(
  () => Object.keys(awaitingAiByQueue.value ?? {}).length,
  () => {
    if (isPinnedToBottom.value) scrollToBottom();
  },
  { flush: 'post' },
);

const extractMentions = (text: string): string[] => {
  const out: string[] = [];
  const push = (s?: string) => {
    const v = (s || '').trim();
    if (v) out.push(v);
  };
  const patterns: RegExp[] = [
    /@\"([^\"]+?)\"/g,
    /@\'([^\']+?)\'/g,
    /@(?:「|《)(.+?)(?:」|》)/g,
    /@([\u4e00-\u9fa5A-Za-z0-9_\-]+)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      push(m[1]);
    }
  }
  return Array.from(new Set(out.map((s) => s.toLowerCase())));
};

const sendMessage = async (payload: {
  text: string;
  attachments: Attachment[];
}) => {
  const text = payload.text || '';
  const attachments = payload.attachments || [];
  if (!text.trim() && attachments.length === 0) return;

  let targetSessionId: string | null = null;
  let targetSessionIds: string[] = [];

  const mentions = extractMentions(text);
  if (!currentSessionId.value && mentions.length) {
    const candidates = sessions.value.filter((t) => {
      const title = (t.title || '').toLowerCase();
      return mentions.some((m) => title.includes(m));
    });
    const sorted = candidates
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return tb - ta;
      })
      .sort((a, b) => {
        const pa =
          a.threadType === 'assistant' || a.threadType === 'dm' ? 0 : 1;
        const pb =
          b.threadType === 'assistant' || b.threadType === 'dm' ? 0 : 1;
        return pa - pb;
      });
    if (sorted.length) {
      const pick = sorted[0];
      targetSessionId = pick.id;
      targetSessionIds = sorted.map((t) => t.id);
      agentStore.setCurrentSession(pick.id, pick.title || '');
      if (sorted.length > 1) {
        const names = sorted
          .slice(0, 3)
          .map((t) => t.title || t.id)
          .join(', ');
        ui.showToast(`命中多个会话：${names}；将依次路由至相关会话`, 'info');
      }
    }
  }

  const principalId = getPrincipalId();
  if (!principalId) return;

  const sessionIds = currentSessionId.value
    ? [currentSessionId.value]
    : targetSessionIds.length
      ? targetSessionIds
      : targetSessionId
        ? [targetSessionId]
        : [];

  if (sessionIds.length === 0) {
    ui.showToast('请先选择或创建一个会话', 'info');
    return;
  }

  const sessionId = sessionIds[0];
  const uploadedAttachments: Array<{
    type: string;
    url: string;
    name?: string;
    size?: number;
  }> = [];
  const attachmentMarkdown: string[] = [];

  if (attachments.length > 0) {
    try {
      for (const item of attachments) {
        const res = await resourceApi.smartUpload(item.file, { sessionId });
        const path = res.data.path;
        const url = resolveResourceUrl(path) || path;
        const type = item.file.type.startsWith('image/') ? 'image' : 'file';
        uploadedAttachments.push({
          type,
          url: path,
          name: item.file.name,
          size: item.file.size,
        });
        attachmentMarkdown.push(
          type === 'image'
            ? `![${item.file.name}](${url})`
            : `[${item.file.name}](${url})`,
        );
      }
    } catch {
      ui.showToast('附件上传失败', 'error');
      return;
    }
  }

  const attachmentsMd = attachmentMarkdown.join('\n\n');
  const combinedContent = attachmentsMd
    ? text.trim()
      ? `${text}\n\n${attachmentsMd}`
      : attachmentsMd
    : text;

  // 水容发送：立即展示 temp 消息动画，接口异步处理，输入框不锁定
  // 强制 pin + 清零未读, 实际滚动由 ResizeObserver / watch(length) 在 temp 插入后触发
  isPinnedToBottom.value = true;
  unreadNewCount.value = 0;

  void imStore
    .sendMessageOptimistic(sessionId, combinedContent, {
      attachments: uploadedAttachments.length ? uploadedAttachments : undefined,
    })
    .catch(() => {
      ui.showToast('发送失败', 'error');
    });

  // 兜底滚到底 :: temp 插入是异步的 (ensureSelfIsMember + mergeMessagesIncremental 各 await)
  // 50ms / 200ms / 500ms 三次兜底, 覆盖快速 / 中速 / 慢速 (markdown 渲染) 场景
  // 每次只在 isPinnedToBottom=true 时滚, 避免用户期间手动上滚被打扰
  [50, 200, 500].forEach((delay) => {
    window.setTimeout(() => {
      if (isPinnedToBottom.value) scrollToBottom();
    }, delay);
  });
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #d1d5db;
}

/* 新消息浮动按钮 :: fade + 微弹起 */
.new-msg-fade-enter-active,
.new-msg-fade-leave-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.new-msg-fade-enter-from,
.new-msg-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
.new-msg-fade-enter-to,
.new-msg-fade-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
