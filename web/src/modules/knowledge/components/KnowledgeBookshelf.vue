<template>
  <!-- 知识书架主页 bookshelf-view keyword: knowledge, bookshelf, list -->
  <div class="h-full flex flex-col bg-[#f5f5f7] w-full relative text-zinc-950">
    <!-- 编辑器视图 -->
    <KnowledgeEditor
      v-if="editingBook"
      :book="editingBook"
      @close="editingBook = null"
      @updated="handleBookUpdated"
    />

    <!-- 书架主视图 -->
    <template v-else>
      <div class="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">
        <!-- 顶部区域：标题 + 按钮 header-area -->
        <div class="mb-7 flex items-start justify-between gap-4">
          <div>
            <p class="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Knowledge</p>
            <h2 class="text-[28px] font-semibold leading-tight text-zinc-950">{{ t('knowledge.title') }}</h2>
            <p class="mt-1 text-sm text-zinc-500">{{ t('knowledge.subtitle') }}</p>
          </div>
          <button
            @click="showCreateModal = true"
            class="flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(24,24,27,0.18)] transition-all hover:-translate-y-0.5 hover:bg-zinc-800"
          >
            <i class="fa-solid fa-plus"></i>
            {{ t('knowledge.create') }}
          </button>
        </div>

        <!-- 筛选 tabs filter-tabs keyword: type-filter -->
        <div class="mb-7 inline-flex items-center rounded-full border border-zinc-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          <button
            v-for="tab in typeTabs"
            :key="tab.value"
            @click="selectedType = tab.value; handleRefresh()"
            class="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            :class="selectedType === tab.value
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950'"
          >
            <i :class="tab.icon" class="mr-1.5"></i>
            {{ tab.label }}
          </button>
        </div>

        <!-- 加载中 loading-state -->
        <div v-if="loading" class="flex items-center justify-center py-20">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-zinc-300"></i>
        </div>

        <!-- 空状态 empty-state -->
        <div v-else-if="books.length === 0" class="rounded-3xl border border-dashed border-zinc-300 bg-white/70 py-20 text-center">
          <i class="fa-solid fa-book-open text-5xl text-zinc-200 mb-4"></i>
          <p class="text-zinc-400">{{ t('knowledge.empty') }}</p>
        </div>

        <!-- 书架展示 bookshelf-grid keyword: book-grid, bookshelf -->
        <div v-else class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <div
            v-for="book in books"
            :key="book.id"
            class="group relative flex cursor-pointer flex-col"
            @click="openEditor(book)"
          >
            <!-- 书脊（书本外观） book-spine keyword: book-spine, visual -->
            <div
              class="relative h-[176px] overflow-hidden rounded-2xl border bg-white shadow-[0_14px_34px_rgba(24,24,27,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(24,24,27,0.13)]"
              :class="getBookTone(book).cover"
            >
              <div class="absolute inset-y-0 left-0 w-8" :class="getBookTone(book).spine">
                <div class="flex h-full items-center justify-center">
                  <span class="-rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em]" :class="getBookTone(book).spineText">
                    {{ book.type === 'skill' ? 'Skill' : 'Lore' }}
                  </span>
                </div>
              </div>

              <div class="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent"></div>

              <!-- 类型标签 -->
              <div class="absolute left-12 top-4">
                <span class="rounded-full border px-2 py-0.5 text-[10px] font-medium" :class="getBookTone(book).badge">
                  {{ book.type === 'skill' ? t('knowledge.typeSkill') : t('knowledge.typeLore') }}
                </span>
              </div>

              <!-- 向量状态 embedded-badge -->
              <div v-if="book.isEmbedded" class="absolute right-4 top-4">
                <span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]" :title="t('knowledge.embedded')"></span>
              </div>

              <!-- 书名 book-title -->
              <div class="absolute bottom-0 left-8 right-0 flex h-[116px] flex-col justify-end p-4">
                <p class="line-clamp-2 min-h-[38px] text-[15px] font-semibold leading-tight" :class="getBookTone(book).titleText">{{ book.name }}</p>
                <p v-if="book.chapterCount !== undefined" class="mt-1 text-xs" :class="getBookTone(book).mutedText">
                  {{ book.chapterCount }} {{ t('knowledge.chapters') }}
                </p>
                <!-- tags显示 book-tags-display -->
                <div
                  v-if="book.tags && book.tags.length"
                  class="mt-2 grid h-[38px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] content-start gap-1 overflow-hidden"
                  @mouseenter="markBookTagAreaHover(book)"
                  @mouseleave="unmarkBookTagAreaHover(book)"
                >
                  <button
                    v-for="tag in visibleBookTags(book)"
                    :key="tag"
                    type="button"
                    class="min-w-0 truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none"
                    :class="getBookTone(book).tag"
                    :title="tag"
                    @click.stop="openBookInfo(book)"
                  >{{ tag }}</button>
                  <button
                    v-if="hiddenBookTagCount(book) > 0"
                    type="button"
                    class="whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] leading-none"
                    :class="getBookTone(book).tag"
                    :title="`还有 ${hiddenBookTagCount(book)} 个标签`"
                    @click.stop="openBookInfo(book)"
                  >+{{ hiddenBookTagCount(book) }}个</button>
                </div>
                <div v-else class="mt-2 h-[38px]"></div>
              </div>
            </div>

            <!-- 操作按钮 action-buttons keyword: action-overlay -->
            <div
              class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl transition-colors"
              :class="isBookTagAreaHovered(book)
                ? 'bg-zinc-950/0 opacity-0'
                : 'bg-zinc-950/0 opacity-0 group-hover:bg-zinc-950/10 group-hover:opacity-100'"
            >
              <div class="pointer-events-auto flex gap-1.5" @click.stop>
                <button
                  @click="openEditor(book)"
                  class="rounded-full bg-white/95 p-2 text-xs text-zinc-700 shadow-lg transition-colors hover:text-zinc-950"
                  :title="isLocalBook(book) ? '查看' : t('knowledge.edit')"
                >
                  <i :class="isLocalBook(book) ? 'fa-solid fa-eye' : 'fa-solid fa-pen-to-square'"></i>
                </button>
                <button
                  v-if="!isLocalBook(book)"
                  @click="handleBuildEmbedding(book)"
                  class="rounded-full bg-white/95 p-2 text-xs text-zinc-700 shadow-lg transition-colors hover:text-emerald-600"
                  :title="t('knowledge.buildVector')"
                  :disabled="embeddingId === book.id"
                >
                  <i :class="embeddingId === book.id ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-brain'"></i>
                </button>
                <button
                  v-if="!isLocalBook(book)"
                  @click="handleDelete(book)"
                  class="rounded-full bg-white/95 p-2 text-xs text-zinc-700 shadow-lg transition-colors hover:text-red-600"
                  :title="t('knowledge.delete')"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 书本信息弹窗 book-info-modal keyword: knowledge-info, tags -->
      <div
        v-if="infoBook"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm"
        @click.self="closeBookInfo"
      >
        <div class="w-full max-w-lg rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_28px_80px_rgba(24,24,27,0.22)]">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <span class="mb-2 inline-flex rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-white">
                {{ infoBook.type === 'skill' ? t('knowledge.typeSkill') : t('knowledge.typeLore') }}
              </span>
              <h3 class="line-clamp-2 text-xl font-semibold leading-tight text-zinc-950">{{ infoBook.name }}</h3>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
              @click="closeBookInfo"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <p class="mb-5 min-h-[44px] rounded-2xl bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
            {{ infoBook.description || '暂无描述' }}
          </p>

          <div class="mb-5 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-2xl border border-zinc-200 bg-white p-3">
              <p class="text-xs text-zinc-400">章节</p>
              <p class="mt-1 font-medium text-zinc-950">{{ infoBook.chapterCount ?? 0 }} {{ t('knowledge.chapters') }}</p>
            </div>
            <div class="rounded-2xl border border-zinc-200 bg-white p-3">
              <p class="text-xs text-zinc-400">向量状态</p>
              <p class="mt-1 font-medium" :class="infoBook.isEmbedded ? 'text-emerald-600' : 'text-zinc-500'">
                {{ infoBook.isEmbedded ? t('knowledge.embedded') : t('knowledge.notEmbedded') }}
              </p>
            </div>
            <div class="rounded-2xl border border-zinc-200 bg-white p-3">
              <p class="text-xs text-zinc-400">创建时间</p>
              <p class="mt-1 truncate font-medium text-zinc-950">{{ formatBookDate(infoBook.createdAt) }}</p>
            </div>
            <div class="rounded-2xl border border-zinc-200 bg-white p-3">
              <p class="text-xs text-zinc-400">更新时间</p>
              <p class="mt-1 truncate font-medium text-zinc-950">{{ formatBookDate(infoBook.updatedAt) }}</p>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Tags</p>
            <div v-if="allBookTags(infoBook).length" class="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <span
                v-for="tag in allBookTags(infoBook)"
                :key="tag"
                class="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
              >{{ tag }}</span>
            </div>
            <div v-else class="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-400">
              暂无标签
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-950"
              @click="closeBookInfo"
            >
              关闭
            </button>
            <button
              type="button"
              class="rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800"
              @click="openInfoBookEditor"
            >
              {{ isLocalBook(infoBook) ? '查看' : t('knowledge.edit') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 新建书本弹窗 create-modal keyword: create-book-modal -->
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm"
        @click.self="showCreateModal = false"
      >
        <div class="w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_28px_80px_rgba(24,24,27,0.22)]">
          <h3 class="text-lg font-semibold text-zinc-950 mb-4">{{ t('knowledge.createTitle') }}</h3>

          <!-- 书本类型选择 type-select -->
          <div class="mb-4">
            <label class="text-sm font-medium text-zinc-700 mb-1.5 block">{{ t('knowledge.type') }}</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                @click="createForm.type = opt.value"
                class="rounded-2xl border p-3 text-left transition-all"
                :class="createForm.type === opt.value
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'"
              >
                <i :class="[opt.icon, createForm.type === opt.value ? 'text-white' : 'text-zinc-950']" class="mb-1 text-lg"></i>
                <p class="text-sm font-medium">{{ opt.label }}</p>
                <p class="text-xs mt-0.5" :class="createForm.type === opt.value ? 'text-white/60' : 'text-zinc-500'">{{ opt.desc }}</p>
              </button>
            </div>
          </div>

          <!-- 书本名称 name-input -->
          <div class="mb-4">
            <label class="text-sm font-medium text-zinc-700 mb-1.5 block">{{ t('knowledge.name') }}</label>
            <input
              v-model="createForm.name"
              class="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
              :placeholder="t('knowledge.namePlaceholder')"
            />
          </div>

          <!-- 书本描述 description-input -->
          <div class="mb-4">
            <label class="text-sm font-medium text-zinc-700 mb-1.5 block">
              {{ t('knowledge.description') }}
              <span class="text-zinc-400 font-normal ml-1">{{ t('knowledge.descHint') }}</span>
            </label>
            <textarea
              v-model="createForm.description"
              rows="3"
              class="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
              :placeholder="t('knowledge.descPlaceholder')"
            />
          </div>

          <!-- tags输入 tags-input keyword: tags -->
          <div class="mb-6">
            <label class="text-sm font-medium text-zinc-700 mb-1.5 block">Tags</label>
            <div class="flex flex-wrap gap-1.5 mb-1.5">
              <span
                v-for="(tag, idx) in createForm.tags"
                :key="idx"
                class="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
              >
                {{ tag }}
                <button type="button" @click="createForm.tags!.splice(idx, 1)" class="text-zinc-400 hover:text-red-500">&times;</button>
              </span>
            </div>
            <input
              v-model="createTagInput"
              class="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
              placeholder="输入 tag 后按 Enter 添加"
              @keydown.enter.prevent="addCreateTag"
              @keydown.,.prevent="addCreateTag"
            />
          </div>

          <!-- 操作按钮 modal-actions -->
          <div class="flex gap-3 justify-end">
            <button
              @click="showCreateModal = false"
              class="px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-950"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              @click="handleCreate"
              :disabled="!createForm.name || createLoading"
              class="flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              <i v-if="createLoading" class="fa-solid fa-spinner fa-spin"></i>
              {{ t('common.create') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @title KnowledgeBookshelf
 * @description 知识书架主组件：展示所有知识书本（书架视觉），支持增删改查和向量构建。
 * @keywords-cn 知识书架, 书本列表, 增删改查, 向量
 * @keywords-en knowledge-bookshelf, book-list, crud, vector
 */
import { ref, onMounted } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import { useKnowledge } from '../hooks/useKnowledge';
import KnowledgeEditor from './KnowledgeEditor.vue';
import type { KnowledgeBookInfo, CreateBookRequest, KnowledgeBookType } from '../types/knowledge.types';

interface BookTone {
  cover: string;
  spine: string;
  spineText: string;
  badge: string;
  tag: string;
  titleText: string;
  mutedText: string;
}

const { t } = useI18n();
const { loading, books, createBook, deleteBook, buildEmbedding, listBooks } = useKnowledge();

// 当前编辑的书本（进入编辑器视图）
const editingBook = ref<KnowledgeBookInfo | null>(null);
const showCreateModal = ref(false);
const createLoading = ref(false);
const embeddingId = ref<string | null>(null);
const selectedType = ref<string>('');
const infoBook = ref<KnowledgeBookInfo | null>(null);
const tagHoverBookId = ref<string | null>(null);

const createForm = ref<CreateBookRequest>({ type: 'skill', name: '', description: '', tags: [] });
const createTagInput = ref('');

const typeTabs = [
  { value: '', label: t('knowledge.all'), icon: 'fa-solid fa-layer-group' },
  { value: 'skill', label: t('knowledge.typeSkill'), icon: 'fa-solid fa-wand-magic-sparkles' },
  { value: 'lore', label: t('knowledge.typeLore'), icon: 'fa-solid fa-book' },
];

const typeOptions: { value: KnowledgeBookType; label: string; desc: string; icon: string }[] = [
  {
    value: 'skill' as KnowledgeBookType,
    label: t('knowledge.typeSkill'),
    desc: t('knowledge.typeSkillDesc'),
    icon: 'fa-solid fa-wand-magic-sparkles',
  },
  {
    value: 'lore' as KnowledgeBookType,
    label: t('knowledge.typeLore'),
    desc: t('knowledge.typeLoreDesc'),
    icon: 'fa-solid fa-book',
  },
];

const BOOK_TAG_VISIBLE_LIMIT = 3;

/**
 * @description 新建弹窗中添加 tag。
 * @keyword-en knowledge-add-create-tag
 */
function addCreateTag() {
  const tag = createTagInput.value.trim().replace(/,+$/, '');
  if (tag && !createForm.value.tags?.includes(tag)) {
    if (!createForm.value.tags) createForm.value.tags = [];
    createForm.value.tags.push(tag);
  }
  createTagInput.value = '';
}

/**
 * @description 获取书本黑白视觉风格，保持 mac 风格的稳定、克制外观。
 * @keyword-en knowledge-book-tone
 */
function getBookTone(book: KnowledgeBookInfo): BookTone {
  if (book.type === 'skill') {
    return {
      cover: 'border-zinc-950 bg-zinc-950',
      spine: 'bg-white/10 border-r border-white/10',
      spineText: 'text-white/50',
      badge: 'border-white/20 bg-white/10 text-white/70',
      tag: 'border-white/20 bg-white/10 text-white/70',
      titleText: 'text-white',
      mutedText: 'text-white/50',
    };
  }
  return {
    cover: 'border-zinc-200 bg-white',
    spine: 'bg-zinc-950',
    spineText: 'text-white/60',
    badge: 'border-zinc-200 bg-zinc-50 text-zinc-500',
    tag: 'border-zinc-200 bg-zinc-50 text-zinc-500',
    titleText: 'text-zinc-950',
    mutedText: 'text-zinc-400',
  };
}

/**
 * @description 获取书卡可见标签，限制数量以保持书卡形态稳定。
 * @keyword-en knowledge-visible-book-tags
 */
function visibleBookTags(book: KnowledgeBookInfo): string[] {
  const tags = book.tags ?? [];
  if (tags.length <= BOOK_TAG_VISIBLE_LIMIT) return tags;
  return tags.slice(0, BOOK_TAG_VISIBLE_LIMIT - 1);
}

/**
 * @description 获取书卡被隐藏的标签数量，用于显示 +N 提示。
 * @keyword-en knowledge-hidden-book-tag-count
 */
function hiddenBookTagCount(book: KnowledgeBookInfo): number {
  return Math.max((book.tags?.length ?? 0) - visibleBookTags(book).length, 0);
}

/**
 * @description 标记当前鼠标悬浮在书卡 tag 区域，此时不显示操作遮罩。
 * @keyword-en knowledge-mark-book-tag-area-hover
 */
function markBookTagAreaHover(book: KnowledgeBookInfo) {
  tagHoverBookId.value = book.id;
}

/**
 * @description 取消书卡 tag 区域悬浮标记。
 * @keyword-en knowledge-unmark-book-tag-area-hover
 */
function unmarkBookTagAreaHover(book: KnowledgeBookInfo) {
  if (tagHoverBookId.value === book.id) {
    tagHoverBookId.value = null;
  }
}

/**
 * @description 判断鼠标是否悬浮在指定书卡 tag 区域。
 * @keyword-en knowledge-is-book-tag-area-hovered
 */
function isBookTagAreaHovered(book: KnowledgeBookInfo): boolean {
  return tagHoverBookId.value === book.id;
}

/**
 * @description 获取书本完整标签列表，用于信息弹窗展示。
 * @keyword-en knowledge-all-book-tags
 */
function allBookTags(book: KnowledgeBookInfo): string[] {
  return book.tags ?? [];
}

/**
 * @description 打开书本信息弹窗。
 * @keyword-en knowledge-open-book-info
 */
function openBookInfo(book: KnowledgeBookInfo) {
  infoBook.value = book;
}

/**
 * @description 关闭书本信息弹窗。
 * @keyword-en knowledge-close-book-info
 */
function closeBookInfo() {
  infoBook.value = null;
}

/**
 * @description 从信息弹窗进入书本编辑器或查看器。
 * @keyword-en knowledge-open-info-book-editor
 */
function openInfoBookEditor() {
  if (!infoBook.value) return;
  const book = infoBook.value;
  closeBookInfo();
  openEditor(book);
}

/**
 * @description 格式化书本时间字段。
 * @keyword-en knowledge-format-book-date
 */
function formatBookDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @description 按当前筛选类型刷新书本列表。
 * @keyword-en knowledge-refresh-books
 */
function handleRefresh() {
  listBooks(selectedType.value || undefined);
}

/**
 * @description 打开指定书本的知识编辑器。
 * @keyword-en knowledge-open-editor
 */
function openEditor(book: KnowledgeBookInfo) {
  editingBook.value = book;
}

/**
 * @description 判断是否为内置本地书本，本地书本只允许查看。
 * @keyword-en knowledge-is-local-book
 */
function isLocalBook(book: KnowledgeBookInfo): boolean {
  return book.id.startsWith('local_');
}

/**
 * @description 编辑器保存后同步书架列表中的书本信息。
 * @keyword-en knowledge-handle-book-updated
 */
function handleBookUpdated(updated: KnowledgeBookInfo) {
  const idx = books.value.findIndex((b) => b.id === updated.id);
  if (idx >= 0) books.value[idx] = updated;
}

/**
 * @description 创建新知识书本并刷新当前书架。
 * @keyword-en knowledge-handle-create-book
 */
async function handleCreate() {
  if (!createForm.value.name) return;
  createLoading.value = true;
  try {
    await createBook({ ...createForm.value });
    showCreateModal.value = false;
    createForm.value = { type: 'skill', name: '', description: '', tags: [] };
    createTagInput.value = '';
    await listBooks(selectedType.value || undefined);
  } finally {
    createLoading.value = false;
  }
}

/**
 * @description 为指定知识书本构建或刷新向量。
 * @keyword-en knowledge-handle-build-embedding
 */
async function handleBuildEmbedding(book: KnowledgeBookInfo) {
  if (isLocalBook(book)) return;
  embeddingId.value = book.id;
  try {
    await buildEmbedding(book.id);
  } finally {
    embeddingId.value = null;
  }
}

/**
 * @description 删除指定知识书本并刷新当前书架。
 * @keyword-en knowledge-handle-delete-book
 */
async function handleDelete(book: KnowledgeBookInfo) {
  if (isLocalBook(book)) return;
  if (!confirm(t('knowledge.deleteConfirm', { name: book.name }))) return;
  await deleteBook(book.id);
  await listBooks(selectedType.value || undefined);
}

onMounted(() => {
  listBooks();
});
</script>
