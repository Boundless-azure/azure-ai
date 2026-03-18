import { MongoClient, type Db } from 'mongodb';

/**
 * @title Mongo 客户端模块
 * @description 管理 runner 侧 MongoDB 连接与状态检测。
 * @keywords-cn Mongo客户端, 连接检测, 数据库实例
 * @keywords-en mongo-client, connection-check, database-instance
 */
export class RunnerMongoClient {
  private client?: MongoClient;
  private defaultDbName?: string;

  /**
   * @title 建立 Mongo 连接
   * @description 连接 MongoDB 并设置默认数据库名称。
   * @keywords-cn Mongo连接, 默认库, 连接复用
   * @keywords-en mongo-connect, default-db, connection-reuse
   */
  async connect(uri: string, dbName?: string): Promise<Db> {
    if (!this.client) {
      const client = new MongoClient(uri);
      await client.connect();
      this.client = client;
    }
    if (dbName) {
      this.defaultDbName = dbName;
    }
    return this.client.db(dbName ?? this.defaultDbName ?? 'runner');
  }

  /**
   * @title Mongo 心跳检测
   * @description 对指定数据库或默认数据库执行 ping。
   * @keywords-cn Mongo检测, 心跳, 数据库
   * @keywords-en mongo-ping, heartbeat, database
   */
  async ping(dbName?: string): Promise<boolean> {
    if (!this.client) return false;
    const db = this.client.db(dbName ?? this.defaultDbName ?? 'runner');
    try {
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @title 获取数据库实例
   * @description 返回指定数据库或默认数据库的 Db 实例。
   * @keywords-cn 获取数据库, Db实例, 默认库
   * @keywords-en get-db, db-instance, default-db
   */
  getDb(dbName?: string): Db | null {
    if (!this.client) return null;
    return this.client.db(dbName ?? this.defaultDbName ?? 'runner');
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
    this.client = undefined;
    this.defaultDbName = undefined;
  }
}
