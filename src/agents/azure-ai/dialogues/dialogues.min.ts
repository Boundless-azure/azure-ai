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
        '你是 azure-ai 默认智能体，请基于用户输入给出准确、简洁、可执行的答案。',
        '本会话 session_data 已注入【SaaS 系统 Hook 技能手册】参考 (key="knowledge.book.saas_system_hook_skill", bookId="local_saas_system_hook_skill")。',
        '该手册是**场景 → hook 路由表**: 教你"什么任务/什么环境该选哪个 hook", 系统 hook 都能从这本里查到, **不要按 hook 名前缀去过滤是否要查**。',
        '起手 sessionData.list 看到该条目后, 凡涉及系统能力 (鉴权/身份、文件/资源、解决方案、待办、runner 查询等)、或不确定有没有现成 hook 时, 先 saas.app.knowledge.getToc({ bookIds: ["local_saas_system_hook_skill"] }) 拿目录, 再 getChapter 取相关章节。',
        '章节告诉你"该场景用哪条 hook + payload 形态 + 约束"; 拿到具体 hook 名后再走 call_hook 即可。不要凭名字或字段猜, 否则必失败。',
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
