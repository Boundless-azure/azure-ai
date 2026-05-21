import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { KnowledgeService } from '../services/knowledge.service';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { KnowledgeBookType } from '../enums/knowledge.enums';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import type {
  KnowledgeBookInfo,
  KnowledgeChapterToc,
  KnowledgeChapterInfo,
} from '../types/knowledge.types';
import {
  CreateKnowledgeBookDto,
  UpdateKnowledgeBookDto,
  CreateKnowledgeChapterDto,
  UpdateKnowledgeChapterDto,
  KnowledgeSearchDto,
} from '../types/knowledge.types';

/**
 * @title 知识 Hook payload schema (SSOT)
 * @description 知识 REST controller 内直接声明 LLM hook 的数组形参 schema, type 由 z.infer 派生。
 * @keywords-cn 知识Hook, payloadSchema, SSOT
 * @keywords-en knowledge-hook, payload-schema, ssot
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
    .max(10)
    .optional()
    .describe(
      'tag 列表 (上限 10 个, 任一命中即返回); 必须从 saas.app.knowledge.getTag 返回的真实 tag 中挑选, ' +
        '禁止自创或叠加未在全景里出现过的 tag, 否则 hook 直接返回 error。不传 tags 则返回前 100 条。',
    ),
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
 * @title 知识控制器
 * @description 知识书本和章节的 REST API, 同时直接声明 LLM 读取知识库的 HookRoute。
 * @keywords-cn 知识, 书本, 章节, CRUD, 向量, Hook
 * @keywords-en knowledge, book, chapter, crud, vector, hook
 */
