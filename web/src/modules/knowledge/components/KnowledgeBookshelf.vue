<template>
  <!-- 知识书架主页 bookshelf-view keyword: knowledge, bookshelf, list -->
  <div class="h-full flex flex-col bg-gray-50 w-full relative">
    <!-- 编辑器视图 -->
    <KnowledgeEditor
      v-if="editingBook"
      :book="editingBook"
      @close="editingBook = null"
      @updated="handleBookUpdated"
    />

    <!-- 书架主视图 -->
    <template v-else>
      <div class="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
        <!-- 顶部区域：标题 + 按钮 header-area -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{{ t('knowledge.title') }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">{{ t('knowledge.subtitle') }}</p>
          </div>
          <button
            @click="showCreateModal = true"
            class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <i class="fa-solid fa-plus"></i>
            {{ t('knowledge.create') }}
          </button>
        </div>

        <!-- 筛选 tabs filter-tabs keyword: type-filter -->
        <div class="flex items-center gap-2 mb-6">
          <button
            v-for="tab in typeTabs"
            :key="tab.value"
            @click="selectedType = tab.value; handleRefresh()"
            class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            :class="selectedType === tab.value
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'"
          >
            <i :class="tab.icon" class="mr-1.5"></i>
            {{ tab.label }}
          </button>
        </div>

        <!-- 加载中 loading-state -->
        <div v-if="loading" class="flex items-center justify-center py-20">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-300"></i>
        </div>

        <!-- 空状态 empty-state -->
        <div v-else-if="books.length === 0" class="text-center py-20">
          <i class="fa-solid fa-book-open text-5xl text-gray-200 mb-4"></i>
          <p class="text-gray-400">{{ t('knowledge.empty') }}</p>
        </div>

        <!-- 书架展示 bookshelf-grid keyword: book-grid, bookshelf -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          <div
            v-for="book in books"
            :key="book.id"
            class="group relative flex flex-col cursor-pointer"
            @click="openEditor(book)"
          >
            <!-- 书脊（书本外观） book-spine keyword: book-spine, visual -->
            <div
              class="relative flex-1 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 overflow-hidden"
              :style="{ backgroundColor: getBookColor(book.type) }"
              style="min-height: 160px;"
            >
              <!-- 书本竖纹装饰 -->
              <div class="absolute inset-y-0 left-0 w-3 opacity-20 rounded-l-lg"
                style="background: linear-gradient(to right, rgba(0,0,0,0.3), transparent)"></div>

              <!-- 类型标签 -->
              <div class="absolute top-2 right-2">
                <span class="px-1.5 py-0.5 rounded text-xs font-medium text-white/80 bg-black/20">
                  {{ book.type === 'skill' ? t('knowledge.typeSkill') : t('knowledge.typeLore') }}
                </span>
              </div>

              <!-- 向量状态 embedded-badge -->
              <div v-if="book.isEmbedded" class="absolute top-2 left-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block" :title="t('knowledge.embedded')"></span>
              </div>

              <!-- 书名 book-title -->
              <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 to-transparent">
                <p class="text-white text-sm font-semibold line-clamp-2 leading-tight">{{ book.name }}</p>
                <p v-if="book.chapterCount !== undefined" class="text-white/60 text-xs mt-0.5">
                  {{ book.chapterCount }} {{ t('knowledge.chapters') }}
                </p>
                <!-- tags显示 book-tags-display -->
                <div v-if="book.tags && book.tags.length" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="tag in book.tags"
                    :key="tag"
                    class="px-1.5 py-0.5 text-[10px] rounded bg-white/20 text-white/80 leading-none"
                  >{{ tag }}</span>
                </div>
              </div>
            </div>

            <!-- 操作按钮 action-buttons keyword: action-overlay -->
            <div class="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div class="flex gap-1.5" @click.stop>
                <button
                  @click="openEditor(book)"
                  class="p-2 bg-white rounded-lg shadow text-gray-700 hover:text-blue-600 transition-colors text-xs"
                  :title="t('knowledge.edit')"
                >
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button
                  @click="handleBuildEmbedding(book)"
                  class="p-2 bg-white rounded-lg shadow text-gray-700 hover:text-emerald-600 transition-colors text-xs"
                  :title="t('knowledge.buildVector')"
                  :disabled="embeddingId === book.id"
                >
                  <i :class="embeddingId === book.id ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-brain'"></i>
                </button>
                <button
                  @click="handleDelete(book)"
                  class="p-2 bg-white rounded-lg shadow text-gray-700 hover:text-red-600 transition-colors text-xs"
                  :title="t('knowledge.delete')"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新建书本弹窗 create-modal keyword: create-book-modal -->
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">{{ t('knowledge.createTitle') }}</h3>

          <!-- 书本类型选择 type-select -->
          <div class="mb-4">
            <label class="text-sm font-medium text-gray-700 mb-1.5 block">{{ t('knowledge.type') }}</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                @click="createForm.type = opt.value"
                class="p-3 rounded-xl border-2 text-left transition-all"
                :class="createForm.type === opt.value
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'"
              >
                <i :class="opt.icon" class="text-lg mb-1" :style="{ color: opt.color }"></i>
                <p class="text-sm font-medium text-gray-900">{{ opt.label }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ opt.desc }}</p>
              </button>
            </div>
          </div>

          <!-- 书本名称 name-input -->
          <div class="mb-4">
            <label class="text-sm font-medium text-gray-700 mb-1.5 block">{{ t('knowledge.name') }}</label>
            <input
              v-model="createForm.name"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              :placeholder="t('knowledge.namePlaceholder')"
            />
          </div>

          <!-- 书本描述 description-input -->
          <div class="mb-4">
            <label class="text-sm font-medium text-gray-700 mb-1.5 block">
              {{ t('knowledge.description') }}
              <span class="text-gray-400 font-normal ml-1">{{ t('knowledge.descHint') }}</span>
            </label>
            <textarea
              v-model="createForm.description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
              :placeholder="t('knowledge.descPlaceholder')"
            />
          </div>

          <!-- tags输入 tags-input keyword: tags -->
          <div class="mb-6">
            <label class="text-sm font-medium text-gray-700 mb-1.5 block">Tags</label>
            <div class="flex flex-wrap gap-1.5 mb-1.5">
              <span
                v-for="(tag, idx) in createForm.tags"
                :key="idx"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                {{ tag }}
                <button type="button" @click="createForm.tags!.splice(idx, 1)" class="text-gray-400 hover:text-red-500">&times;</button>
              </span>
            </div>
            <input
              v-model="createTagInput"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="输入 tag 后按 Enter 添加"
              @keydown.enter.prevent="addCreateTag"
              @keydown.,.prevent="addCreateTag"
            />
          </div>

          <!-- 操作按钮 modal-actions -->
          <div class="flex gap-3 justify-end">
            <button
              @click="showCreateModal = false"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              @click="handleCreate"
              :disabled="!createForm.name || createLoading"
              class="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
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

