<template>
  <div
    class="relative transition-all duration-300 ease-in-out shadow-sm border border-gray-200"
    :class="[
      isRecording
        ? 'bg-white border-gray-200 rounded-full h-14 px-2 shadow-lg border'
        : 'bg-white rounded-2xl min-h-[48px] hover:shadow-md border-gray-200 border',
    ]"
  >
    <!-- Normal Input Content -->
    <div
      class="transition-all duration-300 origin-center"
      :class="[
        isRecording
          ? 'opacity-0 scale-95 pointer-events-none absolute inset-0 overflow-hidden'
          : 'opacity-100 scale-100 relative',
      ]"
    >
      <!-- Attachments Preview -->
      <div v-if="attachments.length" class="px-3 pt-3 grid grid-cols-3 gap-2">
        <div
          v-for="(item, idx) in attachments"
          :key="idx"
          class="relative group"
        >
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

          <!-- Emoji Button -->
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
            @click="toggleEmojiPicker"
            title="表情"
            :disabled="disabled"
          >
            <i class="fa-regular fa-face-smile"></i>
          </button>

          <!-- Voice Input -->
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
            @click="startRecording"
            :title="t('chat.voiceInput')"
            :disabled="disabled"
          >
            <i class="fa-solid fa-microphone"></i>
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

    <!-- Recording UI -->
    <div
      v-if="isRecording"
      class="absolute inset-0 flex items-center px-4 w-full h-full animate-fade-in text-gray-900"
    >
      <div class="flex-1 flex items-center space-x-3 overflow-hidden">
        <!-- Recording Indicator (Minimalist Black Pulse) -->
        <div
          class="w-2.5 h-2.5 rounded-full bg-black animate-pulse shadow-sm flex-shrink-0"
        ></div>
        <span
          class="text-sm font-mono font-medium flex-shrink-0 tracking-wider"
        >
          {{ recordingDuration }}
        </span>
        <!-- Minimalist Waveform -->
        <div class="flex items-center space-x-0.5 h-6 flex-1 ml-4 opacity-80">
          <div
            v-for="i in 40"
            :key="i"
            class="w-0.5 bg-black rounded-full transition-all duration-300"
            :style="{ height: Math.max(15, Math.random() * 100) + '%' }"
          ></div>
        </div>
      </div>

      <div
        class="flex items-center space-x-3 ml-3 border-l border-gray-200 pl-3 flex-shrink-0"
      >
        <button
          @click="cancelRecording"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="取消"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
        <button
          @click="sendVoice"
          class="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 transition-colors shadow-md transform active:scale-95"
          title="发送"
        >
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>
    </div>

    <!-- Modals (Mention List & Emoji Picker) -->
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

    <div
      v-if="showEmojiPicker"
      class="absolute bottom-full left-0 mb-2 ml-2 z-50 animate-fade-in-up"
    >
      <div
        class="bg-white border border-gray-200 rounded-xl shadow-xl w-72 p-2"
      >
        <div
          class="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto custom-scrollbar"
        >
          <button
            v-for="emoji in emojiList"
            :key="emoji"
            @click="insertEmoji(emoji)"
            class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg transition-colors"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
      <!-- Backdrop to close -->
      <div class="fixed inset-0 z-[-1]" @click="showEmojiPicker = false"></div>
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

const showEmojiPicker = ref(false);
const recordingDuration = ref('00:00');
let recordingTimer: any = null;
let recordingSeconds = 0;

