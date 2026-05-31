<template>
  <BaseModal
    :open="open"
    title="分配知识"
    :subtitle="`Agent: ${agentName || '-'}`"
    size="xl"
    @close="handleClose"
  >
    <div
      v-if="!agentId"
      class="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
    >
      <i class="fa-solid fa-triangle-exclamation"></i>
      当前 Agent 缺少可用标识，暂无法分配知识
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        本地知识默认分配给所有 Agent，固定勾选且不可取消；这里仅维护额外绑定的数据库知识。
      </div>

      <div class="relative">
        <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          placeholder="搜索知识名称、描述或标签"
        />
      </div>

      <div v-if="loading" class="py-10 text-center text-sm text-gray-400">
        加载中...
      </div>
      <div v-else-if="error" class="py-10 text-center text-sm text-red-500">
        {{ error }}
      </div>
      <div
        v-else-if="filteredBooks.length === 0"
        class="py-10 text-center text-sm text-gray-400"
      >
        暂无可显示的知识书本
      </div>
        <div v-else class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <div>
              共 {{ filteredBooks.length }} 本知识
              <span v-if="filteredBooks.length > 0">
                ，当前显示 {{ visibleRangeStart }}-{{ visibleRangeEnd }}
              </span>
            </div>
            <div class="inline-flex items-center gap-2 text-[11px] text-gray-600">
              <span class="rounded-full bg-white px-2.5 py-1">每页 {{ pageSize }} 项</span>
              <span class="rounded-full bg-white px-2.5 py-1">{{ currentPage }} / {{ totalPages }}</span>
            </div>
          </div>

          <div class="max-h-[58vh] overflow-y-auto pr-1">
            <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label
                v-for="book in paginatedBooks"
                :key="book.id"
                class="flex min-h-[124px] cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors"
                :class="isSelected(book.id) ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'"
              >
                <input
                  type="checkbox"
                  class="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  :checked="isSelected(book.id)"
                  :disabled="isLocalBook(book.id) || saving"
                  @change="toggleBook(book.id)"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <div class="truncate text-[13px] font-semibold leading-5 text-gray-900">
                      {{ book.name }}
                    </div>
                    <span class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      {{ book.type === 'skill' ? '技能' : '学识' }}
                    </span>
                    <span
                      v-if="isLocalBook(book.id)"
                      class="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700"
                    >
                      本地默认
                    </span>
                  </div>
                  <p v-if="book.description" class="mt-1 text-[11px] leading-4 text-gray-500">
                    {{ book.description }}
                  </p>
                  <div v-if="book.tags?.length" class="mt-2 flex flex-wrap gap-1">
                    <span
                      v-for="tag in book.tags.slice(0, 4)"
                      :key="`${book.id}-${tag}`"
                      class="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
                    >
                      {{ tag }}
                    </span>
                    <span
                      v-if="book.tags.length > 4"
                      class="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
                    >
                      +{{ book.tags.length - 4 }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === 1"
              @click="handlePageChange(currentPage - 1)"
            >
              <i class="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span class="px-3 text-sm font-medium text-gray-600">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === totalPages"
              @click="handlePageChange(currentPage + 1)"
            >
              <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        @click="handleClose"
      >
        取消
      </button>
      <button
        type="button"
        class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="saving || !agentId"
        @click="handleSave"
      >
        <i v-if="saving" class="fa-solid fa-spinner fa-spin mr-1"></i>
        保存知识分配
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
/**
 * @title AgentKnowledgeAssignModal
 * @description Agent 知识分配弹窗，展示本地默认知识与可选数据库知识，并保存自定义绑定。
 * @keywords-cn Agent知识分配, 知识绑定, 分配弹窗
 * @keywords-en agent-knowledge-assign, knowledge-binding, assignment-modal
 */
import { computed, ref, watch } from 'vue';
import BaseModal from '../../../components/BaseModal.vue';
import { agentApi } from '../../../api/agent';
import { knowledgeApi } from '../../../api/knowledge';
import type { KnowledgeBookInfo } from '../../knowledge/types/knowledge.types';
import type { AgentKnowledgeAssignmentState } from '../types/agent.types';

const props = defineProps<{
  open: boolean;
  agentId: string | null | undefined;
  agentName?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const books = ref<KnowledgeBookInfo[]>([]);
const localBookIds = ref<string[]>([]);
const customBookIds = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = 18;

/**
 * @title 选中书本 ID 列表
 * @description 合并本地默认知识与自定义知识，得到当前 Agent 的生效知识集合。
 * @keyword-en selected-book-ids
 */
const selectedBookIds = computed(() => [
  ...localBookIds.value,
  ...customBookIds.value,
]);

/**
 * @title 过滤后的知识书本列表
 * @description 按名称、描述和标签过滤当前可见的知识书本。
 * @keyword-en filtered-knowledge-books
 */
const filteredBooks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return books.value;
  return books.value.filter((book) => {
    const haystack = [
      book.name,
      book.description ?? '',
      ...(book.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

/**
 * @title 当前页知识书本
 * @description 按搜索结果与分页状态裁切当前页应展示的知识书本。
 * @keyword-en paginated-knowledge-books
 */
const paginatedBooks = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredBooks.value.slice(start, start + pageSize);
});

/**
 * @title 知识总页数
 * @description 根据过滤结果和单页容量计算总页数，最少为 1。
 * @keyword-en knowledge-total-pages
 */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredBooks.value.length / pageSize)),
);

/**
 * @title 当前页起始序号
 * @description 返回当前页展示区间的起始序号，用于顶部摘要文案。
 * @keyword-en visible-range-start
 */
const visibleRangeStart = computed(() =>
  filteredBooks.value.length === 0 ? 0 : (currentPage.value - 1) * pageSize + 1,
);

/**
 * @title 当前页结束序号
 * @description 返回当前页展示区间的结束序号，用于顶部摘要文案。
 * @keyword-en visible-range-end
 */
const visibleRangeEnd = computed(() =>
  Math.min(currentPage.value * pageSize, filteredBooks.value.length),
);

/**
 * @title 应用知识分配状态
 * @description 把后端返回的知识分配结果写入本地状态。
 * @keyword-en apply-assignment-state
 */
function applyAssignmentState(state: AgentKnowledgeAssignmentState): void {
  localBookIds.value = [...state.localBookIds];
  customBookIds.value = [...state.customBookIds];
}

/**
 * @title 判断是否本地知识
 * @description 本地预置知识默认分配且不可取消。
 * @keyword-en is-local-knowledge-book
 */
function isLocalBook(bookId: string): boolean {
  return localBookIds.value.includes(bookId) || bookId.startsWith('local_');
}

/**
 * @title 判断知识是否被选中
 * @description 判断书本是否属于当前 Agent 的生效知识集合。
 * @keyword-en is-selected-book
 */
function isSelected(bookId: string): boolean {
  return selectedBookIds.value.includes(bookId);
}

/**
 * @title 切换知识选择
 * @description 切换自定义数据库知识的选中状态，本地知识保持固定选中。
 * @keyword-en toggle-knowledge-book
 */
function toggleBook(bookId: string): void {
  if (isLocalBook(bookId)) return;
  const next = new Set(customBookIds.value);
  if (next.has(bookId)) next.delete(bookId);
  else next.add(bookId);
  customBookIds.value = Array.from(next);
}

/**
 * @title 切换知识分页
 * @description 在合法范围内切换当前页码。
 * @keyword-en change-knowledge-page
 */
function handlePageChange(page: number): void {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
}

/**
 * @title 加载弹窗数据
 * @description 并行获取知识书本列表与当前 Agent 的知识分配状态。
 * @keyword-en bootstrap-knowledge-assign-modal
 */
async function bootstrap(): Promise<void> {
  if (!props.agentId) {
    books.value = [];
    localBookIds.value = [];
    customBookIds.value = [];
    currentPage.value = 1;
    return;
  }
  loading.value = true;
  error.value = null;
  currentPage.value = 1;
  try {
    const [booksRes, stateRes] = await Promise.all([
      knowledgeApi.listBooks(),
      agentApi.getKnowledgeAssignments(props.agentId),
    ]);
    books.value = booksRes.data;
    applyAssignmentState(stateRes.data);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '知识分配加载失败';
    books.value = [];
    localBookIds.value = [];
    customBookIds.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * @title 保存知识分配
 * @description 提交当前生效的知识书本 ID 列表，并用返回值刷新本地状态。
 * @keyword-en save-knowledge-assignments
 */
async function handleSave(): Promise<void> {
  if (!props.agentId) return;
  saving.value = true;
  error.value = null;
  try {
    const res = await agentApi.updateKnowledgeAssignments(props.agentId, {
      bookIds: selectedBookIds.value,
    });
    applyAssignmentState(res.data);
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '知识分配保存失败';
  } finally {
    saving.value = false;
  }
}

/**
 * @title 关闭弹窗
 * @description 关闭弹窗并重置搜索输入。
 * @keyword-en close-knowledge-assign-modal
 */
function handleClose(): void {
  searchQuery.value = '';
  currentPage.value = 1;
  emit('close');
}

watch(searchQuery, () => {
  currentPage.value = 1;
});

watch(
  () => filteredBooks.value.length,
  (count) => {
    const maxPage = Math.max(1, Math.ceil(count / pageSize));
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage;
    }
  },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      void bootstrap();
    }
  },
);

watch(
  () => props.agentId,
  () => {
    if (props.open) {
      void bootstrap();
    }
  },
);
</script>