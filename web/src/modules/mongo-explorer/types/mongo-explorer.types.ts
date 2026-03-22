/**
 * @title MongoExplorer Types
 * @description MongoDB Explorer module type definitions
 * @keywords-cn MongoDB浏览器类型, 数据库管理类型
 * @keywords-en mongo-explorer-types, database-management-types
 */

// MongoDB 连接配置
export interface MongoConnectionConfig {
  uri: string;
  dbName?: string;
}

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
export interface QueryRequest {
  database: string;
  collection: string;
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  limit?: number;
  skip?: number;
}

// 查询结果
export interface QueryResult {
  documents: Record<string, unknown>[];
  total: number;
  limit: number;
  skip: number;
  executionTime: number;
}
