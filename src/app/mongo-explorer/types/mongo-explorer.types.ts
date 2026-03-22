import { z } from 'zod';

// 连接配置
export const MongoConnectionConfigSchema = z.object({
  uri: z.string().min(1),
  dbName: z.string().optional(),
});

export type MongoConnectionConfig = z.infer<typeof MongoConnectionConfigSchema>;

// 数据库信息
export interface DatabaseInfo {
  name: string;
  collections: CollectionInfo[];
}

// 集合信息
export interface CollectionInfo {
  name: string;
  type: string;
  count: number;
  size: number;
  storageSize: number;
}

// Schema 信息
export interface SchemaInfo {
  database: string;
  collection: string;
  fields: FieldInfo[];
  sampleDocuments: Record<string, unknown>[];
}

// 字段信息
export interface FieldInfo {
  name: string;
  type: string;
  isArray: boolean;
  isObject: boolean;
  count: number;
}

// 查询请求
export const MongoQuerySchema = z.object({
  database: z.string().min(1),
  collection: z.string().min(1),
  filter: z.record(z.string(), z.unknown()).optional().default({}),
  projection: z.record(z.string(), z.unknown()).optional(),
  sort: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  skip: z.number().int().min(0).optional().default(0),
});

export type MongoQueryRequest = z.infer<typeof MongoQuerySchema>;

// 查询结果
export interface QueryResult {
  documents: Record<string, unknown>[];
  total: number;
  limit: number;
  skip: number;
  executionTime: number;
}

// Runner 列表项（带 MongoDB 配置）
export interface RunnerWithMongo {
  id: string;
  alias: string;
  status: string;
  hasMongoConfig: boolean;
}
