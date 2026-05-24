import type { RedisConfig } from './types';

/**
 * @title Redis 配置加载
 * @description 从环境变量读取 Redis 连接配置
 * @keywords-cn Redis配置, 缓存, 连接
 * @keywords-en redis-config, cache, connection
 */
export function loadRedisConfigFromEnv(): RedisConfig {
  const url = process.env.REDIS_URL; // e.g. redis://:pwd@host:6379/0
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10) || 6379;
  const password = process.env.REDIS_PASSWORD;
  const db = parseInt(process.env.REDIS_DB || '0', 10) || 0;
  const tls = (process.env.REDIS_TLS || 'false') === 'true';

  return { host, port, password, db, tls, url };
}
