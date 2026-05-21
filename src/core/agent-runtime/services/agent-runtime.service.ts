import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import type { ChatMessage, ModelSseEvent } from '@core/ai/types';
import type { AIModelRequest } from '@core/ai/types';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { AgentLoaderService } from './agent-loader.service';
import type { LoadedAgent } from '../types/agent-runtime.types';
import { HookBusService } from '@/core/hookbus/services/hook.bus.service';
import { RunnerHookRpcService } from '@/app/runner/services/runner-hook-rpc.service';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import {
  buildCallHookTool,
  buildCallHookAsyncTool,
  buildSearchHookTool,
  buildGetHookTagTool,
  buildGetHookInfoTool,
  type InvocationContextProvider,
} from '../tools/call-hook.tools';
import {
  buildBaseLlmSystemPrompt,
  type LlmSystemPromptJson,
} from '../prompts/base-llm.prompt';
import { SessionCallTrackerService } from './session-call-tracker.service';
import { SessionSaveLlmService } from './session-save-llm.service';
import { AiCallLogService } from '@/app/conversation/services/ai-call-log.service';

type AgentRuntimeContext = {
  agentId: string;
  agentPrincipalId: string;
  nickname?: string | null;
  purpose?: string | null;
  tenantId?: string | null;
};

/**
 * @title Agent 运行时服务
 * @description 对外提供两种接入方式:
 * 1) 有对话层 (dialogues) 时, 通过 handleAiServer 注入 AIModelService 并调用 handle(messages)
 * 2) 仅工具 (handle) 时, 返回该 agent 的工具集合, 供上层作为额外工具参与主对话
 *
 * Hook 调用上下文:
 * - 每次 startDialogue / getTools 调用方都应通过 options.invocationContext 传入 token 等环境信息
 * - 工具层闭包持有该上下文, LLM schema 完全不暴露这些字段, 保证 LLM 不可见不可改
 * @keywords-cn 运行时服务, 对话接入, 句柄工具, AI服务注入, 调用上下文
 * @keywords-en runtime-service, dialogue-attach, handle-tools, ai-service-inject, invocation-context
 */
