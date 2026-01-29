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
        :isProcessing="isProcessing"
        :messages="currentMessages"
        :selfPrincipalId="selfPrincipalId"
        :sessionMembers="currentSessionMembers"
      />
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
 * @description 会话内聊天记录页面：历史加载、实时同步与消息发送。
 * @keywords-cn 会话内聊天记录, 消息发送, 历史加载, 实时同步
 * @keywords-en chat-messages, send-message, history-load, realtime-sync
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import InputArea from '../../components/chat/InputArea.vue';
import ChatMessageList from '../../components/chat/ChatMessageList.vue';
import { useI18n } from '../../composables/useI18n';
import { useAgentStore } from '../../store/agent.store';
import { useAgentSessionStore } from '../../store/session.store';
import { useChatContacts } from '../../hooks/useChatContacts';
import { useImStore } from '../../../im/im.module';
import { ChatRole } from '../../enums/agent.enums';
import type { Attachment, ChatMessage } from '../../types/agent.types';
import { useUIStore } from '../../store/ui.store';

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

const { mentionCandidates, loadContacts } = useChatContacts();

const imStore = useImStore();
const {
  activeMessages,
  activeSession,
  activeLoadingMessages,
  activeSendStatusByMessageId,
} = storeToRefs(imStore);

const chatContainer = ref<HTMLElement | null>(null);

const isPinnedToBottom = ref(true);
const bottomThresholdPx = 80;

const updatePinnedState = () => {
  const el = chatContainer.value;
  if (!el) return;
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  isPinnedToBottom.value = distance <= bottomThresholdPx;
};

const isProcessing = ref(false);
const isTitleLoading = ref(false);

watch(isTitleLoading, (v) => emit('titleLoadingChange', v), {
  immediate: true,
});

const currentSessionMembers = ref<
  Array<{ principalId: string; displayName: string }>
>([]);

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
    const detail = activeSession.value;
    currentSessionMembers.value = (detail?.members || []).map((m) => ({
      principalId: m.principalId,
      displayName: m.displayName,
    }));
  } finally {
    isTitleLoading.value = false;
  }

  isPinnedToBottom.value = true;
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

watch(
  chatContainer,
  (el, prev) => {
    prev?.removeEventListener('scroll', onScroll);
    el?.addEventListener('scroll', onScroll, { passive: true });
    nextTick(() => {
      updatePinnedState();
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  chatContainer.value?.removeEventListener('scroll', onScroll);
  imStore.leaveSession();
});

watch(
  () => currentMessages.value.length,
  (len, prevLen) => {
    if (len <= prevLen) return;
    if (!isPinnedToBottom.value) return;
    scrollToBottom();
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

  const attachmentsMd = attachments
    .map((f, i) => `![attachment-${i + 1}](${f.preview})`)
    .join('\n\n');
  const combinedContent = attachmentsMd ? `${text}\n\n${attachmentsMd}` : text;

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
  try {
    isProcessing.value = true;
    await imStore.sendMessageOptimistic(sessionId, combinedContent);
  } catch {
    ui.showToast('发送失败', 'error');
  } finally {
    isProcessing.value = false;
  }

  isPinnedToBottom.value = true;
  scrollToBottom();
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
</style>
