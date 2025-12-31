import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：webmcp_op
 * @desc 下发 WebMCP 操作 JSON 到页面，返回执行回执（JSON-only）。
 * @keywords-cn 函数调用, WebMCP, 操作下发, 回执
 * @keywords-en function-call, webmcp, dispatch-operation, result
 */
export const WebMcpOperationFunctionDescription: FunctionCallDescription = {
  name: 'webmcp_op',
  description:
    '下发操作 JSON 到前端页面（callHook / setData），返回执行结果；仅返回 JSON。',
};
