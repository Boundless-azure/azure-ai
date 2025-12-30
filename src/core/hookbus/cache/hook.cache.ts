import { Injectable } from '@nestjs/common';
import { CommonRedisService } from '@/redis/services/common.service';

/**
 * @title Hook 缓存服务
 * @description 使用 Redis 存储 Hook 最近状态或统计信息，便于外部工具查询。
 * @keywords-cn Hook缓存, 状态统计, Redis
 * @keywords-en hook-cache, status-stats, redis
 */
@Injectable()
export class HookCacheService {
  constructor(private readonly redis: CommonRedisService) {}

  async recordStatus(hook: string, status: string): Promise<void> {
    if (!this.redis.isAvailable()) return;
    const key = `hookbus:status:${hook}`;
    await this.redis.setString(key, status, 300);
  }

  async getStatus(hook: string): Promise<string | null> {
    if (!this.redis.isAvailable()) return null;
    const key = `hookbus:status:${hook}`;
    return await this.redis.getString(key);
  }
}
