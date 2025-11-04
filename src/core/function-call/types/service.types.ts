import type { FunctionCallDescription } from '../descriptions/types';

/**
 * 函数调用执行上下文（由系统侧注入，会话/用户范围）
 */
export interface FunctionCallRuntimeContext {
  sessionId?: string;
  userId?: string;
}

/**
 * 标准化的函数调用句柄：描述 + 校验器 + 执行器
 */
export interface FunctionCallHandle {
  /** 函数名称（与描述保持一致） */
  name: string;
  /** 工具/函数描述（供 AI 原生 function-call 能力使用） */
  description: FunctionCallDescription;
  /** 运行时参数校验器（返回 true 表示通过校验） */
  validate: (args: unknown) => boolean;
  /** 执行器（支持可选的会话/用户上下文） */
  execute: (
    args: unknown,
    ctx?: FunctionCallRuntimeContext,
  ) => Promise<unknown>;
}

/**
 * 每个 function-call 服务必须实现的接口：提供该函数的句柄
 */
export interface FunctionCallServiceContract {
  getHandle(): FunctionCallHandle;
}
