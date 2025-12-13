import type { DatabaseConfig } from './types';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

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
    synchronize: cfg.synchronize ?? false,
    logging: cfg.logging ?? false,
  } as TypeOrmModuleOptions;
}
