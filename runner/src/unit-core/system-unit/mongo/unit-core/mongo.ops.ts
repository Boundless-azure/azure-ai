import type { UnitExecutionContext } from '../../../types/unit.types';

/**
 * @title Mongo 能力实现
 * @description 提供 MongoDB 的 CRUD 操作封装。
 * @keywords-cn Mongo实现, CRUD, 数据库操作
 * @keywords-en mongo-ops, crud, db-operations
 */
export const mongoOps = {
  /**
   * @title 插入单条记录
   * @description 在指定数据库/集合插入单条数据。
   * @keywords-cn 插入, 单条记录, Mongo
   * @keywords-en insert-one, single-doc, mongo
   */
  async insertOne(
    ctx: UnitExecutionContext,
    payload: { db?: string; collection: string; doc: Record<string, unknown> },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    const result = await db.collection(payload.collection).insertOne(payload.doc);
    return { insertedId: result.insertedId };
  },

  /**
   * @title 查询记录
   * @description 在指定数据库/集合查询数据并返回结果列表。
   * @keywords-cn 查询, 数据列表, Mongo
   * @keywords-en find, record-list, mongo
   */
  async find(
    ctx: UnitExecutionContext,
    payload: {
      db?: string;
      collection: string;
      filter?: Record<string, unknown>;
      limit?: number;
    },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    const cursor = db.collection(payload.collection).find(payload.filter ?? {});
    if (payload.limit) cursor.limit(payload.limit);
    const items = await cursor.toArray();
    return { items };
  },

  /**
   * @title 更新单条记录
   * @description 在指定数据库/集合更新符合条件的单条数据。
   * @keywords-cn 更新, 单条记录, Mongo
   * @keywords-en update-one, single-doc, mongo
   */
  async updateOne(
    ctx: UnitExecutionContext,
    payload: {
      db?: string;
      collection: string;
      filter: Record<string, unknown>;
      update: Record<string, unknown>;
    },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    const result = await db
      .collection(payload.collection)
      .updateOne(payload.filter, payload.update);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  },

  /**
   * @title 删除单条记录
   * @description 在指定数据库/集合删除符合条件的单条数据。
   * @keywords-cn 删除, 单条记录, Mongo
   * @keywords-en delete-one, single-doc, mongo
   */
  async deleteOne(
    ctx: UnitExecutionContext,
    payload: { db?: string; collection: string; filter: Record<string, unknown> },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    const result = await db.collection(payload.collection).deleteOne(payload.filter);
    return { deletedCount: result.deletedCount };
  },
};
