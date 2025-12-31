import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：getWebmcp
 * @desc 通过 WebMCP 网关请求当前页面声明（JSON-only）。模型使用该声明以规划变量修改与 hook 调用操作。
 * @keywords-cn 函数调用, WebMCP, 页面声明, JSON
 * @keywords-en function-call, webmcp, page-descriptor, json-only
 */
export const GetWebMcpFunctionDescription: FunctionCallDescription = {
  name: 'getWebmcp',
  description:
    '请求前端当前页面的 WebMCP 声明结构，用于生成后续操作 JSON；返回 JSON-only 的页面声明（函数以指针表示）。',
};
