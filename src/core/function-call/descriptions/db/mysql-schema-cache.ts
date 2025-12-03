import type { FunctionCallDescription } from '../types';

export const MysqlSchemaCacheFunctionDescription: FunctionCallDescription = {
  name: 'db_mysql_schema_cache',
  description:
    '读取、刷新或注释 MySQL 的 schema 缓存(JSON)。先读取缓存以理解表/字段/外键/索引及业务说明；不明确时向用户澄清并通过 annotate 写入说明与同义词，再生成只读 SQL。',
};
