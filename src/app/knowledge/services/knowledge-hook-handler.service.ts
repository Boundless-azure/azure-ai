import { Injectable } from '@nestjs/common';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeBookType } from '../enums/knowledge.enums';

/**
 * @title 知识 Hook 处理器
 * @description 为 LLM 提供通过 call_hook 读取知识库的能力：目录查询、章节内容获取、按标签列举书本。
 * @keywords-cn 知识Hook, 目录, 章节内容, tag搜索
 * @keywords-en knowledge-hook, toc, chapter-content, tag-search
 */
@Injectable()
export class KnowledgeHookHandlerService {
  constructor(private readonly knowledgeService: KnowledgeService) { }

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
    description:
      '获取指定书本 ID 列表的知识目录（不含章节内容）。payload: { bookIds: string[] }，bookIds 必填。返回每本书的标题、类型、描述和章节列表（无正文）。',
  })
  async handleGetToc(
    event: HookEvent<{ bookIds?: string[] }>,
  ): Promise<HookResult> {
    const { bookIds } = event.payload ?? {};
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
    description:
      '获取指定书本的章节正文内容。payload: { bookIds: string[], chapterIds?: string[] }。bookIds 必填；chapterIds 可选，不传则返回全部 LM 必读章节；传入则额外返回指定章节内容。',
  })
  async handleGetChapter(
    event: HookEvent<{ bookIds?: string[]; chapterIds?: string[] }>,
  ): Promise<HookResult> {
    const { bookIds, chapterIds } = event.payload ?? {};
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
  // search_knowledge — 按 tag 列举知识书本（前 100 条）
  // ----------------------------------------------------------------

  /**
   * 按可选 tag 过滤返回知识书本列表（最多 100 条），不传 tags 则返回全部前 100 条
   * payload: { tags?: string[]; type?: KnowledgeBookType; limit?: number }
   * @keyword-en hook-search-knowledge-by-tag
   */
  @HookHandler('search_knowledge', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'search', 'tag'],
    description:
      '按标签列举知识书本，最多返回 100 条。payload: { tags?: string[], type?: string, limit?: number }。tags 可不传，不传时返回前 100 条全部书本；传入则按标签过滤（ILIKE 模糊匹配）；type 可选（如 skill / lore）；limit 可选，默认 100 上限。',
  })
  async handleSearch(
    event: HookEvent<{
      tags?: string[];
      type?: KnowledgeBookType;
      limit?: number;
    }>,
  ): Promise<HookResult> {
    const { tags, type, limit } = event.payload ?? {};
    try {
      const data = await this.knowledgeService.listByTags({
        tags,
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
