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
import { KnowledgeService } from '../services/knowledge.service';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { KnowledgeBookType } from '../enums/knowledge.enums';
import type {
  KnowledgeBookInfo,
  KnowledgeChapterToc,
  KnowledgeChapterInfo,
  KnowledgeMatchResult,
} from '../types/knowledge.types';
import {
  CreateKnowledgeBookDto,
  UpdateKnowledgeBookDto,
  CreateKnowledgeChapterDto,
  UpdateKnowledgeChapterDto,
  KnowledgeSearchDto,
} from '../types/knowledge.types';

/**
 * @title 知识控制器
 * @description 知识书本和章节的 REST API。
 * @keywords-cn 知识, 书本, 章节, CRUD, 向量
 * @keywords-en knowledge, book, chapter, crud, vector
 */
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
  async buildEmbedding(
    @Param('id') id: string,
  ): Promise<KnowledgeBookInfo> {
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
  async getBookChapters(@Param('id') id: string): Promise<KnowledgeChapterToc[]> {
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
    const result = await this.knowledgeService.getChapterContent([id], [chapterId]);
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
   * 语义向量匹配知识
   * @route POST /knowledge/search
   * @keyword-en semantic-search
   */
  @Post('search')
  async search(
    @Body() dto: KnowledgeSearchDto,
  ): Promise<KnowledgeMatchResult[]> {
    const apiKey = await this.pickApiKey();
    return this.knowledgeService.vectorSearch(dto.query, apiKey, {
      type: dto.type,
      limit: dto.limit,
    });
  }

  /** 从已启用模型中取 OpenAI apiKey */
  private async pickApiKey(): Promise<string> {
    const models = await this.aiModelService.getEnabledModels();
    for (const m of models) {
      if (
        m.provider === 'openai' &&
        typeof m.apiKey === 'string' &&
        m.apiKey
      ) {
        return m.apiKey;
      }
    }
    return process.env['OPENAI_API_KEY'] ?? '';
  }
}
