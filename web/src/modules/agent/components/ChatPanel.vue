<template>
  <div class="flex flex-col h-full bg-gray-50 relative">
    <!-- Agent Status Header -->
    <div class="h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-white shadow-sm z-10 flex-shrink-0">
      <div class="flex items-center space-x-3 group relative cursor-pointer">
        <div class="relative">
          <div class="w-2 h-2 bg-green-500 rounded-full absolute top-0 right-0 animate-pulse"></div>
          <i class="fa-solid fa-earth-americas text-xl text-gray-700"></i>
        </div>
        <div class="flex flex-col">
          <span class="text-sm font-bold text-gray-800">Assistant Agent</span>
          <span class="text-xs text-blue-600 flex items-center">
            <i class="fa-solid fa-circle-notch fa-spin mr-1 text-[10px]"></i>
            Processing Request...
          </span>
        </div>

        <!-- Hover Workflow Details -->
        <div class="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-4 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 z-50">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Workflow Status</h3>
          <div class="space-y-3">
            <div 
              v-for="(step, index) in steps" 
              :key="step.id"
              class="flex items-center"
            >
              <div 
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mr-3 border"
                :class="{
                  'bg-blue-600 text-white border-blue-600': step.status === 'active',
                  'bg-green-500 text-white border-green-500': step.status === 'completed',
                  'bg-white text-gray-400 border-gray-300': step.status === 'pending',
                  'bg-red-500 text-white border-red-500': step.status === 'error'
                }"
              >
                <i v-if="step.status === 'completed'" class="fa-solid fa-check"></i>
                <i v-else-if="step.status === 'active'" class="fa-solid fa-circle-notch fa-spin"></i>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <span 
                class="text-sm"
                :class="{
                  'text-blue-700 font-medium': step.status === 'active',
                  'text-gray-600': step.status !== 'active'
                }"
              >
                {{ step.title }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Header Actions: Date Picker & Segment Menu -->
      <div class="flex items-center space-x-3">
        <button 
          @click="openDatePicker"
          class="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors flex items-center border border-gray-200 whitespace-nowrap overflow-x-auto max-w-[120px] scrollbar-hide"
        >
          <i class="fa-solid fa-calendar-days mr-2 text-gray-400 flex-shrink-0"></i>
          <span>{{ currentDateStr }}</span>
        </button>

        <!-- Segment Menu Trigger -->
        <div class="relative group">
          <button class="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-500 flex items-center justify-center transition-all">
            <i class="fa-solid fa-layer-group text-xs"></i>
          </button>
          <!-- Segment Dropdown -->
          <div class="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all z-50">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">Segments</div>
            <div class="max-h-40 overflow-y-auto custom-scrollbar">
              <div 
                v-for="seg in currentSegments" 
                :key="seg.id"
                class="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg group/item"
              >
                <!-- Edit Mode -->
                <div v-if="editingSegmentId === seg.id" class="flex items-center flex-1 mr-2 min-w-0">
                  <input 
                    v-model="tempSegmentName"
                    @keydown.enter.stop="saveSegmentName(currentDateStr, seg.id)"
                    @click.stop
                    class="w-full text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    placeholder="Segment Name"
                  />
                  <button @click.stop="saveSegmentName(currentDateStr, seg.id)" class="ml-1 text-green-600 hover:text-green-700 px-1">
                    <i class="fa-solid fa-check"></i>
                  </button>
                </div>

                <!-- View Mode -->
                <div v-else class="flex items-center flex-1 min-w-0 mr-2 cursor-pointer" @click.stop="toggleSegment(currentDateStr, seg.id)">
                  <span 
                    class="text-sm text-gray-700 truncate" 
                    :class="{'opacity-50': !seg.isVisible}"
                    :title="seg.name"
                  >
                    {{ seg.name }}
                  </span>
                  <button 
                    @click.stop="startEditing(seg)" 
                    class="ml-2 text-gray-400 hover:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity px-1"
                    title="Rename"
                  >
                    <i class="fa-solid fa-pen text-[10px]"></i>
                  </button>
                </div>

                <input 
                  type="checkbox" 
                  :checked="seg.isVisible" 
                  @change="toggleSegment(currentDateStr, seg.id)"
                  @click.stop
                  class="ml-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
              </div>
              <div v-if="currentSegments.length === 0" class="text-xs text-gray-400 px-2 py-1 italic">No segments</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Area (Standard Scroll) -->
    <div 
      class="flex-1 overflow-y-auto p-6 custom-scrollbar relative" 
      ref="chatContainer"
    >
      <!-- Empty State -->
      <div v-if="isHistoryEmpty" class="flex flex-col items-center justify-center h-full space-y-6 text-center animate-fade-in-up">
        <div class="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative">
          <div class="absolute inset-0 bg-blue-100/50 rounded-full animate-ping" style="animation-duration: 3s;"></div>
          <i class="fa-solid fa-earth-americas text-4xl text-blue-500 relative z-10"></i>
        </div>
        <div class="space-y-2 max-w-xs mx-auto">
           <p class="text-gray-500 font-medium">{{ t('chat.emptyState') }}</p>
           <button @click="generateMockData" class="text-xs text-blue-500 hover:underline">Generate Mock Data</button>
        </div>
      </div>

      <!-- Message List (Current Date Only) -->
      <div v-else>
        <template v-for="(msg, index) in currentMessages" :key="msg.id">
          
          <!-- Segment Divider (Start of a segment) -->
          <div v-if="getSegmentStartName(index)" class="flex items-center my-6">
             <div class="flex-1 h-px bg-gray-200"></div>
             <span class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">{{ getSegmentStartName(index) }}</span>
             <div class="flex-1 h-px bg-gray-200"></div>
          </div>

          <!-- Message Bubble -->
          <div 
            v-if="isMessageVisible(index)"
            class="flex mb-6 px-2 group/message"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div class="flex items-end flex-grow" :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'">
               <div 
                class="rounded-2xl px-5 py-3 shadow-sm text-sm md:text-base relative group transition-all"
                :class="msg.role === 'user' ? 'bg-black text-white max-w-xl' : 'bg-white border border-gray-200 text-gray-800 max-w-3xl w-full flex-grow'"
              >
                <!-- Tool Call Display -->
                <div v-if="msg.tool_calls && msg.tool_calls.length > 0" class="mb-3 space-y-2">
                  <div 
                    v-for="tool in msg.tool_calls" 
                    :key="tool.id"
                    class="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-600"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-bold text-blue-600 flex items-center">
                        <i class="fa-solid fa-wrench mr-1"></i> {{ tool.name }}
                      </span>
                      <span 
                        class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                        :class="{
                          'bg-yellow-100 text-yellow-600': tool.status === 'calling',
                          'bg-green-100 text-green-600': tool.status === 'completed',
                          'bg-red-100 text-red-600': tool.status === 'failed'
                        }"
                      >
                        {{ tool.status }}
                      </span>
                    </div>
                    <div class="truncate opacity-75">{{ tool.arguments }}</div>
                  </div>
                </div>

                <!-- Markdown Content -->
                <div 
                  v-if="msg.role === 'assistant'" 
                  class="markdown-body prose prose-sm max-w-none"
                  v-html="renderMarkdown(msg.content)"
                ></div>
                <p v-else class="leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
              </div>

              <!-- Segment Action Trigger (Hover) -->
              <button 
                @click="createSegmentAt(index)"
                class="mb-2 mx-2 w-6 h-6 rounded-full bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-500 flex items-center justify-center opacity-0 group-hover/message:opacity-100 transition-all"
                title="End segment here"
              >
                 <i class="fa-solid fa-scissors text-xs"></i>
              </button>
            </div>
          </div>
        </template>
      </div>
      
      <!-- Loading Indicator (Fixed Position) -->
      <div v-if="isProcessing" class="fixed bottom-24 left-6 z-20">
         <div class="bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm flex items-center space-x-2">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            <span class="text-xs text-gray-400 ml-2">{{ t('chat.processing') }}</span>
         </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-4 bg-white border-t border-gray-200 flex-shrink-0 z-20">
      <div class="max-w-4xl mx-auto">
        <div class="relative flex flex-col bg-gray-50 border border-gray-200 rounded-3xl shadow-sm focus-within:shadow-md focus-within:border-gray-300 focus-within:bg-white transition-all duration-300 overflow-hidden">
          <!-- Image Previews -->
          <div v-if="attachedFiles.length > 0" class="px-4 pt-4 flex space-x-3 overflow-x-auto custom-scrollbar pb-2">
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
                >
              </button>
              
              <!-- Voice Input Trigger -->
              <button 
                class="h-8 px-3 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-all duration-300"
                :class="{'bg-red-50 text-red-500 hover:bg-red-100 w-auto': isRecording, 'w-8': !isRecording}"
                @click="toggleRecording"
                :title="isRecording ? t('chat.stopRecording') : t('chat.voiceInput')"
              >
                 <div v-if="isRecording" class="flex items-center space-x-2">
                    <div class="flex items-center space-x-0.5 h-4">
                      <div class="w-1 bg-red-500 rounded-full animate-voice-wave" style="animation-delay: 0ms; height: 40%"></div>
                      <div class="w-1 bg-red-500 rounded-full animate-voice-wave" style="animation-delay: 100ms; height: 100%"></div>
                      <div class="w-1 bg-red-500 rounded-full animate-voice-wave" style="animation-delay: 200ms; height: 60%"></div>
                      <div class="w-1 bg-red-500 rounded-full animate-voice-wave" style="animation-delay: 300ms; height: 80%"></div>
                      <div class="w-1 bg-red-500 rounded-full animate-voice-wave" style="animation-delay: 100ms; height: 40%"></div>
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
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Panel Component
 * @description Main chat interface with segmented history, tool call display, and empty state.
 * @keywords-cn 聊天面板, 消息列表, 分段显示, 空状态
 * @keywords-en chat-panel, message-list, segmentation, empty-state
 */
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { agentService } from '../services/agent.service';
import type { ChatMessage, WorkflowStep, ChatSegment } from '../types/agent.types';
import { useI18n } from '../composables/useI18n';
import DatePickerModal from './DatePickerModal.vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const { t } = useI18n();
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

