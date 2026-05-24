import { Injectable } from '@nestjs/common';
import { CommonRedisService } from '@/redis/services/common.service';
import { AgentEntity } from '../entities/agent.entity';

/**
 * @title Agent 缓存
 * @description 基于 Redis 的 Agent 读写缓存封装。
 * @keywords-cn Agent缓存, Redis, JSON缓存
 * @keywords-en agent-cache, redis, json-cache
 */
@Injectable()
export class AgentCache {
  constructor(private readonly redis: CommonRedisService) {}

  private key(id: string): string {
    return `agent:${id}`;
  }

  async get(id: string): Promise<AgentEntity | null> {
    if (!this.redis.isAvailable()) return null;
    return await this.redis.getJSON<AgentEntity>(this.key(id));
  }

  async set(
    id: string,
    value: AgentEntity,
    ttlSeconds = 300,
  ): Promise<boolean> {
    if (!this.redis.isAvailable()) return false;
    return await this.redis.setJSON(this.key(id), value, { ttlSeconds });
  }

  async invalidate(id: string): Promise<void> {
    if (!this.redis.isAvailable()) return;
    await this.redis.delKeys([this.key(id)]);
  }
}
