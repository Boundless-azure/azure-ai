import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { loadDatabaseConfigFromEnv } from './database.config';
import type { DatabaseConfig } from './types';

dotenv.config({ path: '.env' });

/**
 * @title TypeORM 数据源配置
 * @description 配置并导出 TypeORM 数据源实例，用于 CLI 和应用连接
 * @keywords-cn 数据源, TypeORM, 实例, CLI
 * @keywords-en data-source, typeorm, instance, cli
 */
const db: DatabaseConfig = loadDatabaseConfigFromEnv();

let options: DataSourceOptions;

switch (db.type) {
  case 'mysql': {
    const mysqlOpts = {
      type: 'mysql',
      host: db.host ?? 'localhost',
      port: db.port ?? 3306,
      username: db.username ?? 'root',
      password: db.password,
      database: db.database ?? 'azure_ai_dev',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
      synchronize: db.synchronize ?? false,
      logging: db.logging ?? false,
    } satisfies DataSourceOptions;
    options = mysqlOpts;
    break;
  }
  case 'postgres': {
    const pgOpts = {
      type: 'postgres',
      host: db.host ?? 'localhost',
      port: db.port ?? 5432,
      username: db.username ?? 'postgres',
      password: db.password,
      database: db.database ?? 'azure_ai_dev',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
      synchronize: db.synchronize ?? false,
      logging: db.logging ?? false,
    } satisfies DataSourceOptions;
    options = pgOpts;
    break;
  }
  case 'sqlite': {
    const sqliteOpts = {
      type: 'sqlite',
      database: db.database ?? 'azure_ai_dev.sqlite',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
      synchronize: db.synchronize ?? false,
      logging: db.logging ?? false,
    } satisfies DataSourceOptions;
    options = sqliteOpts;
    break;
  }
  default: {
    // Fallback to mysql to keep DS initialization valid
    const fallback = {
      type: 'mysql',
      host: db.host ?? 'localhost',
      port: db.port ?? 3306,
      username: db.username ?? 'root',
      password: db.password,
      database: db.database ?? 'azure_ai_dev',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
      synchronize: db.synchronize ?? false,
      logging: db.logging ?? false,
    } satisfies DataSourceOptions;
    options = fallback;
  }
}

export default new DataSource(options);
