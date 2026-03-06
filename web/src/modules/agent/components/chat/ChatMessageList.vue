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
      <template v-for="msg in messages" :key="msg.id">
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
          class="flex mb-6 px-2 group/message w-full gap-3"
          :class="[
            msg.senderId === selfId ? 'flex-row-reverse' : 'flex-row',
            isNewMessage(msg.id) ? 'message-enter' : '',
          ]"
        >
          <!-- Avatar Column -->
          <div class="flex-shrink-0 select-none">
            <button
              class="block"
              :title="
                displayNameById[msg.senderId || ''] || msg.senderName || ''
              "
              @click.stop="handleAvatarClick(msg)"
            >
              <div
                class="w-9 h-9 rounded-md bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm overflow-hidden"
              >
                <img
                  v-if="avatarSrcById[(msg.senderId || '').trim()]"
                  :src="avatarSrcById[(msg.senderId || '').trim()]"
                  class="w-full h-full object-contain"
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
          </div>

          <!-- Content Column -->
          <div
            class="flex flex-col min-w-0 max-w-[85%]"
            :class="msg.senderId === selfId ? 'items-end' : 'items-start'"
          >
            <!-- Nickname -->
            <span
              v-if="sessionType === 'group' && msg.senderId !== selfId"
              class="text-xs text-gray-500 mb-1 select-none ml-1"
            >
              {{ displayNameById[msg.senderId || ''] || msg.senderName }}
            </span>

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

              <!-- Bubble -->
              <div
                class="rounded-lg px-3 py-2 shadow-sm text-sm relative group transition-all break-words"
                :class="
                  msg.senderId === selfId
                    ? 'bg-black text-white mr-1.5'
                    : 'bg-white border border-gray-200 text-gray-800 ml-1.5'
                "
              >
                <!-- Tail for Self (Right) -->
                <div
                  v-if="msg.senderId === selfId"
                  class="absolute top-3 -right-[6px] w-3 h-3 bg-black rotate-45"
                ></div>

                <!-- Tail for Others (Left) -->
                <div
                  v-else
                  class="absolute top-3 -left-[6px] w-3 h-3 bg-white border-l border-b border-gray-200 rotate-45"
                ></div>

                <div
                  v-if="msg.tool_calls && msg.tool_calls.length > 0"
                  class="mb-3 space-y-2 relative z-10"
                >
                  <div
                    v-for="tool in msg.tool_calls"
                    :key="tool.id"
                    class="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-600 overflow-x-auto"
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
                  class="markdown-body prose prose-sm max-w-none overflow-x-auto relative z-10"
                  v-html="renderMarkdown(msg.content)"
                  @click="handleMessageClick"
                ></div>
                <p
                  v-else
                  class="leading-relaxed whitespace-pre-wrap relative z-10"
                  @click="handleMessageClick"
                >
                  {{ msg.content }}
                </p>
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

    <!-- Image Preview Modal -->
    <div
      v-if="previewUrl"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-fade-in"
      @click="previewUrl = null"
    >
      <img
        :src="previewUrl"
        class="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl transition-transform transform scale-100"
        @click.stop
      />
      <button
        class="absolute top-4 right-4 text-white/70 hover:text-white text-2xl transition-colors"
        @click="previewUrl = null"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Message List
 * @description 聊天消息气泡与工具调用展示区域。
 * @keywords-cn 消息列表, 工具调用, 聊天内容
 * @keywords-en message-list, tool-calls, chat-content
 */
import { computed, watch, ref, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import type { ChatMessage } from '../../types/agent.types';
import { ChatRole, ToolCallStatus } from '../../enums/agent.enums';
import { useI18n } from '../../composables/useI18n';
import { resolveResourceUrl } from '../../../../utils/http';
import { usePanelStore } from '../../store/panel.store';
import { useImStore } from '../../../im/im.module';
import MarkdownIt from 'markdown-it';
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
}

const props = defineProps<Props>();

type SessionMember = Props['sessionMembers'][number];

const imStore = useImStore();
const { activeSession } = storeToRefs(imStore);

const { t } = useI18n();
const panelStore = usePanelStore();
const previewUrl = ref<string | null>(null);

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
    out[pid] = (resolveResourceUrl(raw) || raw).trim();
  }
  console.log(out);
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
    const resolved = resolveResourceUrl(src);
    if (resolved) {
      token.attrs[srcIndex][1] = resolved;
    }
  }
  return defaultImageRender(tokens, idx, options, env, self);
};

const handleMessageClick = (e: MouseEvent) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  // Image Preview
  if (target instanceof HTMLImageElement && target.tagName === 'IMG') {
    const src = target.src;
    if (src) {
      previewUrl.value = src;
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

const messageIds = computed(() => {
  return props.messages.map((m) => m.id);
});

watch(
  messageIds,
  (ids, prevIds) => {
    const prev = new Set(prevIds || []);
    for (const id of ids) {
      if (!prev.has(id)) {
        markNewMessage(id);
      }
    }
  },
  { flush: 'post' },
);

onUnmounted(() => {
  for (const t of newMessageTimeoutById.values()) {
    window.clearTimeout(t);
  }
  newMessageTimeoutById.clear();
});

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

const renderMarkdown = (content: string) => {
  return md.render(content);
};
</script>

<style scoped>
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
</style>
