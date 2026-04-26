import { z } from 'zod';
import type { UnitHookModule } from '../../types/unit.types';

/**
 * @title Mongo 操作能力 Hook 描述
 * @description 允许指定数据库执行 CRUD，runner 库仅允许读写当前 runnerDbName。
 * @keywords-cn Mongo能力, CRUD, 指定数据库
 * @keywords-en mongo-capability, crud, db-select
 */
export const unitHooks: UnitHookModule = {
  unit: {
    name: 'mongo',
    description: '提供 MongoDB 的简单 CRUD 能力，支持跨库（排除受限库）',
    keywordsCn: ['Mongo', '数据库', 'CRUD'],
    keywordsEn: ['mongo', 'database', 'crud'],
  },
  hooks: [
    {
      name: 'runner.unitcore.mongo.insertOne',
      description: '在指定数据库/集合插入单条记录',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        doc: z.record(z.string(), z.unknown()),
      }),
    },
    {
      name: 'runner.unitcore.mongo.find',
      description: '在指定数据库/集合查询记录',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        filter: z.record(z.string(), z.unknown()).optional(),
        limit: z.number().int().positive().optional(),
      }),
    },
    {
      name: 'runner.unitcore.mongo.updateOne',
      description: '在指定数据库/集合更新单条记录',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        filter: z.record(z.string(), z.unknown()),
        update: z.record(z.string(), z.unknown()),
      }),
    },
    {
      name: 'runner.unitcore.mongo.deleteOne',
      description: '在指定数据库/集合删除单条记录',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        filter: z.record(z.string(), z.unknown()),
      }),
    },
  ],
};

export default unitHooks;