const renderMarkdown = (content: string) => {
  return md.render(content);
};

const steps = ref<WorkflowStep[]>([]);
const history = ref<Record<string, ChatMessage[]>>({});
const inputMessage = ref('');
const isProcessing = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const chatContainer = ref<HTMLElement | null>(null);
const showDatePicker = ref(false);
const currentDateStr = ref(new Date().toISOString().split('T')[0]);

// File attachment state
const fileInput = ref<HTMLInputElement | null>(null);
const attachedFiles = ref<{ file: File; preview: string }[]>([]);

// Voice recording state
const isRecording = ref(false);

// Segmentation State
const segments = ref<Record<string, ChatSegment[]>>({});
const editingSegmentId = ref<string | null>(null);
const tempSegmentName = ref('');

const isHistoryEmpty = computed(() => {
  return Object.keys(history.value).length === 0;
});

const currentMessages = computed(() => {
  return history.value[currentDateStr.value] || [];
});

const currentSegments = computed(() => {
  return segments.value[currentDateStr.value] || [];
});

const loadData = async () => {
  steps.value = await agentService.getWorkflowSteps();
  // Initially empty to show empty state
  history.value = {}; 
  segments.value = {};
};

const generateMockData = () => {
  const today = new Date().toISOString().split('T')[0];
  currentDateStr.value = today; // Ensure we are looking at today

  history.value = {
    [today]: [
      {
        id: '1',
        role: 'user',
        content: 'What is the status of the project?',
        timestamp: Date.now() - 86400000
      },
      {
        id: '2',
        role: 'assistant',
        content: 'The project is currently in the **development phase**. We are on track for the Q3 release.',
        timestamp: Date.now() - 86390000
      },
      {
        id: '3',
        role: 'user',
        content: 'Check server status.',
        timestamp: Date.now() - 3600000
      },
      {
        id: '4',
        role: 'assistant',
        content: 'Checking server metrics...',
        timestamp: Date.now() - 3590000,
        tool_calls: [
          {
            id: 'call_1',
            name: 'check_server_health',
            arguments: '{"region": "us-east-1"}',
            status: 'completed',
            result: 'Healthy'
          }
        ]
      },
      {
        id: '5',
        role: 'assistant',
        content: 'All systems are operational. CPU usage is at 45%.',
        timestamp: Date.now() - 3580000
      }
    ]
  };
  
  // Create default segments
  segments.value[today] = [
    { id: 'seg_1', name: 'Project Status', startIndex: 0, endIndex: 1, isVisible: true },
    { id: 'seg_2', name: 'Server Health', startIndex: 2, endIndex: 4, isVisible: true }
  ];

  scrollToBottom();
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

const sendMessage = async () => {
  if ((!inputMessage.value.trim() && attachedFiles.value.length === 0) || isProcessing.value) return;

  const userMsg: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: inputMessage.value,
    timestamp: Date.now(),
  };

  // Add to history
  const today = currentDateStr.value;
  if (!history.value[today]) history.value[today] = [];
  history.value[today].push(userMsg);

  inputMessage.value = '';
  attachedFiles.value = []; // Clear attachments
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
  
  isProcessing.value = true;
  scrollToBottom();

  // Simulate response
  setTimeout(() => {
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'This is a simulated response. I can help you with code, analysis, and more.',
      timestamp: Date.now(),
    };
    history.value[today].push(aiMsg);
    isProcessing.value = false;
    scrollToBottom();
  }, 1500);
};

