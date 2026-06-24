import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { AgentEntity } from '../entities/agent.entity';
import { AgentKnowledgeAssignmentEntity } from '../entities/agent-knowledge-assignment.entity';
import type {
  QueryAgentDto,
  UpdateAgentDto,
  AgentKnowledgeAssignmentState,
} from '../types/agent.types';
import type { Db, Collection } from 'mongodb';
import type { AgentDoc } from '@/mongo/types/mongo.types';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { KnowledgeBookEntity } from '@/app/knowledge/entities/knowledge-book.entity';
import { LOCAL_BOOKS } from '@/app/knowledge/local/local-knowledge.seed';

/**
 * @title Agent 服务
 * @description 提供 Agent 的查询、更新与删除能力（不提供新增）。
 * @keywords-cn Agent服务, 查询, 更新, 删除
 * @keywords-en agent-service, query, update, delete
 */
@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly repo: Repository<AgentEntity>,
    @InjectRepository(AgentKnowledgeAssignmentEntity)
    private readonly knowledgeAssignmentRepo: Repository<AgentKnowledgeAssignmentEntity>,
    @InjectRepository(KnowledgeBookEntity)
    private readonly knowledgeBookRepo: Repository<KnowledgeBookEntity>,
    @Optional() @Inject('MONGO_DB') private readonly mongoDb?: Db,
    private readonly aiModelService?: AIModelService,
  ) {}

  async list(query: QueryAgentDto): Promise<AgentEntity[]> {
    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) return [];
      const filter: Record<string, unknown> = { isDelete: { $ne: true } };
      let cursor = col.find(filter).sort({ createdAt: -1 }).limit(500);
      if (query.q && query.q.trim()) {
        const q = query.q.trim();
        cursor = col
          .find({
            ...filter,
            $or: [
              { nickname: { $regex: q, $options: 'i' } },
              { purpose: { $regex: q, $options: 'i' } },
              { codeDir: { $regex: q, $options: 'i' } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(500);
      }
      const docs = await cursor.toArray();
      return docs.map((d) => this.toEntity(d));
    }
    const where: Record<string, unknown> = {};
    if (query.q && query.q.trim()) {
      const q = `%${query.q.trim()}%`;
      return await this.repo.find({
        where: [
          { nickname: Like(q), isDelete: false },
          { purpose: Like(q), isDelete: false },
          { codeDir: Like(q), isDelete: false },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return await this.repo.find({
      where: { ...where, isDelete: false },
      order: { createdAt: 'DESC' },
    });
  }

  async get(id: string): Promise<AgentEntity | null> {
    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) return null;
      const doc = await col.findOne({ _id: id } as Record<string, unknown>);
      return doc ? this.toEntity(doc) : null;
    }
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  /**
   * @title 更新Agent向量
   * @description 使用 Gemini 生成向量并写入 embedding 列；支持全量或指定ID列表，自动调整维度以匹配列。
   * @keywords-cn 向量更新, 批量, GeminiEmbeddings
   * @keywords-en embeddings-update, batch, gemini-embeddings
   */
  async updateEmbeddings(ids?: string[]): Promise<{
    updated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const list =
      ids && ids.length
        ? await this.repo.find({
            where: { id: In(ids), isDelete: false, active: true },
          })
        : await this.repo.find({ where: { isDelete: false, active: true } });

    const apiKey = await this.pickGeminiKey();
    if (!apiKey) {
      return {
        updated: 0,
        errors: [{ id: 'ALL', error: 'No Gemini API key available' }],
      };
    }

    const emb = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: 'text-embedding-004',
    });
    const columnDim = 1536;
    let updated = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const a of list) {
      try {
        const text = this.composeText(a);
        const vec = await emb.embedQuery(text);
        const adjusted = this.adjustVector(vec, columnDim);
        const literal = `[${adjusted.map((v) => (Number.isFinite(v) ? Number(v) : 0)).join(',')}]`;
        const isPg = await this.isPostgresDb();
        if (isPg) {
          await this.repo.manager.query(
            `UPDATE agents SET embedding = CAST($2 AS vector) WHERE id = $1`,
            [a.id, literal],
          );
        } else {
          await this.repo.update({ id: a.id }, { embedding: literal });
        }
        updated += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ id: a.id, error: msg });
      }
    }

    return { updated, errors };
  }

  /**
   * @title 获取 Agent 知识分配状态
   * @description 返回 Agent 当前生效的知识绑定结果，本地知识默认包含在 assignedBookIds 内。
   * @keywords-cn Agent知识分配, 生效知识, 本地默认
   * @keywords-en get-agent-knowledge-assignments, effective-knowledge, local-default
   */
  async getKnowledgeAssignments(
    agentId: string,
  ): Promise<AgentKnowledgeAssignmentState> {
    await this.assertAgentExists(agentId);
    const localBookIds = this.getLocalKnowledgeBookIds();
    const customAssignments = await this.knowledgeAssignmentRepo.find({
      where: { agentId, isDelete: false },
      order: { createdAt: 'ASC' },
    });
    const customBookIds = customAssignments.map((item) => item.bookId);
    return {
      agentId,
      localBookIds,
      customBookIds,
      assignedBookIds: [...localBookIds, ...customBookIds],
    };
  }

  /**
   * @title 更新 Agent 知识分配
   * @description 覆盖 Agent 的自定义知识绑定；本地知识不会落库，但始终自动生效。
   * @keywords-cn Agent知识分配更新, 自定义知识, 覆盖保存
   * @keywords-en update-agent-knowledge-assignments, custom-knowledge, replace-save
   */
  async updateKnowledgeAssignments(
    agentId: string,
    bookIds: string[],
  ): Promise<AgentKnowledgeAssignmentState> {
    await this.assertAgentExists(agentId);

    const normalizedIds = this.normalizeKnowledgeBookIds(bookIds);
    const localBookIds = new Set(this.getLocalKnowledgeBookIds());
    const customBookIds = normalizedIds.filter((id) => !localBookIds.has(id));

    await this.assertKnowledgeBooksExist(customBookIds);

    await this.knowledgeAssignmentRepo.update(
      { agentId, isDelete: false },
      { isDelete: true, deletedAt: new Date() },
    );

    if (customBookIds.length > 0) {
      const entities = customBookIds.map((bookId) =>
        this.knowledgeAssignmentRepo.create({
          agentId,
          bookId,
          isDelete: false,
          deletedAt: null,
        }),
      );
      await this.knowledgeAssignmentRepo.save(entities);
    }

    return await this.getKnowledgeAssignments(agentId);
  }

  private composeText(a: AgentEntity): string {
    const parts: string[] = [];
    if (a.nickname) parts.push(a.nickname);
    if (a.purpose) parts.push(a.purpose);
    if (a.codeDir) parts.push(a.codeDir);
    const kws = Array.isArray(
      (a as unknown as { keywords?: string[] }).keywords,
    )
      ? ((a as unknown as { keywords?: string[] }).keywords as string[])
      : [];
    if (kws.length) parts.push(kws.join(', '));
    return parts.join(' | ').toLowerCase();
  }

  private async pickOpenAIKey(): Promise<string | undefined> {
    if (!this.aiModelService) return undefined;
    const models = await this.aiModelService.getEnabledModels();
    for (const m of models) {
      if (m.provider === 'openai' && typeof m.apiKey === 'string' && m.apiKey) {
        return m.apiKey;
      }
    }
    return undefined;
  }

  private async pickGeminiKey(): Promise<string | undefined> {
    if (!this.aiModelService) return undefined;
    const models = await this.aiModelService.getEnabledModels();
    for (const m of models) {
      if (m.provider === 'gemini' && typeof m.apiKey === 'string' && m.apiKey) {
        return m.apiKey;
      }
    }
    return undefined;
  }

  private adjustVector(v: number[], dim: number): number[] {
    if (Array.isArray(v)) {
      if (v.length === dim) return v;
      if (v.length > dim) return v.slice(0, dim);
      const pad = new Array(dim - v.length).fill(0);
      return v.concat(pad);
    }
    return new Array<number>(dim).fill(0);
  }

  private async isPostgresDb(): Promise<boolean> {
    try {
      const res: unknown = await this.repo.manager.query('SELECT version()');
      const first = Array.isArray(res) && res.length > 0 ? res[0] : undefined;
      const txt =
        first && this.isRecord(first) ? String(Object.values(first)[0]) : '';
      return txt.toLowerCase().includes('postgres');
    } catch {
      return false;
    }
  }

  private isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
  }

  /**
   * @title 断言 Agent 存在
   * @description 校验目标 Agent 是否存在，不存在时抛出 404。
   * @keywords-cn Agent存在校验, 404, 前置检查
   * @keywords-en assert-agent-exists, not-found, precheck
   */
  private async assertAgentExists(agentId: string): Promise<void> {
    const agent = await this.get(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${agentId}`);
    }
  }

  /**
   * @title 获取本地知识书本 ID
   * @description 返回所有本地预置知识的 bookId 列表，作为 Agent 默认知识集合。
   * @keywords-cn 本地知识ID, 默认知识, 预置书本
   * @keywords-en local-knowledge-ids, default-knowledge, preset-books
   */
  private getLocalKnowledgeBookIds(): string[] {
    return LOCAL_BOOKS.map((book) => book.id);
  }

  /**
   * @title 规范化知识书本 ID 列表
   * @description 去重并移除空字符串，保持提交顺序。
   * @keywords-cn 知识ID规范化, 去重, 顺序保留
   * @keywords-en normalize-knowledge-book-ids, dedupe, preserve-order
   */
  private normalizeKnowledgeBookIds(bookIds: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of bookIds ?? []) {
      const bookId = typeof raw === 'string' ? raw.trim() : '';
      if (!bookId || seen.has(bookId)) continue;
      seen.add(bookId);
      normalized.push(bookId);
    }
    return normalized;
  }

  /**
   * @title 校验知识书本存在性
   * @description 仅允许绑定有效且未删除的数据库知识书本；本地知识不经此校验。
   * @keywords-cn 知识存在校验, 数据库知识, 非法ID
   * @keywords-en assert-knowledge-books-exist, database-books, invalid-id
   */
  private async assertKnowledgeBooksExist(bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) return;
    const books = await this.knowledgeBookRepo.find({
      where: { id: In(bookIds), isDelete: false, active: true },
      select: ['id'],
    });
    const existing = new Set(books.map((item) => item.id));
    const missing = bookIds.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Knowledge books not found or inactive: ${missing.join(', ')}`,
      );
    }
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const nextAiModelIds = Array.isArray(dto.aiModelIds)
      ? await this.validateAiModelIds(dto.aiModelIds)
      : undefined;

    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) throw new Error('MongoDB not available');
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof dto.nickname === 'string') patch['nickname'] = dto.nickname;
      if (typeof dto.purpose === 'string') patch['purpose'] = dto.purpose;
      if (typeof dto.avatarUrl === 'string') patch['avatarUrl'] = dto.avatarUrl;
      if (nextAiModelIds) {
        patch['aiModelIds'] = nextAiModelIds;
      }
      await col.updateOne({ _id: id }, { $set: patch });
      const saved = await col.findOne({ _id: id });
      if (!saved) throw new Error('Agent update failed');
      return this.toEntity(saved);
    }
    const current = await this.get(id);
    if (!current) throw new Error('Agent not found');
    if (typeof dto.nickname === 'string') current.nickname = dto.nickname;
    if (typeof dto.purpose === 'string') current.purpose = dto.purpose;
    if (typeof dto.avatarUrl === 'string') current.avatarUrl = dto.avatarUrl;
    if (nextAiModelIds) {
      current.aiModelIds = nextAiModelIds;
    }
    if (typeof dto.proactiveChatEnabled === 'boolean') {
      current.proactiveChatEnabled = dto.proactiveChatEnabled;
    }
    return await this.repo.save(current);
  }

  /**
   * 校验 Agent 模型槽位必须保存 ai_models.id，不接受模型 name。
   * @keyword-en validate-agent-model-ids, model-slot-id
   */
  private async validateAiModelIds(modelIds: string[]): Promise<string[]> {
    const normalized = modelIds.map((item) => item.trim()).filter(Boolean);
    if (!normalized.length) return [];
    if (!this.aiModelService) return normalized;

    const invalid: string[] = [];
    for (const modelId of normalized) {
      const resolved = await this.aiModelService.resolveModelIdByIds([modelId]);
      if (!resolved) invalid.push(modelId);
    }

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Agent aiModelIds must be active ai_models.id values: ${invalid.join(', ')}`,
      );
    }

    return normalized;
  }

  async delete(id: string): Promise<void> {
    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) return;
      await col.updateOne(
        { _id: id },
        { $set: { isDelete: true, updatedAt: new Date() } },
      );
      return;
    }
    const exist = await this.get(id);
    if (!exist) return;
    await this.repo.softDelete({ id });
  }

  private useMongo(): boolean {
    return (process.env.MONGO_ENABLED ?? 'false') === 'true' && !!this.mongoDb;
  }

  private agentCollection(): Collection<AgentDoc> | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<AgentDoc>('agents');
  }

  private toEntity(doc: AgentDoc): AgentEntity {
    const e = new AgentEntity();
    e.id = doc._id ?? '';
    e.codeDir = doc.codeDir;
    e.nickname = doc.nickname;
    e.avatarUrl =
      typeof doc.avatarUrl === 'string' && doc.avatarUrl.trim()
        ? doc.avatarUrl.trim()
        : null;
    e.principalId =
      typeof doc.principalId === 'string' && doc.principalId.trim()
        ? doc.principalId
        : null;
    e.isAiGenerated = doc.isAiGenerated;
    e.purpose = doc.purpose;
    if (typeof doc.embedding === 'string') {
      e.embedding = doc.embedding;
    } else if (Array.isArray(doc.embedding)) {
      const arr = doc.embedding.map((v) =>
        Number.isFinite(Number(v)) ? Number(v) : 0,
      );
      e.embedding = `[${arr.join(',')}]`;
    } else {
      e.embedding = null;
    }
    e.keywords = Array.isArray(doc.keywords) ? doc.keywords : null;
    e.nodes = doc.nodes;
    e.active = doc.active;
    e.aiModelIds = Array.isArray(doc.aiModelIds)
      ? doc.aiModelIds.map((item) => item.trim())
      : null;
    e.createdAt = doc.createdAt ?? new Date();
    e.updatedAt = doc.updatedAt ?? new Date();
    e.isDelete = doc.isDelete ?? false;
    return e;
  }
}
