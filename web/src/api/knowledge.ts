/**
 * @title 知识 API
 * @description 知识书本和章节的 API 接口。
 * @keywords-cn 知识API, 书本, 章节, 向量搜索
 * @keywords-en knowledge-api, book, chapter, vector-search
 */
import { http } from '../utils/http';
import type {
  KnowledgeBookInfo,
  KnowledgeChapterToc,
  KnowledgeChapterInfo,
  KnowledgeMatchResult,
  CreateBookRequest,
  UpdateBookRequest,
  CreateChapterRequest,
  UpdateChapterRequest,
} from '../modules/knowledge/types/knowledge.types';
import {
  CreateBookSchema,
  UpdateBookSchema,
  CreateChapterSchema,
  UpdateChapterSchema,
} from '../modules/knowledge/types/knowledge.types';

export const knowledgeApi = {
  // ========== 书本 ==========
  listBooks: (type?: string) =>
    http.get<KnowledgeBookInfo[]>('/knowledge/books', type ? { type } : {}),

  getBook: (id: string) =>
    http.get<KnowledgeBookInfo>(`/knowledge/books/${id}`),

  createBook: (data: CreateBookRequest) => {
    const parsed = CreateBookSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create book payload');
    return http.post<KnowledgeBookInfo>('/knowledge/books', parsed.data);
  },

  updateBook: (id: string, data: UpdateBookRequest) => {
    const parsed = UpdateBookSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update book payload');
    return http.patch<KnowledgeBookInfo>(`/knowledge/books/${id}`, parsed.data);
  },

  deleteBook: (id: string) =>
    http.delete<{ ok: boolean }>(`/knowledge/books/${id}`),

  buildEmbedding: (id: string) =>
    http.post<KnowledgeBookInfo>(`/knowledge/books/${id}/embed`, {}),

  // ========== 章节 ==========
  getChaptersToc: (bookId: string) =>
    http.get<KnowledgeChapterToc[]>(`/knowledge/books/${bookId}/chapters`),

  getChapterContent: (bookId: string, chapterId: string) =>
    http.get<KnowledgeChapterInfo[]>(`/knowledge/books/${bookId}/chapters/${chapterId}`),

  createChapter: (bookId: string, data: CreateChapterRequest) => {
    const parsed = CreateChapterSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create chapter payload');
    return http.post<KnowledgeChapterInfo>(`/knowledge/books/${bookId}/chapters`, parsed.data);
  },

  updateChapter: (chapterId: string, data: UpdateChapterRequest) => {
    const parsed = UpdateChapterSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update chapter payload');
    return http.patch<KnowledgeChapterInfo>(`/knowledge/chapters/${chapterId}`, parsed.data);
  },

  deleteChapter: (chapterId: string) =>
    http.delete<{ ok: boolean }>(`/knowledge/chapters/${chapterId}`),

  // ========== 批量 Hook API ==========
  batchToc: (bookIds: string[]) =>
    http.post<Record<string, KnowledgeChapterToc[]>>('/knowledge/toc', { bookIds }),

  batchChapterContent: (bookIds: string[], chapterIds?: string[]) =>
    http.post<Record<string, KnowledgeChapterInfo[]>>('/knowledge/chapters/content', {
      bookIds,
      chapterIds,
    }),

  batchInfo: (bookIds: string[]) =>
    http.post<KnowledgeBookInfo[]>('/knowledge/info', { bookIds }),

  search: (query: string, type?: string, limit?: number) =>
    http.post<KnowledgeMatchResult[]>('/knowledge/search', { query, type, limit }),
};
