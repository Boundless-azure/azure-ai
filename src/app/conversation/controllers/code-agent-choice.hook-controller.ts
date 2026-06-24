import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type {
  HookInvocationContext,
  HookResult,
} from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { AgentRuntimeService } from '@/core/agent-runtime/services/agent-runtime.service';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { CurrentSessionService } from '../services/current-session.service';

/**
 * Payload schema for code-agent dependency choice submit.
 * @keyword-cn 代码智能体选择, 选择提交
 * @keyword-en code-agent-choice-submit, dependency-selection
 */
const codeAgentChoiceSubmitSchema = z.object({
  sessionId: z.string().optional(),
  runnerId: z.string().min(1),
  agentPrincipalId: z.string().optional(),
  agentId: z.string().optional(),
  aiModelIds: z.array(z.string()).optional(),
  threadId: z.string().optional(),
  checkpointId: z.string().nullable().optional(),
  interruptId: z.string().nullable().optional(),
  requirement: z.string().optional(),
  chooseSolution: z.string().min(1),
  chooseAction: z.enum(['solution', 'app', 'view', 'unit']),
  selectedSolution: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type CodeAgentChoiceSubmitPayload = z.infer<typeof codeAgentChoiceSubmitSchema>;

/**
 * Submitted dependency choice snapshot stored on the chat session metadata.
 * @keyword-cn 代码智能体选择, 会话元数据
 * @keyword-en code-agent-choice, session-metadata
 */
type CodeAgentChoiceMetadata = {
  runnerId: string;
  agentPrincipalId: string;
  agentId?: string;
  aiModelIds?: string[];
  threadId?: string;
  checkpointId: string | null;
  interruptId: string | null;
  chooseSolution: string;
  chooseAction: 'solution' | 'app' | 'view' | 'unit';
  requirement?: string;
  selectedSolution?: Record<string, unknown>;
  context?: Record<string, unknown>;
  submittedAt: string;
};

type CodeAgentResumeResult = {
  supported: boolean;
  checkpointId: string | null;
  threadId?: string;
  status: 'skipped' | 'resumed' | 'failed';
  message?: string;
  result?: unknown;
};

/**
 * @title Code Agent Choice Hook Controller
 * @description Accepts selection-card submissions and stores the selected dependency target.
 * @keyword-cn 代码智能体选择, 会话元数据, Hook入口
 * @keyword-en code-agent-choice, session-metadata, hook-controller
 */
@Injectable()
@HookController({
  pluginName: 'conversation',
  tags: ['conversation', 'code-agent', 'selection'],
})
export class CodeAgentChoiceHookController {
  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    private readonly currentSession: CurrentSessionService,
    @Inject(forwardRef(() => AgentRuntimeService))
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

  /**
   * Store code-agent dependency-check selection from the hook component.
   * @keyword-cn 代码智能体选择, 选择提交
   * @keyword-en code-agent-choice-submit, dependency-selection
   */
  @HookRoute({
    hook: 'saas.app.conversation.codeAgentChoiceSubmit',
    description:
      'Submit a code-agent dependency-check selection from the conversation card. ' +
      'Stores chooseSolution / chooseAction on chat session metadata and currentSession for later graph resume.',
    args: [codeAgentChoiceSubmitSchema],
    metadata: { tags: ['conversation', 'code-agent', 'selection'] },
  })
  @CheckAbility('update', 'session')
  async handleSubmit(
    payload: CodeAgentChoiceSubmitPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const sessionId = resolveChoiceSessionId(payload, context);
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error: 'sessionId missing for code-agent choice submit',
      };
    }

    const session = await this.sessionRepo.findOne({
      where: { sessionId, isDelete: false },
      select: { id: true, sessionId: true, metadata: true },
    });
    if (!session) {
      return {
        status: HookResultStatus.Error,
        error: `session not found: ${sessionId}`,
      };
    }

    const agentPrincipalId =
      payload.agentPrincipalId?.trim() || context?.principalId?.trim() || '';
    const choice = normalizeCodeAgentChoiceMetadata(payload, agentPrincipalId);
    const metadata = mergeCodeAgentChoiceMetadata(session.metadata, choice);
    await this.sessionRepo.update(session.id, {
      metadata: metadata as ChatSessionEntity['metadata'],
    });

    if (agentPrincipalId) {
      this.currentSession.setFields(sessionId, agentPrincipalId, {
        codeAgentDependencyChoice: choice,
        codeAgentResumeContext: choice.context ?? {},
      });
    }

    const resume = await this.resumeCodeAgentGraph(sessionId, choice);

    return {
      status: HookResultStatus.Success,
      data: {
        accepted: true,
        sessionId,
        metadataKey: 'codeAgent.dependencyChoice',
        currentSessionField: 'codeAgentDependencyChoice',
        resume,
      },
    };
  }

  /**
   * Resume the paused code-agent LangGraph thread after a dependency choice.
   * @keyword-cn 检查点恢复, 代码智能体选择
   * @keyword-en checkpoint-resume, code-agent-choice
   */
  private async resumeCodeAgentGraph(
    sessionId: string,
    choice: CodeAgentChoiceMetadata,
  ): Promise<CodeAgentResumeResult> {
    if (!choice.threadId) {
      return {
        supported: false,
        checkpointId: choice.checkpointId,
        status: 'skipped',
        message: 'threadId missing; cannot resume LangGraph checkpoint',
      };
    }
    if (!choice.agentPrincipalId) {
      return {
        supported: false,
        checkpointId: choice.checkpointId,
        threadId: choice.threadId,
        status: 'skipped',
        message: 'agentPrincipalId missing; cannot resume as code-agent',
      };
    }

    try {
      const loaded = await this.agentRuntime.load('code-agent', {
        invocationContext: {
          source: 'system',
          principalId: choice.agentPrincipalId,
          principalType: 'agent',
          extras: {
            sessionId,
            ...(choice.agentId ? { agentId: choice.agentId } : {}),
            codeAgentResume: true,
          },
        },
        aiModelIds: choice.aiModelIds,
        agentContext: {
          agentId: choice.agentId ?? 'code-agent',
          agentPrincipalId: choice.agentPrincipalId,
        },
      });
      const codeGenTool = findAgentToolByName(
        loaded.tools,
        'code_gen_orchestrate',
      );
      if (!codeGenTool) {
        return {
          supported: false,
          checkpointId: choice.checkpointId,
          threadId: choice.threadId,
          status: 'skipped',
          message: 'code_gen_orchestrate tool not found',
        };
      }
      const result = await invokeAgentTool(codeGenTool, {
        full_requirement: choice.requirement ?? '',
        runner_id: choice.runnerId,
        targetKind: choice.chooseAction,
        context: {
          ...(choice.context ?? {}),
          session_id: sessionId,
          chooseSolution: choice.chooseSolution,
          chooseAction: choice.chooseAction,
          ...(choice.selectedSolution
            ? { selectedSolution: choice.selectedSolution }
            : {}),
        },
        resume: {
          threadId: choice.threadId,
          ...(choice.checkpointId ? { checkpointId: choice.checkpointId } : {}),
          ...(choice.interruptId ? { interruptId: choice.interruptId } : {}),
        },
      });
      return {
        supported: true,
        checkpointId: choice.checkpointId,
        threadId: choice.threadId,
        status: 'resumed',
        result,
      };
    } catch (error) {
      return {
        supported: true,
        checkpointId: choice.checkpointId,
        threadId: choice.threadId,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Resolve the target chat session id from payload or hook context.
 * @keyword-cn 会话选择, 字段读取
 * @keyword-en choice-session-resolve, field-read
 */
function resolveChoiceSessionId(
  payload: CodeAgentChoiceSubmitPayload,
  context?: HookInvocationContext,
): string {
  const fromPayload = payload.sessionId?.trim();
  if (fromPayload) return fromPayload;
  const fromContext =
    typeof context?.extras?.sessionId === 'string'
      ? context.extras.sessionId.trim()
      : '';
  return fromContext;
}

/**
 * Normalize a submitted dependency choice before storing it.
 * @keyword-cn 代码智能体选择, 选择归一化
 * @keyword-en code-agent-choice, choice-normalize
 */
function normalizeCodeAgentChoiceMetadata(
  payload: CodeAgentChoiceSubmitPayload,
  agentPrincipalId: string,
): CodeAgentChoiceMetadata {
  return {
    runnerId: payload.runnerId.trim(),
    agentPrincipalId,
    ...(payload.agentId?.trim() ? { agentId: payload.agentId.trim() } : {}),
    ...(payload.aiModelIds
      ? { aiModelIds: normalizeStringArray(payload.aiModelIds) }
      : {}),
    ...(payload.threadId?.trim() ? { threadId: payload.threadId.trim() } : {}),
    checkpointId: payload.checkpointId?.trim() || null,
    interruptId: payload.interruptId?.trim() || null,
    chooseSolution: payload.chooseSolution.trim(),
    chooseAction: payload.chooseAction,
    ...(payload.requirement?.trim()
      ? { requirement: payload.requirement.trim() }
      : {}),
    ...(payload.selectedSolution
      ? { selectedSolution: payload.selectedSolution }
      : {}),
    ...(payload.context ? { context: payload.context } : {}),
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Merge the submitted choice into the session metadata without disturbing other keys.
 * @keyword-cn 会话元数据, 代码智能体选择
 * @keyword-en session-metadata, code-agent-choice
 */
function mergeCodeAgentChoiceMetadata(
  metadata: Record<string, unknown> | null | undefined,
  choice: CodeAgentChoiceMetadata,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  const rawCodeAgent = next.codeAgent;
  const codeAgent =
    rawCodeAgent &&
    typeof rawCodeAgent === 'object' &&
    !Array.isArray(rawCodeAgent)
      ? { ...(rawCodeAgent as Record<string, unknown>) }
      : {};
  codeAgent.dependencyChoice = choice;
  next.codeAgent = codeAgent;
  return next;
}

/**
 * Find one dynamically loaded agent tool by name.
 * @keyword-cn 工具查找, 代码智能体恢复
 * @keyword-en tool-lookup, code-agent-resume
 */
function findAgentToolByName(
  tools: unknown[],
  name: string,
): Record<string, unknown> | null {
  return (
    (tools.find(
      (tool) =>
        Boolean(tool) &&
        typeof tool === 'object' &&
        !Array.isArray(tool) &&
        (tool as Record<string, unknown>).name === name,
    ) as Record<string, unknown> | undefined) ?? null
  );
}

/**
 * Invoke a LangChain-style tool without depending on its concrete class.
 * @keyword-cn 工具调用, 代码智能体恢复
 * @keyword-en tool-invoke, code-agent-resume
 */
async function invokeAgentTool(
  tool: unknown,
  input: unknown,
): Promise<unknown> {
  if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
    throw new Error('invalid agent tool');
  }
  const record = tool as {
    invoke?: (value: unknown) => Promise<unknown>;
    call?: (value: unknown) => Promise<unknown>;
    func?: (value: unknown) => Promise<unknown>;
  };
  if (typeof record.invoke === 'function') {
    return await record.invoke(input);
  }
  if (typeof record.call === 'function') {
    return await record.call(input);
  }
  if (typeof record.func === 'function') {
    return await record.func(input);
  }
  throw new Error('agent tool is not invokable');
}

/**
 * Normalize optional string arrays from hook payloads.
 * @keyword-cn 字段归一化, 模型ID
 * @keyword-en field-normalize, model-ids
 */
function normalizeStringArray(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean);
}
