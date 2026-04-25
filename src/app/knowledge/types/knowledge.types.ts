import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { z } from 'zod';
import { KnowledgeBookType } from '../enums/knowledge.enums';

/**
 * @title 知识模块类型定义
 * @description 知识书本与章节相关的请求/响应 DTO 及接口。
 * @keywords-cn 知识DTO, 书本, 章节, 向量匹配
 * @keywords-en knowledge-dto, book, chapter, vector-match
 */

// ========== 书本 DTO ==========

/**
 * 创建知识书本请求
 * @keyword-en create-book
 */
export class CreateKnowledgeBookDto {
  @IsEnum(KnowledgeBookType)
  type!: KnowledgeBookType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * 更新知识书本请求
 * @keyword-en update-book
 */
export class UpdateKnowledgeBookDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * 知识列表查询请求（按 tag 过滤）
 * @keyword-en tag-search-query
 */
export class KnowledgeSearchDto {
  /** 按标签过滤，不传则返回全部（最多 100 条） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(KnowledgeBookType)
  type?: KnowledgeBookType;

  /** 返回条数，默认 100，最大 100 */
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

// ========== 章节 DTO ==========

/**
 * 创建章节请求
 * @keyword-en create-chapter
 */
export class CreateKnowledgeChapterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isLmRequired?: boolean;

  @IsOptional()
  @IsString()
  content?: string;
}

/**
 * 更新章节请求
 * @keyword-en update-chapter
 */
export class UpdateKnowledgeChapterDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isLmRequired?: boolean;

  @IsOptional()
  @IsString()
  content?: string;
}

// ========== 响应接口 ==========

/** 知识书本简要信息 */
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
  createdAt: Date;
  updatedAt: Date;
}

/** 章节目录条目（不含内容） */
export interface KnowledgeChapterToc {
  id: string;
  bookId: string;
  title: string;
  sortOrder: number;
  isLmRequired: boolean;
}

/** 章节完整信息（含内容） */
export interface KnowledgeChapterInfo extends KnowledgeChapterToc {
  content: string | null;
}

/** 向量匹配结果 */
export interface KnowledgeMatchResult {
  bookId: string;
  name: string;
  type: KnowledgeBookType;
  description: string | null;
  score: number;
}

/** 获取目录的请求参数 */
export class GetKnowledgeTocDto {
  @IsArray()
  @IsUUID('all', { each: true })
  bookIds!: string[];
}

/** 获取章节内容的请求参数 */
export class GetKnowledgeChaptersDto {
  @IsArray()
  @IsUUID('all', { each: true })
  bookIds!: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  chapterIds?: string[];
}

/** 获取书本名称和描述 */
export class GetKnowledgeInfoDto {
  @IsArray()
  @IsUUID('all', { each: true })
  bookIds!: string[];
}

// ========== Zod 校验 Schema（前端用）==========

export const CreateKnowledgeBookSchema = z.object({
  type: z.nativeEnum(KnowledgeBookType),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateKnowledgeBookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const CreateKnowledgeChapterSchema = z.object({
  title: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
  isLmRequired: z.boolean().optional(),
  content: z.string().optional(),
});

export const UpdateKnowledgeChapterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isLmRequired: z.boolean().optional(),
  content: z.string().optional(),
});

export const KnowledgeSearchSchema = z.object({
  tags: z.array(z.string()).optional(),
  type: z.nativeEnum(KnowledgeBookType).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
