import { Injectable } from '@nestjs/common';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookContext, HookResult } from '@/core/hookbus/types/hook.types';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeBookType } from '../enums/knowledge.enums';

/**
 * @title 知识 Hook 处理器
 * @description 为 LLM 提供通过 call_hook 读取知识库的能力：目录查询、章节内容获取、语义向量搜索。
 * @keywords-cn 知识Hook, 目录, 章节内容, 语义搜索
 * @keywords-en knowledge-hook, toc, chapter-content, semantic-search
 */
@Injectable()
export class KnowledgeHookHandlerService {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // ----------------------------------------------------------------
  // get_knowledge_toc — 批量获取知识目录
  // ----------------------------------------------------------------

  /**
   * 获取指定书本 ID 列表的目录（不含章节内容）
   * payload: { bookIds: string[] }
   * @keyword-en hook-get-knowledge-toc
   */
  @HookHandler('get_knowledge_toc', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'toc'],
  })
  async handleGetToc(
    ctx: HookContext<{ bookIds?: string[] }>,
  ): Promise<HookResult> {
    const { bookIds } = ctx.event.payload ?? {};
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return {
        status: HookResultStatus.Error,
        error: 'bookIds 数组必填且不能为空',
      };
    }
    try {
      const data = await this.knowledgeService.getTocByBookIds(bookIds);
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      return {
        status: HookResultStatus.Error,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ----------------------------------------------------------------
  // get_knowledge_chapter — 获取章节内容（含 LM 必读）
  // ----------------------------------------------------------------

  /**
   * 获取指定书本的章节内容；LM 必读章节始终返回，可额外指定 chapterIds
   * payload: { bookIds: string[]; chapterIds?: string[] }
   * @keyword-en hook-get-knowledge-chapter
   */
  @HookHandler('get_knowledge_chapter', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'chapter'],
  })
  async handleGetChapter(
    ctx: HookContext<{ bookIds?: string[]; chapterIds?: string[] }>,
  ): Promise<HookResult> {
    const { bookIds, chapterIds } = ctx.event.payload ?? {};
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return {
        status: HookResultStatus.Error,
        error: 'bookIds 数组必填且不能为空',
      };
    }
    try {
      const data = await this.knowledgeService.getChapterContent(
        bookIds,
        chapterIds,
      );
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      return {
        status: HookResultStatus.Error,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ----------------------------------------------------------------
  // search_knowledge — 语义向量搜索
  // ----------------------------------------------------------------

  /**
   * 自然语言语义匹配知识书本（向量搜索）
   * payload: { query: string; apiKey: string; type?: KnowledgeBookType; limit?: number }
   * @keyword-en hook-search-knowledge
   */
  @HookHandler('search_knowledge', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'search', 'vector'],
  })
  async handleSearch(
    ctx: HookContext<{
      query?: string;
      apiKey?: string;
      type?: KnowledgeBookType;
      limit?: number;
    }>,
  ): Promise<HookResult> {
    const { query, apiKey, type, limit } = ctx.event.payload ?? {};
    if (!query) {
      return { status: HookResultStatus.Error, error: 'query 为必填参数' };
    }
    if (!apiKey) {
      return { status: HookResultStatus.Error, error: 'apiKey 为必填参数' };
    }
    try {
      const data = await this.knowledgeService.vectorSearch(query, apiKey, {
        type,
        limit,
      });
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      return {
        status: HookResultStatus.Error,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
