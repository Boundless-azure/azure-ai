import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeBookType } from '../enums/knowledge.enums';

/**
 * @title 知识 Hook payload schema (SSOT)
 * @description 单一来源: schema 给装饰器用作运行时校验 + LLM JSONSchema 派生, type 由 z.infer 派生供 handler 签名复用。
 * @keywords-cn 知识Hook, payloadSchema, SSOT, zod-infer
 * @keywords-en knowledge-hook, payload-schema, ssot, zod-infer
 */
const knowledgeBookTypeSchema = z.enum([
  KnowledgeBookType.SKILL,
  KnowledgeBookType.LORE,
]);

const getKnowledgeTocSchema = z.object({
  bookIds: z
    .array(z.string())
    .min(1)
    .describe('要获取目录的书本 ID 列表, 至少 1 个'),
});

const getKnowledgeChapterSchema = z.object({
  bookIds: z
    .array(z.string())
    .min(1)
    .describe('要获取章节的书本 ID 列表, 至少 1 个'),
  chapterIds: z
    .array(z.string())
    .optional()
    .describe(
      '可选章节 ID; 不传则只返回 LM 必读, 传入则在 LM 必读基础上额外返回这些章节',
    ),
});

const getKnowledgeTagSchema = z.object({
  type: knowledgeBookTypeSchema.optional().describe('可选过滤: skill / lore'),
  cursor: z.number().int().nonnegative().optional().describe('翻页起点'),
  limit: z
    .number()
    .int()
    .positive()
    .max(400)
    .optional()
    .describe('单次返回上限, 默认/上限 400 (一次拿全景)'),
});

const searchKnowledgeSchema = z.object({
  tags: z
    .array(z.string())
    .optional()
    .describe('按 tag 过滤 (ILIKE 模糊匹配); 不传则全部前 100 条'),
  type: knowledgeBookTypeSchema.optional().describe('可选过滤: skill / lore'),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('单次返回上限, 默认/上限 100'),
});

type GetKnowledgeTocPayload = z.infer<typeof getKnowledgeTocSchema>;
type GetKnowledgeChapterPayload = z.infer<typeof getKnowledgeChapterSchema>;
type GetKnowledgeTagPayload = z.infer<typeof getKnowledgeTagSchema>;
type SearchKnowledgePayload = z.infer<typeof searchKnowledgeSchema>;

/**
 * @title 知识 Hook 处理器
 * @description 为 LLM 提供通过 call_hook 读取知识库的能力：目录查询、章节内容获取、按标签列举书本。
 * @keywords-cn 知识Hook, 目录, 章节内容, tag搜索
 * @keywords-en knowledge-hook, toc, chapter-content, tag-search
 */
@Injectable()
export class KnowledgeHookHandlerService {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // ----------------------------------------------------------------
  // saas.app.knowledge.getToc — 批量获取知识目录
  // ----------------------------------------------------------------

  /**
   * 获取指定书本 ID 列表的目录（不含章节内容）
   * @keyword-en hook-get-knowledge-toc
   */
  @HookHandler('saas.app.knowledge.getToc', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'toc'],
    description:
      '获取指定书本 ID 列表的知识目录（不含章节内容）。返回每本书的标题、类型、描述和章节列表（无正文）。',
    payloadSchema: getKnowledgeTocSchema,
  })
  async handleGetToc(
    event: HookEvent<GetKnowledgeTocPayload>,
  ): Promise<HookResult> {
    const { bookIds } = event.payload;
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
  // saas.app.knowledge.getChapter — 获取章节内容（含 LM 必读）
  // ----------------------------------------------------------------

  /**
   * 获取指定书本的章节内容；LM 必读章节始终返回，可额外指定 chapterIds
   * @keyword-en hook-get-knowledge-chapter
   */
  @HookHandler('saas.app.knowledge.getChapter', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'chapter'],
    description:
      '获取指定书本的章节正文内容。bookIds 必填; chapterIds 可选, 不传则只返回 LM 必读, 传入则在 LM 必读基础上额外返回指定章节。',
    payloadSchema: getKnowledgeChapterSchema,
  })
  async handleGetChapter(
    event: HookEvent<GetKnowledgeChapterPayload>,
  ): Promise<HookResult> {
    const { bookIds, chapterIds } = event.payload;
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
  // saas.app.knowledge.getTag — 知识库 tag 频次榜（默认/上限 400 一次拿全景）
  // ----------------------------------------------------------------

  /**
   * 获取知识库所有 tag 的频次榜, 默认/上限 400 (与 get_hook_tag 对齐)
   * 推荐作为知识库发现链路起点: 先看 tag 全景, 再据此 saas.app.knowledge.search 缩范围
   * @keyword-en hook-get-knowledge-tag
   */
  @HookHandler('saas.app.knowledge.getTag', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'tag', 'meta'],
    description:
      '获取知识库 tag 频次榜, 默认/上限 400 条 (一次拿全景, 推荐作为知识发现起点)。' +
      '聚合 db 书本 + 本地预置书本; 超过 400 用 cursor 翻页; type 可选过滤。',
    payloadSchema: getKnowledgeTagSchema,
  })
  async handleGetTag(
    event: HookEvent<GetKnowledgeTagPayload>,
  ): Promise<HookResult> {
    const { type, cursor, limit } = event.payload;
    try {
      const data = await this.knowledgeService.listAllTags({
        type,
        cursor,
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

  // ----------------------------------------------------------------
  // saas.app.knowledge.search — 按 tag 列举知识书本（前 100 条）
  // ----------------------------------------------------------------

  /**
   * 按可选 tag 过滤返回知识书本列表（最多 100 条），不传 tags 则返回全部前 100 条
   * @keyword-en hook-search-knowledge-by-tag
   */
  @HookHandler('saas.app.knowledge.search', {
    pluginName: 'knowledge',
    tags: ['knowledge', 'search', 'tag'],
    description:
      '按标签列举知识书本, 最多返回 100 条。tags 可不传 (返回全部前 100 条); 传入则按标签 ILIKE 模糊匹配; type 可选 (skill / lore)。',
    payloadSchema: searchKnowledgeSchema,
  })
  async handleSearch(
    event: HookEvent<SearchKnowledgePayload>,
  ): Promise<HookResult> {
    const { tags, type, limit } = event.payload;
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