@HookController({ pluginName: 'knowledge', tags: ['knowledge'] })
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly aiModelService: AIModelService,
  ) {}

  // ========== 书本管理 ==========

  /**
   * 创建知识书本
   * @route POST /knowledge/books
   * @keyword-en create-book
   */
  @Post('books')
  @CheckAbility('create', 'knowledge')
  async createBook(
    @Body() dto: CreateKnowledgeBookDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<KnowledgeBookInfo> {
    const creatorId = req.user?.id ?? 'anonymous';
    return this.knowledgeService.createBook(creatorId, dto);
  }

  /**
   * 获取知识书本列表
   * @route GET /knowledge/books
   * @keyword-en list-books
   */
  @Get('books')
  async listBooks(
    @Query('type') type?: KnowledgeBookType,
  ): Promise<KnowledgeBookInfo[]> {
    return this.knowledgeService.listBooks(type);
  }

  /**
   * 获取单个书本详情
   * @route GET /knowledge/books/:id
   * @keyword-en get-book
   */
  @Get('books/:id')
  async getBook(@Param('id') id: string): Promise<KnowledgeBookInfo> {
    return this.knowledgeService.getBook(id);
  }

  /**
   * 更新书本
   * @route PATCH /knowledge/books/:id
   * @keyword-en update-book
   */
  @Patch('books/:id')
  @CheckAbility('update', 'knowledge')
  async updateBook(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBookDto,
  ): Promise<KnowledgeBookInfo> {
    return this.knowledgeService.updateBook(id, dto);
  }

  /**
   * 删除书本
   * @route DELETE /knowledge/books/:id
   * @keyword-en delete-book
   */
  @Delete('books/:id')
  @CheckAbility('delete', 'knowledge')
  async deleteBook(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.knowledgeService.deleteBook(id);
    return { ok: true };
  }

  /**
   * 构建书本向量（触发 embedding）
   * @route POST /knowledge/books/:id/embed
   * @keyword-en build-embedding
   */
  @Post('books/:id/embed')
  @CheckAbility('update', 'knowledge')
  async buildEmbedding(@Param('id') id: string): Promise<KnowledgeBookInfo> {
    const apiKey = await this.pickApiKey();
    return this.knowledgeService.buildEmbedding(id, apiKey);
  }

  // ========== 章节管理 ==========

  /**
   * 获取书本目录
   * @route GET /knowledge/books/:id/chapters
   * @keyword-en list-chapters-toc
   */
  @Get('books/:id/chapters')
  async getBookChapters(
    @Param('id') id: string,
  ): Promise<KnowledgeChapterToc[]> {
    const toc = await this.knowledgeService.getTocByBookIds([id]);
    return toc[id] ?? [];
  }

  /**
   * 新增章节
   * @route POST /knowledge/books/:id/chapters
   * @keyword-en create-chapter
   */
  @Post('books/:id/chapters')
  @CheckAbility('create', 'knowledge')
  async createChapter(
    @Param('id') id: string,
    @Body() dto: CreateKnowledgeChapterDto,
  ): Promise<KnowledgeChapterInfo> {
    return this.knowledgeService.createChapter(id, dto);
  }

  /**
   * 获取章节内容（含 LM 必读）
   * @route GET /knowledge/books/:id/chapters/:chapterId
   * @keyword-en get-chapter-content
   */
  @Get('books/:id/chapters/:chapterId')
  async getChapterContent(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
  ): Promise<KnowledgeChapterInfo[]> {
    const result = await this.knowledgeService.getChapterContent(
      [id],
      [chapterId],
    );
    return result[id] ?? [];
  }

  /**
   * 更新章节
   * @route PATCH /knowledge/chapters/:chapterId
   * @keyword-en update-chapter
   */
  @Patch('chapters/:chapterId')
  @CheckAbility('update', 'knowledge')
  async updateChapter(
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateKnowledgeChapterDto,
  ): Promise<KnowledgeChapterInfo> {
    return this.knowledgeService.updateChapter(chapterId, dto);
  }

  /**
   * 删除章节
   * @route DELETE /knowledge/chapters/:chapterId
   * @keyword-en delete-chapter
   */
  @Delete('chapters/:chapterId')
  @CheckAbility('delete', 'knowledge')
  async deleteChapter(
    @Param('chapterId') chapterId: string,
  ): Promise<{ ok: boolean }> {
    await this.knowledgeService.deleteChapter(chapterId);
    return { ok: true };
  }

  // ========== Hook API ==========

  /**
   * 通过书本 ID 列表批量获取目录
   * @route POST /knowledge/toc
   * @keyword-en batch-toc
   */
  @Post('toc')
  async batchToc(
    @Body('bookIds') bookIds: string[],
  ): Promise<Record<string, KnowledgeChapterToc[]>> {
    return this.knowledgeService.getTocByBookIds(bookIds ?? []);
  }

  /**
   * 通过书本 ID 列表批量获取章节内容（含 LM 必读）
   * @route POST /knowledge/chapters/content
   * @keyword-en batch-chapter-content
   */
  @Post('chapters/content')
  async batchChapterContent(
    @Body('bookIds') bookIds: string[],
    @Body('chapterIds') chapterIds?: string[],
  ): Promise<Record<string, KnowledgeChapterInfo[]>> {
    return this.knowledgeService.getChapterContent(bookIds ?? [], chapterIds);
  }

  /**
   * 通过书本 ID 列表获取名称和描述
   * @route POST /knowledge/info
   * @keyword-en batch-book-info
   */
  @Post('info')
  async batchInfo(
    @Body('bookIds') bookIds: string[],
  ): Promise<KnowledgeBookInfo[]> {
    return this.knowledgeService.getBookInfoByIds(bookIds ?? []);
  }

  /**
   * 按 tag 过滤列举知识书本（最多 100 条）
   * @route POST /knowledge/search
   * @keyword-en tag-search
   */
  @Post('search')
  async search(@Body() dto: KnowledgeSearchDto): Promise<KnowledgeBookInfo[]> {
    return this.knowledgeService.listByTags({
      tags: dto.tags,
      type: dto.type,
      limit: dto.limit,
    });
  }

  /**
   * 获取指定书本 ID 列表的目录（不含章节内容）。
   * @keyword-en hook-get-knowledge-toc
   */
  @HookRoute({
    hook: 'saas.app.knowledge.getToc',
    description:
      '获取指定书本 ID 列表的知识目录（不含章节内容）。返回每本书的标题、类型、描述和章节列表（无正文）。',
    args: [getKnowledgeTocSchema],
    metadata: { tags: ['knowledge', 'toc'] },
  })
  @CheckAbility('read', 'knowledge')
  async handleGetToc(
    payload: GetKnowledgeTocPayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { bookIds } = payload;
    event?.log?.info('knowledge.getToc:start', { bookIdCount: bookIds.length });
    try {
      const start = Date.now();
      const data = await this.knowledgeService.getTocByBookIds(bookIds);
      event?.log?.info('knowledge.getToc:done', {
        bookIdCount: bookIds.length,
        bookCount: Array.isArray(data) ? data.length : 0,
        durationMs: Date.now() - start,
      });
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('knowledge.getToc:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /**
   * 获取指定书本的章节内容；LM 必读章节始终返回，可额外指定 chapterIds。
   * @keyword-en hook-get-knowledge-chapter
   */
  @HookRoute({
    hook: 'saas.app.knowledge.getChapter',
    description:
      '获取指定书本的章节正文内容。bookIds 必填; chapterIds 可选, 不传则只返回 LM 必读, 传入则在 LM 必读基础上额外返回指定章节。',
    args: [getKnowledgeChapterSchema],
    metadata: { tags: ['knowledge', 'chapter'] },
  })
  @CheckAbility('read', 'knowledge')
  async handleGetChapter(
    payload: GetKnowledgeChapterPayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { bookIds, chapterIds } = payload;
    event?.log?.info('knowledge.getChapter:start', {
      bookIdCount: bookIds.length,
      chapterIdCount: chapterIds?.length ?? 0,
      lmRequiredOnly: !chapterIds || chapterIds.length === 0,
    });
    try {
      const start = Date.now();
      const data = await this.knowledgeService.getChapterContent(
        bookIds,
        chapterIds,
      );
      event?.log?.info('knowledge.getChapter:done', {
        bookCount: Array.isArray(data) ? data.length : 0,
        durationMs: Date.now() - start,
      });
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('knowledge.getChapter:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /**
   * 获取知识库所有 tag 的频次榜, 推荐作为知识库发现链路起点。
   * @keyword-en hook-get-knowledge-tag
   */
  @HookRoute({
    hook: 'saas.app.knowledge.getTag',
    description:
      '获取知识库 tag 频次榜, 默认/上限 400 条 (一次拿全景, 推荐作为知识发现起点)。' +
      '聚合 db 书本 + 本地预置书本; 超过 400 用 cursor 翻页; type 可选过滤。',
    args: [getKnowledgeTagSchema],
    metadata: { tags: ['knowledge', 'tag', 'meta'] },
  })
  @CheckAbility('read', 'knowledge')
  async handleGetTag(
    payload: GetKnowledgeTagPayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { type, cursor, limit } = payload;
    event?.log?.info('knowledge.getTag:start', {
      ...(type ? { type } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    try {
      const start = Date.now();
      const data = await this.knowledgeService.listAllTags({
        type,
        cursor,
        limit,
      });
      const items = (data as { items?: unknown[] } | null)?.items;
      event?.log?.info('knowledge.getTag:done', {
        returned: Array.isArray(items) ? items.length : 0,
        durationMs: Date.now() - start,
      });
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('knowledge.getTag:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /**
   * 按可选 tag 过滤返回知识书本列表（最多 100 条）。
   * @keyword-en hook-search-knowledge-by-tag
   */
  @HookRoute({
    hook: 'saas.app.knowledge.search',
    description:
      '按标签列举知识书本, 最多返回 100 条。tags 可不传 (返回全部前 100 条); ' +
      '传入时必须是 saas.app.knowledge.getTag 全景中真实存在的子集 — ' +
      '若全部不存在 hook 会直接 error 阻止瞎猜; type 可选 (skill / lore)。',
    args: [searchKnowledgeSchema],
    metadata: { tags: ['knowledge', 'search', 'tag'] },
  })
  @CheckAbility('read', 'knowledge')
  async handleSearch(
    payload: SearchKnowledgePayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { tags, type, limit } = payload;
    event?.log?.info('knowledge.search:start', {
      tagCount: tags?.length ?? 0,
      ...(type ? { type } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    try {
      const start = Date.now();
      let known: string[] | undefined;
      let unknown: string[] = [];
      if (tags && tags.length > 0) {
        const validation = await this.validateTags(tags, type);
        known = validation.known;
        unknown = validation.unknown;
        if (known.length === 0) {
          event?.log?.warn('knowledge.search:reject-all-unknown', {
            unknown,
            availableSample: validation.availableSample,
          });
          return {
            status: HookResultStatus.Error,
            error:
              `tags 全部不存在: [${unknown.join(', ')}]. ` +
              `请先 call_hook("saas.app.knowledge.getTag") 拿真实 tag 列表, ` +
              `不要自创 tag 或在数组里叠加未在全景里出现过的 tag。` +
              (validation.availableSample.length > 0
                ? ` 当前部分可用 tag: [${validation.availableSample.join(', ')}]`
                : ' (当前知识库为空, 不要再 search 了)'),
          };
        }
      }

      const data = await this.knowledgeService.listByTags({
        tags: known,
        type,
        limit,
      });
      event?.log?.info('knowledge.search:done', {
        returned: Array.isArray(data) ? data.length : 0,
        knownCount: known?.length ?? 0,
        unknownCount: unknown.length,
        durationMs: Date.now() - start,
      });
      const wrapped =
        unknown.length > 0
          ? {
              items: data,
              unknownTags: unknown,
              hint:
                `以下 tag 不存在已被忽略: [${unknown.join(', ')}]. ` +
                `请只使用 saas.app.knowledge.getTag 返回里出现过的 tag, 不要自创。`,
            }
          : data;
      return { status: HookResultStatus.Success, data: wrapped };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('knowledge.search:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /** 从已启用模型中取 OpenAI apiKey */
  private async pickApiKey(): Promise<string> {
    const models = await this.aiModelService.getEnabledModels();
    for (const m of models) {
      if (m.provider === 'openai' && typeof m.apiKey === 'string' && m.apiKey) {
        return m.apiKey;
      }
    }
    return process.env['OPENAI_API_KEY'] ?? '';
  }

  /**
   * 把传入 tags 跟 getTag 全集做交集, 返回 known/unknown 拆分与可用样本。
   * @keyword-en validate-tags-against-real-set
   */
  private async validateTags(
    tags: string[],
    type?: KnowledgeBookType,
  ): Promise<{
    known: string[];
    unknown: string[];
    availableSample: string[];
  }> {
    const all = await this.knowledgeService.listAllTags({ type, limit: 400 });
    const realSet = new Set(
      (all?.items ?? []).map((it) => it.name.toLowerCase()),
    );
    const known: string[] = [];
    const unknown: string[] = [];
    for (const t of tags) {
      if (realSet.has(t.toLowerCase())) known.push(t);
      else unknown.push(t);
    }
    const availableSample = (all?.items ?? []).slice(0, 8).map((it) => it.name);
    return { known, unknown, availableSample };
  }
}
