import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentExecutionEntity } from '../entities/agent-execution.entity';
import type {
  QueryExecutionDto,
  UpdateExecutionDto,
} from '../types/agent.types';
import type { Db, Collection } from 'mongodb';
import type { AgentExecutionDoc } from '@/mongo/types/mongo.types';

/**
 * @title 执行Agent 服务
 * @description 提供执行记录的查询、更新与删除能力（不提供新增）。
 * @keywords-cn 执行Agent服务, 查询, 更新, 删除
 * @keywords-en agent-execution-service, query, update, delete
 */
@Injectable()
export class AgentExecutionService {
  constructor(
    @InjectRepository(AgentExecutionEntity)
    private readonly repo: Repository<AgentExecutionEntity>,
    @Optional() @Inject('MONGO_DB') private readonly mongoDb?: Db,
  ) {}

  async list(query: QueryExecutionDto): Promise<AgentExecutionEntity[]> {
    if (this.useMongo()) {
      const col = this.executionCollection();
      if (!col) return [];
      const filter: Record<string, unknown> = { isDelete: { $ne: true } };
      if (query.agentId) filter['agentId'] = query.agentId;
      if (query.contextMessageId)
        filter['contextMessageId'] = query.contextMessageId;
      const docs = await col
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();
      return docs.map((d) => this.toEntity(d));
    }
    const where: Record<string, unknown> = { isDelete: false };
    if (query.agentId) where['agentId'] = query.agentId;
    if (query.contextMessageId)
      where['contextMessageId'] = query.contextMessageId;
    return await this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async get(id: string): Promise<AgentExecutionEntity | null> {
    if (this.useMongo()) {
      const col = this.executionCollection();
      if (!col) return null;
      const doc = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
      return doc ? this.toEntity(doc) : null;
    }
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async update(
    id: string,
    dto: UpdateExecutionDto,
  ): Promise<AgentExecutionEntity> {
    if (this.useMongo()) {
      const col = this.executionCollection();
      if (!col) throw new Error('MongoDB not available');
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (dto.nodeStatus) patch['nodeStatus'] = dto.nodeStatus;
      if (dto.latestResponse) patch['latestResponse'] = dto.latestResponse;
      if (typeof dto.contextMessageId === 'string')
        patch['contextMessageId'] = dto.contextMessageId;
      await col.updateOne({ _id: id } as unknown as Record<string, unknown>, {
        $set: patch,
      });
      const saved = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
      if (!saved) throw new Error('Execution update failed');
      return this.toEntity(saved);
    }
    const current = await this.get(id);
    if (!current) throw new Error('AgentExecution not found');
    if (dto.nodeStatus) current.nodeStatus = dto.nodeStatus;
    if (dto.latestResponse) current.latestResponse = dto.latestResponse;
    if (typeof dto.contextMessageId === 'string')
      current.contextMessageId = dto.contextMessageId;
    return await this.repo.save(current);
  }

  async delete(id: string): Promise<void> {
    if (this.useMongo()) {
      const col = this.executionCollection();
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

  private executionCollection(): Collection<AgentExecutionDoc> | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<AgentExecutionDoc>('agent_executions');
  }

  private toEntity(doc: AgentExecutionDoc): AgentExecutionEntity {
    const e = new AgentExecutionEntity();
    (e as unknown as { id?: string }).id = doc._id ?? '';
    (e as unknown as { agentId?: string }).agentId = doc.agentId;
    e.nodeStatus = doc.nodeStatus ?? null;
    e.latestResponse = doc.latestResponse ?? null;
    e.contextMessageId = doc.contextMessageId ?? null;
    (e as unknown as { createdAt?: Date }).createdAt =
      doc.createdAt ?? new Date();
    (e as unknown as { updatedAt?: Date }).updatedAt =
      doc.updatedAt ?? new Date();
    (e as unknown as { isDelete?: boolean }).isDelete = doc.isDelete ?? false;
    return e;
  }
}
