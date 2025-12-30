<template>
  <div class="flex flex-col h-full bg-gray-50 relative">
    <!-- Agent Status Header -->
    <div
      class="h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-white shadow-sm z-10 flex-shrink-0"
    >
      <div class="flex items-start space-x-3 group relative cursor-pointer">
        <div class="relative mt-1">
          <div
            class="w-2 h-2 bg-green-500 rounded-full absolute top-0 right-0 animate-pulse"
          ></div>
          <i class="fa-solid fa-earth-americas text-xl text-gray-700"></i>
        </div>
        <div class="flex flex-col">
          <!-- Main Title Row -->
          <div class="flex items-baseline space-x-2">
            <div class="flex items-center">
              <button
                :title="currentSessionTitle || '未命名对话'"
                class="text-base font-bold text-gray-800 hover:text-blue-600 transition-colors truncate max-w-[100px] text-left leading-tight"
              >
                {{ currentSessionTitle || '未命名对话' }}
              </button>
              <i
                v-if="isTitleLoading"
                class="fas fa-spinner fa-spin text-gray-400 text-xs ml-2"
              ></i>
            </div>
            <div class="h-3 w-[1px] bg-gray-300 self-center"></div>
            <button
              @click="createNewSessionGroup"
              class="text-xs text-gray-500 hover:text-black font-medium transition-colors"
            >
              新增
            </button>
            <button
              @click="openSessionSwitchModal"
              class="text-xs text-gray-500 hover:text-black font-medium transition-colors"
            >
              切换
            </button>
          </div>

          <!-- Subtitle Row (Workflow Status) -->
          <div class="mt-1">
            <span
              v-if="activeWorkflows.length > 0"
              class="text-xs text-blue-600 flex items-center"
            >
              <i class="fa-solid fa-circle-notch fa-spin mr-1 text-[10px]"></i>
              {{ t('chat.activeWorkflows', { count: activeWorkflows.length }) }}
            </span>
            <span v-else class="text-xs text-gray-400">
              {{ t('chat.noActiveWorkflows') }}
            </span>
          </div>
        </div>

        <!-- Hover Workflow Details -->
        <div
          class="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 z-50"
        >
          <h3
            class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3"
          >
            {{ t('chat.workflowStatus') }}
          </h3>
          <div
            class="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-3 items-center"
          >
            <template v-for="wf in activeWorkflows.slice(0, 3)" :key="wf.id">
              <!-- Status Icon -->
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border"
                :class="{
                  'bg-blue-50 text-blue-600 border-blue-200':
                    wf.status === WorkflowGraphStatus.Running,
                  'bg-gray-50 text-gray-400 border-gray-200':
                    wf.status === WorkflowGraphStatus.Pending,
                  'bg-green-50 text-green-600 border-green-200':
                    wf.status === WorkflowGraphStatus.Completed,
                  'bg-red-50 text-red-600 border-red-200':
                    wf.status === WorkflowGraphStatus.Error,
                }"
              >
                <i
                  v-if="wf.status === WorkflowGraphStatus.Running"
                  class="fa-solid fa-circle-notch fa-spin"
                ></i>
                <i
                  v-else-if="wf.status === WorkflowGraphStatus.Completed"
                  class="fa-solid fa-check"
                ></i>
                <i
                  v-else-if="wf.status === WorkflowGraphStatus.Error"
                  class="fa-solid fa-xmark"
                ></i>
                <i v-else class="fa-solid fa-clock"></i>
              </div>

              <!-- Workflow -> Node -->
              <div class="flex items-center min-w-0 text-xs">
                <span class="font-bold text-gray-800 truncate max-w-[80px]">{{
                  wf.name
                }}</span>
                <i
                  class="fa-solid fa-arrow-right mx-2 text-gray-300 text-[10px]"
                ></i>
                <span class="text-gray-600 truncate">{{ wf.node }}</span>
              </div>

              <!-- Status Text -->
              <div
                class="text-[10px] font-medium px-1.5 py-0.5 rounded"
                :class="{
                  'bg-blue-100 text-blue-700':
                    wf.status === WorkflowGraphStatus.Running,
                  'bg-gray-100 text-gray-600':
                    wf.status === WorkflowGraphStatus.Pending,
                  'bg-green-100 text-green-700':
                    wf.status === WorkflowGraphStatus.Completed,
                  'bg-red-100 text-red-700':
                    wf.status === WorkflowGraphStatus.Error,
                }"
              >
                {{ wf.status }}
              </div>
            </template>
          </div>

          <!-- Show More -->
          <div
            v-if="activeWorkflows.length > 3"
            class="pt-3 mt-1 border-t border-gray-100 text-center"
          >
            <button
              @click="showWorkflowMonitor = true"
              class="text-xs text-blue-500 hover:text-blue-600 font-medium hover:underline flex items-center justify-center w-full"
            >
              Show more
              <i class="fa-solid fa-chevron-down ml-1 text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Header Actions: Date Picker & Segment Menu -->
      <div class="flex items-center space-x-3">
        <button
          @click="openDatePicker"
          class="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors flex items-center border border-gray-200 whitespace-nowrap overflow-x-auto max-w-[120px] scrollbar-hide"
        >
          <i
            class="fa-solid fa-calendar-days mr-2 text-gray-400 flex-shrink-0"
          ></i>
          <span>{{ currentDateStr }}</span>
        </button>

        <!-- Segment Menu Trigger Removed -->
      </div>
    </div>

    <!-- Chat Area (Standard Scroll) -->
    <div
      class="flex-1 overflow-y-auto p-2 custom-scrollbar relative"
      ref="chatContainer"
    >
      <!-- History Loading State -->
      <div
        v-if="isLoadingHistory"
        class="flex flex-col items-center justify-center h-full space-y-4"
      >
        <div
          class="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="isHistoryEmpty"
        class="flex flex-col items-center justify-center h-full space-y-6 text-center animate-fade-in-up"
      >
        <div
          class="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative"
        >
          <div
            class="absolute inset-0 bg-blue-100/50 rounded-full animate-ping"
            style="animation-duration: 3s"
          ></div>
          <i
            class="fa-solid fa-earth-americas text-4xl text-blue-500 relative z-10"
          ></i>
        </div>
        <div class="space-y-2 max-w-xs mx-auto">
          <p class="text-gray-500 font-medium">{{ t('chat.emptyState') }}</p>
        </div>
      </div>

      <!-- Message List (Current Date Only) -->
      <div v-else class="animate-fade-in">
        <template v-for="(msg, index) in currentMessages" :key="msg.id">
          <!-- Message Bubble -->
          <div
            class="flex flex-col mb-6 px-2 group/message w-full"
            :class="msg.role === ChatRole.User ? 'items-end' : 'items-start'"
          >
            <!-- Sender Info -->
            <div
              class="flex items-center gap-2 mb-1.5 px-1 opacity-80 select-none"
              :class="
                msg.role === ChatRole.User ? 'flex-row-reverse' : 'flex-row'
              "
            >
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                :class="
                  msg.role === ChatRole.User
                    ? 'bg-gray-800 text-white'
                    : 'bg-blue-100 text-blue-600'
                "
              >
                <i
                  class="fa-solid"
                  :class="msg.role === ChatRole.User ? 'fa-user' : 'fa-robot'"
                ></i>
              </div>
              <span class="text-xs text-gray-500 font-medium">
                {{ msg.role === ChatRole.User ? 'You' : 'Assistant' }}
              </span>
            </div>

            <!-- Bubble Content -->
            <div
              class="rounded-2xl px-4 py-2.5 shadow-sm text-sm relative group transition-all overflow-hidden break-words max-w-full"
              :class="
                msg.role === ChatRole.User
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 text-gray-800 w-full'
              "
            >
              <!-- Tool Call Display -->
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
                      <i class="fa-solid fa-wrench mr-1"></i> {{ tool.name }}
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
                  <div class="truncate opacity-75">{{ tool.arguments }}</div>
                  <div
                    v-if="tool.result"
                    class="mt-1 text-[11px] text-green-700 whitespace-pre-wrap"
                  >
                    {{ tool.result }}
                  </div>
                </div>
              </div>

              <!-- Markdown Content -->
              <div
                v-if="msg.role === ChatRole.Assistant"
                class="markdown-body prose prose-sm max-w-none overflow-x-auto"
                v-html="renderMarkdown(msg.content)"
              ></div>
              <p v-else class="leading-relaxed whitespace-pre-wrap">
                {{ msg.content }}
              </p>
            </div>
          </div>
        </template>
      </div>

      <!-- Loading Indicator (Fixed Position) -->
      <div v-if="isProcessing" class="fixed bottom-24 left-6 z-20">
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
          <span class="text-xs text-gray-400 ml-2">{{
            t('chat.processing')
          }}</span>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-4 bg-white border-t border-gray-200 flex-shrink-0 z-20">
      <div class="max-w-4xl mx-auto">
        <div
          class="relative flex flex-col bg-gray-50 border border-gray-200 rounded-3xl shadow-sm focus-within:shadow-md focus-within:border-gray-300 focus-within:bg-white transition-all duration-300 overflow-hidden"
        >
          <!-- Image Previews -->
          <div
            v-if="attachedFiles.length > 0"
            class="px-4 pt-4 flex space-x-3 overflow-x-auto custom-scrollbar pb-2"
          >
            <div
              v-for="(file, index) in attachedFiles"
              :key="index"
              class="relative group flex-shrink-0"
            >
              <img
                :src="file.preview"
                class="h-16 w-16 object-cover rounded-lg border border-gray-200"
                alt="preview"
              />
              <button
                @click="removeAttachment(index)"
                class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
          </div>

          <!-- Textarea -->
          <textarea
            v-model="inputMessage"
            @keydown.enter.prevent="handleEnter"
            @input="adjustHeight"
            @paste="handlePaste"
            ref="textareaRef"
            rows="1"
            class="w-full bg-transparent border-none outline-none px-4 py-3 text-gray-700 placeholder-gray-400 resize-none max-h-32 overflow-y-auto"
            :placeholder="t('chat.inputPlaceholder')"
          ></textarea>

          <!-- Input Actions -->
          <div class="flex items-center justify-between px-2 pb-2">
            <div class="flex items-center space-x-1">
              <button
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors relative"
                @click="triggerFileInput"
                :title="t('chat.attachFile')"
              >
                <i class="fa-solid fa-paperclip"></i>
                <input
                  type="file"
                  ref="fileInput"
                  class="hidden"
                  accept="image/*"
                  multiple
                  @change="handleFileSelect"
                />
              </button>

              <!-- Voice Input Trigger -->
              <button
                class="h-8 px-3 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-all duration-300"
                :class="{
                  'bg-red-50 text-red-500 hover:bg-red-100 w-auto': isRecording,
                  'w-8': !isRecording,
                }"
                @click="toggleRecording"
                :title="
                  isRecording ? t('chat.stopRecording') : t('chat.voiceInput')
                "
              >
                <div v-if="isRecording" class="flex items-center space-x-2">
                  <div class="flex items-center space-x-0.5 h-4">
                    <div
                      class="w-1 bg-red-500 rounded-full animate-voice-wave"
                      style="animation-delay: 0ms; height: 40%"
                    ></div>
                    <div
                      class="w-1 bg-red-500 rounded-full animate-voice-wave"
                      style="animation-delay: 100ms; height: 100%"
                    ></div>
                    <div
                      class="w-1 bg-red-500 rounded-full animate-voice-wave"
                      style="animation-delay: 200ms; height: 60%"
                    ></div>
                    <div
                      class="w-1 bg-red-500 rounded-full animate-voice-wave"
                      style="animation-delay: 300ms; height: 80%"
                    ></div>
                    <div
                      class="w-1 bg-red-500 rounded-full animate-voice-wave"
                      style="animation-delay: 100ms; height: 40%"
                    ></div>
                  </div>
                </div>
                <i v-else class="fa-solid fa-microphone"></i>
              </button>
            </div>

            <button
              @click="sendMessage"
              :disabled="!inputMessage.trim() && attachedFiles.length === 0"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-all transform hover:scale-105 shadow-md"
            >
              <i class="fa-solid fa-arrow-up"></i>
            </button>
          </div>
        </div>
        <div class="text-center mt-2">
          <p class="text-[10px] text-gray-400">
            {{ t('chat.footerDisclaimer') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Date Picker Modal -->
    <DatePickerModal
      v-if="showDatePicker"
      :currentDate="currentDateStr"
      @close="showDatePicker = false"
      @confirm="handleDateConfirm"
    />

    <!-- Workflow Monitor Modal -->
    <WorkflowMonitorModal
      v-if="showWorkflowMonitor"
      :visible="showWorkflowMonitor"
      @close="showWorkflowMonitor = false"
    />

    <!-- Session Switch Modal -->
    <SessionSwitchModal
      v-if="showSessionSwitchModal"
      :visible="showSessionSwitchModal"
      :currentGroupId="currentSessionId"
      @close="showSessionSwitchModal = false"
      @select="handleSessionSwitch"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Panel Component
 * @description Main chat interface with tool call display and streaming AI responses.
 * @keywords-cn 聊天面板, 消息列表, 工具调用, 流式
 * @keywords-en chat-panel, message-list, tool-calls, streaming
 */
import { ref, onMounted, nextTick, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '../store/agent.store';
import { agentService } from '../services/agent.service';
import {
  agentSocketService,
  type AgentStreamCallbacks,
} from '../services/agent.socket.service';
import {
  ChatRole,
  ToolCallStatus,
  WorkflowGraphStatus,
} from '../enums/agent.enums';
import type {
  ChatMessage,
  WorkflowStep,
  ToolCall,
  ActiveWorkflowCard,
} from '../types/agent.types';
import { useI18n } from '../composables/useI18n';
import DatePickerModal from './DatePickerModal.vue';
import WorkflowMonitorModal from './WorkflowMonitorModal.vue';
import SessionSwitchModal from './SessionSwitchModal.vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { useUIStore } from '../store/ui.store';

const props = defineProps<{
  class?: string;
}>();

const { t } = useI18n();
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

const renderMarkdown = (content: string) => {
  return md.render(content);
};

const steps = ref<WorkflowStep[]>([]);
const activeWorkflows = ref<ActiveWorkflowCard[]>([]);
const history = ref<Record<string, ChatMessage[]>>({});
const inputMessage = ref('');
const isProcessing = ref(false);
const isLoadingHistory = ref(false);
const isTitleLoading = ref<boolean>(false);
const currentAssistantMessageId = ref<string | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const chatContainer = ref<HTMLElement | null>(null);
const showDatePicker = ref(false);
const showWorkflowMonitor = ref(false);
const showSessionSwitchModal = ref(false);

const store = useAgentStore();
const {
  selectedDate: currentDateStr,
  chatClientId,
  currentSessionId,
  currentSessionTitle,
} = storeToRefs(store);

// File attachment state
const fileInput = ref<HTMLInputElement | null>(null);
const attachedFiles = ref<{ file: File; preview: string }[]>([]);

// Voice recording state
const isRecording = ref(false);

const isHistoryEmpty = computed(() => {
  return Object.keys(history.value).length === 0;
});

const currentMessages = computed(() => {
  return history.value[currentDateStr.value] || [];
});

const loadData = async () => {
  steps.value = await agentService.getWorkflowSteps();
  try {
    activeWorkflows.value = await agentService.getActiveWorkflows(
      currentDateStr.value,
    );
  } catch (error) {
    // keep empty on failure
  }

  if (currentSessionId.value) {
    isLoadingHistory.value = true;
    try {
      const messages = await agentService.getGroupHistory(
        currentSessionId.value,
      );
      history.value = {
        [currentDateStr.value]: messages,
      };
      nextTick(() => {
        scrollToBottom();
      });
    } catch (error) {
      console.error('Failed to load session history on mount:', error);
    } finally {
      isLoadingHistory.value = false;
    }
  } else {
    history.value = {};
  }
};

const refreshActiveWorkflows = async () => {
  try {
    activeWorkflows.value = await agentService.getActiveWorkflows(
      currentDateStr.value,
    );
  } catch (error) {
    // ignore
  }
};

const createNewSessionGroup = async () => {
  // Reset current context
  isProcessing.value = false;
  currentAssistantMessageId.value = null;
  history.value = {};
  inputMessage.value = '';
  attachedFiles.value = [];

  // Create new group and set current session
  try {
    isTitleLoading.value = true;
    const resp = await agentService.createGroup({
      date: currentDateStr.value,
      chatClientId: chatClientId.value,
      title: null,
    });
    store.setCurrentSession(resp.id, '');
  } catch (error) {
    console.error('Failed to create new session group:', error);
    store.setCurrentSession(undefined, '');
    isTitleLoading.value = false;
  }
};

const openSessionSwitchModal = () => {
  showSessionSwitchModal.value = true;
};

const handleSessionSwitch = async (group: {
  id: string;
  title: string;
  date: string;
}) => {
  store.setCurrentSession(group.id, group.title);
  isTitleLoading.value = false;
  if (group.date !== currentDateStr.value) {
    store.setSelectedDate(group.date);
  }

  isLoadingHistory.value = true;
  try {
    const messages = await agentService.getGroupHistory(group.id);
    history.value = {
      ...history.value,
      [group.date]: messages,
    };
    nextTick(() => {
      scrollToBottom();
    });
  } catch (error) {
    console.error('Failed to load session history:', error);
  } finally {
    isLoadingHistory.value = false;
  }
  showSessionSwitchModal.value = false;
};

onMounted(() => {
  loadData();
});

const adjustHeight = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
  }
};

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    sendMessage();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

const upsertToolCall = (
  message: ChatMessage,
  data: {
    id?: string;
    name?: string;
    argsText?: string;
    resultText?: string;
    status?: ToolCall['status'];
  },
) => {
  const toolId = data.id ?? data.name ?? `tool_${Date.now()}`;
  if (!message.tool_calls) {
    message.tool_calls = [];
  }
  let target = message.tool_calls.find((t) => t.id === toolId);
  if (!target) {
    target = {
      id: toolId,
      name: data.name ?? 'tool',
      arguments: data.argsText ?? '',
      status: data.status ?? ToolCallStatus.Calling,
    };
    message.tool_calls.push(target);
  }
  if (data.argsText !== undefined) {
    target.arguments = data.argsText;
  }
  if (data.resultText !== undefined) {
    target.result = data.resultText;
  }
  if (data.status) {
    target.status = data.status;
  }
};

const sendMessage = async () => {
  if (
    (!inputMessage.value.trim() && attachedFiles.value.length === 0) ||
    isProcessing.value
  )
    return;

  const today = currentDateStr.value;
  const now = Date.now();

  const userMsg: ChatMessage = {
    id: now.toString(),
    role: ChatRole.User,
    content: inputMessage.value,
    timestamp: now,
  };

  if (!history.value[today]) {
    history.value[today] = [];
  }
  history.value[today].push(userMsg);

  const assistantMsg: ChatMessage = {
    id: `${now}_assistant`,
    role: ChatRole.Assistant,
    content: '',
    timestamp: now + 1,
    tool_calls: [],
  };
  history.value[today].push(assistantMsg);
  currentAssistantMessageId.value = assistantMsg.id;

  inputMessage.value = '';
  attachedFiles.value = [];
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }

  isProcessing.value = true;
  // If starting a new session, show loading state for title
  if (!currentSessionId.value) {
    isTitleLoading.value = true;
  }
  scrollToBottom();

  const callbacks: AgentStreamCallbacks = {
    onToken: (text, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      target.content += text;
      scrollToBottom();
    },
    onToolStart: (data, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      let argsText = '';
      if (data.input !== undefined) {
        try {
          argsText = JSON.stringify(data.input, null, 2);
        } catch (e) {
          argsText = String(data.input);
        }
      }
      upsertToolCall(target, {
        id: data.id,
        name: data.name,
        argsText,
        status: ToolCallStatus.Calling,
      });
    },
    onToolChunk: (data, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      if (data.args === undefined) return;
      let argsText = '';
      try {
        argsText = JSON.stringify(data.args, null, 2);
      } catch (e) {
        argsText = String(data.args);
      }
      upsertToolCall(target, {
        id: data.id,
        name: data.name,
        argsText,
        status: ToolCallStatus.Calling,
      });
    },
    onToolEnd: (data, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      let resultText = '';
      if (data.output !== undefined) {
        try {
          resultText = JSON.stringify(data.output, null, 2);
        } catch (e) {
          resultText = String(data.output);
        }
      }
      upsertToolCall(target, {
        id: data.id,
        name: data.name,
        resultText,
        status: ToolCallStatus.Completed,
      });
    },
    onDone: (sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      isProcessing.value = false;
      refreshActiveWorkflows();
      scrollToBottom();
    },
    onError: (error, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      isProcessing.value = false;

      const uiStore = useUIStore();
      uiStore.showToast(`Chat Error: ${error}`, 'error');

      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: ChatRole.Assistant,
        content: `Error: ${error}`,
        timestamp: Date.now(),
      };
      if (!history.value[today]) {
        history.value[today] = [];
      }
      history.value[today].push(errorMsg);
      scrollToBottom();
    },
    onSessionGroup: (data, sessionId) => {
      if (data.sessionGroupId) {
        currentSessionId.value = data.sessionGroupId;
        refreshActiveWorkflows();
      }
    },
    onSessionGroupTitle: (data, sessionId) => {
      // Update title if it belongs to current session group
      if (data.sessionGroupId === currentSessionId.value) {
        currentSessionTitle.value = data.title;
        isTitleLoading.value = false;
      }
    },
  };

  agentSocketService.startChat(
    {
      message: userMsg.content,
      sessionId: currentSessionId.value,
      date: currentDateStr.value,
      chatClientId: chatClientId.value,
      stream: true,
    },
    callbacks,
  );
};

// Date Picker Logic
const openDatePicker = () => {
  showDatePicker.value = true;
};

const handleDateConfirm = (date: string) => {
  currentDateStr.value = date;
  showDatePicker.value = false;
  scrollToBottom();
  refreshActiveWorkflows();
};

// File Attachment Logic
const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    Array.from(input.files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachedFiles.value.push({
            file,
            preview: e.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }
  // Reset input so same file can be selected again
  input.value = '';
};

const removeAttachment = (index: number) => {
  attachedFiles.value.splice(index, 1);
};

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            attachedFiles.value.push({
              file,
              preview: e.target?.result as string,
            });
          };
          reader.readAsDataURL(file);
          event.preventDefault(); // Prevent pasting the file name
        }
      }
    }
  }
};

// Voice Logic
const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  if (isRecording.value) {
    // Simulate voice input start
    setTimeout(() => {
      if (isRecording.value) {
        inputMessage.value = 'Hello, how are you today?';
        adjustHeight();
        isRecording.value = false;
      }
    }, 3000);
  }
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

@keyframes voice-wave {
  0%,
  100% {
    height: 40%;
  }
  50% {
    height: 100%;
  }
}
.animate-voice-wave {
  animation: voice-wave 0.5s ease-in-out infinite;
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
