import type { UnitCoreModule } from '../../types/unit.types';
import { mongoOps } from './unit-core/mongo.ops';

/**
 * @title Mongo 能力 Hook 映射
 * @description 将 Mongo CRUD hook 映射到具体实现。
 * @keywords-cn Hook映射, Mongo能力, CRUD
 * @keywords-en hook-mapping, mongo-ops, crud
 */
export const unitCore: UnitCoreModule['handlers'] = {
  'mongo:insertOne': async (ctx, payload) =>
    mongoOps.insertOne(ctx, payload as { db?: string; collection: string; doc: Record<string, unknown> }),
  'mongo:find': async (ctx, payload) =>
    mongoOps.find(ctx, payload as { db?: string; collection: string; filter?: Record<string, unknown>; limit?: number }),
  'mongo:updateOne': async (ctx, payload) =>
    mongoOps.updateOne(ctx, payload as { db?: string; collection: string; filter: Record<string, unknown>; update: Record<string, unknown> }),
  'mongo:deleteOne': async (ctx, payload) =>
    mongoOps.deleteOne(ctx, payload as { db?: string; collection: string; filter: Record<string, unknown> }),
};

export default unitCore;
