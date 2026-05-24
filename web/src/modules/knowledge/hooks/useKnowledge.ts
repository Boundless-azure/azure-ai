/**
 * @title useKnowledge
 * @description 知识书本与章节的 CRUD、向量构建和语义搜索组合函数。
 * @keywords-cn 知识, 书本, 章节, 向量, 搜索
 * @keywords-en knowledge, book, chapter, vector, search
 */
import { ref } from 'vue';
import { knowledgeApi } from '../../../api/knowledge';
import type {
  KnowledgeBookInfo,
  KnowledgeChapterToc,
  KnowledgeChapterInfo,
  KnowledgeMatchResult,
  CreateBookRequest,
  UpdateBookRequest,
  CreateChapterRequest,
  UpdateChapterRequest,
} from '../types/knowledge.types';
import { KNOWLEDGE_EVENT_NAMES } from '../constants/knowledge.constants';

export function useKnowledge() {
  const loading = ref(false);
  const books = ref<KnowledgeBookInfo[]>([]);
  const currentBook = ref<KnowledgeBookInfo | null>(null);
  const chapters = ref<KnowledgeChapterToc[]>([]);
  const currentChapter = ref<KnowledgeChapterInfo | null>(null);
  const error = ref<string | null>(null);

  // ========== 书本 ==========

  /**
   * 获取书本列表
   * @keyword-en list-books
   */
  async function listBooks(type?: string) {
    loading.value = true;
    error.value = null;
    try {
      const res = await knowledgeApi.listBooks(type);
      books.value = res.data;
      window.dispatchEvent(new CustomEvent(KNOWLEDGE_EVENT_NAMES.booksChanged));
      return books.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list books failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取单本书详情
   * @keyword-en get-book
   */
  async function getBook(id: string) {
    const res = await knowledgeApi.getBook(id);
    currentBook.value = res.data;
    return currentBook.value;
  }

  /**
   * 创建书本
   * @keyword-en create-book
   */
  async function createBook(data: CreateBookRequest) {
    const res = await knowledgeApi.createBook(data);
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_EVENT_NAMES.booksChanged));
    return res.data;
  }

  /**
   * 更新书本
   * @keyword-en update-book
   */
  async function updateBook(id: string, data: UpdateBookRequest) {
    const res = await knowledgeApi.updateBook(id, data);
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_EVENT_NAMES.booksChanged));
    return res.data;
  }

  /**
   * 删除书本
   * @keyword-en delete-book
   */
  async function deleteBook(id: string) {
    await knowledgeApi.deleteBook(id);
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_EVENT_NAMES.booksChanged));
  }

  /**
   * 构建/更新书本向量
   * @keyword-en build-embedding
   */
  async function buildEmbedding(id: string) {
    const res = await knowledgeApi.buildEmbedding(id);
    const book = res.data;
    const idx = books.value.findIndex((b) => b.id === id);
    if (idx >= 0) books.value[idx] = { ...books.value[idx], ...book };
    return book;
  }

  // ========== 章节 ==========

  /**
   * 获取书本目录
   * @keyword-en list-chapters-toc
   */
  async function listChapters(bookId: string) {
    loading.value = true;
    try {
      const res = await knowledgeApi.getChaptersToc(bookId);
      chapters.value = res.data;
      return chapters.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取章节内容（包含 LM 必读章节）
   * @keyword-en get-chapter-content
   */
  async function getChapterContent(bookId: string, chapterId: string) {
    const res = await knowledgeApi.getChapterContent(bookId, chapterId);
    const list: KnowledgeChapterInfo[] = res.data;
    currentChapter.value =
      list.find((c) => c.id === chapterId) ?? list[0] ?? null;
    return list;
  }

  /**
   * 创建章节
   * @keyword-en create-chapter
   */
  async function createChapter(bookId: string, data: CreateChapterRequest) {
    const res = await knowledgeApi.createChapter(bookId, data);
    window.dispatchEvent(
      new CustomEvent(KNOWLEDGE_EVENT_NAMES.chaptersChanged),
    );
    return res.data;
  }

  /**
   * 更新章节
   * @keyword-en update-chapter
   */
  async function updateChapter(chapterId: string, data: UpdateChapterRequest) {
    const res = await knowledgeApi.updateChapter(chapterId, data);
    window.dispatchEvent(
      new CustomEvent(KNOWLEDGE_EVENT_NAMES.chaptersChanged),
    );
    return res.data;
  }

  /**
   * 删除章节
   * @keyword-en delete-chapter
   */
  async function deleteChapter(chapterId: string) {
    await knowledgeApi.deleteChapter(chapterId);
    window.dispatchEvent(
      new CustomEvent(KNOWLEDGE_EVENT_NAMES.chaptersChanged),
    );
  }

  // ========== 语义搜索 ==========

  const searchResults = ref<KnowledgeMatchResult[]>([]);

  /**
   * 语义向量匹配
   * @keyword-en semantic-search
   */
  async function search(query: string, type?: string, limit?: number) {
    loading.value = true;
    try {
      const res = await knowledgeApi.search(query, type, limit);
      searchResults.value = res.data;
      return searchResults.value;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    books,
    currentBook,
    chapters,
    currentChapter,
    searchResults,
    error,
    listBooks,
    getBook,
    createBook,
    updateBook,
    deleteBook,
    buildEmbedding,
    listChapters,
    getChapterContent,
    createChapter,
    updateChapter,
    deleteChapter,
    search,
  };
}
