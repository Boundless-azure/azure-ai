import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：db_mongo_find
 * @description 在指定集合上执行只读的 find 查询（JSON-only）。
 * @keywords-cn 函数调用, Mongo, find, 只读, 集合
 * @keywords-en function-call, mongo, find, readonly, collection
 */
export const MongoFindFunctionDescription: FunctionCallDescription = {
  name: 'db_mongo_find',
  description:
    '在指定集合上执行只读的 find 查询；允许基础 filter/projection/sort/limit 参数；仅返回 JSON 数组。禁止写操作。',
};