// Date Picker Logic
const openDatePicker = () => {
  showDatePicker.value = true;
};

const handleDateConfirm = (date: string) => {
  currentDateStr.value = date;
  showDatePicker.value = false;
  scrollToBottom();
};

// Segmentation Logic
const startEditing = (seg: ChatSegment) => {
  editingSegmentId.value = seg.id;
  tempSegmentName.value = seg.name;
};

const saveSegmentName = (date: string, segId: string) => {
  const seg = segments.value[date]?.find(s => s.id === segId);
  if (seg && tempSegmentName.value.trim()) {
    seg.name = tempSegmentName.value.trim();
  }
  editingSegmentId.value = null;
};

// Create segment ending at specific index
const createSegmentAt = (index: number) => {
  const date = currentDateStr.value;
  if (!segments.value[date]) segments.value[date] = [];
  
  const existingSegments = segments.value[date];
  
  // Check if this message is already inside a segment
  const insideSegment = existingSegments.find(s => index >= s.startIndex && index <= s.endIndex);
  if (insideSegment) {
    alert('This message is already part of a segment.');
    return;
  }

  // Determine start index
  // If there are previous segments, start after the last one
  // Otherwise start from 0
  let startIndex = 0;
  if (existingSegments.length > 0) {
    // Find the last segment before this index
    const sorted = [...existingSegments].sort((a, b) => a.endIndex - b.endIndex);
    const lastSeg = sorted[sorted.length - 1];
    if (lastSeg.endIndex < index) {
      startIndex = lastSeg.endIndex + 1;
    } else {
      // Should not happen if we check insideSegment, but safe fallback
      startIndex = index;
    }
  }
  
  if (startIndex > index) {
    alert('Invalid segment range.');
    return;
  }

  segments.value[date].push({
    id: Date.now().toString(),
    name: `Segment ${existingSegments.length + 1}`,
    startIndex,
    endIndex: index,
    isVisible: true
  });
  
  // Sort segments by index to keep order
  segments.value[date].sort((a, b) => a.startIndex - b.startIndex);
};

