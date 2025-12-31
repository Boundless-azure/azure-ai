import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AgentEntity } from '../entities/agent.entity';
import type { QueryAgentDto, UpdateAgentDto } from '../types/agent.types';
import type { Db, Collection } from 'mongodb';
import type { AgentDoc } from '@/mongo/types/mongo.types';

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
  ) {}

  async list(query: QueryAgentDto): Promise<AgentEntity[]> {
    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) return [];
      const filter: Record<string, unknown> = { isDelete: { $ne: true } };
      if (query.conversationGroupId)
        filter['conversationGroupId'] = query.conversationGroupId;
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
    if (query.conversationGroupId)
      where['conversationGroupId'] = query.conversationGroupId;
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
      const doc = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
      return doc ? this.toEntity(doc) : null;
    }
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    if (this.useMongo()) {
      const col = this.agentCollection();
      if (!col) throw new Error('MongoDB not available');
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      patch['nickname'] = dto.nickname;
      if (typeof dto.purpose === 'string') patch['purpose'] = dto.purpose;
      await col.updateOne({ _id: id } as unknown as Record<string, unknown>, {
        $set: patch,
      });
      const saved = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
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
      await col.updateOne({ _id: id } as unknown as Record<string, unknown>, {
        $set: { isDelete: true, updatedAt: new Date() },
      });
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
    (e as unknown as { id?: string }).id = doc._id ?? '';
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
    e.keywords = Array.isArray(
      (doc as unknown as { keywords?: string[] | null }).keywords,
    )
      ? ((doc as unknown as { keywords?: string[] | null })
          .keywords as string[])
      : null;
    e.nodes = doc.nodes;
    e.conversationGroupId = doc.conversationGroupId;
    e.active = doc.active;
    (e as unknown as { createdAt?: Date }).createdAt =
      doc.createdAt ?? new Date();
    (e as unknown as { updatedAt?: Date }).updatedAt =
      doc.updatedAt ?? new Date();
    (e as unknown as { isDelete?: boolean }).isDelete = doc.isDelete ?? false;
    return e;
  }
}
