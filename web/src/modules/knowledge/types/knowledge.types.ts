/**
 * @title 知识模块类型（前端）
 * @description 知识书本和章节的类型定义与 Zod 校验 Schema。
 * @keywords-cn 知识类型, 书本, 章节, 前端
 * @keywords-en knowledge-types, book, chapter, frontend
 */
import { z } from 'zod';

export type KnowledgeBookType = 'skill' | 'lore';

export interface KnowledgeBookInfo {
  id: string;
  type: KnowledgeBookType;
  name: string;
  description: string | null;
  creatorId: string | null;
  isEmbedded: boolean;
  active: boolean;
  tags: string[] | null;
  chapterCount?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface KnowledgeChapterToc {
  id: string;
  bookId: string;
  title: string;
  sortOrder: number;
  isLmRequired: boolean;
}

export interface KnowledgeChapterInfo extends KnowledgeChapterToc {
  content: string | null;
}

export interface KnowledgeMatchResult {
  bookId: string;
  name: string;
  type: KnowledgeBookType;
  description: string | null;
  score: number;
}

export interface CreateBookRequest {
  type: KnowledgeBookType;
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdateBookRequest {
  name?: string;
  description?: string;
  active?: boolean;
  tags?: string[];
}

export interface CreateChapterRequest {
  title: string;
  sortOrder?: number;
  isLmRequired?: boolean;
  content?: string;
}

export interface UpdateChapterRequest {
  title?: string;
  sortOrder?: number;
  isLmRequired?: boolean;
  content?: string;
}

// ========== Zod Schemas ==========

export const CreateBookSchema = z.object({
  type: z.enum(['skill', 'lore']),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateBookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const CreateChapterSchema = z.object({
  title: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
  isLmRequired: z.boolean().optional(),
  content: z.string().optional(),
});

export const UpdateChapterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isLmRequired: z.boolean().optional(),
  content: z.string().optional(),
});
