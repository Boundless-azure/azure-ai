import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OpenAIEmbeddings } from '@langchain/openai';
import { KnowledgeBookEntity } from '../entities/knowledge-book.entity';
import { KnowledgeChapterEntity } from '../entities/knowledge-chapter.entity';
import { KnowledgeBookType } from '../enums/knowledge.enums';
import type {
  CreateKnowledgeBookDto,
  UpdateKnowledgeBookDto,
  CreateKnowledgeChapterDto,
  UpdateKnowledgeChapterDto,
  KnowledgeBookInfo,
  KnowledgeChapterToc,
  KnowledgeChapterInfo,
  KnowledgeMatchResult,
} from '../types/knowledge.types';
import {
  LOCAL_BOOKS,
  LOCAL_CHAPTERS_BY_BOOK,
  LOCAL_CHAPTERS_BY_ID,
  isLocalKnowledgeId,
} from '../local/local-knowledge.seed';

/**
 * @title 知识服务
 * @description 知识书本 CRUD、章节管理、向量化构建和语义匹配核心逻辑。
 * @keywords-cn 知识服务, 书本, 章节, 向量, 语义匹配
 * @keywords-en knowledge-service, book, chapter, vector, semantic-match
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(KnowledgeBookEntity)
    private readonly bookRepo: Repository<KnowledgeBookEntity>,
    @InjectRepository(KnowledgeChapterEntity)
    private readonly chapterRepo: Repository<KnowledgeChapterEntity>,
  ) { }

  // ========== 书本 CRUD ==========

  /**
   * 创建知识书本
   * @keyword-en create-book
   */
  async createBook(
    creatorId: string,
    dto: CreateKnowledgeBookDto,
  ): Promise<KnowledgeBookInfo> {
    const entity = this.bookRepo.create({
      type: dto.type,
      name: dto.name,
      description: dto.description ?? null,
      creatorId,
      isEmbedded: false,
      active: true,
      tags: dto.tags ?? null,
    });
    const saved = await this.bookRepo.save(entity);
    return this.toBookInfo(saved);
  }

  /**
   * 获取所有书本列表（含本地预置书本）
   * @keyword-en list-books
   */
  async listBooks(type?: KnowledgeBookType): Promise<KnowledgeBookInfo[]> {
    const where: Record<string, unknown> = { isDelete: false, active: true };
    if (type) where['type'] = type;
    const books = await this.bookRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const ids = books.map((b) => b.id);
    const counts: Array<{ book_id: string; count: string }> = ids.length
      ? await this.chapterRepo.manager.query(
        `SELECT book_id, COUNT(*) as count FROM knowledge_chapters WHERE book_id = ANY($1) AND is_delete = false GROUP BY book_id`,
        [ids],
      )
      : [];
    const countMap = new Map(counts.map((c) => [c.book_id, Number(c.count)]));

    const dbResults: KnowledgeBookInfo[] = books.map((b) => ({
      ...this.toBookInfo(b),
      chapterCount: countMap.get(b.id) ?? 0,
    }));

    // 合并本地预置书本（前置，按 type 过滤）
    const localResults = LOCAL_BOOKS.filter(
      (b) => !type || b.type === type,
    ).map((b) => ({
      ...b,
      chapterCount: LOCAL_CHAPTERS_BY_BOOK.get(b.id)?.length ?? 0,
    }));

    return [...localResults, ...dbResults];
  }

  /**
   * 获取书本详情（支持本地预置书本）
   * @keyword-en get-book
   */
  async getBook(id: string): Promise<KnowledgeBookInfo> {
    if (isLocalKnowledgeId(id)) {
      const local = LOCAL_BOOKS.find((b) => b.id === id);
      if (!local)
        throw new NotFoundException(`Knowledge book not found: ${id}`);
      return local;
    }
    const book = await this.bookRepo.findOne({
      where: { id, isDelete: false },
    });
    if (!book) throw new NotFoundException(`Knowledge book not found: ${id}`);
    return this.toBookInfo(book);
  }

  /**
   * 更新书本（本地预置书本不可修改）
   * @keyword-en update-book
   */
  async updateBook(
    id: string,
    dto: UpdateKnowledgeBookDto,
  ): Promise<KnowledgeBookInfo> {
    if (isLocalKnowledgeId(id))
      throw new BadRequestException('本地预置书本不可修改');
    const book = await this.bookRepo.findOne({
      where: { id, isDelete: false },
    });
    if (!book) throw new NotFoundException(`Knowledge book not found: ${id}`);
    if (dto.name !== undefined) book.name = dto.name;
    if (dto.description !== undefined)
      book.description = dto.description ?? null;
    if (dto.active !== undefined) book.active = dto.active;
    if (dto.tags !== undefined) book.tags = dto.tags ?? null;
    // 描述变更则重置向量化状态
    if (dto.description !== undefined) {
      book.isEmbedded = false;
      book.embedding = null;
    }
    const saved = await this.bookRepo.save(book);
    return this.toBookInfo(saved);
  }

  /**
   * 删除书本（软删，本地预置书本不可删除）
   * @keyword-en delete-book
   */
  async deleteBook(id: string): Promise<void> {
    if (isLocalKnowledgeId(id))
      throw new BadRequestException('本地预置书本不可删除');
    const book = await this.bookRepo.findOne({
      where: { id, isDelete: false },
    });
    if (!book) throw new NotFoundException(`Knowledge book not found: ${id}`);
    book.isDelete = true;
    await this.bookRepo.save(book);
  }

  // ========== 章节 CRUD ==========

  /**
   * 新增章节
   * @keyword-en create-chapter
   */
  async createChapter(
    bookId: string,
    dto: CreateKnowledgeChapterDto,
  ): Promise<KnowledgeChapterInfo> {
    await this.assertBookExists(bookId);
    const entity = this.chapterRepo.create({
      bookId,
      title: dto.title,
      sortOrder: dto.sortOrder ?? 0,
      isLmRequired: dto.isLmRequired ?? false,
      content: dto.content ?? null,
    });
    const saved = await this.chapterRepo.save(entity);
    return this.toChapterInfo(saved);
  }

  /**
   * 更新章节
   * @keyword-en update-chapter
   */
  /**
   * 更新章节（本地预置章节不可修改）
   * @keyword-en update-chapter
   */
  async updateChapter(
    chapterId: string,
    dto: UpdateKnowledgeChapterDto,
  ): Promise<KnowledgeChapterInfo> {
    if (isLocalKnowledgeId(chapterId))
      throw new BadRequestException('本地预置章节不可修改');
    const chapter = await this.chapterRepo.findOne({
      where: { id: chapterId, isDelete: false },
    });
    if (!chapter)
      throw new NotFoundException(`Chapter not found: ${chapterId}`);
    if (dto.title !== undefined) chapter.title = dto.title;
    if (dto.sortOrder !== undefined) chapter.sortOrder = dto.sortOrder;
    if (dto.isLmRequired !== undefined) chapter.isLmRequired = dto.isLmRequired;
    if (dto.content !== undefined) chapter.content = dto.content ?? null;
    const saved = await this.chapterRepo.save(chapter);
    return this.toChapterInfo(saved);
  }

  /**
   * 删除章节（软删，本地预置章节不可删除）
   * @keyword-en delete-chapter
   */
  async deleteChapter(chapterId: string): Promise<void> {
    if (isLocalKnowledgeId(chapterId))
      throw new BadRequestException('本地预置章节不可删除');
    const chapter = await this.chapterRepo.findOne({
      where: { id: chapterId, isDelete: false },
    });
    if (!chapter)
      throw new NotFoundException(`Chapter not found: ${chapterId}`);
    chapter.isDelete = true;
    await this.chapterRepo.save(chapter);
  }

  // ========== Hook API ==========

  /**
   * 通过书本 ID 数组获取目录（不含内容，支持本地预置）
   * @keyword-en get-toc-by-book-ids
   */
  async getTocByBookIds(
    bookIds: string[],
  ): Promise<Record<string, KnowledgeChapterToc[]>> {
    if (bookIds.length === 0) return {};

    const localIds = bookIds.filter(isLocalKnowledgeId);
    const dbIds = bookIds.filter((id) => !isLocalKnowledgeId(id));

    const result: Record<string, KnowledgeChapterToc[]> = {};

    // 本地预置目录
    for (const bid of localIds) {
      const chapters = LOCAL_CHAPTERS_BY_BOOK.get(bid);
      if (chapters) {
        result[bid] = chapters.map((c) => ({
          id: c.id,
          bookId: c.bookId,
          title: c.title,
          sortOrder: c.sortOrder,
          isLmRequired: c.isLmRequired,
        }));
      }
    }

    // 数据库目录
    if (dbIds.length > 0) {
      const chapters = await this.chapterRepo.find({
        where: { bookId: In(dbIds), isDelete: false },
        order: { bookId: 'ASC', sortOrder: 'ASC' },
        select: ['id', 'bookId', 'title', 'sortOrder', 'isLmRequired'],
      });
      for (const c of chapters) {
        if (!result[c.bookId]) result[c.bookId] = [];
        result[c.bookId].push({
          id: c.id,
          bookId: c.bookId,
          title: c.title,
          sortOrder: c.sortOrder,
          isLmRequired: c.isLmRequired,
        });
      }
    }

    return result;
  }

  /**
   * 通过书本 ID 数组和章节 ID 数组获取章节内容，LM 必读章节始终附带（支持本地预置）
   * @keyword-en get-chapter-content
   */
  async getChapterContent(
    bookIds: string[],
    chapterIds?: string[],
  ): Promise<Record<string, KnowledgeChapterInfo[]>> {
    if (bookIds.length === 0) return {};

    const localIds = bookIds.filter(isLocalKnowledgeId);
    const dbIds = bookIds.filter((id) => !isLocalKnowledgeId(id));

    const result: Record<string, KnowledgeChapterInfo[]> = {};

    // 本地预置：LM 必读章节始终附带，同时包含指定章节
    for (const bid of localIds) {
      const chapters = LOCAL_CHAPTERS_BY_BOOK.get(bid);
      if (!chapters) continue;
      const merged = new Map<string, KnowledgeChapterInfo>();
      for (const c of chapters) {
        if (c.isLmRequired) merged.set(c.id, c);
      }
      if (chapterIds) {
        for (const cid of chapterIds) {
          const local = LOCAL_CHAPTERS_BY_ID.get(cid);
          if (local && local.bookId === bid) merged.set(local.id, local);
        }
      }
      const sorted = Array.from(merged.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      if (sorted.length > 0) result[bid] = sorted;
    }

    // 数据库
    if (dbIds.length > 0) {
      const lmRequired = await this.chapterRepo.find({
        where: { bookId: In(dbIds), isLmRequired: true, isDelete: false },
      });
      let requested: KnowledgeChapterEntity[] = [];
      if (chapterIds && chapterIds.length > 0) {
        requested = await this.chapterRepo.find({
          where: { id: In(chapterIds), bookId: In(dbIds), isDelete: false },
        });
      }
      const merged = new Map<string, KnowledgeChapterEntity>();
      for (const c of [...lmRequired, ...requested]) {
        merged.set(c.id, c);
      }
      for (const c of merged.values()) {
        if (!result[c.bookId]) result[c.bookId] = [];
        result[c.bookId].push(this.toChapterInfo(c));
      }
      for (const bookId of dbIds) {
        result[bookId]?.sort((a, b) => a.sortOrder - b.sortOrder);
      }
    }

    return result;
  }

  /**
   * 通过书本 ID 数组获取名称和描述（支持本地预置）
   * @keyword-en get-book-info-by-ids
   */
  async getBookInfoByIds(bookIds: string[]): Promise<KnowledgeBookInfo[]> {
    if (bookIds.length === 0) return [];
    const localIds = bookIds.filter(isLocalKnowledgeId);
    const dbIds = bookIds.filter((id) => !isLocalKnowledgeId(id));
    const localResults = localIds
      .map((id) => LOCAL_BOOKS.find((b) => b.id === id))
      .filter((b): b is KnowledgeBookInfo => b !== undefined);
    const dbResults = dbIds.length
      ? (
        await this.bookRepo.find({
          where: { id: In(dbIds), isDelete: false },
        })
      ).map((b) => this.toBookInfo(b))
      : [];
    return [...localResults, ...dbResults];
  }

  // ========== Tag 过滤列表 ==========

  /**
   * 按 tag 列表过滤返回书本（最多 100 条），不传 tags 则返回全部前 100 条
   * @keyword-en list-by-tags
   */
  async listByTags(opts?: {
    tags?: string[];
    type?: KnowledgeBookType;
    limit?: number;
  }): Promise<KnowledgeBookInfo[]> {
    const limit = Math.min(opts?.limit ?? 100, 100);

    let books: KnowledgeBookEntity[];
    if (opts?.tags && opts.tags.length > 0) {
      // simple-array 以逗号拼接存储，用 ANY + ILIKE 做兼容匹配
      const tagConditions = opts.tags
        .map((_, i) => `tags ILIKE $${i + 1}`)
        .join(' OR ');
      const params = opts.tags.map((t) => `%${t}%`);
      const typeClause = opts?.type ? ` AND type = '${opts.type}'` : '';
      books = await this.bookRepo.manager.query(
        `SELECT * FROM knowledge_books WHERE is_delete = false AND active = true AND (${tagConditions})${typeClause} ORDER BY created_at DESC LIMIT ${limit}`,
        params,
      );
    } else {
      const where: Record<string, unknown> = { isDelete: false, active: true };
      if (opts?.type) where['type'] = opts.type;
      books = await this.bookRepo.find({
        where,
        order: { createdAt: 'DESC' },
        take: limit,
      });
    }

    return books.map((b) => this.toBookInfo(b));
  }

  // ========== 向量搜索 ==========

  /**
   * 构建书本向量（对描述进行 embedding）
   * @keyword-en build-embedding
   */
  async buildEmbedding(
    bookId: string,
    apiKey: string,
  ): Promise<KnowledgeBookInfo> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId, isDelete: false },
    });
    if (!book)
      throw new NotFoundException(`Knowledge book not found: ${bookId}`);
    if (!book.description)
      throw new BadRequestException('Book has no description to embed');

    const emb = new OpenAIEmbeddings({
      apiKey,
      model: 'text-embedding-3-small',
    });
    try {
      const vec = await emb.embedQuery(book.description);
      const literal = `[${vec.map((v) => (Number.isFinite(v) ? v : 0)).join(',')}]`;
      book.embedding = literal as unknown as string;
      book.isEmbedded = true;
      const saved = await this.bookRepo.save(book);
      return this.toBookInfo(saved);
    } catch (err) {
      this.logger.error(`Failed to build embedding for book ${bookId}`, err);
      throw new BadRequestException('Embedding failed');
    }
  }

  /**
   * 自然语言语义匹配知识（向量搜索）
   * @keyword-en vector-search
   */
  async vectorSearch(
    query: string,
    apiKey: string,
    opts?: { type?: KnowledgeBookType; limit?: number },
  ): Promise<KnowledgeMatchResult[]> {
    const topK = opts?.limit ?? 5;
    const emb = new OpenAIEmbeddings({
      apiKey,
      model: 'text-embedding-3-small',
    });
    let vec: number[];
    try {
      vec = await emb.embedQuery(query);
    } catch {
      return [];
    }
    const literal = `[${vec.map((v) => (Number.isFinite(v) ? v : 0)).join(',')}]`;

    const typeFilter = opts?.type ? `AND type = '${opts.type}'` : '';
    const rows: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
      distance: number;
    }> = await this.bookRepo.manager.query(
      `SELECT id, name, type, description, embedding <-> '${literal}'::vector AS distance
         FROM knowledge_books
         WHERE is_delete = false AND active = true AND is_embedded = true AND embedding IS NOT NULL ${typeFilter}
         ORDER BY embedding <-> '${literal}'::vector ASC
         LIMIT $1`,
      [topK],
    );

    return rows.map((r) => {
      const d =
        typeof r.distance === 'number' ? r.distance : Number(r.distance);
      return {
        bookId: r.id,
        name: r.name,
        type: r.type as KnowledgeBookType,
        description: r.description,
        score: 1 / (1 + (Number.isFinite(d) ? d : 1)),
      };
    });
  }

  // ========== 辅助 ==========

  /**
   * 断言书本存在
   * @keyword-en assert-book-exists
   */
  private async assertBookExists(bookId: string): Promise<void> {
    const exists = await this.bookRepo.findOne({
      where: { id: bookId, isDelete: false },
    });
    if (!exists)
      throw new NotFoundException(`Knowledge book not found: ${bookId}`);
  }

  /**
   * 实体转响应 DTO
   * @keyword-en to-book-info
   */
  private toBookInfo(entity: KnowledgeBookEntity): KnowledgeBookInfo {
    return {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      description: entity.description,
      creatorId: entity.creatorId,
      isEmbedded: entity.isEmbedded,
      active: entity.active,
      tags: entity.tags ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * 实体转章节信息
   * @keyword-en to-chapter-info
   */
  private toChapterInfo(entity: KnowledgeChapterEntity): KnowledgeChapterInfo {
    return {
      id: entity.id,
      bookId: entity.bookId,
      title: entity.title,
      sortOrder: entity.sortOrder,
      isLmRequired: entity.isLmRequired,
      content: entity.content,
    };
  }
}
