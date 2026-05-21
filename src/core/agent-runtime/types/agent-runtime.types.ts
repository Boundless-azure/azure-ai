import type { ChatMessage } from '@core/ai/types';

/**
 * @title Agent 描述信息
 * @description 来自 agent.desc.ts 的描述映射
 * @keywords-cn 名称, 描述, 是否支持对话
 * @keywords-en name, description, support-dialogue
 */
export interface AgentDescriptor {
  name: string;
  description: string;
  supportDialogue: boolean;
  /**
   * 节点级 call_hook debug 默认开关 (设计期在 agent.desc.ts 声明)
   *  - true  :: 本 agent 所有 call_hook / call_hook_async 默认开启 OTel trace, 整个 graph 流稳定带 debugLog 回包
   *  - false / undefined :: 默认关闭; LLM 仍可显式传 debug:true 在排查场景临时开启
   *  - 工厂闭包绑定, graph 流期内行为一致, 不跨轮次漂移
   * @keyword-en agent-default-debug
   */
  defaultDebug?: boolean;
}

/**
 * @title 对话层契约
 * @description 约束 dialogues.min 的必要方法
 * @keywords-cn 对话层, 句柄, AI注入
 * @keywords-en dialogues, handle, ai-inject
 */
export interface AgentDialoguesContract {
  handleAiServer(aiServer: {
    chatStream: (req: {
      modelId: string;
      messages: ChatMessage[];
      systemPrompt?: string;
      sessionId?: string;
      conversationGroupId?: string;
      checkpointer?: unknown;
      params?: Record<string, unknown>;
    }) => AsyncGenerator<unknown>;
    resolveModelNameByIds: (modelIds: string[]) => Promise<string | null>;
  }): void;
  setAgentConfig?: (config: { aiModelIds?: string[] }) => void;
  handle(messages: ChatMessage[]): AsyncGenerator<unknown> | Promise<unknown>;
}

/**
 * @title 已加载的 Agent 结构
 * @description 包含目录、描述、工具与可选对话层
 * @keywords-cn 加载结果, 工具集合, 对话实例
 * @keywords-en loaded-result, tools, dialogues-instance
 */
export interface LoadedAgent {
  dir: string;
  descriptor?: AgentDescriptor;
  tools: unknown[];
  dialogues?: AgentDialoguesContract;
}
