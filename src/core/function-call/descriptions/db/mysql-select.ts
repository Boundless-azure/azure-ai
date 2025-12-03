import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：db_mysql_select
 * @desc 执行只读的 MySQL SELECT 查询（JSON-only）。
 *       要求：
 *       - 必须是以 SELECT 开头的只读查询；
 *       - 禁止出现 INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP/CREATE 等写操作关键词；
 *       - 支持使用 `?` 作为参数占位符，并通过 params 传入绑定参数；
 *       - 必须提供 limit，用于限制最大返回行数（系统侧可再次强制限制）。
 */
export const MysqlSelectFunctionDescription: FunctionCallDescription = {
  name: 'db_mysql_select',
  description:
    "执行只读的 MySQL SELECT 查询。使用步骤：先调用 db_mysql_schema_cache(get|refresh) 读取/刷新缓存以确定目标表与必要的 JOIN（依据外键与同义词）；无法唯一确定时先在对话中澄清并用 annotate 写入说明，再生成只读 SQL。所有动态值用 `?` + params 绑定，必须提供合理的 limit（系统可能二次封顶）。典型过滤：LIKE CONCAT('%', ?, '%')、=、BETWEEN ? AND ?。仅返回 JSON 数组。禁止写操作关键词。",
};
