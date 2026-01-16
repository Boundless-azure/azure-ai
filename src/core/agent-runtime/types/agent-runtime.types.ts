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
  }): void;
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
