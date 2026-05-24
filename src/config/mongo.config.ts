import type { MongoModuleOptions } from '../mongo/types/mongo.types';

/**
 * @title Mongo 配置加载
 * @description 从环境变量读取 Mongo 相关配置。
 * @keywords-cn Mongo配置, 环境变量, 加载
 * @keywords-en mongo-config, env, loader
 */
export function loadMongoConfigFromEnv(): MongoModuleOptions {
  const enabled = (process.env.MONGO_ENABLED ?? 'false') === 'true';
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB ?? 'azure_ai_dev';
  return { enabled, uri, dbName };
}
