import { z } from 'zod';
import type { UnitHookModule } from '../../types/unit.types';

/**
 * @title Mongo 操作能力 Hook 描述
 * @description 允许指定数据库执行 CRUD，runner 库仅允许读写当前 runnerDbName。
 *   写操作 (insert/update/delete) 统一接收 array, 支持 1..N 批量, 物理上走 mongo bulkWrite。
 *   写操作均标 `denyLlm: true`: LLM 不允许直接调底层 mongo 写; 业务通过 AI 产代码 / unit-core 直接调,
 *   或通过 runner.app.* 业务 hook 间接调。
 * @keywords-cn Mongo能力, CRUD, 批量, 拒绝LLM
 * @keywords-en mongo-capability, crud, batch, deny-llm
 */
export const unitHooks: UnitHookModule = {
  unit: {
    name: 'mongo',
    description:
      '提供 MongoDB 的 CRUD 能力 (写操作批量化), 支持跨库 (排除受限库)。LLM 不可直接调用写操作。',
    keywordsCn: ['Mongo', '数据库', 'CRUD', '批量'],
    keywordsEn: ['mongo', 'database', 'crud', 'batch'],
  },
  hooks: [
    {
      name: 'runner.unitcore.mongo.insert',
      description:
        '在指定数据库/集合批量插入记录 (接收 docs 数组, 单条作为长度 1 数组传入)',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        docs: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .describe('待插入的文档数组, 至少 1 条'),
      }),
      denyLlm: true,
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
      name: 'runner.unitcore.mongo.update',
      description:
        '在指定数据库/集合批量更新记录 (接收 ops 数组, 每项 { filter, update, multi?, upsert? })',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        ops: z
          .array(
            z.object({
              filter: z.record(z.string(), z.unknown()),
              update: z.record(z.string(), z.unknown()),
              multi: z
                .boolean()
                .optional()
                .describe('true=匹配的全部更新, false/缺省=仅更新第一条'),
              upsert: z.boolean().optional(),
            }),
          )
          .min(1)
          .describe('更新操作数组, 至少 1 条'),
      }),
      denyLlm: true,
    },
    {
      name: 'runner.unitcore.mongo.delete',
      description:
        '在指定数据库/集合批量删除记录 (接收 ops 数组, 每项 { filter, multi? })',
      payloadSchema: z.object({
        db: z.string().optional(),
        collection: z.string(),
        ops: z
          .array(
            z.object({
              filter: z.record(z.string(), z.unknown()),
              multi: z
                .boolean()
                .optional()
                .describe('true=匹配的全部删除, false/缺省=仅删除第一条'),
            }),
          )
          .min(1)
          .describe('删除操作数组, 至少 1 条'),
      }),
      denyLlm: true,
    },
  ],
};

export default unitHooks;
