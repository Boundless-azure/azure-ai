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
 * Code-agent action enum accepted by dependency choice submit.
 * @keyword-cn 代码智能体选择, 动作选择
 * @keyword-en code-agent-choice, action-selection
 */
const codeAgentChoiceActionSchema = z.enum(['app', 'unit', 'data-point']);

/**
 * Route plan accepted from the dependency choice card.
 * @keyword-cn 代码智能体选择, 路由计划
 * @keyword-en code-agent-choice, route-plan
 */
const codeAgentRoutePlanSchema = z
  .object({
    id: z.string().optional(),
    requirement: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    useAction: codeAgentChoiceActionSchema.nullable().optional(),
    waitChooseAction: z.array(codeAgentChoiceActionSchema).optional(),
    useSolution: z.record(z.string(), z.unknown()).nullable().optional(),
    waitChoose: z.array(z.record(z.string(), z.unknown())).optional(),
    reason: z.string().optional(),
  })
  .passthrough();

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
  chooseSolution: z.string().optional(),
  chooseAction: codeAgentChoiceActionSchema.optional(),
  chooseActions: z.array(codeAgentChoiceActionSchema).optional(),
  routePlan: z.array(codeAgentRoutePlanSchema).min(1),
  selectedSolution: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Payload schema for reading a submitted code-agent dependency choice state.
 * @keyword-cn 代码智能体选择, 状态读取
 * @keyword-en code-agent-choice-state, session-metadata
 */
const codeAgentChoiceStateSchema = z.object({
  sessionId: z.string().optional(),
  runnerId: z.string().optional(),
  threadId: z.string().optional(),
  checkpointId: z.string().nullable().optional(),
  interruptId: z.string().nullable().optional(),
});

type CodeAgentChoiceSubmitPayload = z.infer<typeof codeAgentChoiceSubmitSchema>;
type CodeAgentChoiceStatePayload = z.infer<typeof codeAgentChoiceStateSchema>;
type CodeAgentRoutePlanItem = z.infer<typeof codeAgentRoutePlanSchema>;

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
  chooseAction: 'app' | 'unit' | 'data-point';
  chooseActions?: Array<'app' | 'unit' | 'data-point'>;
  routePlan?: Array<Record<string, unknown>>;
  requirement?: string;
  selectedSolution?: Record<string, unknown>;
  context?: Record<string, unknown>;
  submittedAt: string;
};

type CodeAgentResumeResult = {
  supported: boolean;
  checkpointId: string | null;
  threadId?: string;
  status: 'skipped' | 'scheduled' | 'failed';
  message?: string;
  result?: unknown;
};

