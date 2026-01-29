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

    <div v-else-if="mode === 'chat'" class="animate-fade-in">
      <template v-for="(msg, index) in messages" :key="msg.id">
        <div
          class="flex flex-col mb-6 px-2 group/message w-full"
          :class="checkIsSelfMessage(msg) ? 'items-end' : 'items-start'"
        >
          <div
            class="flex items-center gap-2 mb-1.5 px-1 opacity-80 select-none"
            :class="checkIsSelfMessage(msg) ? 'flex-row-reverse' : 'flex-row'"
          >
            <div
              class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-700"
            >
              <span>
                {{
                  (checkIsSelfMessage(msg)
                    ? '我'
                    : getDisplayName(msg.senderId)
                  )?.slice(0, 1) || (checkIsSelfMessage(msg) ? '我' : '他')
                }}
              </span>
            </div>
          </div>

          <div
            class="flex items-center gap-2 max-w-full"
            :class="checkIsSelfMessage(msg) ? 'flex-row' : 'flex-row-reverse'"
          >
            <div
              v-if="msg.status === 'sending'"
              class="text-gray-400 flex-shrink-0"
            >
              <i class="fa-solid fa-spinner fa-spin"></i>
            </div>

            <div
              v-if="msg.status === 'error'"
              class="text-red-500 flex-shrink-0 cursor-pointer"
              title="发送失败"
            >
              <i class="fa-solid fa-circle-exclamation"></i>
            </div>

            <div
              class="rounded-2xl px-4 py-2.5 shadow-sm text-sm relative group transition-all overflow-hidden break-words"
              :class="
                checkIsSelfMessage(msg)
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 text-gray-800 w-full'
              "
            >
              <div
                v-if="msg.tool_calls && msg.tool_calls.length > 0"
                class="mb-3 space-y-2"
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
                class="markdown-body prose prose-sm max-w-none overflow-x-auto"
                v-html="renderMarkdown(msg.content)"
                @click="handleMessageClick"
              ></div>
              <p
                v-else
                class="leading-relaxed whitespace-pre-wrap"
                @click="handleMessageClick"
              >
                {{ msg.content }}
              </p>
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
import { computed, watch, ref } from 'vue';

// ... (props definition)

const props = defineProps<Props>();

watch(
  () => props.messages,
  (newVal) => {
    console.log('[ChatMessageList] messages updated:', newVal?.length);
  },
  { immediate: true },
);
// ...
import type { ChatMessage } from '../../types/agent.types';
import { ChatRole, ToolCallStatus } from '../../enums/agent.enums';
import { useI18n } from '../../composables/useI18n';
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
  sessionMembers: Array<{ principalId: string; displayName: string }>;
}

const { t } = useI18n();
const previewUrl = ref<string | null>(null);

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

const membersById = computed(() => {
  const map = new Map<string, string>();
  for (const item of props.sessionMembers) {
    map.set(item.principalId, item.displayName);
  }
  return map;
});

const checkIsSelfMessage = (m: ChatMessage) => {
  const id = props.selfPrincipalId?.trim();
  const senderId = m.senderId?.trim();
  if (!id || !senderId) return false;
  return senderId === id;
};

const getDisplayName = (pid?: string | null) => {
  if (!pid) return '';
  return membersById.value.get(pid) || '';
};

const renderMarkdown = (content: string) => {
  return md.render(content);
};
</script>

<style scoped>
.markdown-body :deep(p) {
  margin-bottom: 0.5em;
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
  animation: fade-in-up 0.3s ease-out forwards;
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
