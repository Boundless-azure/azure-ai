import type { ChatMessage } from '@core/ai/types';

/**
 * @title Azure AI 默认对话层
 * @description 基于Agent配置的模型ID列表选择模型并发起流式对话。
 * @keywords-cn 默认Agent, 对话层, 模型选择
 * @keywords-en default-agent, dialogue-layer, model-selection
 */
export default class DialoguesClass {
  #aiServer: {
    chatStream: (req: {
      modelId: string;
      messages: ChatMessage[];
      systemPrompt?: string;
    }) => AsyncGenerator<{
      type: string;
      data?: { text?: string };
      error?: string;
    }>;
    resolveModelNameByIds: (modelIds: string[]) => Promise<string | null>;
  } | null = null;
  #modelIds: string[] = [];

  handleAiServer(aiServer: {
    chatStream: (req: {
      modelId: string;
      messages: ChatMessage[];
      systemPrompt?: string;
    }) => AsyncGenerator<{ type: string; data?: { text?: string } }>;
    resolveModelNameByIds: (modelIds: string[]) => Promise<string | null>;
  }) {
    this.#aiServer = aiServer;
  }

  setAgentConfig(config: { aiModelIds?: string[] }) {
    this.#modelIds = Array.isArray(config.aiModelIds) ? config.aiModelIds : [];
  }

  async *handle(messages: ChatMessage[]): AsyncGenerator<string> {
    if (!this.#aiServer) {
      yield '❌ AI服务未初始化';
      return;
    }
    if (!this.#modelIds.length) {
      yield '❌ 当前Agent未配置任何AI模型ID';
      return;
    }
    const modelName = await this.#aiServer.resolveModelNameByIds(
      this.#modelIds,
    );
    if (!modelName) {
      yield '❌ 未找到可用模型，请先在AI提供商中配置并启用对应模型ID';
      return;
    }
    console.log('消息到达', messages);
    const stream = this.#aiServer.chatStream({
      modelId: modelName,
      messages,
      systemPrompt:
        '你是azure-ai默认智能体，请基于用户输入给出准确、简洁、可执行的答案。',
    });
    for await (const event of stream) {
      if (event.type === 'token' && event.data?.text) {
        yield event.data.text;
      }
      if (event.type === 'error') {
        yield `❌ ${event.error ?? '模型调用失败'}`;
      }
    }
  }
}
