import type { DatabaseConfig } from './types';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function loadDatabaseConfigFromEnv(): DatabaseConfig {
  const type = (process.env.DB_TYPE || 'mysql') as DatabaseConfig['type'];
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10) || 3306;
  const username = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_DATABASE || 'azure_ai_dev';
  const synchronize =
    ((process.env.DB_SYNC ?? process.env.DB_SYNCHRONIZE) || 'false') === 'true';
  const logging = process.env.NODE_ENV === 'development';

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