// Manual add (fallback, adds to end)
const addSegment = (date: string) => {
  const msgs = history.value[date] || [];
  if (msgs.length === 0) return;
  createSegmentAt(msgs.length - 1);
};

const toggleSegment = (date: string, segmentId: string) => {
  const seg = segments.value[date]?.find(s => s.id === segmentId);
  if (seg) {
    seg.isVisible = !seg.isVisible;
  }
};

const getSegments = (date: string) => {
  return segments.value[date] || [];
};

const getSegmentStartName = (index: number) => {
  const date = currentDateStr.value;
  const seg = segments.value[date]?.find(s => s.startIndex === index);
  return seg ? seg.name : null;
};

const isMessageVisible = (index: number) => {
  const date = currentDateStr.value;
  const dateSegments = segments.value[date];
  if (!dateSegments || dateSegments.length === 0) return true;
  
  // Find if this message belongs to any segment
  const coveringSegment = dateSegments.find(s => index >= s.startIndex && index <= s.endIndex);
  
  // If it's covered by a segment, check if that segment is visible
  if (coveringSegment) {
    return coveringSegment.isVisible;
  }
  
  // If not covered by any segment (e.g. new messages), show it
  return true;
};

// File Attachment Logic
const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    Array.from(input.files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachedFiles.value.push({
            file,
            preview: e.target?.result as string
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
              preview: e.target?.result as string
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
        inputMessage.value = "Hello, how are you today?";
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.85em;
}

@keyframes voice-wave {
  0%, 100% { height: 40%; }
  50% { height: 100%; }
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
</style>