const emojiList = [
  '😀',
  '😁',
  '😂',
  '🤣',
  '😃',
  '😄',
  '😅',
  '😆',
  '😉',
  '😊',
  '😋',
  '😎',
  '😍',
  '😘',
  '🥰',
  '😗',
  '😙',
  '😚',
  '🙂',
  '🤗',
  '🤩',
  '🤔',
  '🤨',
  '😐',
  '😑',
  '😶',
  '🙄',
  '😏',
  '😣',
  '😥',
  '😮',
  '🤐',
  '😯',
  '😪',
  '😫',
  '😴',
  '😌',
  '😛',
  '😜',
  '😝',
  '🤤',
  '😒',
  '😓',
  '😔',
  '😕',
  '🙃',
  '🤑',
  '😲',
  '☹️',
  '🙁',
  '😖',
  '😞',
  '😤',
  '😢',
  '😭',
  '😦',
  '😧',
  '😨',
  '😩',
  '🤯',
  '😬',
  '😰',
  '😱',
  '🥵',
  '🥶',
  '😳',
  '🤪',
  '😵',
  '😡',
  '😠',
  '🤬',
  '😷',
  '🤒',
  '🤕',
  '🤢',
  '🤮',
  '😇',
  '🤠',
  '🤡',
  '🥳',
  '🥴',
  '🥺',
  '🤥',
  '🤫',
  '🤭',
  '🧐',
  '🤓',
  '😈',
  '👿',
  '👹',
  '👺',
  '💀',
  '👻',
  '👽',
  '🤖',
  '💩',
  '👍',
  '👎',
  '👌',
  '✌️',
  '🤞',
  '🤟',
  '🤘',
  '🤙',
  '👈',
  '👉',
  '👆',
  '🖕',
  '👇',
  '☝️',
  '🤝',
  '🙏',
  '💪',
  '🧠',
  '🫀',
  '🫁',
  '🦷',
  '🦴',
  '👀',
  '👁️',
  '👅',
  '👄',
  '👶',
  '🧒',
  '👦',
  '👧',
  '🧑',
  '👱',
  '👨',
  '🧔',
  '👨‍🦰',
  '👨‍🦱',
  '👨‍🦳',
  '👨‍🦲',
  '👩',
  '👩‍🦰',
  '🧑‍🦰',
  '👩‍🦱',
  '🧑‍🦱',
  '👩‍🦳',
  '🧑‍🦳',
  '👩‍🦲',
  '🧑‍🦲',
  '👱‍♀️',
  '👱‍♂️',
  '🧓',
  '👴',
  '👵',
  '🙍',
  '🙍‍♂️',
  '🙍‍♀️',
  '🙎',
  '🙎‍♂️',
  '🙎‍♀️',
  '🙅',
  '🙅‍♂️',
  '🙅‍♀️',
  '🙆',
  '🙆‍♂️',
  '🙆‍♀️',
  '💁',
  '💁‍♂️',
  '💁‍♀️',
  '🙋',
  '🙋‍♂️',
  '🙋‍♀️',
  '🧏',
  '🧏‍♂️',
  '🧏‍♀️',
  '🙇',
  '🙇‍♂️',
  '🙇‍♀️',
  '🤦',
  '🤦‍♂️',
  '🤦‍♀️',
  '🤷',
  '🤷‍♂️',
  '🤷‍♀️',
];

const startRecording = () => {
  isRecording.value = true;
  recordingSeconds = 0;
  recordingDuration.value = '00:00';
  if (recordingTimer) clearInterval(recordingTimer);
  recordingTimer = setInterval(() => {
    recordingSeconds++;
    const m = Math.floor(recordingSeconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (recordingSeconds % 60).toString().padStart(2, '0');
    recordingDuration.value = `${m}:${s}`;
  }, 1000);
};

const cancelRecording = () => {
  isRecording.value = false;
  if (recordingTimer) clearInterval(recordingTimer);
};

const sendVoice = () => {
  isRecording.value = false;
  if (recordingTimer) clearInterval(recordingTimer);
  // Send mock voice message
  emit('send', {
    text: `[语音消息 ${recordingDuration.value}]`,
    attachments: [],
  });
};

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value;
};

const insertEmoji = (emoji: string) => {
  if (editorRef.value) {
    editorRef.value.innerText += emoji;
    text.value = editorRef.value.innerText;

    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editorRef.value);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);

    editorRef.value.focus();
  }
  showEmojiPicker.value = false;
};

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
  const input = event.target;
  if (input instanceof HTMLInputElement && input.files) {
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
  if (input instanceof HTMLInputElement) {
    input.value = '';
  }
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
