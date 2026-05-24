import Redis from 'ioredis';

/**
 * @title Redis 客户端模块
 * @description 管理 runner 侧 Redis 连接与状态检测。
 * @keywords-cn Redis客户端, 连接检测, 缓存连接
 * @keywords-en redis-client, connection-check, cache-connection
 */
export class RunnerRedisClient {
  private client?: Redis;

  async connect(uri: string): Promise<Redis> {
    if (this.client) return this.client;
    const client = new Redis(uri, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await client.connect();
    this.client = client;
    return client;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.quit();
    this.client = undefined;
  }
}
