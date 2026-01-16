<template>
  <div class="bg-white rounded-2xl border border-gray-200 shadow-sm relative">
    <!-- Attachments Preview -->
    <div v-if="attachments.length" class="px-3 pt-3 grid grid-cols-3 gap-2">
      <div v-for="(item, idx) in attachments" :key="idx" class="relative group">
        <img
          :src="item.preview"
          class="w-full h-24 object-cover rounded-md border border-gray-200"
        />
        <button
          class="absolute top-1 right-1 bg-white/90 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-white"
          @click="removeAttachment(idx)"
          title="移除"
        >
          <i class="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div class="relative w-full">
      <div
        v-if="!text && !isComposing"
        class="absolute top-3 left-4 text-gray-400 pointer-events-none select-none text-sm"
      >
        {{ placeholder }}
      </div>
      <div
        ref="editorRef"
        contenteditable="true"
        @keydown="onKeydown"
        @input="onInput"
        @paste="handlePaste"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
        class="w-full bg-transparent border-none outline-none px-4 py-3 text-gray-700 text-sm leading-6 max-h-32 overflow-y-auto whitespace-pre-wrap break-words min-h-[48px]"
      ></div>
    </div>

    <div
      v-if="showMentionList"
      class="absolute bottom-full left-0 mb-2 ml-2 z-50"
    >
      <div
        class="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden min-w-[200px]"
      >
        <div class="max-h-44 overflow-auto">
          <div
            v-for="(item, idx) in filteredMentions"
            :key="item.id"
            class="flex items-center px-2 py-1.5 text-xs cursor-pointer"
            :class="
              idx === activeMentionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
            "
            @mousedown.prevent="selectMention(item)"
          >
            <div
              class="w-5 h-5 rounded-full mr-2 flex items-center justify-center text-[10px]"
              :class="
                item.threadType === 'assistant'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600'
              "
            >
              <i
                class="fa-solid"
                :class="
                  item.threadType === 'assistant' ? 'fa-robot' : 'fa-user'
                "
              />
            </div>
            <span class="truncate">{{ item.title || item.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between px-2 pb-2">
      <div class="flex items-center space-x-1">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors relative"
          @click="triggerFileInput"
          :title="t('chat.attachFile')"
          :disabled="disabled"
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

        <!-- Voice Input -->
        <button
          class="h-8 px-3 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-all duration-300"
          :class="{
            'bg-red-50 text-red-500 hover:bg-red-100 w-auto': isRecording,
            'w-8': !isRecording,
          }"
          @click="toggleRecording"
          :title="isRecording ? t('chat.stopRecording') : t('chat.voiceInput')"
          :disabled="disabled"
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
        @click="send"
        :disabled="disabled || (!text.trim() && attachments.length === 0)"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-all transform hover:scale-105 shadow-md"
      >
        <i class="fa-solid fa-arrow-up"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Input Area
 * @description Reusable input area with text, attachments, and voice mock.
 * @keywords-cn 输入区, 文本输入, 附件, 语音
 * @keywords-en input-area, text, attachments, voice, mentions
 */
import { ref, computed, nextTick } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { Attachment, ThreadListItem } from '../../types/agent.types';

const props = defineProps<{
  placeholder?: string;
  disabled?: boolean;
  mentions?: ThreadListItem[];
}>();

const emit = defineEmits<{
  (e: 'send', payload: { text: string; attachments: Attachment[] }): void;
}>();

const { t } = useI18n();
const text = ref('');
const attachments = ref<Attachment[]>([]);
const isRecording = ref(false);
const editorRef = ref<HTMLDivElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const showMentionList = ref(false);
const activeMentionIndex = ref(0);
const mentionQuery = ref('');
const savedRange = ref<Range | null>(null);
const isComposing = ref(false);

const filteredMentions = computed(() => {
  const q = mentionQuery.value.toLowerCase();
  const list = (props.mentions || []).filter((m) => {
    const title = (m.title || '').toLowerCase();
    const id = (m.id || '').toLowerCase();
    return q ? title.includes(q) || id.includes(q) : true;
  });
  return list.slice(0, 8);
});

const onCompositionStart = () => {
  isComposing.value = true;
};

const onCompositionEnd = (e: Event) => {
  isComposing.value = false;
  onInput();
};

const onInput = (e?: Event) => {
  if (!editorRef.value) return;
  text.value = editorRef.value.innerText;

  if (isComposing.value) return;

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;

  // Check for mention trigger
  if (node.nodeType === Node.TEXT_NODE) {
    const textContent = node.textContent || '';
    const before = textContent.slice(0, offset);
    const lastAt = before.lastIndexOf('@');

    if (lastAt !== -1) {
      // Ensure @ is at start or preceded by whitespace
      const prevChar = lastAt > 0 ? before[lastAt - 1] : ' ';
      if (/\s/.test(prevChar)) {
        const query = before.slice(lastAt + 1);
        // Basic check: query shouldn't contain spaces for now, or limited spaces
        if (!/\s/.test(query)) {
          mentionQuery.value = query;
          showMentionList.value = (props.mentions || []).length > 0;
          activeMentionIndex.value = 0;

          // Save range covering the query part for replacement
          const r = document.createRange();
          r.setStart(node, lastAt);
          r.setEnd(node, offset);
          savedRange.value = r;
          return;
        }
      }
    }
  }

  showMentionList.value = false;
  savedRange.value = null;
};

const onKeydown = (e: KeyboardEvent) => {
  if (showMentionList.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeMentionIndex.value = Math.min(
        activeMentionIndex.value + 1,
        filteredMentions.value.length - 1,
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeMentionIndex.value = Math.max(activeMentionIndex.value - 1, 0);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredMentions.value[activeMentionIndex.value];
      if (item) selectMention(item);
      return;
    }
    if (e.key === 'Escape') {
      showMentionList.value = false;
      return;
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};

const selectMention = (item: ThreadListItem) => {
  if (!savedRange.value) return;

  const range = savedRange.value;
  range.deleteContents();

  const span = document.createElement('span');
  span.className =
    'inline-flex items-center h-6 px-2 text-sm rounded-full bg-gray-100 text-gray-600 align-middle mx-0.5 font-medium select-none';
  span.contentEditable = 'false';
  span.textContent = `@${item.title || item.id}`;

  range.insertNode(span);

  // Insert space after
  const space = document.createTextNode('\u00A0'); // nbsp
  range.setStartAfter(span);
  range.setEndAfter(span);
  range.insertNode(space);

  // Move cursor after space
  range.setStartAfter(space);
  range.setEndAfter(space);

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Update text value
  if (editorRef.value) {
    text.value = editorRef.value.innerText;
  }

  showMentionList.value = false;
  savedRange.value = null;
  mentionQuery.value = '';
};

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const textData = event.clipboardData?.getData('text/plain');
  if (textData) {
    document.execCommand('insertText', false, textData);
  }

  // Handle image paste logic from original
  const items = event.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = String(e.target?.result ?? '');
        attachments.value.push({ file, preview });
      };
      reader.readAsDataURL(file);
    }
  }
};

const triggerFileInput = () => fileInput.value?.click();

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    Array.from(input.files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = String(e.target?.result ?? '');
          attachments.value.push({ file, preview });
        };
        reader.readAsDataURL(file);
      }
    });
  }
  input.value = '';
};

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1);
};

const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  if (isRecording.value) {
    setTimeout(() => {
      if (isRecording.value) {
        // Mock voice input
        const mockText = 'Hello, how are you today?';
        document.execCommand('insertText', false, mockText);
        isRecording.value = false;
      }
    }, 3000);
  }
};

const send = () => {
  if (!text.value.trim() && attachments.value.length === 0) return;
  emit('send', { text: text.value, attachments: attachments.value });

  // Clear editor
  if (editorRef.value) {
    editorRef.value.innerText = '';
  }
  text.value = '';
  attachments.value = [];
};
</script>

<style scoped>
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
</style>
