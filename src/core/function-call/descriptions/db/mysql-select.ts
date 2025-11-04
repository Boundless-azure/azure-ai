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
    '执行只读的 MySQL SELECT 查询；必须提供 limit 限制；支持 `?` 参数占位符与 params 绑定；仅返回 JSON 数组。',
  parameters: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description:
          '只读 SELECT 语句；不允许包含 INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP/CREATE。可使用 `?` 作为参数占位符。',
      },
      params: {
        type: 'array',
        description:
          '参数数组（与 SQL 中的 `?` 占位符一一对应）。仅允许原始值（string/number/boolean/null）。',
        items: {},
      },
      limit: {
        type: 'number',
        description:
          '最大返回行数上限（必填）。系统侧可能强制设定最大值（如 200）。',
      },
    },
    required: ['sql', 'limit'],
  },
};
