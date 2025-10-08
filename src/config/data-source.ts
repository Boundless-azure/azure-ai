import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
// 在 TypeORM 0.3.x 中，具体驱动的连接选项类型不从根导出，需要从 driver 路径导入
import type { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';
import * as dotenv from 'dotenv';
import { loadDatabaseConfigFromEnv } from './database.config';
import type { DatabaseConfig } from './types';

dotenv.config({ path: '.env' });

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
    } satisfies MysqlConnectionOptions;
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
    } satisfies PostgresConnectionOptions;
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
    } satisfies SqliteConnectionOptions;
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
    } satisfies MysqlConnectionOptions;
    options = fallback;
  }
}

export default new DataSource(options);
