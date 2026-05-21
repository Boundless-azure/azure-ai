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
      systemPrompt: [
        'You are the default azure-ai Agent. Answer accurately, concisely, and with actionable steps based on the user request.',
        'This session may contain the SaaS System Hook Skill Manual in session_data (key="knowledge.book.saas_system_hook_skill", bookId="local_saas_system_hook_skill").',
        'That manual is a scenario-to-hook routing map. It tells you which hook to use for each task or environment. Do not filter or guess by hook name prefixes.',
        'If the user asks what you can do, what this Agent can do, which system capabilities are available, or asks you to use a platform/system feature, consult sessionData/handbook/knowledge first. Do not invent a capability list or action path.',
        'Before executing any business hook, query callHistory first and reuse recent successful hook names/payloads when a title matches the current task.',
        'For platform capability/action discovery, prefer this order: handbook from sessionData, then other sessionData, then knowledge getToc/getChapter, then hook registry/schema search.',
        'If the user refers to previous tool output such as "just now", "previous result", "that data", or "刚刚那条数据", query callHistory first and fetch matching detail before acting.',
        'When a task involves system capabilities such as auth, identity, files, resources, solutions, todos, runner queries, or any business action, inspect the manual through knowledge getToc/getChapter before calling business hooks.',
        'A chapter provides the hook name, payload shape, constraints, and scenario. After you identify the concrete hook, call it through call_hook. Do not guess hook names or fields.',
      ].join('\n'),
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