const { t } = useI18n();
const { loading, books, createBook, deleteBook, buildEmbedding, listBooks } = useKnowledge();

// 当前编辑的书本（进入编辑器视图）
const editingBook = ref<KnowledgeBookInfo | null>(null);
const showCreateModal = ref(false);
const createLoading = ref(false);
const embeddingId = ref<string | null>(null);
const selectedType = ref<string>('');

const createForm = ref<CreateBookRequest>({ type: 'skill', name: '', description: '', tags: [] });
const createTagInput = ref('');

const typeTabs = [
  { value: '', label: t('knowledge.all'), icon: 'fa-solid fa-layer-group' },
  { value: 'skill', label: t('knowledge.typeSkill'), icon: 'fa-solid fa-wand-magic-sparkles' },
  { value: 'lore', label: t('knowledge.typeLore'), icon: 'fa-solid fa-book' },
];

const typeOptions: { value: KnowledgeBookType; label: string; desc: string; icon: string; color: string }[] = [
  {
    value: 'skill' as KnowledgeBookType,
    label: t('knowledge.typeSkill'),
    desc: t('knowledge.typeSkillDesc'),
    icon: 'fa-solid fa-wand-magic-sparkles',
    color: '#6366f1',
  },
  {
    value: 'lore' as KnowledgeBookType,
    label: t('knowledge.typeLore'),
    desc: t('knowledge.typeLoreDesc'),
    icon: 'fa-solid fa-book',
    color: '#f59e0b',
  },
];

/** 新建弹窗中添加 tag */
function addCreateTag() {
  const tag = createTagInput.value.trim().replace(/,+$/, '');
  if (tag && !createForm.value.tags?.includes(tag)) {
    if (!createForm.value.tags) createForm.value.tags = [];
    createForm.value.tags.push(tag);
  }
  createTagInput.value = '';
}

/** 获取书本颜色（按类型区分色调） */
function getBookColor(type: string): string {
  if (type === 'skill') {
    const palette = ['#6366f1', '#8b5cf6', '#a78bfa', '#818cf8', '#7c3aed'];
    return palette[Math.floor(Math.random() * palette.length)];
  }
  const palette = ['#f59e0b', '#d97706', '#b45309', '#ea580c', '#dc2626'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function handleRefresh() {
  listBooks(selectedType.value || undefined);
}

function openEditor(book: KnowledgeBookInfo) {
  editingBook.value = book;
}

function handleBookUpdated(updated: KnowledgeBookInfo) {
  const idx = books.value.findIndex((b) => b.id === updated.id);
  if (idx >= 0) books.value[idx] = updated;
}

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

async function handleBuildEmbedding(book: KnowledgeBookInfo) {
  embeddingId.value = book.id;
  try {
    await buildEmbedding(book.id);
  } finally {
    embeddingId.value = null;
  }
}

async function handleDelete(book: KnowledgeBookInfo) {
  if (!confirm(t('knowledge.deleteConfirm', { name: book.name }))) return;
  await deleteBook(book.id);
  await listBooks(selectedType.value || undefined);
}

onMounted(() => {
  listBooks();
});
</script>
