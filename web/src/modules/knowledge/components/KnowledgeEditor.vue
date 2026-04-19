<template>
  <!-- 知识编辑器主视图 keyword: knowledge-editor, editor-layout -->
  <div class="h-full flex flex-col bg-white w-full">
    <!-- 顶部导航栏 editor-topbar -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white z-10 flex-shrink-0">
      <button
        @click="$emit('close')"
        class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        title="返回书架"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <!-- 书本信息 book-header-info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="px-2 py-0.5 text-xs font-medium rounded-full text-white"
            :style="{ backgroundColor: book.type === 'skill' ? '#6366f1' : '#f59e0b' }"
          >
            {{ book.type === 'skill' ? t('knowledge.typeSkill') : t('knowledge.typeLore') }}
          </span>
          <!-- 书名编辑 book-title-edit -->
          <input
            v-if="editingTitle"
            v-model="titleDraft"
            class="text-lg font-bold text-gray-900 border-b border-gray-400 focus:outline-none bg-transparent"
            @blur="saveTitle"
            @keyup.enter="saveTitle"
            @keyup.escape="editingTitle = false"
            ref="titleInputRef"
          />
          <h2
            v-else
            class="text-lg font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors truncate"
            @click="startEditTitle"
          >
            {{ book.name }}
          </h2>
          <span
            v-if="!book.isEmbedded"
            class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"
          >
            <i class="fa-solid fa-circle-exclamation mr-1"></i>{{ t('knowledge.notEmbedded') }}
          </span>
        </div>
      </div>
      <!-- 工具栏 editor-toolbar -->
      <div class="flex items-center gap-2">
        <!-- 新增章节 -->
        <button
          @click="showAddChapter = true"
          class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <i class="fa-solid fa-plus"></i>
          {{ t('knowledge.addChapter') }}
        </button>
        <!-- 构建向量 -->
        <button
          @click="handleBuildEmbedding"
          :disabled="embeddingLoading"
          class="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5"
          :class="book.isEmbedded
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'"
        >
          <i :class="embeddingLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-brain'"></i>
          {{ book.isEmbedded ? t('knowledge.reEmbed') : t('knowledge.buildVector') }}
        </button>
      </div>
    </div>

    <!-- 主体区域：左侧目录 + 右侧编辑器 editor-body -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左侧目录 sidebar-toc keyword: chapter-toc, sidebar -->
      <div class="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
        <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 flex-shrink-0">
          {{ t('knowledge.toc') }}
        </div>
        <!-- 目录加载 toc-loading -->
        <div v-if="tocLoading" class="flex justify-center py-6">
          <i class="fa-solid fa-spinner fa-spin text-gray-400"></i>
        </div>
        <!-- 章节列表 chapter-list -->
        <div v-else class="flex-1 overflow-y-auto py-1">
          <div
            v-for="chap in chapters"
            :key="chap.id"
            class="group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors rounded mx-1"
            :class="selectedChapterId === chap.id
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-200'"
            @click="selectChapter(chap.id)"
          >
            <!-- LM必读标记 lm-required-badge -->
            <span
              v-if="chap.isLmRequired"
              class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              :class="selectedChapterId === chap.id ? 'bg-amber-300' : 'bg-amber-500'"
              :title="t('knowledge.lmRequired')"
            ></span>
            <span v-else class="w-1.5 flex-shrink-0"></span>
            <span class="text-sm flex-1 truncate">{{ chap.title }}</span>
            <!-- 章节操作 chapter-actions -->
            <div class="opacity-0 group-hover:opacity-100 flex gap-0.5" @click.stop>
              <button
                @click="startEditChapterTitle(chap)"
                class="p-0.5 hover:text-blue-400 transition-colors"
                :class="selectedChapterId === chap.id ? 'text-white/60' : 'text-gray-400'"
              >
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button
                @click="handleDeleteChapter(chap.id)"
                class="p-0.5 hover:text-red-400 transition-colors"
                :class="selectedChapterId === chap.id ? 'text-white/60' : 'text-gray-400'"
              >
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </div>

          <!-- 空状态 toc-empty -->
          <div v-if="chapters.length === 0" class="text-center py-8 px-3">
            <i class="fa-solid fa-list text-gray-300 text-2xl mb-2"></i>
            <p class="text-xs text-gray-400">{{ t('knowledge.noChapters') }}</p>
          </div>
        </div>

        <!-- 章节标题编辑 inline-edit-chapter keyword: chapter-title-edit -->
        <div
          v-if="editingChapterId"
          class="px-3 py-2 border-t border-gray-200 bg-white flex-shrink-0"
        >
          <input
            v-model="chapterTitleDraft"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
            @keyup.enter="saveChapterTitle"
            @keyup.escape="editingChapterId = null"
            ref="chapterTitleInputRef"
          />
          <div class="flex gap-2 mt-1">
            <button @click="saveChapterTitle" class="text-xs text-blue-600 hover:underline">{{ t('common.save') }}</button>
            <button @click="editingChapterId = null" class="text-xs text-gray-400 hover:underline">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>

      <!-- 右侧编辑区域 editor-main keyword: markdown-editor, preview -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 未选择章节 no-chapter-selected -->
        <div v-if="!selectedChapterId" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <i class="fa-solid fa-file-lines text-5xl text-gray-200 mb-4"></i>
            <p class="text-gray-400">{{ t('knowledge.selectChapter') }}</p>
            <button
              @click="showAddChapter = true"
              class="mt-3 text-sm text-blue-600 hover:underline"
            >
              {{ t('knowledge.addFirstChapter') }}
            </button>
          </div>
        </div>

        <!-- 章节编辑器 chapter-editor keyword: split-editor -->
        <div v-else class="flex-1 flex overflow-hidden">
          <!-- 编辑区 markdown-edit-area -->
          <div class="flex-1 flex flex-col overflow-hidden border-r border-gray-100">
            <!-- 编辑工具栏 edit-toolbar -->
            <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
              <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Markdown</span>
              <div class="flex-1"></div>
              <!-- LM必读开关 lm-toggle -->
              <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                <span class="w-8 h-4 rounded-full relative transition-colors"
                  :class="currentChapterData?.isLmRequired ? 'bg-amber-400' : 'bg-gray-200'"
                  @click="toggleLmRequired"
                >
                  <span class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow"
                    :class="currentChapterData?.isLmRequired ? 'translate-x-4' : ''"></span>
                </span>
                <i class="fa-solid fa-star text-amber-500"></i>
                {{ t('knowledge.lmRequired') }}
              </label>
              <!-- 自动保存状态 save-status -->
              <span class="text-xs text-gray-400 flex items-center gap-1">
                <i v-if="saving" class="fa-solid fa-spinner fa-spin text-blue-400"></i>
                <i v-else-if="saved" class="fa-solid fa-check text-green-500"></i>
                {{ saving ? t('knowledge.saving') : saved ? t('knowledge.saved') : '' }}
              </span>
            </div>
            <textarea
              v-model="editorContent"
              class="flex-1 resize-none font-mono text-sm text-gray-800 p-4 focus:outline-none leading-relaxed"
              :placeholder="t('knowledge.editorPlaceholder')"
              @input="handleContentChange"
            ></textarea>
          </div>

          <!-- 预览区 markdown-preview-area -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex items-center px-4 py-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
              <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('knowledge.preview') }}</span>
            </div>
            <div
              class="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none"
              v-html="renderedContent"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增章节弹窗 add-chapter-modal keyword: add-chapter -->
    <div
      v-if="showAddChapter"
      class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      @click.self="showAddChapter = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 class="text-base font-bold text-gray-900 mb-4">{{ t('knowledge.addChapter') }}</h3>

        <!-- 章节标题 add-chapter-title-input -->
        <div class="mb-3">
          <label class="text-sm font-medium text-gray-700 mb-1 block">{{ t('knowledge.chapterTitle') }}</label>
          <input
            v-model="newChapterTitle"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            :placeholder="t('knowledge.chapterTitlePlaceholder')"
          />
        </div>

        <!-- LM必读选项 lm-required-option -->
        <div class="mb-5 flex items-center gap-2">
          <input
            id="lmRequired"
            type="checkbox"
            v-model="newChapterLmRequired"
            class="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          <label for="lmRequired" class="text-sm text-gray-700 flex items-center gap-1">
            <i class="fa-solid fa-star text-amber-500"></i>
            {{ t('knowledge.markLmRequired') }}
            <span class="text-gray-400 text-xs">{{ t('knowledge.lmRequiredHint') }}</span>
          </label>
        </div>

        <!-- 弹窗操作按钮 modal-actions -->
        <div class="flex gap-3 justify-end">
          <button @click="showAddChapter = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleAddChapter"
            :disabled="!newChapterTitle || addChapterLoading"
            class="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            <i v-if="addChapterLoading" class="fa-solid fa-spinner fa-spin mr-1"></i>
            {{ t('common.create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title KnowledgeEditor
 * @description 知识编辑器：左侧目录树，右侧 Markdown 编辑与预览，支持 LM 必读章节标记。
 * @keywords-cn 知识编辑器, 章节, Markdown, 预览, LM必读
 * @keywords-en knowledge-editor, chapter, markdown, preview, lm-required
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import { useKnowledge } from '../hooks/useKnowledge';
import type { KnowledgeBookInfo, KnowledgeChapterToc, KnowledgeChapterInfo } from '../types/knowledge.types';

const props = defineProps<{
  book: KnowledgeBookInfo;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated', book: KnowledgeBookInfo): void;
}>();

const { t } = useI18n();
const {
  chapters,
  listChapters,
  getChapterContent,
  createChapter,
  updateChapter,
  deleteChapter,
  updateBook,
  buildEmbedding,
} = useKnowledge();

const tocLoading = ref(false);
const selectedChapterId = ref<string | null>(null);
const currentChapterData = ref<KnowledgeChapterInfo | null>(null);
const editorContent = ref('');
const saving = ref(false);
const saved = ref(false);
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const embeddingLoading = ref(false);
const editingTitle = ref(false);
const titleDraft = ref(props.book.name);
const titleInputRef = ref<HTMLInputElement | null>(null);

// 章节管理
const showAddChapter = ref(false);
const newChapterTitle = ref('');
const newChapterLmRequired = ref(false);
const addChapterLoading = ref(false);
const editingChapterId = ref<string | null>(null);
const chapterTitleDraft = ref('');
const chapterTitleInputRef = ref<HTMLInputElement | null>(null);

/** 简单 Markdown 渲染（粗体/斜体/代码/标题/列表） */
const renderedContent = computed(() => {
  if (!editorContent.value) return `<p class="text-gray-400 italic">预览区域</p>`;
  let html = editorContent.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 标题
    .replace(/^#{3} (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    // 粗体/斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-pink-600 text-sm">$1</code>')
    // 代码块
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.slice(3, -3).replace(/^\w*\n/, '');
      return `<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-3"><code>${code}</code></pre>`;
    })
    // 无序列表
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$1</li>')
    // 段落
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br>');
  return `<p class="mb-3">${html}</p>`;
});

/** 选择章节 */
async function selectChapter(chapterId: string) {
  selectedChapterId.value = chapterId;
  const result = await getChapterContent(props.book.id, chapterId);
  const target = result.find((c) => c.id === chapterId);
  currentChapterData.value = target ?? null;
  editorContent.value = target?.content ?? '';
  saved.value = false;
}

/** 内容变更自动保存（500ms 防抖） */
function handleContentChange() {
  saved.value = false;
  if (saveTimer.value) clearTimeout(saveTimer.value);
  saveTimer.value = setTimeout(() => {
    saveContent();
  }, 600);
}

/** 保存内容 */
async function saveContent() {
  if (!selectedChapterId.value || !currentChapterData.value) return;
  saving.value = true;
  try {
    await updateChapter(selectedChapterId.value, { content: editorContent.value });
    if (currentChapterData.value) currentChapterData.value.content = editorContent.value;
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } finally {
    saving.value = false;
  }
}

/** 切换 LM 必读 */
async function toggleLmRequired() {
  if (!selectedChapterId.value || !currentChapterData.value) return;
  const next = !currentChapterData.value.isLmRequired;
  await updateChapter(selectedChapterId.value, { isLmRequired: next });
  currentChapterData.value.isLmRequired = next;
  const chap = chapters.value.find((c) => c.id === selectedChapterId.value);
  if (chap) chap.isLmRequired = next;
}

/** 构建向量 */
async function handleBuildEmbedding() {
  embeddingLoading.value = true;
  try {
    const updated = await buildEmbedding(props.book.id);
    emit('updated', { ...props.book, isEmbedded: true });
  } finally {
    embeddingLoading.value = false;
  }
}

/** 书名编辑 */
function startEditTitle() {
  titleDraft.value = props.book.name;
  editingTitle.value = true;
  nextTick(() => titleInputRef.value?.focus());
}

async function saveTitle() {
  if (!titleDraft.value.trim() || titleDraft.value === props.book.name) {
    editingTitle.value = false;
    return;
  }
  await updateBook(props.book.id, { name: titleDraft.value.trim() });
  emit('updated', { ...props.book, name: titleDraft.value.trim() });
  editingTitle.value = false;
}

/** 新增章节 */
async function handleAddChapter() {
  if (!newChapterTitle.value) return;
  addChapterLoading.value = true;
  try {
    const created = await createChapter(props.book.id, {
      title: newChapterTitle.value,
      isLmRequired: newChapterLmRequired.value,
      sortOrder: chapters.value.length,
    });
    await listChapters(props.book.id);
    showAddChapter.value = false;
    newChapterTitle.value = '';
    newChapterLmRequired.value = false;
    await selectChapter(created.id);
  } finally {
    addChapterLoading.value = false;
  }
}

/** 删除章节 */
async function handleDeleteChapter(chapterId: string) {
  if (!confirm(t('knowledge.deleteChapterConfirm'))) return;
  await deleteChapter(chapterId);
  await listChapters(props.book.id);
  if (selectedChapterId.value === chapterId) {
    selectedChapterId.value = null;
    currentChapterData.value = null;
    editorContent.value = '';
  }
}

/** 章节标题编辑 */
function startEditChapterTitle(chap: KnowledgeChapterToc) {
  editingChapterId.value = chap.id;
  chapterTitleDraft.value = chap.title;
  nextTick(() => chapterTitleInputRef.value?.focus());
}

async function saveChapterTitle() {
  if (!editingChapterId.value || !chapterTitleDraft.value.trim()) {
    editingChapterId.value = null;
    return;
  }
  await updateChapter(editingChapterId.value, { title: chapterTitleDraft.value.trim() });
  const chap = chapters.value.find((c) => c.id === editingChapterId.value);
  if (chap) chap.title = chapterTitleDraft.value.trim();
  editingChapterId.value = null;
}

onMounted(async () => {
  tocLoading.value = true;
  await listChapters(props.book.id);
  tocLoading.value = false;
});
</script>