@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(
    private readonly aiModelService: AIModelService,
    private readonly loader: AgentLoaderService,
    private readonly hookBus: HookBusService,
    @Inject(forwardRef(() => RunnerHookRpcService))
    private readonly hookRpc: RunnerHookRpcService,
    private readonly tracker: SessionCallTrackerService,
    private readonly sessionSaveLlm: SessionSaveLlmService,
    @Inject(forwardRef(() => AiCallLogService))
    private readonly callLog: AiCallLogService,
  ) {}

  /**
   * 加载并准备 Agent (描述/工具/对话层)
   *  - 主对话工具集 :: call_hook / call_hook_async / search_hook / get_hook_tag / get_hook_info
   *  - call_hook 挂 SessionCallTracker 副作用 :: **仅记录**, 不在 hook 完成时触发沉淀
   *  - 触发判定挪到 startDialogue 末尾 (整轮主对话结束后统一硬匹配, 一轮只触发一次)
   * @keyword-en load-agent
   */
  async load(
    inputDir: string,
    invocationContext?: HookInvocationContext,
  ): Promise<LoadedAgent> {
    const loaded = await this.loader.loadAll(inputDir);
    const getCtx: InvocationContextProvider = () => invocationContext ?? {};

    // 副作用 ::
    //  ① tracker 仅 record (沉淀 LLM 触发判定挪到整轮结束后, 由 startDialogue 统一做)
    //  ② callLog 硬记录 :: 仅成功项 (errorMsg 为空) 落库, FIFO 50 条上限, fire-and-forget
    //     失败的不记录 — sinking LLM 已经管"教训沉淀", 这里只留事实日志.
    const onCallComplete = (
      record: {
        hookName: string;
        target: 'saas' | 'runner';
        payload: unknown;
        result: unknown;
        errorMsg: string[];
        ts: number;
      },
      ctx: HookInvocationContext,
    ) => {
      const sessionId = ctx.extras?.sessionId;
      if (typeof sessionId !== 'string' || !sessionId) return;
      this.tracker.record(sessionId, record);
      // 仅成功项落库; service 内部还会 catch + warn, 不阻塞主对话
      if (record.errorMsg.length === 0) {
        void this.callLog
          .append(
            sessionId,
            {
              hookName: record.hookName,
              target: record.target,
              payload: record.payload,
              result: record.result,
              ts: record.ts,
            },
            ctx.principalId,
          )
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(
              `[call-log] append failed session=${sessionId} hook=${record.hookName}: ${msg}`,
            );
          });
      }
    };
    // 节点级 debug 默认值: agent.desc.ts 的 defaultDebug 字段, 工厂闭包绑定后整个 graph 流一致
    const defaultDebug = loaded.descriptor?.defaultDebug ?? false;
    const hookTools = [
      buildCallHookTool(
        this.hookBus,
        this.hookRpc,
        getCtx,
        { onCallComplete },
        { defaultDebug },
      ),
      buildCallHookAsyncTool(this.hookBus, this.hookRpc, getCtx, {
        defaultDebug,
      }),
      buildSearchHookTool(this.hookBus, this.hookRpc, getCtx),
      buildGetHookTagTool(this.hookBus, this.hookRpc, getCtx),
      buildGetHookInfoTool(this.hookBus, this.hookRpc, getCtx),
    ];
    loaded.tools = [...hookTools, ...loaded.tools];
    return loaded;
  }

  /**
   * 当存在对话层时, 将 AIModelService 注入并返回可直接调用的句柄
   * @keyword-en attach-dialogue
   */
  attachDialogue(agent: LoadedAgent): void {
    if (!agent.dialogues) return;
    try {
      agent.dialogues.handleAiServer(this.buildAiAdapter());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`注入 AIModelService 失败: ${msg}`);
    }
  }

  /**
   * 启动 Agent 对话 (当存在 dialogues 时); 返回与 ConversationService.chatStream 相同风格的事件流
   * @keyword-en start-dialogue
   */
  async *startDialogue(
    agentDir: string,
    messages: ChatMessage[],
    options?: {
      aiModelIds?: string[];
      /** 主动对话模式上下文, 注入为前置系统提示词 */
      proactiveContext?: {
        sessionId: string;
        agentPrincipalId: string;
        triggerMessageId: string;
      };
      /** Hook 调用上下文 (token / principalId / traceId), 由调用方在请求作用域填入 */
      invocationContext?: HookInvocationContext;
      /** 当前 Agent 的运行时身份信息, 仅注入系统提示词辅助 LLM 认知 */
      agentContext?: AgentRuntimeContext;
    },
  ): AsyncGenerator<ModelSseEvent> {
    const loaded = await this.load(agentDir, options?.invocationContext);
    if (!loaded.dialogues) {
      throw new Error('该 Agent 未提供对话层 (dialogues)');
    }
    // session_data 不再注入 messages 流 (会破坏 prompt cache 的 prefix 匹配)。
    // 改为 base prompt 按需查询: 复杂 hook / 历史 / 记忆任务由 LLM 主动调 sessionData.list 等工具拿依据。
    loaded.dialogues.handleAiServer(
      this.buildAiAdapter(
        options?.proactiveContext,
        loaded.tools,
        options?.agentContext,
      ),
    );
    loaded.dialogues.setAgentConfig?.({ aiModelIds: options?.aiModelIds });
    const gen = loaded.dialogues.handle(messages);
    try {
      for await (const ev of gen as AsyncGenerator<ModelSseEvent>) {
        yield ev;
      }
    } finally {
      // 整轮主对话结束 (含异常 / 提前 break) → 低频硬匹配判定 → 命中则异步触发沉淀 LLM
      // 放 finally 保证 caller 中途 break/throw 也能触发, 一轮只触发一次
      this.maybeTriggerSaveLlmAfterTurn(
        options?.invocationContext,
        options?.aiModelIds,
      );
    }
  }

  /**
   * 整轮对话结束后的沉淀触发 :: 低频硬匹配 (getChapter / 失败后成功) 命中即异步跑独立 LLM
   *  - 一轮只触发一次, 不在 hook 完成时触发 (避免主对话期间反复跑沉淀)
   *  - tracker 内置冷却时间, 避免每轮都触发总结
   *  - aiModelIds 缺失或 sessionId 缺失 → 跳过 + reset
   *  - fire-and-forget, 沉淀失败 / 慢都不影响主对话
   * @keyword-en maybe-trigger-save-llm-after-turn
   */
  private maybeTriggerSaveLlmAfterTurn(
    invocationContext?: HookInvocationContext,
    aiModelIds?: string[],
  ): void {
    const sessionId = invocationContext?.extras?.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) {
      this.logger.debug(
        `[save-trigger] skip: no sessionId in invocationContext.extras`,
      );
      return;
    }
    const should = this.tracker.shouldTriggerSave(sessionId);
    this.logger.log(
      `[save-trigger] session=${sessionId} shouldTrigger=${should}`,
    );
    if (!should) return;
    if (!aiModelIds || aiModelIds.length === 0 || !invocationContext) {
      this.logger.warn(
        `[save-trigger] hit but missing aiModelIds/ctx, reset. session=${sessionId}`,
      );
      this.tracker.resetTriggers(sessionId);
      return;
    }
    this.logger.log(
      `[save-trigger] firing runAsync session=${sessionId} models=${aiModelIds.join(',')}`,
    );
    this.tracker.resetTriggers(sessionId);
    void this.sessionSaveLlm.runAsync({
      sessionId,
      aiModelIds,
      invocationContext,
    });
  }

  /**
   * 获取工具集合 (含 call_hook + call_hook_async + search_hook + get_hook_tag + get_hook_info + Agent 自身工具)
   * @keyword-en get-tools
   */
  async getTools(
    agentDir: string,
    invocationContext?: HookInvocationContext,
  ): Promise<unknown[]> {
    const loaded = await this.load(agentDir, invocationContext);
    return loaded.tools;
  }

  /**
   * 构建对话层 AI 适配器，并合并 base prompt、主动对话规则和 Agent 定义。
   * @keyword-en build-ai-adapter
   */
  private buildAiAdapter(
    proactiveContext?: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
    },
    tools?: unknown[],
    agentContext?: AgentRuntimeContext,
  ) {
    const buildMergedSystemPrompt = (
      agentDefinitionPrompt?: string,
    ): string => {
      const systemPromptJson: LlmSystemPromptJson = buildBaseLlmSystemPrompt();

      if (agentContext) {
        systemPromptJson.role.agentRuntime = {
          priority: 'system',
          agentId: agentContext.agentId,
          agentPrincipalId: agentContext.agentPrincipalId,
          tenantId: agentContext.tenantId ?? null,
          ...(agentContext.nickname
            ? { nickname: agentContext.nickname }
            : {}),
          ...(agentContext.purpose ? { purpose: agentContext.purpose } : {}),
          notes: [
            'Current business tenant_id comes from the current triggering user and is used only for business data isolation.',
            'Hook authorization always uses agentPrincipalId. Never use tenantId as principalId.',
          ],
        };
      }

      if (proactiveContext) {
        systemPromptJson.role.proactiveDialogue = {
          priority: 'critical',
          sessionId: proactiveContext.sessionId,
          agentPrincipalId: proactiveContext.agentPrincipalId,
          triggerMessageId: proactiveContext.triggerMessageId,
          rules: [
            'Any user-visible reply must be sent by calling saas.app.conversation.sendMsg through call_hook. Returning final text directly will not be delivered to the user and counts as failure.',
            'Before executing any business hook, first query callHistory and reuse recent successful hook names/payloads when a title matches the current task.',
            'If user wording may be an informal alias or synonym of a platform concept, resolve it with knowledgeCatalog plus sessionData/knowledge before choosing hooks or answering.',
            'If callHistory has no usable match or the situation is uncertain, use this discovery order before sendMsg: sessionData first (handbook.* plus other relevant keys), then knowledge base, then hook registry/schema last.',
            'If the user refers to previous tool output, query callHistory first and fetch matching detail before acting.',
            'Capability/action requests must be manual-backed. Do not answer or act from generic model knowledge.',
            'For sendMsg, replyToId must exactly equal triggerMessageId from this JSON role.',
            'Decide from the full context whether to send, when to send, and what to send. Consider all recent messages, not only the last one.',
            'You may split a long answer into up to 4 sendMsg calls for natural conversation. Do not over-send.',
            'After sending the needed message(s), finish the turn. Do not wait for the user or start another turn.',
          ],
        };
      }

      const trimmedAgentDefinition = agentDefinitionPrompt?.trim();
      if (trimmedAgentDefinition) {
        systemPromptJson.role.agentDefinition = {
          priority: 'high',
          prompt: trimmedAgentDefinition,
          rules: [
            'Follow this Agent definition continuously for role, tone, boundaries, and business goals.',
            'Do not fall back to a generic assistant identity.',
          ],
        };
      }

      const { system, agentRuntime, agentDefinition, proactiveDialogue } =
        systemPromptJson.role;
      systemPromptJson.role = {
        system,
        ...(agentRuntime ? { agentRuntime } : {}),
        ...(agentDefinition ? { agentDefinition } : {}),
        ...(proactiveDialogue ? { proactiveDialogue } : {}),
      };

      return JSON.stringify(systemPromptJson);
    };

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
        const mergedSystemPrompt = buildMergedSystemPrompt(req.systemPrompt);

        const aiReq: AIModelRequest = {
          modelId: req.modelId,
          messages: req.messages,
          systemPrompt: mergedSystemPrompt,
          sessionId: req.sessionId,
          conversationGroupId: req.conversationGroupId,
          checkpointer: isCheckpointSaver(req.checkpointer)
            ? req.checkpointer
            : undefined,
          params: req.params as AIModelRequest['params'],
          tools: tools && tools.length > 0 ? tools : undefined,
        };
        return this.aiModelService.chatStream(aiReq);
      },
      resolveModelNameByIds: (modelIds: string[]) =>
        this.aiModelService.resolveModelNameByIds(modelIds),
    };
  }
}
