import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import type { Db, MongoClient } from 'mongodb';

/**
 * @title Mongo 客户端服务
 * @description 管理 MongoClient 生命周期并提供数据库实例。
 * @keywords-cn Mongo客户端, 数据库, 连接, 生命周期
 * @keywords-en mongo-client, database, connection, lifecycle
 */
@Injectable()
export class MongoClientService implements OnModuleDestroy {
  private client?: MongoClient;
  private db?: Db;

  constructor(@Inject('MONGO_OPTIONS') private readonly opts?: unknown) {}

  async connect(options: {
    uri?: string;
    dbName?: string;
  }): Promise<Db | undefined> {
    try {
      const mod = (await import('mongodb').catch(() => undefined)) as
        | typeof import('mongodb')
        | undefined;
      if (!mod) return undefined;
      const uri =
        options.uri ?? process.env.MONGO_URI ?? 'mongodb://localhost:27017';
      const dbName = options.dbName ?? process.env.MONGO_DB ?? 'azure_ai_dev';
      const client = new mod.MongoClient(uri);
      await client.connect();
      this.client = client;
      this.db = client.db(dbName);
      return this.db;
    } catch {
      return undefined;
    }
  }

  getDb(): Db | undefined {
    return this.db;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* noop */
      }
    }
  }
}
