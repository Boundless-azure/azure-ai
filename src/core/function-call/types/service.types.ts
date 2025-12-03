import type { DynamicStructuredTool, Tool } from 'langchain';

/**
 * 每个 function-call 服务必须实现的接口：提供该函数的句柄
 */
export interface FunctionCallServiceContract {
  /**
   * 返回 LangChain Tool（使用 zod 定义 schema）。
   * 示例：
   * const searchDatabase = tool(({ query, limit }) => ..., { name, description, schema })
   */
  getHandle(): Tool | DynamicStructuredTool;
}
