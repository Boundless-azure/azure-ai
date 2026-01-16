import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { AgentEntity } from '../entities/agent.entity';
import type { QueryAgentDto, UpdateAgentDto } from '../types/agent.types';
import type { Db, Collection } from 'mongodb';
import type { AgentDoc } from '@/mongo/types/mongo.types';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { AIProvider } from '@core/ai/types';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

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
      const doc = await col.findOne({ _id: id });
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
      if (
        m.provider === AIProvider.OPENAI &&
        typeof m.apiKey === 'string' &&
        m.apiKey
      ) {
        return m.apiKey;
      }
    }
    return undefined;
  }

  private async pickGeminiKey(): Promise<string | undefined> {
    if (!this.aiModelService) return undefined;
    const models = await this.aiModelService.getEnabledModels();
    for (const m of models) {
      if (
        m.provider === AIProvider.GEMINI &&
        typeof m.apiKey === 'string' &&
        m.apiKey
      ) {
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

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) throw new Error('MongoDB not available');
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      patch['nickname'] = dto.nickname;
      if (typeof dto.purpose === 'string') patch['purpose'] = dto.purpose;
      await col.updateOne({ _id: id }, { $set: patch });
      const saved = await col.findOne({ _id: id });
      if (!saved) throw new Error('Agent update failed');
      return this.toEntity(saved);
    }
    const current = await this.get(id);
    if (!current) throw new Error('Agent not found');
    current.nickname = dto.nickname;
    if (typeof dto.purpose === 'string') current.purpose = dto.purpose;
    return await this.repo.save(current);
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
    e.createdAt = doc.createdAt ?? new Date();
    e.updatedAt = doc.updatedAt ?? new Date();
    e.isDelete = doc.isDelete ?? false;
    return e;
  }
}
