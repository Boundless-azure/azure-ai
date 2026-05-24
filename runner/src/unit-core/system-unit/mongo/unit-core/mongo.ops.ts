import type { UnitExecutionContext } from '../../../types/unit.types';

type UpdateOp = {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  multi?: boolean;
  upsert?: boolean;
};

type DeleteOp = {
  filter: Record<string, unknown>;
  multi?: boolean;
};

/**
 * @title Mongo 能力实现 (批量化)
 * @description 提供 MongoDB 的 CRUD 操作封装。
 *   写操作 (insert / update / delete) 统一接收数组, 内部走 mongo bulkWrite, 单条作为长度 1 的数组传入。
 *   写操作均由 hook 声明 denyLlm:true, LLM 不可直接调用; 业务通过 AI 产代码或上层 runner.app.* hook 间接调。
 * @keywords-cn Mongo实现, CRUD, 批量, bulkWrite, 拒绝LLM
 * @keywords-en mongo-ops, crud, batch, bulk-write, deny-llm
 */
export const mongoOps = {
  /**
   * 批量插入文档; 内部走 insertMany (mongo 原生最优批量路径), 返回插入条数 + insertedIds 列表。
   * @keyword-en insert-many, batch-insert
   */
  async insert(
    ctx: UnitExecutionContext,
    payload: {
      db?: string;
      collection: string;
      docs: Array<Record<string, unknown>>;
    },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    if (!Array.isArray(payload.docs) || payload.docs.length === 0) {
      throw new Error('mongo.insert: docs must be a non-empty array');
    }
    const result = await db
      .collection(payload.collection)
      .insertMany(payload.docs);
    return {
      insertedCount: result.insertedCount,
      insertedIds: Object.values(result.insertedIds),
    };
  },

  /**
   * 在指定数据库/集合查询数据并返回结果列表 (只读, 允许 LLM 调用)。
   * @keyword-en find, record-list
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
   * 批量更新; ops 数组每项可独立指定 filter/update/multi/upsert, 走 bulkWrite 提交。
   * @keyword-en bulk-update, batch-update
   */
  async update(
    ctx: UnitExecutionContext,
    payload: {
      db?: string;
      collection: string;
      ops: UpdateOp[];
    },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    if (!Array.isArray(payload.ops) || payload.ops.length === 0) {
      throw new Error('mongo.update: ops must be a non-empty array');
    }
    const bulk = payload.ops.map((op) =>
      op.multi
        ? {
            updateMany: {
              filter: op.filter,
              update: op.update,
              upsert: op.upsert ?? false,
            },
          }
        : {
            updateOne: {
              filter: op.filter,
              update: op.update,
              upsert: op.upsert ?? false,
            },
          },
    );
    const result = await db.collection(payload.collection).bulkWrite(bulk);
    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    };
  },

  /**
   * 批量删除; ops 数组每项独立指定 filter + multi, 走 bulkWrite 提交。
   * @keyword-en bulk-delete, batch-delete
   */
  async delete(
    ctx: UnitExecutionContext,
    payload: {
      db?: string;
      collection: string;
      ops: DeleteOp[];
    },
  ) {
    const db = ctx.mongo.getDb(payload.db ?? ctx.runnerDbName);
    if (!db) throw new Error('mongo not connected');
    if (!Array.isArray(payload.ops) || payload.ops.length === 0) {
      throw new Error('mongo.delete: ops must be a non-empty array');
    }
    const bulk = payload.ops.map((op) =>
      op.multi
        ? { deleteMany: { filter: op.filter } }
        : { deleteOne: { filter: op.filter } },
    );
    const result = await db.collection(payload.collection).bulkWrite(bulk);
    return { deletedCount: result.deletedCount };
  },
};
