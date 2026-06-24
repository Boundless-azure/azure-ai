import type { ChatMessage } from '@core/ai/types';
import type { PluginService } from '@/core/plugin';
import type { SolutionService } from '@/app/solution/services/solution.service';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';

/**
 * @title Code Agent 对话层
 * @description 提供开发需求澄清、取舍分析与确认后开发能力；代码生成工作流通过 AgentHandle 工具异步触发
 * @keywords-cn 代码智能体, 对话层, AI问答
 * @keywords-en code-agent, dialogue, ai-chat
 * @keyword-en code-agent, dialogue, model-id
 */
export default class DialoguesClass {
  #aiServer: AgentAiServer | null = null;
  #pluginService: PluginService | null = null;
  #logicModelId: string | null = null;
  #frontendModelId: string | null = null;

  /** 注入 AI 模型服务 */
  /**
   * Injects the runtime AI adapter.
   * @keyword-en code-agent, dialogue, ai-injection
   */
  handleAiServer(aiServer: AgentAiServer) {
    this.#aiServer = aiServer;
  }

  /** 注入插件服务 */
  /**
   * Injects PluginService for dialogue support.
   * @keyword-en code-agent, dialogue, plugin-injection
   */
  handlePluginService(pluginService: PluginService) {
    this.#pluginService = pluginService;
  }

  /**
   * 注入 Solution 服务。
   * @keyword-en solution-service, dialogue, target-resolution
   */
  handleSolutionService(_solutionService: SolutionService) {
    return this;
  }

  /** 覆盖模型 ID（保留给显式双模型调试场景）。 */
  /**
   * Overrides logic/frontend model IDs for explicit debug routing.
   * @keyword-en code-agent, dialogue, model-override
   */
  setModelOverrides(opts: { logicModelId?: string; frontendModelId?: string }) {
    if (opts.logicModelId) this.#logicModelId = opts.logicModelId;
    if (opts.frontendModelId) this.#frontendModelId = opts.frontendModelId;
  }

  /** 返回已注入的插件服务实例。 */
  /**
   * Returns the injected PluginService instance.
   * @keyword-en code-agent, dialogue, plugin-service
   */
  getPluginService(): PluginService | null {
    return this.#pluginService;
  }

  /** 返回当前选中的逻辑/前端模型覆盖。 */
  /**
   * Returns the current logic/frontend model ID overrides.
   * @keyword-en code-agent, dialogue, model-state
   */
  getModelOverrides() {
    return {
      logicModelId: this.#logicModelId,
      frontendModelId: this.#frontendModelId,
    };
  }

  /**
   * 轻量对话处理
   * 用于回答代码/架构相关问题，不涉及代码生成工作流
   */
  /**
   * Streams the code-agent requirement dialogue through the dialogue model ID slot.
   * @keyword-en code-agent, dialogue, ai-chat
   */
  async *handle(messages: ChatMessage[]): AsyncGenerator<string> {
    if (!this.#aiServer) {
      yield '❌ AI 服务未初始化';
      return;
    }

    const dialogueModel = this.#aiServer.useModel(0);
    const dialogueModelId = await dialogueModel.getModelId();
    if (!dialogueModelId) {
      yield '❌ 当前Agent未配置可用的对话模型槽位';
      return;
    }
    const logicModelLabel =
      (this.#logicModelId
        ? await this.#aiServer.withModel(this.#logicModelId).getModelId()
        : await this.#aiServer.useModel(1).getModelId()) ?? '未配置';
    const frontendModelLabel =
      (this.#frontendModelId
        ? await this.#aiServer.withModel(this.#frontendModelId).getModelId()
        : await this.#aiServer.useModel(2).getModelId()) ?? '未配置';

    const systemPrompt = [
      '你是 code-agent 的开发对话层：理解用户想做什么，补齐必要需求信息，并在需求足够明确时简短确认可进入代码图工具。',
      '默认简洁。简单页面、表格、展示、样式调整、轻量组件不要反复追问；能从上下文合理判断时就直接推进。',
      '只在目标、范围、验收口径、关键数据或运行位置确实不清楚时追问最少必要问题。',
      '不要把执行层规则、Runner 能力或工具调用细节写成对用户的硬限制；这些由后续 code graph 节点和 hook 结果判断。',
      '当用户明确要求开始生成、修改、初始化或运行项目时，整理完整需求并启动 code_gen_orchestrate；讨论方案、比较方案或单纯问答时只回答需求本身。',
      '启动 code_gen_orchestrate 时尽量带上已知的 targetKind、solutionName/appName、runner_id 和 context.session_id；缺失信息由工具节点继续检查。',
      `当前默认逻辑模型：${logicModelLabel}，前端模型：${frontendModelLabel}`,
    ].join('\n');

    const stream = dialogueModel.chatStream({
      source: 'code-agent.dialogue',
      messages,
      systemPrompt,
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
