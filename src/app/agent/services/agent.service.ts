import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AgentEntity } from '../entities/agent.entity';
import type { QueryAgentDto, UpdateAgentDto } from '../types/agent.types';

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
  ) {}

  async list(query: QueryAgentDto): Promise<AgentEntity[]> {
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
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const current = await this.get(id);
    if (!current) throw new Error('Agent not found');
    current.nickname = dto.nickname;
    if (typeof dto.purpose === 'string') current.purpose = dto.purpose;
    return await this.repo.save(current);
  }

  async delete(id: string): Promise<void> {
    const exist = await this.get(id);
    if (!exist) return;
    await this.repo.softDelete({ id });
  }
}
