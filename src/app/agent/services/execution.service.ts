import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentExecutionEntity } from '../entities/agent-execution.entity';
import type {
  QueryExecutionDto,
  UpdateExecutionDto,
} from '../types/agent.types';

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
  ) {}

  async list(query: QueryExecutionDto): Promise<AgentExecutionEntity[]> {
    const where: Record<string, unknown> = { isDelete: false };
    if (query.agentId) where['agentId'] = query.agentId;
    if (query.contextMessageId)
      where['contextMessageId'] = query.contextMessageId;
    return await this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async get(id: string): Promise<AgentExecutionEntity | null> {
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async update(
    id: string,
    dto: UpdateExecutionDto,
  ): Promise<AgentExecutionEntity> {
    const current = await this.get(id);
    if (!current) throw new Error('AgentExecution not found');
    if (dto.nodeStatus) current.nodeStatus = dto.nodeStatus;
    if (dto.latestResponse) current.latestResponse = dto.latestResponse;
    if (typeof dto.contextMessageId === 'string')
      current.contextMessageId = dto.contextMessageId;
    return await this.repo.save(current);
  }

  async delete(id: string): Promise<void> {
    const exist = await this.get(id);
    if (!exist) return;
    await this.repo.softDelete({ id });
  }
}
