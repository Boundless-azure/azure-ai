import type { UnitCoreModule } from '../../types/unit.types';
import { mongoOps } from './unit-core/mongo.ops';

/**
 * @title Mongo 能力 Hook 映射
 * @description 将 Mongo CRUD hook 映射到具体实现。
 *   写操作 (insert/update/delete) 统一接收 array, 实现走 bulkWrite (insert 走 insertMany)。
 * @keywords-cn Hook映射, Mongo能力, CRUD, 批量
 * @keywords-en hook-mapping, mongo-ops, crud, batch
 */
export const unitCore: UnitCoreModule['handlers'] = {
  'runner.unitcore.mongo.insert': async (ctx, payload) =>
    mongoOps.insert(
      ctx,
      payload as {
        db?: string;
        collection: string;
        docs: Array<Record<string, unknown>>;
      },
    ),
  'runner.unitcore.mongo.find': async (ctx, payload) =>
    mongoOps.find(
      ctx,
      payload as {
        db?: string;
        collection: string;
        filter?: Record<string, unknown>;
        limit?: number;
      },
    ),
  'runner.unitcore.mongo.update': async (ctx, payload) =>
    mongoOps.update(
      ctx,
      payload as {
        db?: string;
        collection: string;
        ops: Array<{
          filter: Record<string, unknown>;
          update: Record<string, unknown>;
          multi?: boolean;
          upsert?: boolean;
        }>;
      },
    ),
  'runner.unitcore.mongo.delete': async (ctx, payload) =>
    mongoOps.delete(
      ctx,
      payload as {
        db?: string;
        collection: string;
        ops: Array<{
          filter: Record<string, unknown>;
          multi?: boolean;
        }>;
      },
    ),
};

export default unitCore;
