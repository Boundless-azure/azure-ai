import type { ChatMessage } from '@core/ai/types';
import type { AIModelService } from '@/core/ai';
import type { PluginService } from '@/core/plugin';

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-thinking-exp';

/**
 * @title Code Agent 对话层
 * @description 提供轻量问答能力；代码生成工作流通过 AgentHandle 工具异步触发
 * @keywords-cn 代码智能体, 对话层, AI问答
 * @keywords-en code-agent, dialogue, ai-chat
 */
export default class DialoguesClass {
  #aiService: AIModelService | null = null;
  #pluginService: PluginService | null = null;
  #deepseekModelId: string = DEFAULT_DEEPSEEK_MODEL;
  #geminiModelId: string = DEFAULT_GEMINI_MODEL;

  /** 注入 AI 模型服务 */
  handleAiServer(aiService: AIModelService) {
    this.#aiService = aiService;
  }

  /** 注入插件服务 */
  handlePluginService(pluginService: PluginService) {
    this.#pluginService = pluginService;
  }

  /** 覆盖模型 ID */
  setModelIds(opts: { deepseekModelId?: string; geminiModelId?: string }) {
    if (opts.deepseekModelId) this.#deepseekModelId = opts.deepseekModelId;
    if (opts.geminiModelId) this.#geminiModelId = opts.geminiModelId;
  }

  getPluginService(): PluginService | null {
    return this.#pluginService;
  }

  getModelIds() {
    return {
      deepseekModelId: this.#deepseekModelId,
      geminiModelId: this.#geminiModelId,
    };
  }

  /**
   * 轻量对话处理
   * 用于回答代码/架构相关问题，不涉及代码生成工作流
   */
  async *handle(messages: ChatMessage[]): AsyncGenerator<string> {
    if (!this.#aiService) {
      yield '❌ AI 服务未初始化';
      return;
    }

    const systemPrompt = [
      '你是一个专业的代码架构师 AI，擅长分析需求、设计系统模块。',
      '如果用户需要生成完整代码，请告知用户使用 code_gen_orchestrate 工具启动异步代码生成工作流。',
      `当前默认后端模型：${this.#deepseekModelId}，前端模型：${this.#geminiModelId}`,
    ].join('\n');

    const stream = this.#aiService.chatStream({
      modelId: this.#deepseekModelId,
      messages,
      systemPrompt,
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        yield event.data.text;
      }
    }
  }
}
