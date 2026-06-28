import type {
  AIModelResponse,
  ChatMessage,
  ModelSseEvent,
} from '@core/ai/types';

/**
 * @title Agent AI 请求
 * @description Agent 侧可见的统一 AI 调用入参，不暴露底层模型配置细节
 * @keywords-cn AI请求, 模型调用, agent适配
 * @keywords-en ai-request, model-invoke, agent-adapter
 */
export interface AgentAiRequest {
  source?: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  sessionId?: string;
  conversationGroupId?: string;
  checkpointer?: unknown;
  params?: Record<string, unknown>;
  /** 后台任务调用时隔离 LangChain callbacks，避免继承主对话已关闭的流式 writer */
  isolateCallbacks?: boolean;
}

/**
 * @title Agent 模型作用域客户端
 * @description 已绑定某个槽位或显式模型 ID 的 AI 客户端，支持链式 useModel(index).chatStream 调用
 * @keywords-cn 模型作用域, 槽位模型, 链式调用
 * @keywords-en scoped-model, ordered-slot, chained-call
 * @keyword-cn 模型作用域, 模型ID, 槽位模型
 * @keyword-en scoped-model, model-id, ordered-slot
 */
export interface AgentAiModelClient {
  /** Returns the resolved ai_models.id. */
  getModelId(): Promise<string | null>;
  chat(request: AgentAiRequest): Promise<AIModelResponse>;
  chatStream(
    request: AgentAiRequest,
  ): AsyncGenerator<ModelSseEvent, AIModelResponse, unknown>;
}

/**
 * @title Agent AI 适配器
 * @description 对 Agent 暴露显式模型与槽位模型两种入口，屏蔽 aiModelIds 的解析细节
 * @keywords-cn AI适配器, 模型槽位, 显式模型
 * @keywords-en ai-adapter, model-slot, explicit-model
 */
export interface AgentAiServer {
  chat(request: AgentAiRequest & { modelId: string }): Promise<AIModelResponse>;
  chatStream(
    request: AgentAiRequest & { modelId: string },
  ): AsyncGenerator<ModelSseEvent, AIModelResponse, unknown>;
  useModel(preferredIndex: number): AgentAiModelClient;
  withModel(modelId: string): AgentAiModelClient;
}

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
  handleAiServer(aiServer: AgentAiServer): void;
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
