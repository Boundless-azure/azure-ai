import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AIModelResponse,
  ChatMessage,
  ModelSseEvent,
} from '@core/ai/types';
import type { AIModelRequest } from '@core/ai/types';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { AgentLoaderService } from './agent-loader.service';
import type {
  AgentAiModelClient,
  AgentAiRequest,
  AgentAiServer,
  LoadedAgent,
} from '../types/agent-runtime.types';
import { HookBusService } from '@/core/hookbus/services/hook.bus.service';
// AGENT-MONITOR-TEMP: 通用 LLM 监听埋点, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import { monitorChat } from '@/agents/code-agent/monitor/code-graph-ai-instrument';
import { RunnerHookRpcService } from '@/app/runner/services/runner-hook-rpc.service';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import {
  buildCallHookTool,
  buildCallHookBatchTool,
  buildSearchHookTool,
  buildGetHookTagTool,
  buildGetHookInfoTool,
  type InvocationContextProvider,
} from '../tools/call-hook.tools';
import { buildInitTipTool } from '../tools/init-tip.tool';
import {
  buildBaseLlmSystemPrompt,
  type LlmSystemPromptJson,
} from '../prompts/base-llm.prompt';
import { AiCallLogService } from '@/app/conversation/services/ai-call-log.service';
import { CurrentSessionService } from '@/app/conversation/services/current-session.service';
import { ImMessageService } from '@/app/conversation/services/im-message.service';
import { PluginService } from '@/core/plugin/services/plugin.service';
import { SolutionService } from '@/app/solution/services/solution.service';
import { TypeOrmCheckpointSaver } from '@/core/langgraph/checkpoint/services/typeorm-checkpoint.saver';

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
 * 1) 有对话层 (dialogues) 时, 通过 handleAiServer 注入带 useModel/withModel 的 AI adapter 并调用 handle(messages)
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
    @Inject(forwardRef(() => AiCallLogService))
    private readonly callLog: AiCallLogService,
    @Inject(forwardRef(() => CurrentSessionService))
    private readonly currentSession: CurrentSessionService,
    @Inject(forwardRef(() => ImMessageService))
    private readonly imMessageService: ImMessageService,
    private readonly pluginService: PluginService,
    private readonly solutionService: SolutionService,
    private readonly checkpointer: TypeOrmCheckpointSaver,
  ) {}

  /**
   * 加载并准备 Agent (描述/工具/对话层)
   *  - 主对话工具集 :: call_hook / call_hook_batch / search_hook / get_hook_tag / get_hook_info
   *  - call_hook 挂 callHistory 副作用 :: 仅成功项 (errorMsg 为空) 落库, FIFO 50 条上限
   * @keyword-en load-agent
   */
  async load(
    inputDir: string,
    options?: {
      invocationContext?: HookInvocationContext;
      aiModelIds?: string[];
      agentContext?: AgentRuntimeContext;
    },
  ): Promise<LoadedAgent> {
    const invocationContext = options?.invocationContext;
    const workflowContext = this.buildHandleWorkflowContext(
      invocationContext,
      options?.agentContext,
      options?.aiModelIds,
    );
    const loaded = await this.loader.loadAll(inputDir, {
      aiServer: this.buildAiAdapter({
        aiModelIds: options?.aiModelIds,
        agentContext: options?.agentContext,
        mergeSystemPrompt: false,
      }),
      pluginService: this.pluginService,
      solutionService: this.solutionService,
      runnerHookRpc: this.hookRpc,
      hookBus: this.hookBus,
      checkpointer: this.checkpointer,
      ...(workflowContext ? { workflowContext } : {}),
      agentConfig: { aiModelIds: options?.aiModelIds },
    });
    const getCtx: InvocationContextProvider = () => invocationContext ?? {};

    // 副作用 :: callLog 硬记录仅保存成功项; 失败项只服务当前轮纠错, 不跨轮沉淀.
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
      this.currentSession.recordHookCall(
        sessionId,
        ctx.principalId,
        record.hookName,
        record.errorMsg.length === 0,
      );
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
      buildCallHookBatchTool(
        this.hookBus,
        this.hookRpc,
        getCtx,
        { onCallComplete },
        { defaultDebug },
      ),
      buildSearchHookTool(this.hookBus, this.hookRpc, getCtx),
      buildGetHookTagTool(this.hookBus, this.hookRpc, getCtx),
      buildGetHookInfoTool(this.hookBus, this.hookRpc, getCtx),
      buildInitTipTool(this.currentSession, getCtx, this.callLog),
    ];
    loaded.tools = [...hookTools, ...loaded.tools];
    return loaded;
  }

  /**
   * 当存在对话层时, 将 AI adapter 注入并返回可直接调用的句柄
   * @keyword-en attach-dialogue
   */
  attachDialogue(agent: LoadedAgent): void {
    if (!agent.dialogues) return;
    try {
      agent.dialogues.handleAiServer(this.buildAiAdapter());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`注入 AI adapter 失败: ${msg}`);
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
      /** 会话 ID :: 开启 checkpoint 会话记忆 (thread = sessionId:agentPrincipalId); 缺省则退回无状态全量历史 */
      sessionId?: string;
    },
  ): AsyncGenerator<ModelSseEvent> {
    const loaded = await this.load(agentDir, {
      invocationContext: options?.invocationContext,
      aiModelIds: options?.aiModelIds,
      agentContext: options?.agentContext,
    });
    if (!loaded.dialogues) {
      throw new Error('该 Agent 未提供对话层 (dialogues)');
    }
    // S3 checkpoint 融合 (中心化, 对所有 agent 对话层通用) :: 有 sessionId 就给对话专用 adapter 挂 checkpoint 上下文,
    // adapter 在 chatStream 时统一 → 只发最新一条 + 挂 checkpointer + thread=sessionId:agentPrincipalId; 历史(含 tool 轮)由
    // checkpoint append-only 持久。工作流的 handle-adapter 不带此上下文, 不受影响。
    const cpSessionId = options?.sessionId ?? options?.proactiveContext?.sessionId;
    const cpAgentPrincipalId =
      options?.agentContext?.agentPrincipalId ??
      options?.proactiveContext?.agentPrincipalId;
    const checkpoint =
      cpSessionId && this.checkpointer
        ? {
            sessionId: cpSessionId,
            threadKey: cpAgentPrincipalId
              ? `${cpSessionId}:${cpAgentPrincipalId}`
              : cpSessionId,
            checkpointer: this.checkpointer as unknown,
          }
        : undefined;
    // session_data 不再自动注入 user message; directive/preference/handbook 通过 saas.app.conversation.initTip 的 suggestions 推过去 (callHistoryHints / handbookInventory / activeDirectives), LLM 自行 sessionData.get 取真内容.
    loaded.dialogues.handleAiServer(
      this.buildAiAdapter({
        proactiveContext: options?.proactiveContext,
        tools: loaded.tools,
        agentContext: options?.agentContext,
        aiModelIds: options?.aiModelIds,
        checkpoint,
      }),
    );
    loaded.dialogues.setAgentConfig?.({ aiModelIds: options?.aiModelIds });
    // user message 直发原话, 不再补 currentSessionGuard; init_tip + examples + reasoning ≥ 20 承担引导
    const gen = loaded.dialogues.handle(messages);
    for await (const ev of gen as AsyncGenerator<ModelSseEvent>) {
      yield ev;
    }
  }

  /**
   * 获取工具集合 (含 call_hook + call_hook_batch + search_hook + get_hook_tag + get_hook_info + Agent 自身工具)
   * @keyword-en get-tools
   */
  async getTools(
    agentDir: string,
    invocationContext?: HookInvocationContext,
  ): Promise<unknown[]> {
    const loaded = await this.load(agentDir, { invocationContext });
    return loaded.tools;
  }

  /**
   * 从 Hook 调用上下文提取会话回调所需的最小字段，供异步工具回写 IM 消息。
   * @keyword-en build-handle-workflow-context
   */
  private buildHandleWorkflowContext(
    invocationContext?: HookInvocationContext,
    agentContext?: AgentRuntimeContext,
    aiModelIds?: string[],
  ): {
    sessionId: string;
    agentId?: string;
    agentPrincipalId: string;
    aiModelIds?: string[];
    imMessageService: ImMessageService;
  } | null {
    const sessionId = invocationContext?.extras?.sessionId;
    const agentPrincipalId = invocationContext?.principalId;
    if (typeof sessionId !== 'string' || !sessionId) return null;
    if (typeof agentPrincipalId !== 'string' || !agentPrincipalId) {
      return null;
    }
    return {
      sessionId,
      agentId: agentContext?.agentId,
      agentPrincipalId,
      aiModelIds: Array.isArray(aiModelIds)
        ? aiModelIds.map((item) => item.trim()).filter(Boolean)
        : undefined,
      imMessageService: this.imMessageService,
    };
  }

  /**
   * 构建 Agent AI 适配器；可按运行场景选择是否合并 runtime prompt。
   * @keyword-en build-ai-adapter
   */
  private buildAiAdapter(options?: {
    proactiveContext?: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
    };
    tools?: unknown[];
    agentContext?: AgentRuntimeContext;
    aiModelIds?: string[];
    mergeSystemPrompt?: boolean;
    /** 有值 → 该 adapter 的 chatStream 开 checkpoint 会话记忆: 只发最新一条 + 挂 checkpointer + thread=threadKey */
    checkpoint?: {
      sessionId: string;
      threadKey: string;
      checkpointer: unknown;
    };
  }): AgentAiServer {
    const proactiveContext = options?.proactiveContext;
    const tools = options?.tools;
    const agentContext = options?.agentContext;
    const checkpoint = options?.checkpoint;
    const mergeSystemPrompt = options?.mergeSystemPrompt ?? true;
    const configuredModelIds = Array.isArray(options?.aiModelIds)
      ? options.aiModelIds.map((item) => item.trim()).filter(Boolean)
      : [];
    const aiModelService = this.aiModelService;

    const buildMergedSystemPrompt = (
      agentDefinitionPrompt?: string,
    ): string | undefined => {
      const trimmedAgentDefinition = agentDefinitionPrompt?.trim();
      if (!mergeSystemPrompt) {
        return trimmedAgentDefinition || undefined;
      }

      const systemPromptJson: LlmSystemPromptJson = buildBaseLlmSystemPrompt();

      if (agentContext) {
        systemPromptJson.role.agentRuntime = {
          priority: 'system',
          agentId: agentContext.agentId,
          agentPrincipalId: agentContext.agentPrincipalId,
          tenantId: agentContext.tenantId ?? null,
          ...(agentContext.nickname ? { nickname: agentContext.nickname } : {}),
          ...(agentContext.purpose ? { purpose: agentContext.purpose } : {}),
          myContext: [
            'My business tenant_id comes from the current triggering user. I use it only for business data isolation.',
            'My hook authorization always uses my agentPrincipalId. I never use tenantId as principalId.',
          ],
        };
      }

      if (proactiveContext) {
        systemPromptJson.role.proactiveDialogue = {
          priority: 'critical',
          sessionId: proactiveContext.sessionId,
          agentPrincipalId: proactiveContext.agentPrincipalId,
          triggerMessageId: proactiveContext.triggerMessageId,
          myProactiveBehavior: [
            'My only voice channel to the user is saas.app.conversation.sendMsg through call_hook. If I return final text without sendMsg, the user never sees it — silently lost work.',
            'For sendMsg, I leave replyToId unset; the server fills it from ctx.extras.triggerMessageId automatically. sessionId and senderPrincipalId are also auto-filled from ctx — I never impersonate other principals.',
            'I decide what / when / whether to send by reading the full recent context, not only the last message.',
            'I may split a long answer into up to 4 sendMsg calls for natural pacing. I do not over-send.',
            'After delivering the needed reply, I finish the turn. I do not wait for the user or open another round.',
          ],
        };
      }

      if (trimmedAgentDefinition) {
        systemPromptJson.role.agentDefinition = {
          priority: 'high',
          prompt: trimmedAgentDefinition,
          myDefinitionBehavior: [
            'I continuously follow my Agent definition for role, tone, boundaries, and business goals.',
            'I never fall back to a generic assistant identity.',
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

    // checkpoint 模式的消息裁剪 :: 只发"本轮新增" —— 从最后一条 user 消息起截 (保证含 user 且非空,
    // 避免只剩 system 触发 Anthropic "messages must not be empty"); 找不到 user (如主动模式) 则发全量兜底。
    const trimToLastUserTurn = (msgs: ChatMessage[]): ChatMessage[] => {
      if (msgs.length <= 1) return msgs;
      let i = msgs.length - 1;
      while (i >= 0 && msgs[i].role !== 'user') i -= 1;
      const sliced = i >= 0 ? msgs.slice(i) : msgs;
      return sliced.length > 0 ? sliced : msgs;
    };

    const buildAiRequest = (
      modelId: string,
      req: AgentAiRequest,
    ): AIModelRequest => ({
      modelId,
      source:
        req.source ??
        (agentContext?.agentId
          ? `agent-runtime:${agentContext.agentId}`
          : undefined),
      // checkpoint 模式: 历史(含 tool 轮)由 checkpoint 供, 只发本轮新增(从最后一条 user 起); 无 checkpoint 走原全量
      messages: checkpoint ? trimToLastUserTurn(req.messages) : req.messages,
      systemPrompt: buildMergedSystemPrompt(req.systemPrompt),
      // checkpoint 模式统一注 :: sessionId 保真 + conversationGroupId=threadKey(→ thread_id) + checkpointer
      sessionId: checkpoint?.sessionId ?? req.sessionId,
      conversationGroupId: checkpoint?.threadKey ?? req.conversationGroupId,
      checkpointer: checkpoint
        ? (checkpoint.checkpointer as AIModelRequest['checkpointer'])
        : isCheckpointSaver(req.checkpointer)
          ? req.checkpointer
          : undefined,
      params: req.params as AIModelRequest['params'],
      isolateCallbacks: req.isolateCallbacks,
      // 每次调用显式注入的工具覆盖 adapter 固定工具 (让 code 生成节点跑自己的 write_file/read_file 循环);
      // 未提供时沿用 agent 的固定工具集。
      tools: req.tools?.length
        ? req.tools
        : tools && tools.length > 0
          ? tools
          : undefined,
    });

    const requireModelId = async (
      resolveModelId: () => Promise<string | null>,
    ): Promise<string> => {
      const modelId = await resolveModelId();
      if (!modelId) {
        throw new Error(
          'No usable model slot is configured for this Agent; AI calls can only use assigned agent.aiModelIds.',
        );
      }
      return modelId;
    };

    const resolveAssignedModelId = (
      modelId: string,
    ): Promise<string | null> => {
      const trimmedModelId = modelId.trim();
      if (!trimmedModelId || !configuredModelIds.includes(trimmedModelId)) {
        return Promise.resolve(null);
      }
      return aiModelService.resolveModelIdByIds([trimmedModelId]);
    };

    const resolveSlotModelId = async (
      preferredIndex: number,
    ): Promise<string | null> => {
      const assignedModelId = await aiModelService.resolveModelIdByNearestSlot(
        configuredModelIds,
        preferredIndex,
      );
      if (assignedModelId) return assignedModelId;
      return null;
    };

    const streamWithModel = (
      modelId: string,
      req: AgentAiRequest,
    ): AsyncGenerator<ModelSseEvent, AIModelResponse, unknown> =>
      (async function* () {
        return yield* aiModelService.chatStream(buildAiRequest(modelId, req));
      })();

    const createModelClient = (
      resolveModelId: () => Promise<string | null>,
    ): AgentAiModelClient => ({
      getModelId: resolveModelId,
      chat: async (req: AgentAiRequest) => {
        const modelId = await requireModelId(resolveModelId);
        // AGENT-MONITOR-TEMP: 通用监听埋点, 后期删 (grep AGENT-MONITOR-TEMP)
        return monitorChat(req, {
          chat: () => aiModelService.chat(buildAiRequest(modelId, req)),
          stream: () => aiModelService.chatStream(buildAiRequest(modelId, req)),
        });
      },
      chatStream: (req: AgentAiRequest) =>
        (async function* () {
          const modelId = await requireModelId(resolveModelId);
          return yield* streamWithModel(modelId, req);
        })(),
    });

    return {
      chat: async (req: AgentAiRequest & { modelId: string }) => {
        const modelId = await requireModelId(() =>
          resolveAssignedModelId(req.modelId),
        );
        // AGENT-MONITOR-TEMP: 通用监听埋点, 后期删 (grep AGENT-MONITOR-TEMP)
        return monitorChat(req, {
          chat: () => aiModelService.chat(buildAiRequest(modelId, req)),
          stream: () => aiModelService.chatStream(buildAiRequest(modelId, req)),
        });
      },
      chatStream: (
        req: AgentAiRequest & { modelId: string },
      ): AsyncGenerator<ModelSseEvent, AIModelResponse, unknown> =>
        (async function* () {
          const modelId = await requireModelId(() =>
            resolveAssignedModelId(req.modelId),
          );
          return yield* streamWithModel(modelId, req);
        })(),
      useModel: (preferredIndex: number) =>
        createModelClient(() => resolveSlotModelId(preferredIndex)),
      withModel: (modelId: string) =>
        createModelClient(() => resolveAssignedModelId(modelId)),
    };
  }
}