/**
 * @title Code Agent Choice Hook Controller
 * @description Accepts selection-card submissions and stores the selected Solution/action route.
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
      'Stores routePlan and derived compatibility chooseSolution / chooseAction on chat session metadata and currentSession for later graph resume.',
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
    let choice: CodeAgentChoiceMetadata;
    try {
      choice = normalizeCodeAgentChoiceMetadata(payload, agentPrincipalId);
    } catch (error) {
      return {
        status: HookResultStatus.Error,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    const metadataChoiceKey = buildCodeAgentChoiceStateKey(choice);
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
        metadataChoicesKey: 'codeAgent.dependencyChoices',
        metadataChoiceKey,
        choice,
        currentSessionField: 'codeAgentDependencyChoice',
        resume,
      },
    };
  }

  /**
   * Read whether the dependency choice card has already been submitted.
   * @keyword-cn 代码智能体选择, 状态读取
   * @keyword-en code-agent-choice-state, session-metadata
   */
  @HookRoute({
    hook: 'saas.app.conversation.codeAgentChoiceState',
    description:
      'Read the stored code-agent dependency-check selection state for a conversation card.',
    args: [codeAgentChoiceStateSchema],
    metadata: { tags: ['conversation', 'code-agent', 'selection'] },
  })
  @CheckAbility('read', 'session')
  async handleState(
    payload: CodeAgentChoiceStatePayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const sessionId = resolveChoiceSessionId(payload, context);
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error: 'sessionId missing for code-agent choice state',
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

    const metadataChoiceKey = buildCodeAgentChoiceStateKey(payload);
    const choice = findCodeAgentChoiceMetadata(session.metadata, payload);
    const submitted = Boolean(choice);
    return {
      status: HookResultStatus.Success,
      data: {
        submitted,
        sessionId,
        metadataChoiceKey,
        choice: submitted ? choice : null,
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
          ...(choice.chooseActions
            ? { chooseActions: choice.chooseActions }
            : {}),
          ...(choice.routePlan ? { routePlan: choice.routePlan } : {}),
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
        status: 'scheduled',
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
  payload: { sessionId?: string },
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
 * Read the code-agent metadata bucket from session metadata.
 * @keyword-cn 代码智能体选择, 会话元数据
 * @keyword-en code-agent-choice, session-metadata
 */
function readCodeAgentMetadataBucket(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  return metadata?.codeAgent &&
    typeof metadata.codeAgent === 'object' &&
    !Array.isArray(metadata.codeAgent)
    ? (metadata.codeAgent as Record<string, unknown>)
    : null;
}

/**
 * Extract the stored code-agent dependency choice metadata from session metadata.
 * @keyword-cn 代码智能体选择, 会话元数据
 * @keyword-en code-agent-choice, session-metadata
 */
function extractCodeAgentChoiceMetadata(
  metadata: Record<string, unknown> | null | undefined,
): CodeAgentChoiceMetadata | null {
  const codeAgent = readCodeAgentMetadataBucket(metadata);
  const choice = codeAgent?.dependencyChoice;
  return choice && typeof choice === 'object' && !Array.isArray(choice)
    ? (choice as CodeAgentChoiceMetadata)
    : null;
}

/**
 * Find the stored dependency choice for the currently rendered card.
 * @keyword-cn 代码智能体选择状态, 依赖选择
 * @keyword-en code-agent-choice-state, dependency-selection
 */
function findCodeAgentChoiceMetadata(
  metadata: Record<string, unknown> | null | undefined,
  payload: CodeAgentChoiceStatePayload,
): CodeAgentChoiceMetadata | null {
  const codeAgent = readCodeAgentMetadataBucket(metadata);
  const choices = codeAgent?.dependencyChoices;
  const choiceKey = buildCodeAgentChoiceStateKey(payload);
  if (choices && typeof choices === 'object' && !Array.isArray(choices)) {
    const keyed = (choices as Record<string, unknown>)[choiceKey];
    if (
      keyed &&
      typeof keyed === 'object' &&
      !Array.isArray(keyed) &&
      isMatchingCodeAgentChoiceState(payload, keyed as CodeAgentChoiceMetadata)
    ) {
      return keyed as CodeAgentChoiceMetadata;
    }
  }

  const latest = extractCodeAgentChoiceMetadata(metadata);
  return latest && isMatchingCodeAgentChoiceState(payload, latest)
    ? latest
    : null;
}

/**
 * Check whether a stored choice belongs to the currently rendered card.
 * @keyword-cn 代码智能体选择状态, 依赖选择
 * @keyword-en code-agent-choice-state, dependency-selection
 */
function isMatchingCodeAgentChoiceState(
  payload: CodeAgentChoiceStatePayload,
  choice: CodeAgentChoiceMetadata,
): boolean {
  if (payload.runnerId?.trim() && payload.runnerId.trim() !== choice.runnerId) {
    return false;
  }
  if (payload.threadId?.trim() && payload.threadId.trim() !== choice.threadId) {
    return false;
  }
  const checkpointId = payload.checkpointId?.trim();
  if (checkpointId && checkpointId !== choice.checkpointId) {
    return false;
  }
  const interruptId = payload.interruptId?.trim();
  if (interruptId && interruptId !== choice.interruptId) {
    return false;
  }
  return Boolean(
    payload.threadId?.trim() ||
    payload.checkpointId?.trim() ||
    payload.interruptId?.trim(),
  );
}

/**
 * Build a stable metadata key for one dependency choice card.
 * @keyword-cn 代码智能体选择状态, 会话元数据
 * @keyword-en code-agent-choice-state, session-metadata
 */
function buildCodeAgentChoiceStateKey(input: {
  runnerId?: string | null;
  threadId?: string | null;
  checkpointId?: string | null;
  interruptId?: string | null;
}): string {
  const runnerId = input.runnerId?.trim() || '-';
  const threadId = input.threadId?.trim() || '-';
  const checkpointId = input.checkpointId?.trim() || '-';
  const interruptId = input.interruptId?.trim() || '-';
  return [runnerId, threadId, checkpointId, interruptId].join('|');
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
  const chooseSolution =
    payload.chooseSolution?.trim() ||
    readPrimarySubmittedRouteSolutionId(payload.routePlan);
  const chooseAction =
    payload.chooseAction ?? readPrimarySubmittedRouteAction(payload.routePlan);
  const chooseActions = normalizeCodeAgentActions([
    ...(payload.chooseActions ?? []),
    ...readSubmittedRouteActions(payload.routePlan),
  ]);
  const selectedSolution =
    payload.selectedSolution ??
    readPrimarySubmittedRouteSolution(payload.routePlan);
  if (!chooseSolution) {
    throw new Error('routePlan must include a selected Solution');
  }
  if (!chooseAction) {
    throw new Error('routePlan must include a selected action');
  }
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
    chooseSolution,
    chooseAction,
    ...(chooseActions.length > 0 ? { chooseActions } : {}),
    routePlan: payload.routePlan,
    ...(payload.requirement?.trim()
      ? { requirement: payload.requirement.trim() }
      : {}),
    ...(selectedSolution ? { selectedSolution } : {}),
    context: {
      ...(payload.context ?? {}),
      chooseSolution,
      chooseAction,
      ...(chooseActions.length > 0 ? { chooseActions } : {}),
      routePlan: payload.routePlan,
      ...(selectedSolution ? { selectedSolution } : {}),
    },
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Read the first selected Solution id from submitted routePlan.
 * @keyword-cn 浠ｇ爜鏅鸿兘浣撻€夋嫨, 璺敱璁″垝
 * @keyword-en code-agent-choice, route-plan
 */
function readPrimarySubmittedRouteSolutionId(
  routePlan: CodeAgentRoutePlanItem[],
): string {
  const solution = readPrimarySubmittedRouteSolution(routePlan);
  if (!solution) return '';
  return (
    readChoiceRecordString(solution, 'solutionId') ||
    readChoiceRecordString(solution, 'id')
  );
}

/**
 * Read the first selected Solution object from submitted routePlan.
 * @keyword-cn 浠ｇ爜鏅鸿兘浣撻€夋嫨, Solution閫夋嫨
 * @keyword-en code-agent-choice, solution-selection
 */
function readPrimarySubmittedRouteSolution(
  routePlan: CodeAgentRoutePlanItem[],
): Record<string, unknown> | null {
  for (const route of routePlan) {
    if (
      route.useSolution &&
      typeof route.useSolution === 'object' &&
      !Array.isArray(route.useSolution)
    ) {
      return route.useSolution;
    }
  }
  return null;
}

/**
 * Read the first selected action from submitted routePlan.
 * @keyword-cn 浠ｇ爜鏅鸿兘浣撻€夋嫨, 鍔ㄤ綔閫夋嫨
 * @keyword-en code-agent-choice, action-selection
 */
function readPrimarySubmittedRouteAction(
  routePlan: CodeAgentRoutePlanItem[],
): 'app' | 'unit' | 'data-point' | undefined {
  return routePlan.find((route) => route.useAction)?.useAction ?? undefined;
}

/**
 * Read the de-duplicated action list from submitted routePlan.
 * @keyword-cn 浠ｇ爜鏅鸿兘浣撻€夋嫨, 鍔ㄤ綔閫夋嫨
 * @keyword-en code-agent-choice, action-selection
 */
function readSubmittedRouteActions(
  routePlan: CodeAgentRoutePlanItem[],
): Array<'app' | 'unit' | 'data-point'> {
  return normalizeCodeAgentActions(
    routePlan
      .map((route) => route.useAction)
      .filter((action): action is 'app' | 'unit' | 'data-point' =>
        Boolean(action),
      ),
  );
}

/**
 * Read one string field from a submitted choice record.
 * @keyword-cn 浠ｇ爜鏅鸿兘浣撻€夋嫨, 瀛楁璇诲彇
 * @keyword-en code-agent-choice, field-read
 */
function readChoiceRecordString(
  value: Record<string, unknown>,
  field: string,
): string {
  const raw = value[field];
  return typeof raw === 'string' ? raw.trim() : '';
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
  const rawChoices = codeAgent.dependencyChoices;
  const dependencyChoices =
    rawChoices && typeof rawChoices === 'object' && !Array.isArray(rawChoices)
      ? { ...(rawChoices as Record<string, unknown>) }
      : {};
  dependencyChoices[buildCodeAgentChoiceStateKey(choice)] = choice;
  codeAgent.dependencyChoice = choice;
  codeAgent.dependencyChoices = dependencyChoices;
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
 * Normalize code-agent action arrays from hook payloads.
 * @keyword-cn 代码智能体选择, 字段归一化
 * @keyword-en code-agent-choice, field-normalize
 */
function normalizeCodeAgentActions(
  values: Array<'app' | 'unit' | 'data-point'>,
): Array<'app' | 'unit' | 'data-point'> {
  return [...new Set(values)];
}

/**
 * Normalize optional string arrays from hook payloads.
 * @keyword-cn 字段归一化, 模型ID
 * @keyword-en field-normalize, model-ids
 */
function normalizeStringArray(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean);
}
