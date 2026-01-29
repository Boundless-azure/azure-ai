import type { DatabaseConfig } from './types';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * @title 数据库配置加载
 * @description 从环境变量读取数据库连接配置
 * @keywords-cn 数据库配置, 环境变量, TypeORM, PostgreSQL
 * @keywords-en database-config, env, typeorm, postgresql
 */
export function loadDatabaseConfigFromEnv(): DatabaseConfig {
  const type = (process.env.DB_TYPE || 'postgres') as DatabaseConfig['type'];
  const host = process.env.DB_HOST || 'localhost';
  const defaultPort = type === 'postgres' ? 5432 : type === 'sqlite' ? 0 : 3306;
  const port =
    parseInt(process.env.DB_PORT || String(defaultPort), 10) || defaultPort;
  const username = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_DATABASE || 'azure_ai_dev';
  const synchronize =
    ((process.env.DB_SYNC ?? process.env.DB_SYNCHRONIZE) || 'false') === 'true';
  const logging = false;

  return {
    type,
    host,
    port,
    username,
    password,
    database,
    synchronize,
    logging,
  };
}

/**
 * @title 创建 TypeORM 配置选项
 * @description 基于数据库配置生成 TypeORM 模块选项
 * @param cfg 数据库配置对象
 * @returns TypeORM 模块配置选项
 * @keywords-cn TypeORM选项, 模块配置, 实体加载
 * @keywords-en typeorm-options, module-config, entity-loader
 */
export function createTypeOrmOptions(
  cfg: DatabaseConfig,
): TypeOrmModuleOptions {
  return {
    type: cfg.type,
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    password: cfg.password,
    database: cfg.database,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    autoLoadEntities: true,
    synchronize: cfg.synchronize ?? false,
    logging: cfg.logging ?? false,
  };
}
