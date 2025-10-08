import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  RedisClientLike,
  RedisKeySpaceQuery,
  RedisJSONOptions,
} from '../types/client';

/**
 * Redis 通用服务（CommonRedisService）
 *
 * 说明：
 * - 为常见的 Redis 操作提供 IDE 友好的封装（字符串、哈希、JSON 读写、按模式扫描与删除等）。
 * - 当未提供 REDIS_CLIENT（例如未安装或未连接 ioredis）时，服务仍可被注入；
 *   此时 `isAvailable()` 返回 false，调用带网络操作的方法会在内部通过 `ensureClient()` 抛出易理解的错误。
 * - 所有公开方法均带有 JSDoc 注释与类型签名，便于 IDE 自动提示与文档预览。
 *
 * 使用示例：
 * ```ts
 * // 任意可注入位置
 * constructor(private readonly redis: CommonRedisService) {}
 *
 * async demo() {
 *   if (!this.redis.isAvailable()) return; // 可降级处理
 *   await this.redis.setString('k', 'v', 60);
 *   const v = await this.redis.getString('k'); // => 'v'
 * }
 * ```
 */
@Injectable()
export class CommonRedisService {
  private readonly logger = new Logger(CommonRedisService.name);

  constructor(
    @Optional()
    @Inject('REDIS_CLIENT')
    private readonly client?: RedisClientLike,
  ) {}

  /**
   * 当前服务是否具备可用的 Redis 客户端。
   * @returns 若已注入并可用则为 true；否则为 false。
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * 读取字符串值。
   * @param key 键名。
   * @returns 对应值，若不存在则为 null。
   * @throws 当未提供 Redis 客户端时抛出错误（请先调用 `isAvailable()` 进行判断）。
   */
  async getString(key: string): Promise<string | null> {
    this.ensureClient();
    return await this.client!.get(key);
  }

  /**
   * 写入字符串值，并可选设置过期时间。
   * @param key 键名。
   * @param value 字符串值。
   * @param ttlSeconds 过期时间（秒），缺省不设置过期。
   * @returns 是否成功（OK）。
   * @throws 当未提供 Redis 客户端时抛出错误。
   */
  async setString(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<boolean> {
    this.ensureClient();
    const res = await this.client!.set(
      key,
      value,
      ttlSeconds ? 'EX' : undefined,
      ttlSeconds,
    );
    return res === 'OK';
  }

  /**
   * 删除多个键。
   * @param keys 待删除的键列表。
   * @returns 实际删除数量。
   * @throws 当未提供 Redis 客户端时抛出错误。
   */
  async delKeys(keys: string[]): Promise<number> {
    this.ensureClient();
    if (!keys.length) return 0;
    return await this.client!.del(...keys);
  }

  /**
   * 读取哈希所有字段。
   * @param key 哈希键名。
   * @returns 字段-值映射，若不存在则为空对象。
   * @throws 当未提供 Redis 客户端时抛出错误。
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    this.ensureClient();
    return await this.client!.hgetall(key);
  }

  /**
   * 读取哈希指定字段。
   * @param key 哈希键名。
   * @param field 字段名。
   * @returns 字段值，若不存在则为 null。
   * @throws 当未提供 Redis 客户端时抛出错误。
   */
  async hGet(key: string, field: string): Promise<string | null> {
    this.ensureClient();
    return await this.client!.hget(key, field);
  }

  /**
   * 写入哈希指定字段。
   * @param key 哈希键名。
   * @param field 字段名。
   * @param value 字段值（字符串）。
   * @returns 受影响字段数量。
   * @throws 当未提供 Redis 客户端时抛出错误。
   */
  async hSet(key: string, field: string, value: string): Promise<number> {
    this.ensureClient();
    return await this.client!.hset(key, field, value);
  }

  /**
   * 读取并解析为 JSON。
   * @typeParam T 预期的 JSON 类型。
   * @param key 键名。
   * @returns 解析后的对象；不存在或解析失败返回 null。
   * @remarks 解析失败会记录告警日志而不抛错。
   */
  async getJSON<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.getString(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      this.logger.warn(`Invalid JSON at key ${key}: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 序列化对象为 JSON 字符串并写入。
   * @param key 键名。
   * @param value 任意可序列化的对象。
   * @param options 可选项（如 ttlSeconds 过期时间）。
   * @returns 是否写入成功。
   * @remarks 序列化失败会记录错误日志并返回 false。
   */
  async setJSON(
    key: string,
    value: unknown,
    options?: RedisJSONOptions,
  ): Promise<boolean> {
    try {
      const str = JSON.stringify(value);
      return await this.setString(key, str, options?.ttlSeconds);
    } catch (e) {
      this.logger.error(
        `Failed to serialize JSON for key ${key}: ${(e as Error).message}`,
      );
      return false;
    }
  }

  /**
   * 按模式扫描键空间（使用 Redis SCAN）。
   * @param query 扫描条件（pattern 默认 '*'，count 批次大小默认 100）。
   * @returns 所有匹配的键名列表。
   * @remarks SCAN 为游标遍历，适合大键空间；返回键可能在扫描期间发生变化。
   * @throws 当未提供 Redis 客户端时抛出错误。
   */
  async scanKeys(query: RedisKeySpaceQuery): Promise<string[]> {
    this.ensureClient();
    const pattern = query.pattern || '*';
    const count = query.count ?? 100;
    let cursor = 0;
    const keys: string[] = [];

    do {
      const [nextCursor, batch] = await this.client!.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );
      cursor = parseInt(nextCursor, 10);
      keys.push(...batch);
    } while (cursor !== 0);

    return keys;
  }

  /**
   * 根据模式删除全部匹配键。
   * @param pattern 键名匹配模式。
   * @param countPerPage SCAN 每批数量（默认 200）。
   * @returns 删除数量。
   * @remarks 操作具破坏性，请谨慎使用；内部基于 `scanKeys` + `delKeys`。
   */
  async deleteByPattern(pattern: string, countPerPage = 200): Promise<number> {
    const keys = await this.scanKeys({ pattern, count: countPerPage });
    return await this.delKeys(keys);
  }

  /**
   * 根据模式筛选键，其值满足提供的判定函数。
   * @param pattern 键名匹配模式。
   * @param predicate 值判定函数（接收字符串或 null）。
   * @returns 满足条件的键名列表。
   * @remarks 对大量键会产生较多读操作，请合理设置模式以控制范围。
   */
  async filterKeysByValue(
    pattern: string,
    predicate: (value: string | null) => boolean,
  ): Promise<string[]> {
    const keys = await this.scanKeys({ pattern });
    const result: string[] = [];
    for (const key of keys) {
      const val = await this.getString(key);
      if (predicate(val)) result.push(key);
    }
    return result;
  }

  /**
   * 断言当前服务有可用的 Redis 客户端，否则抛出明确错误。
   * @throws 当 `client` 不可用时抛出错误。
   * @example
   * if (!service.isAvailable()) return; // 在调用前进行可用性检查
   */
  private ensureClient(): void {
    if (!this.client) {
      throw new Error(
        'Redis client is not available. Please provide REDIS_CLIENT provider or install a Redis client library.',
      );
    }
  }
}
