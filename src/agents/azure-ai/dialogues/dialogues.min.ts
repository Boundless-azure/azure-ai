import type { ChatMessage } from '@core/ai/types';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';

/**
 * @title Azure AI 默认对话层
 * @description 基于Agent配置的模型ID列表选择模型并发起流式对话。
 * @keywords-cn 默认Agent, 对话层, 模型选择
 * @keywords-en default-agent, dialogue-layer, model-selection
 * @keyword-en default-agent, dialogue-layer, model-id
 */
export default class DialoguesClass {
  #aiServer: AgentAiServer | null = null;

  /**
   * Injects the runtime AI adapter.
   * @keyword-en ai-server-inject, dialogue-layer
   */
  handleAiServer(aiServer: AgentAiServer) {
    this.#aiServer = aiServer;
  }

  /**
   * Streams the default agent response through the model ID slot.
   * @keyword-en dialogue-handle, model-id, model-slot-selection
   */
  async *handle(messages: ChatMessage[]): AsyncGenerator<string> {
    if (!this.#aiServer) {
      yield '❌ AI服务未初始化';
      return;
    }
    const dialogueModel = this.#aiServer.useModel(0);
    const modelId = await dialogueModel.getModelId();
    if (!modelId) {
      yield '❌ 未找到可用模型，请先在AI提供商中配置并启用对应模型ID';
      return;
    }
    console.log('消息到达', messages);
    const stream = dialogueModel.chatStream({
      messages,
      systemPrompt: [
        'You are the default azure-ai Agent. Answer accurately, concisely, and with actionable steps based on the user request.',
        'This session may contain the System Manual in session_data (key="handbook.saas_system_hook", bookId="local_saas_system_hook_skill").',
        'That manual is a terminology and scenario-to-hook routing map. It tells you which chapter or hook family to inspect for each task or environment. Do not filter or guess by hook name prefixes.',
        'If the user asks what you can do, what this Agent can do, which system capabilities are available, or asks you to use a platform/system feature, consult sessionData/handbook/knowledge first. Do not invent a capability list or action path.',
        'Before executing any business hook, query callHistory first and reuse recent successful hook names/payloads when a title matches the current task.',
        'For platform capability/action discovery, prefer this order: handbook from sessionData, then other sessionData, then knowledge getToc/getChapter, then hook registry/schema search.',
        'If the user refers to previous tool output such as "just now", "previous result", "that data", or "刚刚那条数据", query callHistory first and fetch matching detail before acting.',
        'When a task involves system capabilities such as auth, identity, files, resources, solutions, todos, runner queries, or any business action, inspect the manual through knowledge getToc/getChapter before calling business hooks.',
        'A chapter provides the hook name, payload shape, constraints, and scenario. After you identify the concrete hook, call it through call_hook. Do not guess hook names or fields.',
        'Solution vs App/Unit: a Solution is a CONTAINER; apps and units are its CHILDREN (see solution.includes). saas.app.solution.list returns ONLY the Solution layer, never the inner app/unit — so to find an app/unit, first get its solutionId via solution.list, THEN call saas.app.solution.listApps / saas.app.solution.listUnits (or saas.app.solution.getBatch) with that solutionId. Never conclude "not found" from solution.list alone.',
        'Code generation, code modification, project initialization, and running builds belong to the code-agent development workflow. Do NOT use call_hook to write or edit source files directly (runner.app.codeAgentFs.*, runner.unitcore.file.write / patchRange, runner.unitcore.terminal.exec). Clarify the requirement and hand such requests to the code-agent; do not modify source files yourself.',
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
