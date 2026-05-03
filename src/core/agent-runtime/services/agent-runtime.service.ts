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
import { buildBaseLlmSystemPrompt } from '../prompts/base-llm.prompt';

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
  ) {}

  /**
   * 加载并准备 Agent (描述/工具/对话层)
   * @keyword-en load-agent
   */
  async load(
    inputDir: string,
    invocationContext?: HookInvocationContext,
  ): Promise<LoadedAgent> {
    const loaded = await this.loader.loadAll(inputDir);
    const getCtx: InvocationContextProvider = () => invocationContext ?? {};
    // 5 个 hook 工具 (call_hook + call_hook_async + 3 meta tool) 强制注入到工具集
    const hookTools = [
      buildCallHookTool(this.hookBus, this.hookRpc, getCtx),
      buildCallHookAsyncTool(this.hookBus, this.hookRpc, getCtx),
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
    },
  ): AsyncGenerator<ModelSseEvent> {
    const loaded = await this.load(agentDir, options?.invocationContext);
    if (!loaded.dialogues) {
      throw new Error('该 Agent 未提供对话层 (dialogues)');
    }
    // 系统替 LLM 主动 list session_data, 渲染成 [session-data-recall]...[/] 块,
    // 注入到 messages 流末尾 (LLM 注意力 >> systemPrompt 中段, 解决 LLM 不主动调 list 的问题)
    const enrichedMessages = await this.enrichWithSessionRecall(
      messages,
      options?.invocationContext,
    );
    loaded.dialogues.handleAiServer(
      this.buildAiAdapter(options?.proactiveContext, loaded.tools),
    );
    loaded.dialogues.setAgentConfig?.({ aiModelIds: options?.aiModelIds });
    const gen = loaded.dialogues.handle(enrichedMessages);
    for await (const ev of gen as AsyncGenerator<ModelSseEvent>) {
      yield ev;
    }
  }

  /**
   * 在 messages 流末尾注入 [session-data-recall] 块 :: 系统替 LLM 拉一次 sessionData.list,
   * 把 listing 包在标签里作为 system message 追加到 messages 数组。失败时静默跳过 (不阻塞主对话)。
   *
   * 设计要点 ::
   * - 走 hookBus emit 而非直接 inject AiSessionDataService, 避免 core/agent-runtime 反向依赖 app/conversation
   * - source: 'system' 绕开 @CheckAbility('read', 'session') 的 LLM-only 校验 (agent 可能没绑 RBAC)
   * - 标签 [session-data-recall]...[/session-data-recall] 让 LLM 一眼定位本块
   * @keyword-en enrich-session-recall recall-tag
   */
  private async enrichWithSessionRecall(
    messages: ChatMessage[],
    invocationContext?: HookInvocationContext,
  ): Promise<ChatMessage[]> {
    const sessionId = invocationContext?.extras?.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) return messages;

    try {
      const results = (await this.hookBus.emit({
        name: 'saas.app.conversation.sessionData.list',
        payload: { sessionId },
        context: {
          ...(invocationContext ?? {}),
          source: 'system',
        } as HookInvocationContext,
      })) as Array<{
        status?: string;
        data?: { listing?: string; count?: number };
      }>;

      const first = results?.[0];
      if (!first || first.status === 'error') return messages;
      const listing = first.data?.listing;
      if (typeof listing !== 'string' || !listing) return messages;

      const recallContent = [
        '[session-data-recall]',
        '⬇ 系统已替你拉取本会话全部 session_data 元数据。**不要再调 sessionData.list**, 直接读这里。',
        '',
        '## 三件事 :: 看记忆 → 用记忆 → 沉淀新记忆',
        '',
        '### 1) 命中 title (本块底部 listing) → 取完整 value',
        '',
        '```',
        'call_hook({',
        '  target: "saas",',
        `  hookName: "saas.app.conversation.sessionData.get",`,
        `  payload: { sessionId: "${sessionId}", key: "<命中的 key>" }`,
        '})',
        '```',
        '',
        '取到 value 即视作已查询,并且不要重复存入了,除非与现有的有本质不同',
        '',
        '### 2) 不命中 → 走业务 hook; 收尾**必须沉淀**',
        '',
        '```',
        'call_hook({',
        '  target: "saas",',
        `  hookName: "saas.app.conversation.sessionData.save",`,
        '  payload: {',
        `    sessionId: "${sessionId}",`,
        '    key:   "<分层 key, 字符集 [a-zA-Z0-9_.-], ≤128 字符>",',
        '    value: { /* 任意 JSON, 单 key ≤ 10KB */ },',
        '    title: "<≥ 8 字符, 描述性长标题, list 时唯一的判断依据>"',
        '  }',
        '})',
        '```',
        '',
        'title 写法 :: ❌ "memo"/"数据"/与 key 重复; ✅ "membershipList 调用配方 :: payload 必须包 input{} 不能裸字段" / "SaaS 系统 Hook 总览 :: identity 过滤维度速记" / "查用户角色的两步路径 :: membershipList → roleList 按 code 配对"。',
        '',
        '### 3) 沉淀模式 (key 命名规范)',
        '',
        '- **hook 失败→成功后** :: key=`hook.<hookname>.recipe`, value=`{ correctPayload, lesson, confirmedAt }`',
        '- **getChapter 读完一章** :: key=`knowledge.<bookId>.<chapterSlug>`, value=`{ bookId, chapterId, summary, keyHooks?, hints? }`',
        '- **多 hook 串联完成的查询** :: key=`recipe.<task-slug>`, value=`{ steps:[{hook,payload,note}], keyEntities, parallel? }`',
        '- **常用实体 id** :: key=`entity.<kind>.<slug>`, value=`{ id, displayName/name/alias }`',
        '- **用户偏好 / 进度** :: key=`user.pref.<aspect>` / `progress.<task>`',
        '',
        '不要 save :: 当前消息已可读的临时变量 / 整页长文本 (摘要后再存) / token / 凭证。',
        '',
        '---',
        '## 本会话已有记忆',
        '',
        listing,
        '[/session-data-recall]',
      ].join('\n');

      messages[messages.length - 1].content = [recallContent, messages[messages.length - 1].content].join('\n');

      return [
        ...messages,
      ];
    } catch (e) {
      this.logger.warn(
        `[session-data-recall] enrich failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return messages;
    }
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

  private buildAiAdapter(
    proactiveContext?: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
    },
    tools?: unknown[],
  ) {
    // 主动对话模式: 前置注入系统提示词, 用 [system prompt]...[/system prompt] 包裹
    const injectedPrefix = proactiveContext
      ? [
          '[system prompt]',
          `你处于主动对话模式。这点最重要,你的回答必须通过调用工具来发送给用户，而不是直接返回，直接返回是无效的。`,
          `当前 IM 会话 session_id="${proactiveContext.sessionId}"，你的 principal_id="${proactiveContext.agentPrincipalId}"。`,
          `发送消息请参阅【对话 Hook 技能手册】中的 saas.app.conversation.sendMsg hook 说明（bookId=local_conversation_hook_skill），其中包含完整的 payload 结构、参数约束和使用场景。`,
          `replyToId 固定为 "${proactiveContext.triggerMessageId}"，不得修改或编造。`,
          `根据上下文自主决定是否发送、何时发送、发送什么。在上下文中要结合所有消息来判断决定如何返回,不能出现回答不连贯的问题.`,
          `有时候用户是发的连贯信息,要结合历史消息来进行综合回复,而不是只针对最后一条消息进行回复。`,
          `你可以模拟人类情感, 比如长句可以分成多条发送,最多 4 轮, 以表现出思考的过程和情感的表达, 但要注意不要过度发送过多消息导致用户体验变差。`,
          `你发完就可以结束这轮对话了, 不需要等用户回复, 也不需要等下一轮对话, 只要你觉得发完了就可以结束了。不要那么啰嗦,这一点很重要`,
          '[/system prompt]',
        ].join('\n')
      : null;

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
        const basePrompt = buildBaseLlmSystemPrompt();
        const mergedSystemPrompt = [basePrompt, injectedPrefix, req.systemPrompt]
          .filter(Boolean)
          .join('\n');

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
