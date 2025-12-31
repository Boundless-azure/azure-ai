import { AIModelService, ChatMessage } from '@/core/ai';

/**
 * @title Code Agent Dialogues
 * @description 代码智能体对话处理
 * @keywords-cn 代码智能体, 对话
 * @keywords-en code-agent, dialogues
 */
export default class DialoguesClass {
  #aiServer: AIModelService | null = null;
  /**
   * 处理 AI 服务器对话
   * @param aiServer - AI 模型服务实例
   */
  handleAiServer(aiServer: AIModelService) {
    this.#aiServer = aiServer;
  }

  handle(messages: ChatMessage[]) {
    if (!this.#aiServer) throw new Error('AI 模型服务未初始化');
    const systemPrompt = `你是一个代码智能体，你的任务是根据用户的问题生成代码, 我会给你提供好Tool, 你只能使用Tool, 不能自己生成代码`;
    return this.#aiServer.chatStream({
      modelId: 'deepseek-chat',
      messages,
      systemPrompt,
    });
  }
}
