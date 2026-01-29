import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import type { FunctionCallServiceContract } from '../types/service.types';
import { z } from 'zod';
import { tool } from 'langchain';
import type { Db } from 'mongodb';

import { MongoFindFunctionDescription } from '../descriptions/db/mongo-find';

/**
 * @title Mongo 只读查询服务
 * @description 提供只读的集合 find 查询；限制最大返回行数与 filter 合法性。
 * @keywords-cn Mongo查询, 只读, find, 限制, 合法性
 * @keywords-en mongo-query, readonly, find, limit, validation
 */
@Injectable()
export class MongoReadonlyService implements FunctionCallServiceContract {
  constructor(@Optional() @Inject('MONGO_DB') private readonly mongoDb?: Db) {}

  getHandle() {
    const FilterSchema = z.record(z.string(), z.any());
    const SortSchema = z.record(
      z.string(),
      z.union([z.literal(1), z.literal(-1)]),
    );

    const schemaRaw = z.object({
      collection: z.string().min(1),
      filter: FilterSchema.optional(),
      projection: z.record(z.string(), z.number()).optional(),
      sort: SortSchema.optional(),
      limit: z.number().min(1).max(200),
    });

    return tool(
      async (input) =>
        this.find(
          input as {
            collection: string;
            filter?: Record<string, unknown>;
            projection?: Record<string, number>;
            sort?: Record<string, 1 | -1>;
            limit: number;
          },
        ),
      {
        name: MongoFindFunctionDescription.name,
        description: MongoFindFunctionDescription.description,
        schema: schemaRaw,
      },
    );
  }

  private async find(params: {
    collection: string;
    filter?: Record<string, unknown>;
    projection?: Record<string, number>;
    sort?: Record<string, 1 | -1>;
    limit: number;
  }): Promise<Record<string, unknown>[]> {
    if (!this.mongoDb) throw new BadRequestException('MongoDB 未启用');
    const col = this.mongoDb.collection(params.collection);
    const cursor = col
      .find(params.filter ?? {})
      .project(params.projection)
      .sort(params.sort ?? {})
      .limit(Math.min(params.limit, 200));
    const docs = await cursor.toArray();
    return docs.map(
      (d) => JSON.parse(JSON.stringify(d)) as Record<string, unknown>,
    );
  }
}
