import { Injectable, Logger } from '@nestjs/common';
import type { ChatMessage, ModelSseEvent } from '@core/ai/types';
import type { AIModelRequest } from '@core/ai/types';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { AgentLoaderService } from './agent-loader.service';
import type { LoadedAgent } from '../types/agent-runtime.types';

/**
 * @title Agent 运行时服务
 * @description 对外提供两种接入方式：
 * 1) 有对话层（dialogues）时，通过 handleAiServer 注入 AIModelService 并调用 handle(messages)
 * 2) 仅工具（handle）时，返回该 agent 的工具集合，供上层作为额外工具参与主对话
 * @keywords-cn 运行时服务, 对话接入, 句柄工具, AI服务注入
 * @keywords-en runtime-service, dialogue-attach, handle-tools, ai-service-inject
 */
@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(
    private readonly aiModelService: AIModelService,
    private readonly loader: AgentLoaderService,
  ) {}

  /**
   * 加载并准备 Agent（描述/工具/对话层）
   */
  async load(inputDir: string): Promise<LoadedAgent> {
    return await this.loader.loadAll(inputDir);
  }

  /**
   * 当存在对话层时，将 AIModelService 注入并返回可直接调用的句柄
   */
  attachDialogue(agent: LoadedAgent): void {
    if (!agent.dialogues) return;
    try {
      agent.dialogues.handleAiServer(this.buildAiAdapter());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`注入 AIModelService 失败：${msg}`);
    }
  }

  /**
   * 启动 Agent 对话（当存在 dialogues 时）；返回与 ConversationService.chatStream 相同风格的事件流
   */
  async *startDialogue(
    agentDir: string,
    messages: ChatMessage[],
  ): AsyncGenerator<ModelSseEvent> {
    const loaded = await this.loader.loadAll(agentDir);
    if (!loaded.dialogues) {
      throw new Error('该 Agent 未提供对话层（dialogues）');
    }
    loaded.dialogues.handleAiServer(this.buildAiAdapter());
    const gen = loaded.dialogues.handle(messages);
    // 透传底层生成器（增加类型保护）
    for await (const ev of gen as AsyncGenerator<ModelSseEvent>) {
      yield ev;
    }
  }

  /**
   * 获取工具集合（当没有对话层时，上层可将这些工具作为额外工具参与主对话）
   */
  async getTools(agentDir: string): Promise<unknown[]> {
    const loaded = await this.loader.loadAll(agentDir);
    return loaded.tools;
  }

  private buildAiAdapter() {
    const isCheckpointSaver = (x: unknown): x is BaseCheckpointSaver =>
      typeof x === 'object' &&
      x !== null &&
      'put' in (x as Record<string, unknown>);

    return {
      chatStream: (req: {
        modelId: string;
        messages: ChatMessage[];
        systemPrompt?: string;
        sessionId?: string;
        conversationGroupId?: string;
        checkpointer?: unknown;
        params?: Record<string, unknown>;
      }) => {
        const aiReq: AIModelRequest = {
          modelId: req.modelId,
          messages: req.messages,
          systemPrompt: req.systemPrompt,
          sessionId: req.sessionId,
          conversationGroupId: req.conversationGroupId,
          checkpointer: isCheckpointSaver(req.checkpointer)
            ? req.checkpointer
            : undefined,
          params: req.params as AIModelRequest['params'],
        };
        return this.aiModelService.chatStream(aiReq);
      },
    };
  }
}
