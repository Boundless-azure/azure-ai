import { Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  START,
  StateGraph,
  isInterrupted,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { tool } from 'langchain';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import type { CodeAgentTargetKind } from './dialogues/types';
import { sendDependencyChoiceCard } from './nodes/dependency-choice-card';
import {
  readContextString,
  readStringField,
} from './nodes/dependency-check-context';
import { buildDependencyResumeChoice } from './nodes/dependency-check-decision';
import { createCodeGraphNodeLogger } from './nodes/dependency-check-log';
import { runDependencyCheckNode } from './nodes/dependency-check.node';
import { runTargetResolutionNode } from './nodes/target-resolution.node';
import {
  buildBlockedDependencyCheckResult,
  buildDependencyCheckResultMessage,
  buildWaitingDependencyCheckResultFromInterrupt,
  readCodeGenGraphDependencyCheck,
} from './nodes/dependency-check-results';
import {
  CODE_GRAPH_ACTION_VALUES,
  type CodeGenOrchestrateInput,
  type CodeGraphDependencyCheckResult,
  type CodeGraphDependencyInterruptPayload,
  type CodeGraphRequest,
  type CodeGraphResumeRef,
  type CodeGraphToolContext,
  type HookCaller,
  type WorkflowContext,
} from './nodes/dependency-check.types';

const logger = new Logger('CodeAgentHandle');
const DEFAULT_CODE_AGENT_LOG_DIR = 'logs/code-agent';

type HookCallContextLike = {
  source?: 'llm' | 'system' | 'http' | 'runner';
  principalId?: string;
  principalType?: string;
  extras?: Record<string, unknown>;
};

type HookResultLike = {
  status?: string;
  data?: unknown;
  error?: string;
  debugLog?: unknown[];
};

type HookBusLike = {
  select(name: string): unknown[];
  emit(event: {
    name: string;
    payload?: unknown;
    context?: HookCallContextLike;
  }): Promise<HookResultLike[]>;
};
const CodeGenGraphAnnotation = Annotation.Root({
  request: Annotation<CodeGraphRequest>(),
  input: Annotation<CodeGenOrchestrateInput>(),
  targetKind: Annotation<CodeAgentTargetKind>(),
  dependencyCheck: Annotation<CodeGraphDependencyCheckResult | undefined>(),
});

type CodeGenGraphUpdate = typeof CodeGenGraphAnnotation.Update;
type CodeGenGraphNodeName =
  | 'dependency-check'
  | 'target-resolution'
  | typeof START;

type CodeGenGraphState = {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
  dependencyCheck?: CodeGraphDependencyCheckResult;
};

/**
 * @title Code Agent Handle
 * @description Exposes code-agent tools and the LangGraph-backed code workflow.
 * @keyword-cn 代码智能体, LangGraph工作流, 工作流重构
 * @keyword-en code-agent, langgraph-workflow, workflow-refactor
 */
export default class AgentHandleClass {
  #aiAdapter: AgentAiServer | null = null;
  #hookCaller: HookCaller | null = null;
  #hookBus: HookBusLike | null = null;
  #workflowContext: WorkflowContext | null = null;
  #checkpointer: BaseCheckpointSaver | null = null;

  /**
   * Inject the runtime AI adapter.
   * @keyword-cn AI注入, 工具运行时
   * @keyword-en ai-injection, tool-runtime
   */
  handleAiServer(aiAdapter: AgentAiServer) {
    this.#aiAdapter = aiAdapter;
    return this;
  }

  /**
   * Inject the hook caller bridge used to call Runner hooks.
   * @keyword-cn Hook调用, 目标解析
   * @keyword-en hook-caller, target-resolution
   */
  handleRunnerHookRpc(hookCaller: HookCaller) {
    this.#hookCaller = hookCaller;
    return this;
  }

  /**
   * Inject the SaaS HookBus used by preflight runner status checks.
   * @keyword-cn Hook调用接口, Runner状态
   * @keyword-en hook-caller, runner-status
   */
  handleHookBus(hookBus: HookBusLike) {
    this.#hookBus = hookBus;
    return this;
  }

  /**
   * Inject per-call workflow context.
   * @keyword-cn 工作流上下文, 会话回写
   * @keyword-en workflow-context, session-callback
   */
  withWorkflowContext(ctx: WorkflowContext) {
    this.#workflowContext = ctx;
    return this;
  }

  /**
   * Inject the LangGraph checkpoint saver used by code graph execution.
   * @keyword-cn LangGraph检查点, 工作流恢复
   * @keyword-en langgraph-checkpoint, workflow-resume
   */
  handleCheckpointer(checkpointer: BaseCheckpointSaver) {
    this.#checkpointer = checkpointer;
    return this;
  }

  /**
   * Return code-agent tools.
   * @keyword-cn 工具导出, 代码智能体
   * @keyword-en tool-export, code-agent
   */
  handleTool() {
    return [this.#buildOrchestrateTool()];
  }

  /**
   * Build the code graph orchestration shell tool.
   * @keyword-cn 代码Graph工具, Runner指派
   * @keyword-en code-graph-tool, runner-assignment
   */
  #buildOrchestrateTool() {
    const graphContextSchema = z
      .object({
        session_id: z.string().optional(),
        sessionId: z.string().optional(),
      })
      .passthrough();
    const schema = z
      .strictObject({
        full_requirement: z
          .string()
          .min(1)
          .optional()
          .describe('Complete user requirement for code generation.'),
        requirement: z
          .string()
          .min(1)
          .optional()
          .describe('Legacy alias of full_requirement.'),
        runner_id: z
          .string()
          .optional()
          .describe('Required runner id assigned for this code graph request.'),
        runnerId: z.string().optional().describe('Legacy alias of runner_id.'),
        context: graphContextSchema
          .optional()
          .describe('Graph context; should include session_id.'),
        resume: z
          .object({
            threadId: z.string().optional(),
            checkpointId: z.string().optional(),
            interruptId: z.string().optional(),
          })
          .optional()
          .describe(
            'LangGraph resume reference from a dependency choice card.',
          ),
        targetKind: z.enum(CODE_GRAPH_ACTION_VALUES).optional(),
        logicModelId: z.string().optional(),
        frontendModelId: z.string().optional(),
        logicModelIndex: z.number().int().min(0).optional(),
        frontendModelIndex: z.number().int().min(0).optional(),
        appName: z.string().optional(),
        appVersion: z.string().optional(),
        appDescription: z.string().optional(),
        unitName: z.string().optional(),
      })
      .refine(
        (input) =>
          Boolean(normalizeCodeGraphRequirement(input)) ||
          Boolean(input.resume?.threadId),
        {
          message:
            'full_requirement is required unless resume.threadId is provided',
          path: ['full_requirement'],
        },
      );

    return tool(
      async (input: CodeGenOrchestrateInput): Promise<string> => {
        const fullRequirement = normalizeCodeGraphRequirement(input);
        logger.log(`code_gen_orchestrate requirement:\n${fullRequirement}`);
        const runnerId = normalizeRunnerId(input);
        const sessionId = normalizeToolSessionId(
          input.context,
          this.#workflowContext,
        );
        if (!runnerId) {
          return buildRunnerAssignmentRequiredMessage(sessionId);
        }
        const runnerStatus = await checkRunnerMountedByHook(
          this.#hookBus,
          runnerId,
          this.#workflowContext,
        );
        if (!runnerStatus.ok) {
          logger.warn(
            `code_gen_orchestrate blocked before graph runner_id=${runnerId}: ${runnerStatus.reason}`,
          );
          return runnerStatus.message;
        }

        const request = buildCodeGraphRequest(
          fullRequirement,
          runnerId,
          input.context,
          sessionId,
        );
        const targetKind = inferToolTargetKind({
          ...input,
          requirement: fullRequirement,
        });
        const threadId =
          input.resume?.threadId?.trim() ||
          buildCodeGraphThreadId(request, this.#workflowContext);
        const graphRequest = input.resume?.threadId
          ? request
          : withCodeGraphThreadId(request, threadId);
        logger.log(
          `code_gen_orchestrate accepted async graph request runner_id=${graphRequest.runner_id} session_id=${graphRequest.context.session_id ?? ''} targetKind=${targetKind} thread_id=${threadId}`,
        );

        launchCodeGenGraphInBackground({
          request: graphRequest,
          input,
          targetKind,
          aiAdapter: this.#aiAdapter,
          hookCaller: this.#hookCaller,
          workflowContext: this.#workflowContext,
          checkpointer: this.#checkpointer,
        });

        return buildCodeGraphAcceptedMessage({
          request: graphRequest,
          targetKind,
          threadId,
          isResume: Boolean(input.resume?.threadId),
        });
      },
      {
        name: 'code_gen_orchestrate',
        description:
          'Prepare a code graph request. Requires full_requirement, runner_id, and context.session_id. If runner_id is missing, returns a runner-assignment instruction.',
        schema,
      },
    );
  }
}

/**
 * Normalize the complete requirement from current and legacy tool fields.
 * @keyword-cn 完整需求, 工具入参
 * @keyword-en full-requirement, tool-input
 */
function normalizeCodeGraphRequirement(
  input: Pick<CodeGenOrchestrateInput, 'full_requirement' | 'requirement'>,
): string {
  return (input.full_requirement ?? input.requirement ?? '').trim();
}

/**
 * Normalize runner id from current and legacy tool fields.
 * @keyword-cn Runner指派, 工具入参
 * @keyword-en runner-assignment, tool-input
 */
function normalizeRunnerId(
  input: Pick<CodeGenOrchestrateInput, 'runner_id' | 'runnerId'>,
): string {
  return (input.runner_id ?? input.runnerId ?? '').trim();
}

/**
 * Normalize session id from tool context or injected workflow context.
 * @keyword-cn 会话回传, 代码Graph上下文
 * @keyword-en session-callback, code-graph-context
 */
function normalizeToolSessionId(
  context: CodeGraphToolContext | undefined,
  workflowContext: WorkflowContext | null,
): string | undefined {
  const fromInput = (context?.session_id ?? context?.sessionId)?.trim();
  if (fromInput) return fromInput;
  return workflowContext?.sessionId?.trim() || undefined;
}

/**
 * Build the normalized code graph request envelope.
 * @keyword-cn 代码Graph请求, Runner指派
 * @keyword-en code-graph-request, runner-assignment
 */
function buildCodeGraphRequest(
  fullRequirement: string,
  runnerId: string,
  context: CodeGraphToolContext | undefined,
  sessionId: string | undefined,
): CodeGraphRequest {
  return {
    full_requirement: fullRequirement,
    runner_id: runnerId,
    context: {
      ...(context ?? {}),
      ...(sessionId ? { session_id: sessionId } : {}),
    },
  };
}

type CodeGraphLaunchInput = {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
  checkpointer: BaseCheckpointSaver | null;
};

/**
 * Attach a stable graph thread id to the request context before async launch.
 * @keyword-cn 检查点线程, 异步工作流
 * @keyword-en checkpoint-thread, async-workflow
 */
function withCodeGraphThreadId(
  request: CodeGraphRequest,
  threadId: string,
): CodeGraphRequest {
  return {
    ...request,
    context: {
      ...request.context,
      codeGraphThreadId: threadId,
    },
  };
}

/**
 * Launch the LangGraph workflow in the background and persist its final result.
 * @keyword-cn 异步工作流, 后台执行
 * @keyword-en async-workflow, background-run
 */
function launchCodeGenGraphInBackground(args: CodeGraphLaunchInput): void {
  void (async () => {
    let dependencyCheck: CodeGraphDependencyCheckResult;
    try {
      dependencyCheck = await runCodeGenGraph(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`code_gen_orchestrate async graph failed: ${message}`);
      dependencyCheck = buildBlockedDependencyCheckResult(
        args.request,
        message,
      );
    }
    const dependencyCheckMessage = buildDependencyCheckResultMessage(
      args.request,
      dependencyCheck,
    );
    const artifact = await persistCodeGraphRunArtifact({
      request: args.request,
      input: args.input,
      targetKind: args.targetKind,
      result: dependencyCheck,
      toolMessage: dependencyCheckMessage,
      workflowContext: args.workflowContext,
    });
    logger.log(buildCodeGraphRunSummary(dependencyCheck, artifact));
  })();
}

/**
 * Build the immediate tool response after the async graph has been accepted.
 * @keyword-cn 工具回包, 异步工作流
 * @keyword-en tool-result, async-workflow
 */
function buildCodeGraphAcceptedMessage(args: {
  request: CodeGraphRequest;
  targetKind: CodeAgentTargetKind;
  threadId: string;
  isResume: boolean;
}): string {
  return [
    'code graph accepted:',
    JSON.stringify(
      {
        status: args.isResume ? 'resume_scheduled' : 'scheduled',
        runner_id: args.request.runner_id,
        session_id: args.request.context.session_id ?? null,
        targetKind: args.targetKind,
        threadId: args.threadId,
        next: 'LangGraph is running asynchronously in the background; continue the dialogue immediately and wait for proactive messages or choice cards.',
      },
      null,
      2,
    ),
  ].join('\n');
}

type CodeGraphRunArtifactInput = {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
  result: CodeGraphDependencyCheckResult;
  toolMessage: string;
  workflowContext: WorkflowContext | null;
};

type CodeGraphRunArtifactRef = {
  path: string;
};

/**
 * Persist the final code graph response and node log as a local JSON artifact.
 * @keyword-cn 运行产物日志, CodeGraph结果
 * @keyword-en artifact-log, code-graph-result
 */
async function persistCodeGraphRunArtifact(
  args: CodeGraphRunArtifactInput,
): Promise<CodeGraphRunArtifactRef | null> {
  const createdAt = new Date().toISOString();
  const sessionId =
    args.request.context.session_id?.trim() ||
    args.workflowContext?.sessionId?.trim() ||
    'no-session';
  const sessionPart = sanitizeLogPathPart(sessionId);
  const runPart = sanitizeLogPathPart(
    `${createdAt}-${args.result.status}-${randomUUID().slice(0, 8)}`,
  );
  const logRoot = process.env.CODE_AGENT_LOG_DIR || DEFAULT_CODE_AGENT_LOG_DIR;
  const dir = isAbsolute(logRoot)
    ? join(logRoot, sessionPart)
    : join(process.cwd(), logRoot, sessionPart);
  const filePath = join(dir, `${runPart}.json`);
  const artifact = {
    createdAt,
    runner_id: args.request.runner_id,
    session_id: args.request.context.session_id ?? null,
    targetKind: args.targetKind,
    status: args.result.status,
    request: args.request,
    input: args.input,
    result: args.result,
    log: args.result.log,
    toolMessage: args.toolMessage,
  };

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, stringifyCodeGraphArtifact(artifact), 'utf8');
    return { path: filePath };
  } catch (error) {
    logger.warn(
      `code_gen_orchestrate artifact write failed path=${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Build a compact logger line for the completed code graph tool call.
 * @keyword-cn 运行产物日志, 结果摘要
 * @keyword-en artifact-log, result-summary
 */
function buildCodeGraphRunSummary(
  result: CodeGraphDependencyCheckResult,
  artifact: CodeGraphRunArtifactRef | null,
): string {
  const routePlan =
    result.context.routePlan.length > 0
      ? result.context.routePlan
      : result.decision.routePlan;
  const solutions = [
    ...new Set(
      routePlan
        .map(
          (route) =>
            route.useSolution?.solutionId || route.useSolution?.name || '',
        )
        .filter(Boolean),
    ),
  ];
  const actions = [
    ...new Set(
      routePlan.flatMap((route) => (route.useAction ? [route.useAction] : [])),
    ),
  ];
  const targetPlan = result.context.targetPlan ?? [];
  const reusedTargets = targetPlan.filter(
    (item) => item.decision === 'reuse',
  ).length;
  const newTargets = targetPlan.filter(
    (item) => item.decision === 'create',
  ).length;
  const newSolutionName =
    result.decision.requiresNewSolution && result.decision.newSolutionOption
      ? result.decision.newSolutionOption.name
      : '';
  const errors = result.errors.length ? `errors=${result.errors.length}` : '';
  const file = artifact ? `log_file=${artifact.path}` : '';
  return [
    `code_gen_orchestrate finished status=${result.status}`,
    routePlan.length ? `routes=${routePlan.length}` : '',
    solutions.length ? `solutions=${solutions.join(',')}` : '',
    !solutions.length && newSolutionName
      ? `newSolution=${newSolutionName}`
      : '',
    actions.length ? `actions=${actions.join(',')}` : '',
    targetPlan.length ? `targets=${targetPlan.length}` : '',
    reusedTargets ? `reuseTargets=${reusedTargets}` : '',
    newTargets ? `newTargets=${newTargets}` : '',
    errors,
    file,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Serialize code graph artifacts while preserving values JSON cannot natively encode.
 * @keyword-cn 运行产物日志, JSON序列化
 * @keyword-en artifact-log, json-stringify
 */
function stringifyCodeGraphArtifact(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, item: unknown) =>
        typeof item === 'bigint' ? item.toString() : item,
      2,
    ) ?? 'null'
  );
}

/**
 * Convert session and run identifiers into safe path fragments.
 * @keyword-cn 运行产物日志, 文件路径
 * @keyword-en artifact-log, file-path
 */
function sanitizeLogPathPart(value: string): string {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return safe || 'unknown';
}

/**
 * Run the code generation graph through LangGraph with checkpoint support.
 * @keyword-cn LangGraph工作流, 检查点恢复
 * @keyword-en langgraph-workflow, checkpoint-resume
 */
async function runCodeGenGraph(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
  checkpointer: BaseCheckpointSaver | null;
}): Promise<CodeGraphDependencyCheckResult> {
  const checkpointer = args.checkpointer;
  if (!checkpointer) {
    return buildBlockedDependencyCheckResult(
      args.request,
      'LangGraph checkpointer is not injected.',
    );
  }

  const graph = buildCodeGenWorkflowGraph({ ...args, checkpointer });
  const config = buildCodeGraphRunnableConfig({
    request: args.request,
    input: args.input,
    workflowContext: args.workflowContext,
  });
  const graphInput = buildCodeGraphInvokeInput(args);
  const output = await graph.invoke(graphInput, config);

  if (isInterrupted<CodeGraphDependencyInterruptPayload>(output)) {
    const interruptPayload = output[INTERRUPT][0]?.value;
    if (!interruptPayload) {
      return buildBlockedDependencyCheckResult(
        args.request,
        'LangGraph interrupted without a dependency-choice payload.',
      );
    }
    const snapshot = await graph.getState(config);
    const checkpoint = readLangGraphCheckpointRef(snapshot, config);
    const graphLog = createCodeGraphNodeLogger('dependency-check', {
      code_graph_log: interruptPayload.context.code_graph_log,
    });
    if (args.hookCaller) {
      await sendDependencyChoiceCard({
        hookCaller: args.hookCaller,
        request: args.request,
        workflowContext: args.workflowContext,
        interrupt: interruptPayload,
        checkpoint,
        graphLog,
      });
    }
    return buildWaitingDependencyCheckResultFromInterrupt(
      interruptPayload,
      graphLog.entries,
    );
  }

  const result = readCodeGenGraphDependencyCheck(output);
  if (result) return result;
  return buildBlockedDependencyCheckResult(
    args.request,
    'LangGraph completed without dependency-check output.',
  );
}

/**
 * Build the current code-agent LangGraph workflow.
 * @keyword-cn LangGraph工作流, 目标判定
 * @keyword-en langgraph-workflow, target-resolution
 */
function buildCodeGenWorkflowGraph(args: {
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
  checkpointer: BaseCheckpointSaver;
}) {
  return new StateGraph(CodeGenGraphAnnotation)
    .addNode('dependency-check', async (state: CodeGenGraphState) => ({
      dependencyCheck: await runDependencyCheckNode({
        request: state.request,
        input: state.input,
        targetKind: state.targetKind,
        aiAdapter: args.aiAdapter,
        hookCaller: args.hookCaller,
        workflowContext: args.workflowContext,
      }),
    }))
    .addNode('target-resolution', async (state: CodeGenGraphState) => ({
      dependencyCheck: state.dependencyCheck
        ? await runTargetResolutionNode({
            request: state.request,
            input: state.input,
            dependencyCheck: state.dependencyCheck,
            aiAdapter: args.aiAdapter,
            hookCaller: args.hookCaller,
            workflowContext: args.workflowContext,
          })
        : buildBlockedDependencyCheckResult(
            state.request,
            'dependency-check result missing before target-resolution',
          ),
    }))
    .addEdge(START, 'dependency-check')
    .addEdge('dependency-check', 'target-resolution')
    .addEdge('target-resolution', END)
    .compile({
      checkpointer: args.checkpointer,
      name: 'code-agent-code-graph',
      description: 'code-agent LangGraph workflow',
    });
}

/**
 * Build LangGraph runnable config with a per-run thread id and workflow metadata.
 * @keyword-cn 检查点配置, 工作流上下文
 * @keyword-en checkpoint-config, workflow-context
 */
function buildCodeGraphRunnableConfig(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  workflowContext: WorkflowContext | null;
}): RunnableConfig {
  const resume = args.input.resume;
  const threadId =
    resume?.threadId?.trim() ||
    buildCodeGraphThreadId(args.request, args.workflowContext);
  return {
    configurable: {
      thread_id: threadId,
      ...(resume?.checkpointId?.trim()
        ? { checkpoint_id: resume.checkpointId.trim() }
        : {}),
      ...(args.request.context.session_id
        ? { session_id: args.request.context.session_id }
        : {}),
      ...(args.workflowContext?.agentId
        ? { agent_id: args.workflowContext.agentId }
        : {}),
      ...(args.workflowContext?.agentPrincipalId
        ? { agent_principal_id: args.workflowContext.agentPrincipalId }
        : {}),
      ...(args.workflowContext?.aiModelIds
        ? { ai_model_ids: args.workflowContext.aiModelIds }
        : {}),
    },
  };
}

/**
 * Build a fresh LangGraph thread id for one code generation request.
 * @keyword-cn 检查点线程, 代码Graph请求
 * @keyword-en checkpoint-thread, code-graph-request
 */
function buildCodeGraphThreadId(
  request: CodeGraphRequest,
  workflowContext: WorkflowContext | null,
): string {
  const explicitThreadId =
    readContextString(request.context, 'codeGraphThreadId') ??
    readContextString(request.context, 'threadId');
  if (explicitThreadId) return normalizeCodeGraphThreadId(explicitThreadId);
  const sessionId =
    request.context.session_id?.trim() ||
    workflowContext?.sessionId?.trim() ||
    'no-session';
  const digest = createHash('sha1')
    .update(
      [sessionId, request.runner_id, request.full_requirement].join('\n'),
      'utf8',
    )
    .digest('hex')
    .slice(0, 12);
  const nonce = randomUUID().replace(/-/g, '').slice(0, 12);
  return `code-agent:${digest}:${nonce}`;
}

/**
 * Keep user-provided graph thread ids inside the checkpoint schema limit.
 * @keyword-cn 检查点线程, 字段归一化
 * @keyword-en checkpoint-thread, field-normalize
 */
function normalizeCodeGraphThreadId(threadId: string): string {
  const trimmed = threadId.trim();
  if (trimmed.length <= 100) return trimmed;
  const digest = createHash('sha1').update(trimmed, 'utf8').digest('hex');
  return `code-agent:${digest}`;
}

/**
 * Build the initial graph input or a LangGraph resume command.
 * @keyword-cn 检查点恢复, Graph入参
 * @keyword-en checkpoint-resume, graph-input
 */
function buildCodeGraphInvokeInput(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
}):
  | CodeGenGraphUpdate
  | Command<unknown, CodeGenGraphUpdate, CodeGenGraphNodeName> {
  if (args.input.resume?.threadId) {
    return new Command<unknown, CodeGenGraphUpdate, CodeGenGraphNodeName>({
      resume: buildDependencyResumeChoice(args.input),
    });
  }
  return {
    request: args.request,
    input: args.input,
    targetKind: args.targetKind,
  };
}

/**
 * Read checkpoint identifiers from a LangGraph state snapshot.
 * @keyword-cn 检查点读取, LangGraph状态
 * @keyword-en checkpoint-read, langgraph-state
 */
function readLangGraphCheckpointRef(
  snapshot: unknown,
  config: RunnableConfig,
): CodeGraphResumeRef & { threadId: string } {
  const snapshotRecord =
    snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : {};
  const snapshotConfig =
    snapshotRecord.config &&
    typeof snapshotRecord.config === 'object' &&
    !Array.isArray(snapshotRecord.config)
      ? (snapshotRecord.config as RunnableConfig)
      : {};
  const configurable = {
    ...(config.configurable ?? {}),
    ...(snapshotConfig.configurable ?? {}),
  };
  const threadId = String(configurable.thread_id ?? '');
  const checkpointId =
    typeof configurable.checkpoint_id === 'string'
      ? configurable.checkpoint_id
      : undefined;
  const interruptId = readSnapshotInterruptId(snapshotRecord);
  return {
    threadId,
    ...(checkpointId ? { checkpointId } : {}),
    ...(interruptId ? { interruptId } : {}),
  };
}

/**
 * Read the first interrupt id from a LangGraph state snapshot.
 * @keyword-cn 中断读取, LangGraph状态
 * @keyword-en interrupt-read, langgraph-state
 */
function readSnapshotInterruptId(
  snapshot: Record<string, unknown>,
): string | undefined {
  const tasks = snapshot.tasks;
  if (!Array.isArray(tasks)) return undefined;
  for (const task of tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) continue;
    const interrupts = (task as Record<string, unknown>).interrupts;
    if (!Array.isArray(interrupts)) continue;
    const first = interrupts.find(
      (item) => item && typeof item === 'object' && !Array.isArray(item),
    ) as Record<string, unknown> | undefined;
    if (typeof first?.id === 'string') return first.id;
  }
  return undefined;
}

/**
 * Verify that the assigned runner is currently mounted through a SaaS hook.
 * @keyword-cn Runner状态, Runner指派
 * @keyword-en runner-status, runner-assignment
 */
async function checkRunnerMountedByHook(
  hookBus: HookBusLike | null,
  runnerId: string,
  workflowContext: WorkflowContext | null,
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason: string;
      message: string;
    }
> {
  try {
    const data = await callSaasHookData(
      hookBus,
      'saas.app.runner.get',
      [runnerId],
      workflowContext,
    );
    const runner =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    if (!runner) {
      return {
        ok: false,
        reason: 'runner-not-found',
        message: [
          'Runner 当前不可用，不能启动 code_gen_orchestrate。',
          `runner_id=${runnerId} 未通过 saas.app.runner.get 查到。`,
          '请先调用 saas.app.runner.list，筛选 status="mounted"，只把在线 Runner 的 id 传入。',
        ].join('\n'),
      };
    }
    const status = readStringField(runner, 'status') || 'unknown';
    if (status === 'mounted') return { ok: true };
    const alias = readStringField(runner, 'alias');
    return {
      ok: false,
      reason: `runner-status-${status}`,
      message: [
        'Runner 当前不可用，不能启动 code_gen_orchestrate。',
        `runner_id=${runnerId}${alias ? ` (${alias})` : ''} 当前 status=${status}，必须是 mounted。`,
        '请先调用 saas.app.runner.list，筛选 status="mounted"，只把在线 Runner 的 id 传入。',
      ].join('\n'),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason,
      message: [
        'Runner 在线状态校验失败，不能启动 code_gen_orchestrate。',
        `runner_id=${runnerId}`,
        `校验错误: ${reason}`,
        '请先确认 saas.app.runner.get 可用，并选择 status="mounted" 的 Runner。',
      ].join('\n'),
    };
  }
}

/**
 * Call a SaaS hook and unwrap the single-handler data payload.
 * @keyword-cn SaaSHook调用, Hook数据
 * @keyword-en saas-hook-call, hook-data
 */
async function callSaasHookData(
  hookBus: HookBusLike | null,
  hookName: string,
  payload: unknown,
  workflowContext: WorkflowContext | null,
): Promise<unknown> {
  if (!hookBus) {
    throw new Error('SaaS HookBus is not injected.');
  }
  const regs = hookBus.select(hookName);
  if (regs.length === 0) {
    throw new Error(`${hookName} is not registered on saas.`);
  }
  const results = await hookBus.emit({
    name: hookName,
    payload,
    context: buildSaasInvocationContext(workflowContext),
  });
  const errors: string[] = [];
  const data: unknown[] = [];
  for (const result of results) {
    if (result?.status === 'error' || result?.error) {
      errors.push(result.error ?? 'hook-error');
    } else if (result?.status === 'skipped') {
      errors.push(`${hookName} was skipped by hook middleware.`);
    } else {
      data.push(result?.data);
    }
  }
  if (errors.length > 0) {
    throw new Error(`${hookName} failed: ${errors.join('; ')}`);
  }
  return data.length === 1 ? data[0] : data;
}

/**
 * Build the hidden invocation context for SaaS hook calls.
 * @keyword-cn 调用上下文, SaaSHook
 * @keyword-en invocation-context, saas-hook
 */
function buildSaasInvocationContext(workflowContext: WorkflowContext | null) {
  return {
    source: 'llm' as const,
    principalId: workflowContext?.agentPrincipalId,
    principalType: 'agent',
    extras: {
      ...(workflowContext?.sessionId
        ? { sessionId: workflowContext.sessionId }
        : {}),
      ...(workflowContext?.agentId ? { agentId: workflowContext.agentId } : {}),
    },
  };
}

/**
 * Build the response used when runner assignment is missing.
 * @keyword-cn Runner指派, 获取Runner
 * @keyword-en runner-assignment, get-runner
 */
function buildRunnerAssignmentRequiredMessage(sessionId: string | undefined) {
  return [
    '需要先获取可用 Runner 并完成指派，然后再调用 code_gen_orchestrate。',
    '请先查询 Runner 列表，选择明确的 runner_id，并把 runner_id 传入工具参数。',
    sessionId ? `session_id: ${sessionId}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Infer the coarse target kind from the compatible tool input.
 * @keyword-cn 目标类型推断, 默认应用目标
 * @keyword-en infer-tool-target-kind, default-app-target
 */
function inferToolTargetKind(
  input: CodeGenOrchestrateInput,
): CodeAgentTargetKind {
  const requirement = normalizeCodeGraphRequirement(input);
  if (input.targetKind) return input.targetKind;
  if (input.appName?.trim()) return 'app';
  if (input.unitName?.trim()) return 'unit';
  if (looksLikeFrontendAppRequirement(requirement)) return 'app';
  return 'unit';
}

/**
 * Detect whether a requirement looks like a frontend app target.
 * @keyword-cn 前端应用目标, 目标类型推断
 * @keyword-en detect-frontend-app, default-app-target
 */
function looksLikeFrontendAppRequirement(requirement: string): boolean {
  return /页面|单页|展示|表格|看板|可视化|报表|大屏|仪表盘|dashboard|page|frontend|html/i.test(
    requirement,
  );
}
