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
  interrupt,
  isGraphInterrupt,
  isInterrupted,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { tool } from 'langchain';
import z from 'zod';
import type {
  AgentAiModelClient,
  AgentAiServer,
} from '@/core/agent-runtime/types/agent-runtime.types';
import type { CodeAgentTargetKind } from './dialogues/types';

const logger = new Logger('CodeAgentHandle');
const DEFAULT_CODE_AGENT_LOG_DIR = 'logs/code-agent';

/**
 * @title Code Agent workflow context
 * @description Context injected by AgentRuntime before tool calls.
 * @keyword-cn 工作流上下文, 会话回写
 * @keyword-en workflow-context, session-callback
 */
export interface WorkflowContext {
  /** 关联的 IM 会话 ID */
  sessionId: string;
  /** Agent 数据库 ID */
  agentId?: string;
  /** Agent 的 Principal ID */
  agentPrincipalId: string;
  /** 当前会话/Agent 绑定的模型 ID 快照 */
  aiModelIds?: string[];
}

type HookCallReplyLike = {
  errorMsg?: string[];
  result: unknown;
  debugLog?: unknown[];
};

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

type HookCaller = {
  callHook(
    runnerId: string,
    body: {
      hookName: string;
      payload?: unknown;
      context?: HookCallContextLike;
    },
  ): Promise<HookCallReplyLike>;
};

/**
 * @title Code generation orchestration input
 * @description Compatible payload shape accepted by the LangGraph code workflow tool.
 * @keyword-cn 工具入参, LangGraph工作流
 * @keyword-en tool-input, langgraph-workflow
 */
type CodeGenOrchestrateInput = {
  full_requirement?: string;
  requirement?: string;
  runner_id?: string;
  context?: CodeGraphToolContext;
  resume?: CodeGraphResumeRef;
  targetKind?: CodeAgentTargetKind;
  logicModelId?: string;
  frontendModelId?: string;
  logicModelIndex?: number;
  frontendModelIndex?: number;
  runnerId?: string;
  appName?: string;
  appVersion?: string;
  appDescription?: string;
  unitName?: string;
};

const CODE_GRAPH_ACTION_VALUES = ['app', 'unit', 'data-point'] as const;

type CodeGraphActionKind = (typeof CODE_GRAPH_ACTION_VALUES)[number];

const NEW_SOLUTION_CHOICE_ID = '__new_solution__';

type RunnerSolutionSummary = {
  id: string;
  runnerId: string;
  solutionId: string;
  name: string;
  version?: string;
  summary: string;
  description?: string;
  includes: string[];
  isInitialized?: boolean;
};

type CodeGraphNewSolutionOption = {
  id: typeof NEW_SOLUTION_CHOICE_ID;
  kind: 'new-solution';
  name: string;
  version?: string;
  summary: string;
  reason?: string;
  targetKind: CodeAgentTargetKind;
};

type CodeGraphDependencyDecision = {
  waitChoose: RunnerSolutionSummary[];
  useSolution: RunnerSolutionSummary | null;
  waitChooseAction: CodeGraphActionKind[];
  useAction: CodeGraphActionKind | null;
  requiresNewSolution: boolean;
  newSolutionOption?: CodeGraphNewSolutionOption;
  newSolutionReason?: string;
  reason?: string;
};

type CodeGraphRuntimeContext = {
  chooseSolution: string;
  chooseAction: CodeGraphActionKind | '';
  selectedSolution?: RunnerSolutionSummary | CodeGraphNewSolutionOption;
  newSolutionOption?: CodeGraphNewSolutionOption;
  selectedApps?: unknown[];
  selectedUnits?: unknown[];
  selectedDataPoints?: unknown[];
  code_graph_log: CodeGraphLogEntry[];
};

type CodeGraphResumeRef = {
  threadId?: string;
  checkpointId?: string;
  interruptId?: string;
};

type CodeGraphLogLevel = 'info' | 'warn' | 'error';

type CodeGraphLogEntry = {
  ts: string;
  node: string;
  step: string;
  level: CodeGraphLogLevel;
  message: string;
  data?: unknown;
};

type CodeGraphNodeLogger = {
  entries: CodeGraphLogEntry[];
  info(step: string, message: string, data?: unknown): void;
  warn(step: string, message: string, data?: unknown): void;
  error(step: string, message: string, data?: unknown): void;
};

type CodeGraphDependencyCheckResult = {
  status: 'ready' | 'waiting_for_selection' | 'blocked';
  node: 'dependency-check';
  hooks: {
    required: string[];
    available: string[];
    missing: string[];
  };
  context: CodeGraphRuntimeContext;
  solutions: RunnerSolutionSummary[];
  decision: CodeGraphDependencyDecision;
  errors: string[];
  log: CodeGraphLogEntry[];
};

type CodeGraphDependencyResumeChoice = {
  chooseSolution: string;
  chooseAction: CodeGraphActionKind;
  selectedSolution?: RunnerSolutionSummary | Record<string, unknown>;
  context?: Record<string, unknown>;
};

type CodeGraphDependencyInterruptPayload = {
  type: 'code-agent.dependency-choice';
  runnerId: string;
  sessionId?: string;
  requirement: string;
  targetKind: CodeAgentTargetKind;
  hooks: CodeGraphDependencyCheckResult['hooks'];
  context: CodeGraphRuntimeContext;
  solutions: RunnerSolutionSummary[];
  decision: CodeGraphDependencyDecision;
};

type CodeGenGraphState = {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
  dependencyCheck?: CodeGraphDependencyCheckResult;
};

type LlmDependencyDecisionPayload = {
  waitChoose?: Array<{
    id?: string;
    solutionId?: string;
    name?: string;
    reason?: string;
  }>;
  useSolution?: {
    id?: string;
    solutionId?: string;
    name?: string;
    reason?: string;
  } | null;
  waitChooseAction?: CodeGraphActionKind[];
  useAction?: CodeGraphActionKind | null;
  requiresNewSolution?: boolean;
  newSolutionOption?: {
    name?: string;
    version?: string;
    summary?: string;
    reason?: string;
  } | null;
  newSolutionReason?: string;
  reason?: string;
};

const REQUIRED_RUNNER_SOLUTION_HOOKS = [
  'runner.app.solution.list',
  'runner.app.solution.get',
  'runner.app.solution.listApps',
  'runner.app.solution.listUnits',
  'runner.app.dataTouchpoint.list',
] as const;
const CONVERSATION_SEND_MSG_HOOK = 'saas.app.conversation.sendMsg';
const CODE_AGENT_DEPENDENCY_CHOICE_COMPONENT_HOOK =
  'saas.app.conversation.codeAgentDependencyChoice';

const CodeGenGraphAnnotation = Annotation.Root({
  request: Annotation<CodeGraphRequest>(),
  input: Annotation<CodeGenOrchestrateInput>(),
  targetKind: Annotation<CodeAgentTargetKind>(),
  dependencyCheck: Annotation<CodeGraphDependencyCheckResult | undefined>(),
});

type CodeGenGraphUpdate = typeof CodeGenGraphAnnotation.Update;
type CodeGenGraphNodeName = 'dependency-check' | typeof START;

/**
 * @title Code graph tool context
 * @description Context block passed into the code graph tool.
 * @keyword-cn 代码Graph上下文, 会话回传
 * @keyword-en code-graph-context, session-callback
 */
export type CodeGraphToolContext = {
  session_id?: string;
  sessionId?: string;
  [key: string]: unknown;
};

/**
 * @title Code graph request
 * @description Normalized request envelope prepared before future graph execution.
 * @keyword-cn 代码Graph请求, Runner指派
 * @keyword-en code-graph-request, runner-assignment
 */
export type CodeGraphRequest = {
  full_requirement: string;
  runner_id: string;
  context: {
    session_id?: string;
    [key: string]: unknown;
  };
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
    selectedSolution:
      args.result.context.selectedSolution ??
      args.result.decision.useSolution ??
      args.result.decision.newSolutionOption ??
      null,
    selectedAction:
      args.result.context.chooseAction || args.result.decision.useAction,
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
  const contextSolution = result.context.selectedSolution;
  const contextSolutionLabel =
    contextSolution && 'solutionId' in contextSolution
      ? contextSolution.solutionId
      : contextSolution?.name;
  const solution =
    contextSolutionLabel ??
    result.decision.useSolution?.solutionId ??
    result.decision.newSolutionOption?.name ??
    '';
  const action = result.context.chooseAction || result.decision.useAction || '';
  const errors = result.errors.length ? `errors=${result.errors.length}` : '';
  const file = artifact ? `log_file=${artifact.path}` : '';
  return [
    `code_gen_orchestrate finished status=${result.status}`,
    solution ? `solution=${solution}` : '',
    action ? `action=${action}` : '',
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
 * Create a node logger that continues any log already carried in graph context.
 * @keyword-cn 节点日志, 暂停恢复
 * @keyword-en node-log, resume-log
 */
function createCodeGraphNodeLogger(
  node: string,
  context: CodeGraphRequest['context'],
): CodeGraphNodeLogger {
  const entries = extractCodeGraphLog(context);
  const append = (
    level: CodeGraphLogLevel,
    step: string,
    message: string,
    data?: unknown,
  ) => {
    const entry: CodeGraphLogEntry = {
      ts: new Date().toISOString(),
      node,
      step,
      level,
      message,
      ...(data === undefined ? {} : { data }),
    };
    entries.push(entry);
    const line = `[${node}] ${step} ${message}`;
    if (level === 'error') {
      logger.error(line, data ? JSON.stringify(data) : undefined);
      return;
    }
    if (level === 'warn') {
      logger.warn(data ? `${line} ${JSON.stringify(data)}` : line);
      return;
    }
    logger.log(data ? `${line} ${JSON.stringify(data)}` : line);
  };
  return {
    entries,
    info: (step, message, data) => append('info', step, message, data),
    warn: (step, message, data) => append('warn', step, message, data),
    error: (step, message, data) => append('error', step, message, data),
  };
}

/**
 * Extract the carried code graph log from tool context.
 * @keyword-cn Graph日志, 暂停恢复
 * @keyword-en graph-log, resume-log
 */
function extractCodeGraphLog(
  context: CodeGraphRequest['context'],
): CodeGraphLogEntry[] {
  const raw = context.code_graph_log ?? context.codeGraphLog;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCodeGraphLogEntry);
}

/**
 * Check whether an unknown value is a graph log entry.
 * @keyword-cn Graph日志, 类型守卫
 * @keyword-en graph-log, type-guard
 */
function isCodeGraphLogEntry(value: unknown): value is CodeGraphLogEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.ts === 'string' &&
    typeof entry.node === 'string' &&
    typeof entry.step === 'string' &&
    typeof entry.message === 'string' &&
    (entry.level === 'info' ||
      entry.level === 'warn' ||
      entry.level === 'error')
  );
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
 * @keyword-cn LangGraph工作流, 依赖检查节点
 * @keyword-en langgraph-workflow, dependency-check-node
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
    .addEdge(START, 'dependency-check')
    .addEdge('dependency-check', END)
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
 * Normalize the human dependency selection into a LangGraph resume value.
 * @keyword-cn 依赖选择, 检查点恢复
 * @keyword-en dependency-selection, checkpoint-resume
 */
function buildDependencyResumeChoice(
  input: CodeGenOrchestrateInput,
): CodeGraphDependencyResumeChoice {
  const chooseSolution = readContextString(
    input.context ?? {},
    'chooseSolution',
  );
  const chooseAction = normalizeActionChoice(
    readContextString(input.context ?? {}, 'chooseAction') ?? input.targetKind,
  );
  if (!chooseSolution || !chooseAction) {
    throw new Error(
      'resume requires context.chooseSolution and context.chooseAction',
    );
  }
  const selectedSolution = readContextRecord(
    input.context ?? {},
    'selectedSolution',
  );
  return {
    chooseSolution,
    chooseAction,
    ...(selectedSolution ? { selectedSolution } : {}),
    ...(input.context ? { context: input.context } : {}),
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
 * Read the dependency-check result from a completed graph output.
 * @keyword-cn Graph输出, 依赖检查节点
 * @keyword-en graph-output, dependency-check-node
 */
function readCodeGenGraphDependencyCheck(
  output: unknown,
): CodeGraphDependencyCheckResult | null {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return null;
  }
  const value = (output as Record<string, unknown>).dependencyCheck;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as Partial<CodeGraphDependencyCheckResult>;
  return result.node === 'dependency-check' && result.status
    ? (value as CodeGraphDependencyCheckResult)
    : null;
}

/**
 * Build a waiting result from the LangGraph interrupt payload.
 * @keyword-cn 中断回包, 依赖检查节点
 * @keyword-en interrupt-result, dependency-check-node
 */
function buildWaitingDependencyCheckResultFromInterrupt(
  payload: CodeGraphDependencyInterruptPayload,
  log: CodeGraphLogEntry[],
): CodeGraphDependencyCheckResult {
  return {
    status: 'waiting_for_selection',
    node: 'dependency-check',
    hooks: payload.hooks,
    context: { ...payload.context, code_graph_log: log },
    solutions: payload.solutions,
    decision: payload.decision,
    errors: [],
    log,
  };
}

/**
 * Build a blocked dependency-check result before the graph can continue.
 * @keyword-cn 工具回包, 阻塞状态
 * @keyword-en tool-result, blocked-status
 */
function buildBlockedDependencyCheckResult(
  request: CodeGraphRequest,
  reason: string,
): CodeGraphDependencyCheckResult {
  const graphLog = createCodeGraphNodeLogger(
    'dependency-check',
    request.context,
  );
  graphLog.error('blocked', reason);
  return {
    status: 'blocked',
    node: 'dependency-check',
    hooks: {
      required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
      available: [],
      missing: [],
    },
    context: {
      chooseSolution: '',
      chooseAction: '',
      code_graph_log: graphLog.entries,
    },
    solutions: [],
    decision: {
      waitChoose: [],
      useSolution: null,
      waitChooseAction: [],
      useAction: null,
      requiresNewSolution: false,
      reason,
    },
    errors: [reason],
    log: graphLog.entries,
  };
}

/**
 * Execute the first code graph node: verify runner DB hooks and choose target dependencies.
 * @keyword-cn 依赖检查节点, Runner数据库
 * @keyword-en dependency-check-node, runner-db-hooks
 */
async function runDependencyCheckNode(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  targetKind: CodeAgentTargetKind;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphDependencyCheckResult> {
  const graphLog = createCodeGraphNodeLogger(
    'dependency-check',
    args.request.context,
  );
  graphLog.info('start', 'dependency-check node started', {
    runner_id: args.request.runner_id,
    session_id: args.request.context.session_id ?? null,
    requirement: args.request.full_requirement,
    targetKind: args.targetKind,
  });
  const baseContext: CodeGraphRuntimeContext = {
    chooseSolution: '',
    chooseAction: '',
    code_graph_log: graphLog.entries,
  };
  const emptyDecision: CodeGraphDependencyDecision = {
    waitChoose: [],
    useSolution: null,
    waitChooseAction: [],
    useAction: null,
    requiresNewSolution: false,
  };
  if (!args.hookCaller) {
    graphLog.error('prepare-hook-caller', 'hook caller is not injected');
    return {
      status: 'blocked',
      node: 'dependency-check',
      hooks: {
        required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
        available: [],
        missing: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
      },
      context: baseContext,
      solutions: [],
      decision: {
        ...emptyDecision,
        reason: 'Hook caller is not injected.',
      },
      errors: ['Hook caller is not injected.'],
      log: graphLog.entries,
    };
  }
  if (!args.aiAdapter) {
    graphLog.error('prepare-ai-adapter', 'agent AI adapter is not injected');
    return {
      status: 'blocked',
      node: 'dependency-check',
      hooks: {
        required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
        available: [],
        missing: [],
      },
      context: baseContext,
      solutions: [],
      decision: {
        ...emptyDecision,
        reason: 'Agent AI adapter is not injected.',
      },
      errors: ['Agent AI adapter is not injected.'],
      log: graphLog.entries,
    };
  }

  try {
    graphLog.info('probe-hooks:start', 'checking runner solution DB hooks', {
      required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
    });
    const hookProbe = await probeRunnerSolutionHooks(
      args.hookCaller,
      args.request.runner_id,
      args.workflowContext,
    );
    graphLog.info(
      'probe-hooks:done',
      'runner solution DB hook probe finished',
      {
        available: hookProbe.available,
        missing: hookProbe.missing,
      },
    );
    if (hookProbe.missing.length > 0) {
      graphLog.error(
        'probe-hooks:missing',
        'runner is missing required DB hooks',
        {
          missing: hookProbe.missing,
        },
      );
      return {
        status: 'blocked',
        node: 'dependency-check',
        hooks: hookProbe,
        context: baseContext,
        solutions: [],
        decision: {
          ...emptyDecision,
          reason: `Runner 缺少数据库检索 hook: ${hookProbe.missing.join(', ')}`,
        },
        errors: [`missing runner hooks: ${hookProbe.missing.join(', ')}`],
        log: graphLog.entries,
      };
    }

    graphLog.info('list-solutions:start', 'listing runner solutions');
    const solutions = await listRunnerSolutions(
      args.hookCaller,
      args.request.runner_id,
      args.workflowContext,
    );
    graphLog.info('list-solutions:done', 'runner solutions listed', {
      count: solutions.length,
      solutions: solutions.map((solution) => ({
        solutionId: solution.solutionId,
        name: solution.name,
        summary: solution.summary,
      })),
    });

    graphLog.info('decision:start', 'choosing solution and action');
    const decision = await decideCodeGraphDependencies({
      aiAdapter: args.aiAdapter,
      input: args.input,
      request: args.request,
      targetKind: args.targetKind,
      solutions,
      graphLog,
    });
    graphLog.info('decision:done', 'solution/action decision finished', {
      useSolution: decision.useSolution
        ? {
            solutionId: decision.useSolution.solutionId,
            name: decision.useSolution.name,
          }
        : null,
      waitChooseCount: decision.waitChoose.length,
      useAction: decision.useAction,
      waitChooseAction: decision.waitChooseAction,
      requiresNewSolution: decision.requiresNewSolution,
      newSolutionReason: decision.newSolutionReason,
      reason: decision.reason,
    });
    let context = buildDependencyRuntimeContext(decision);
    context.code_graph_log = graphLog.entries;
    let finalDecision = decision;
    const needsSelection =
      decision.waitChoose.length > 0 ||
      decision.waitChooseAction.length > 0 ||
      !decision.useSolution ||
      !decision.useAction;

    if (needsSelection) {
      graphLog.warn(
        'pause',
        'dependency-check requires user selection before continuing',
        {
          waitChooseCount: decision.waitChoose.length,
          waitChooseAction: decision.waitChooseAction,
          requiresNewSolution: decision.requiresNewSolution,
          newSolutionReason: decision.newSolutionReason,
        },
      );
      const resumeChoice = interrupt<
        CodeGraphDependencyInterruptPayload,
        CodeGraphDependencyResumeChoice
      >(
        buildDependencyInterruptPayload({
          request: args.request,
          targetKind: args.targetKind,
          hooks: hookProbe,
          context,
          solutions,
          decision,
        }),
      );
      graphLog.info('resume', 'dependency-check resumed with user choice', {
        chooseSolution: resumeChoice.chooseSolution,
        chooseAction: resumeChoice.chooseAction,
      });
      finalDecision = applyDependencyResumeChoice({
        selection: resumeChoice,
        solutions,
        fallback: decision,
      });
      context = buildDependencyRuntimeContext(finalDecision);
      context.code_graph_log = graphLog.entries;
    }

    const selectedNewSolution =
      finalDecision.requiresNewSolution &&
      Boolean(finalDecision.newSolutionOption) &&
      !finalDecision.useSolution &&
      Boolean(finalDecision.useAction);

    if (
      (!finalDecision.useSolution && !selectedNewSolution) ||
      !finalDecision.useAction
    ) {
      graphLog.error(
        'resume:invalid',
        'dependency-check could not resolve resumed selection',
        {
          chooseSolution: finalDecision.useSolution?.solutionId ?? null,
          chooseAction: finalDecision.useAction,
          requiresNewSolution: finalDecision.requiresNewSolution,
        },
      );
      return {
        status: 'blocked',
        node: 'dependency-check',
        hooks: hookProbe,
        context,
        solutions,
        decision: {
          ...finalDecision,
          reason: 'invalid dependency selection after resume',
        },
        errors: ['invalid dependency selection after resume'],
        log: graphLog.entries,
      };
    }

    if (finalDecision.useSolution && finalDecision.useAction) {
      graphLog.info(
        'list-selected-action:start',
        'listing selected action associations',
        {
          action: finalDecision.useAction,
          solutionId: finalDecision.useSolution.solutionId,
        },
      );
      const selectedLists = await listSelectedSolutionActions({
        hookCaller: args.hookCaller,
        runnerId: args.request.runner_id,
        workflowContext: args.workflowContext,
        solution: finalDecision.useSolution,
        action: finalDecision.useAction,
      });
      context.selectedApps = selectedLists.apps;
      context.selectedUnits = selectedLists.units;
      context.selectedDataPoints = selectedLists.dataPoints;
      graphLog.info(
        'list-selected-action:done',
        'selected action associations listed',
        {
          appsCount: selectedLists.apps.length,
          unitsCount: selectedLists.units.length,
          dataPointsCount: selectedLists.dataPoints.length,
        },
      );
    } else if (selectedNewSolution) {
      graphLog.info(
        'new-solution:selected',
        'dependency-check selected a new Solution option for downstream creation',
        {
          action: finalDecision.useAction,
          newSolutionOption: finalDecision.newSolutionOption,
        },
      );
    }

    graphLog.info('complete', 'dependency-check node completed');

    return {
      status: 'ready',
      node: 'dependency-check',
      hooks: hookProbe,
      context,
      solutions,
      decision: finalDecision,
      errors: [],
      log: graphLog.entries,
    };
  } catch (error) {
    if (isGraphInterrupt(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    graphLog.error('fail', 'dependency-check node failed', { error: message });
    return {
      status: 'blocked',
      node: 'dependency-check',
      hooks: {
        required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
        available: [],
        missing: [],
      },
      context: baseContext,
      solutions: [],
      decision: {
        ...emptyDecision,
        reason: message,
      },
      errors: [message],
      log: graphLog.entries,
    };
  }
}

/**
 * Probe whether the runner has the solution DB hooks required by code-agent.
 * @keyword-cn Hook探测, Runner数据库
 * @keyword-en hook-probe, runner-db-hooks
 */
async function probeRunnerSolutionHooks(
  hookCaller: HookCaller,
  runnerId: string,
  workflowContext: WorkflowContext | null,
): Promise<CodeGraphDependencyCheckResult['hooks']> {
  const data = await callRunnerHookData(
    hookCaller,
    runnerId,
    'runner.system.hookbus.getInfo',
    [{ hookNames: [...REQUIRED_RUNNER_SOLUTION_HOOKS] }],
    workflowContext,
  );
  const items = readItems(data);
  const available = items
    .map((item) => readStringField(item, 'name'))
    .filter(Boolean);
  const missing = REQUIRED_RUNNER_SOLUTION_HOOKS.filter(
    (hookName) => !available.includes(hookName),
  );
  return {
    required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
    available,
    missing,
  };
}

/**
 * List runner solutions through the runner-local solution hook.
 * @keyword-cn Solution列表, Runner数据库
 * @keyword-en solution-list, runner-db-hooks
 */
async function listRunnerSolutions(
  hookCaller: HookCaller,
  runnerId: string,
  workflowContext: WorkflowContext | null,
): Promise<RunnerSolutionSummary[]> {
  const data = await callRunnerHookData(
    hookCaller,
    runnerId,
    'runner.app.solution.list',
    {},
    workflowContext,
  );
  return readItems(data)
    .map((item) => toRunnerSolutionSummary(item, runnerId))
    .filter((item): item is RunnerSolutionSummary => Boolean(item));
}

/**
 * Decide solution and action using a logic model and deterministic fallbacks.
 * @keyword-cn 目标选择, 依赖判定
 * @keyword-en target-selection, dependency-decision
 */
async function decideCodeGraphDependencies(args: {
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
  request: CodeGraphRequest;
  targetKind: CodeAgentTargetKind;
  solutions: RunnerSolutionSummary[];
  graphLog: CodeGraphNodeLogger;
}): Promise<CodeGraphDependencyDecision> {
  const boundSolution = findContextBoundSolution(
    args.request.context,
    args.solutions,
  );
  if (boundSolution) {
    const boundAction = findContextBoundAction(
      args.request.context,
      args.input,
      args.targetKind,
    );
    if (
      !boundAction ||
      isSolutionSuitableForAction(boundSolution, boundAction)
    ) {
      args.graphLog.info(
        'decision:context-binding',
        'using solution from graph context',
        {
          solutionId: boundSolution.solutionId,
          name: boundSolution.name,
          action: boundAction,
        },
      );
      return {
        waitChoose: [],
        useSolution: boundSolution,
        waitChooseAction: boundAction ? [] : [...CODE_GRAPH_ACTION_VALUES],
        useAction: boundAction,
        requiresNewSolution: false,
        reason: boundAction
          ? 'session context binds a suitable solution'
          : 'session context binds a solution; target action still requires confirmation',
      };
    }
    args.graphLog.warn(
      'decision:context-binding-review',
      'bound solution does not look suitable for target action; asking dependency decision to review reuse vs new solution',
      {
        solutionId: boundSolution.solutionId,
        name: boundSolution.name,
        action: boundAction,
        includes: boundSolution.includes,
      },
    );
  }

  const fallback = buildFallbackDependencyDecision(
    args.input,
    args.targetKind,
    args.solutions,
  );
  if (args.solutions.length === 0) {
    args.graphLog.warn('decision:no-solutions', 'runner returned no solutions');
    return {
      ...fallback,
      reason: 'runner returned no solutions',
    };
  }

  try {
    const model = selectLogicModel(args.aiAdapter, args.input);
    args.graphLog.info(
      'decision:llm:start',
      'calling logic model for dependency decision',
    );
    const response = await model.chat({
      source: 'code-agent.dependency-check',
      messages: [
        {
          role: 'user',
          content: buildDependencyDecisionPrompt(
            args.request.full_requirement,
            args.targetKind,
            args.solutions,
          ),
        },
      ],
      params: { temperature: 0 },
    });
    const parsed = LlmDependencyDecisionSchema.parse(
      parseJsonObjectLoose(response.content),
    );
    args.graphLog.info(
      'decision:llm:done',
      'logic model returned dependency JSON',
    );
    return normalizeLlmDependencyDecision(parsed, args.solutions, fallback);
  } catch (error) {
    logger.warn(
      `dependency-check llm decision fallback: ${error instanceof Error ? error.message : String(error)}`,
    );
    args.graphLog.warn(
      'decision:fallback',
      'using deterministic fallback decision',
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return fallback;
  }
}

/**
 * Select the logic model client for graph analysis.
 * @keyword-cn 逻辑模型, 依赖判定
 * @keyword-en logic-model, dependency-decision
 */
function selectLogicModel(
  aiAdapter: AgentAiServer,
  input: CodeGenOrchestrateInput,
): AgentAiModelClient {
  if (input.logicModelId?.trim()) {
    return aiAdapter.withModel(input.logicModelId.trim());
  }
  return aiAdapter.useModel(input.logicModelIndex ?? 1);
}

/**
 * Build a strict JSON prompt for the dependency decision node.
 * @keyword-cn 依赖判定, JSON输出
 * @keyword-en dependency-decision, json-output
 */
function buildDependencyDecisionPrompt(
  requirement: string,
  targetKind: CodeAgentTargetKind,
  solutions: RunnerSolutionSummary[],
): string {
  const solutionBrief = solutions.map((solution) => ({
    id: solution.id,
    solutionId: solution.solutionId,
    name: solution.name,
    summary: solution.summary,
    includes: solution.includes,
    isInitialized: solution.isInitialized,
  }));
  return [
    '你是 code-agent 的依赖检查节点。只能输出 JSON, 不要 markdown。',
    '任务: 根据完整需求和 Runner 已有 solution 列表, 选择最合适的既有 solution, 并判断本次目标动作是 app、unit 还是 data-point。',
    '禁止自动创建新的 solution; solution 只是既有 Runner 记录的承载容器。',
    '即使 Runner 只有一个 solution, 也必须判断它是否适合承载本需求; 不要因为唯一就默认复用。',
    '如果现有 solution 明显不适合且本需求需要新的承载容器, 返回 requiresNewSolution=true, useSolution=null, 并用 newSolutionOption 给出 "new" 候选。',
    '当需要用户确认是复用既有 solution 还是新建 solution 时, 必须同时返回 waitChoose 和 newSolutionOption。',
    '如果无法确定唯一既有 solution, 返回 waitChoose 数组; 如果无法确定动作, 返回 waitChooseAction 数组。',
    'JSON 形状: {"waitChoose":[{"solutionId":"...","name":"...","reason":"..."}],"useSolution":{"solutionId":"...","name":"...","reason":"..."}|null,"waitChooseAction":["app","unit","data-point"],"useAction":"app"|"unit"|"data-point"|null,"requiresNewSolution":false,"newSolutionOption":{"name":"new-solution-name","summary":"why new container is better","reason":"..."}|null,"newSolutionReason":"","reason":"..."}',
    `粗目标提示: ${targetKind}`,
    `完整需求: ${requirement}`,
    `Runner solutions: ${JSON.stringify(solutionBrief)}`,
  ].join('\n');
}

const LlmDependencyDecisionSchema = z.object({
  waitChoose: z
    .array(
      z
        .object({
          id: z.string().optional(),
          solutionId: z.string().optional(),
          name: z.string().optional(),
          reason: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
  useSolution: z
    .object({
      id: z.string().optional(),
      solutionId: z.string().optional(),
      name: z.string().optional(),
      reason: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  waitChooseAction: z.array(z.enum(CODE_GRAPH_ACTION_VALUES)).optional(),
  useAction: z.enum(CODE_GRAPH_ACTION_VALUES).nullable().optional(),
  requiresNewSolution: z.boolean().optional(),
  newSolutionOption: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
      summary: z.string().optional(),
      reason: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  newSolutionReason: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Normalize a logic-model dependency decision against actual runner solutions.
 * @keyword-cn 目标选择, 依赖判定
 * @keyword-en target-selection, dependency-decision
 */
function normalizeLlmDependencyDecision(
  payload: LlmDependencyDecisionPayload,
  solutions: RunnerSolutionSummary[],
  fallback: CodeGraphDependencyDecision,
): CodeGraphDependencyDecision {
  const useSolution = payload.useSolution
    ? resolveSolutionChoice(payload.useSolution, solutions)
    : null;
  const waitChoose = (payload.waitChoose ?? [])
    .map((item) => resolveSolutionChoice(item, solutions))
    .filter((item): item is RunnerSolutionSummary => Boolean(item));
  const useAction = normalizeActionChoice(payload.useAction ?? undefined);
  const waitChooseAction = (payload.waitChooseAction ?? [])
    .map((item) => normalizeActionChoice(item))
    .filter((item): item is CodeGraphActionKind => Boolean(item));
  const requiresNewSolution = payload.requiresNewSolution === true;
  const reason = payload.newSolutionReason || payload.reason || fallback.reason;
  const newSolutionOption = normalizeNewSolutionOption(
    payload.newSolutionOption
      ? (payload.newSolutionOption as Record<string, unknown>)
      : undefined,
    fallback.newSolutionOption,
    fallback.useAction,
    reason,
  );

  if (requiresNewSolution) {
    return {
      waitChoose: waitChoose.length > 0 ? waitChoose : solutions.slice(0, 6),
      useSolution: null,
      waitChooseAction:
        useAction || waitChooseAction.length > 0
          ? waitChooseAction
          : fallback.waitChooseAction,
      useAction: useAction ?? fallback.useAction,
      requiresNewSolution: true,
      ...(newSolutionOption ? { newSolutionOption } : {}),
      newSolutionReason: payload.newSolutionReason ?? payload.reason,
      reason,
    };
  }

  return {
    waitChoose:
      useSolution || waitChoose.length > 0 ? waitChoose : fallback.waitChoose,
    useSolution: useSolution ?? fallback.useSolution,
    waitChooseAction:
      useAction || waitChooseAction.length > 0
        ? waitChooseAction
        : fallback.waitChooseAction,
    useAction: useAction ?? fallback.useAction,
    requiresNewSolution: false,
    ...(newSolutionOption ? { newSolutionOption } : {}),
    reason,
  };
}

/**
 * Build a deterministic dependency decision when LLM selection is unavailable.
 * @keyword-cn 目标选择, 回退策略
 * @keyword-en target-selection, fallback-decision
 */
function buildFallbackDependencyDecision(
  input: CodeGenOrchestrateInput,
  targetKind: CodeAgentTargetKind,
  solutions: RunnerSolutionSummary[],
): CodeGraphDependencyDecision {
  const useAction = normalizeActionChoice(input.targetKind ?? targetKind);
  const hasSolutions = solutions.length > 0;
  const reason = hasSolutions
    ? 'LLM decision unavailable; choose an existing solution or create a new one'
    : 'runner returned no solutions; a new solution must be created or bound before continuing';
  const newSolutionOption = buildNewSolutionOption({
    requirement: normalizeCodeGraphRequirement(input),
    targetKind,
    reason,
  });
  return {
    waitChoose: solutions.slice(0, 6),
    useSolution: null,
    waitChooseAction: useAction ? [] : [...CODE_GRAPH_ACTION_VALUES],
    useAction,
    requiresNewSolution: !hasSolutions,
    newSolutionOption,
    newSolutionReason: hasSolutions
      ? undefined
      : 'runner returned no existing solutions',
    reason,
  };
}

/**
 * Normalize a model-produced new Solution option for dependency confirmation.
 * @keyword-cn 新Solution选项, 依赖判定
 * @keyword-en new-solution-option, dependency-decision
 */
function normalizeNewSolutionOption(
  raw: Record<string, unknown> | null | undefined,
  fallback: CodeGraphNewSolutionOption | undefined,
  targetKind: CodeAgentTargetKind | null,
  reason: string | undefined,
): CodeGraphNewSolutionOption | undefined {
  if (!raw) return fallback;
  const rawName = readOptionString(raw, 'name');
  const rawVersion = readOptionString(raw, 'version');
  const rawSummary = readOptionString(raw, 'summary');
  const rawReason = readOptionString(raw, 'reason');
  const name = rawName || fallback?.name || 'new-solution';
  const summary =
    rawSummary ||
    fallback?.summary ||
    'Create or bind a new Solution for this requirement.';
  return {
    id: NEW_SOLUTION_CHOICE_ID,
    kind: 'new-solution',
    name,
    ...(rawVersion
      ? { version: rawVersion }
      : fallback?.version
        ? { version: fallback.version }
        : {}),
    summary,
    reason: rawReason || reason || fallback?.reason,
    targetKind: targetKind ?? fallback?.targetKind ?? 'app',
  };
}

/**
 * Read one optional string from a model/UI option record.
 * @keyword-cn 新Solution选项, 字段读取
 * @keyword-en new-solution-option, field-read
 */
function readOptionString(
  value: Record<string, unknown>,
  field: string,
): string {
  const raw = value[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Build the default "new Solution" option shown beside existing candidates.
 * @keyword-cn 新Solution选项, 回退策略
 * @keyword-en new-solution-option, fallback-decision
 */
function buildNewSolutionOption(args: {
  requirement: string;
  targetKind: CodeAgentTargetKind;
  reason?: string;
}): CodeGraphNewSolutionOption {
  const heading = args.requirement
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  const baseName = (heading || `${args.targetKind} solution`)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
  return {
    id: NEW_SOLUTION_CHOICE_ID,
    kind: 'new-solution',
    name: baseName || 'new-solution',
    version: '1.0.0',
    summary: 'Create or bind a new Solution for this requirement.',
    reason: args.reason,
    targetKind: args.targetKind,
  };
}

/**
 * Build runtime context from dependency decision.
 * @keyword-cn Graph上下文, 目标选择
 * @keyword-en graph-context, target-selection
 */
function buildDependencyRuntimeContext(
  decision: CodeGraphDependencyDecision,
): CodeGraphRuntimeContext {
  const selectedNewSolution =
    decision.requiresNewSolution &&
    !decision.useSolution &&
    Boolean(decision.newSolutionOption);
  return {
    chooseSolution:
      decision.useSolution?.solutionId ??
      (selectedNewSolution ? NEW_SOLUTION_CHOICE_ID : ''),
    chooseAction: decision.useAction ?? '',
    code_graph_log: [],
    ...(decision.useSolution
      ? { selectedSolution: decision.useSolution }
      : selectedNewSolution && decision.newSolutionOption
        ? { selectedSolution: decision.newSolutionOption }
        : {}),
    ...(decision.newSolutionOption
      ? { newSolutionOption: decision.newSolutionOption }
      : {}),
  };
}

/**
 * Build the LangGraph interrupt payload consumed by the dependency choice card.
 * @keyword-cn 中断payload, 选择卡片
 * @keyword-en interrupt-payload, selection-card
 */
function buildDependencyInterruptPayload(args: {
  request: CodeGraphRequest;
  targetKind: CodeAgentTargetKind;
  hooks: CodeGraphDependencyCheckResult['hooks'];
  context: CodeGraphRuntimeContext;
  solutions: RunnerSolutionSummary[];
  decision: CodeGraphDependencyDecision;
}): CodeGraphDependencyInterruptPayload {
  return {
    type: 'code-agent.dependency-choice',
    runnerId: args.request.runner_id,
    sessionId: args.request.context.session_id,
    requirement: args.request.full_requirement,
    targetKind: args.targetKind,
    hooks: args.hooks,
    context: args.context,
    solutions: args.solutions,
    decision: args.decision,
  };
}

/**
 * Resolve a LangGraph resume selection to the real Runner solution/action pair.
 * @keyword-cn 依赖选择, 检查点恢复
 * @keyword-en dependency-selection, checkpoint-resume
 */
function applyDependencyResumeChoice(args: {
  selection: CodeGraphDependencyResumeChoice;
  solutions: RunnerSolutionSummary[];
  fallback: CodeGraphDependencyDecision;
}): CodeGraphDependencyDecision {
  const useAction = normalizeActionChoice(args.selection.chooseAction);
  if (args.selection.chooseSolution === NEW_SOLUTION_CHOICE_ID) {
    const selectedNewOption = readContextRecord(
      { selectedSolution: args.selection.selectedSolution ?? {} },
      'selectedSolution',
    );
    const newSolutionOption = normalizeNewSolutionOption(
      selectedNewOption,
      args.fallback.newSolutionOption,
      useAction,
      args.fallback.newSolutionReason ?? args.fallback.reason,
    );
    return {
      waitChoose: [],
      useSolution: null,
      waitChooseAction: [],
      useAction,
      requiresNewSolution: true,
      ...(newSolutionOption ? { newSolutionOption } : {}),
      newSolutionReason:
        newSolutionOption?.reason ??
        args.fallback.newSolutionReason ??
        args.fallback.reason,
      reason: 'dependency selection resumed with new Solution option',
    };
  }
  const useSolution =
    resolveSolutionChoice(
      {
        id: args.selection.chooseSolution,
        solutionId: args.selection.chooseSolution,
        name:
          typeof args.selection.selectedSolution?.name === 'string'
            ? args.selection.selectedSolution.name
            : undefined,
      },
      args.solutions,
    ) ?? args.fallback.useSolution;
  return {
    waitChoose: [],
    useSolution,
    waitChooseAction: [],
    useAction,
    requiresNewSolution: false,
    reason: 'dependency selection resumed from LangGraph interrupt',
  };
}

/**
 * List selected solution associations after the dependency node has a target action.
 * @keyword-cn 目标关联列表, Runner数据库
 * @keyword-en action-association-list, runner-db-hooks
 */
async function listSelectedSolutionActions(args: {
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  solution: RunnerSolutionSummary;
  action: CodeGraphActionKind;
}): Promise<{ apps: unknown[]; units: unknown[]; dataPoints: unknown[] }> {
  if (args.action === 'app') {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      'runner.app.solution.listApps',
      { solutionId: args.solution.solutionId },
      args.workflowContext,
    );
    return { apps: readItems(data), units: [], dataPoints: [] };
  }
  if (args.action === 'unit') {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      'runner.app.solution.listUnits',
      { solutionId: args.solution.solutionId },
      args.workflowContext,
    );
    return { apps: [], units: readItems(data), dataPoints: [] };
  }
  if (args.action === 'data-point') {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      'runner.app.dataTouchpoint.list',
      { solutionId: args.solution.solutionId },
      args.workflowContext,
    );
    return { apps: [], units: [], dataPoints: readItems(data) };
  }
  return { apps: [], units: [], dataPoints: [] };
}

/**
 * Send the dependency choice hook component as an agent message.
 * @keyword-cn 选择卡片发送, Hook组件
 * @keyword-en selection-card-send, hook-component
 */
async function sendDependencyChoiceCard(args: {
  hookCaller: HookCaller;
  request: CodeGraphRequest;
  workflowContext: WorkflowContext | null;
  interrupt: CodeGraphDependencyInterruptPayload;
  checkpoint: CodeGraphResumeRef & { threadId: string };
  graphLog: CodeGraphNodeLogger;
}): Promise<void> {
  const sessionId = args.request.context.session_id;
  if (!sessionId) {
    args.graphLog.warn(
      'send-selection-card:skip',
      'session_id missing; cannot send dependency choice card',
    );
    return;
  }
  args.graphLog.info(
    'send-selection-card:start',
    'sending dependency choice card',
  );
  const content = buildDependencyChoiceCardContent({
    interrupt: args.interrupt,
    workflowContext: args.workflowContext,
    checkpoint: args.checkpoint,
  });
  const data = await callRunnerHookData(
    args.hookCaller,
    args.request.runner_id,
    CONVERSATION_SEND_MSG_HOOK,
    [{ sessionId, content }],
    args.workflowContext,
  );
  assertForwardedSaaSHookDataOk(CONVERSATION_SEND_MSG_HOOK, data);
  args.graphLog.info(
    'send-selection-card:done',
    'dependency choice card sent',
    {
      hook: CODE_AGENT_DEPENDENCY_CHOICE_COMPONENT_HOOK,
      sessionId,
      threadId: args.checkpoint.threadId,
      checkpointId: args.checkpoint.checkpointId ?? null,
    },
  );
}

/**
 * Build markdown content containing the hook component fence.
 * @keyword-cn Hook组件消息, 选择卡片
 * @keyword-en hook-component-message, selection-card
 */
function buildDependencyChoiceCardContent(args: {
  interrupt: CodeGraphDependencyInterruptPayload;
  workflowContext: WorkflowContext | null;
  checkpoint: CodeGraphResumeRef & { threadId: string };
}): string {
  const fence = stringifyHookFencePayload({
    actionHook: CODE_AGENT_DEPENDENCY_CHOICE_COMPONENT_HOOK,
    payload: buildDependencyChoiceCardPayload(args),
  });
  return ['```hook', fence, '```'].join('\n');
}

/**
 * Build the hook component payload for dependency choice.
 * @keyword-cn 选择卡片payload, 依赖检查
 * @keyword-en selection-card-payload, dependency-check
 */
function buildDependencyChoiceCardPayload(args: {
  interrupt: CodeGraphDependencyInterruptPayload;
  workflowContext: WorkflowContext | null;
  checkpoint: CodeGraphResumeRef & { threadId: string };
}): Record<string, unknown> {
  const languageProbe = [
    args.interrupt.requirement,
    args.interrupt.decision.reason,
    args.interrupt.decision.newSolutionReason,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n');
  const useChinese = /[\u3400-\u9fff]/.test(languageProbe);
  const canCreateNew = Boolean(args.interrupt.decision.newSolutionOption);
  const uiText = useChinese
    ? {
        locale: 'zh-CN',
        title: '确认生成目标',
        subtitle:
          '请选择本次需求的承载位置和目标类型，确认后 code-agent 会在后台继续执行。',
        decisionNote: canCreateNew
          ? '可以复用已有 Solution，也可以为这次需求新建一个 Solution。'
          : '请确认后续要复用的 Solution 与目标类型。',
        solutionTitle: '承载位置',
        solutionHelp:
          'Solution 用来归档同一类产物。复用会把本次结果放到已有 Solution 下；新建会先创建新的承载容器。',
        actionTitle: '目标类型',
        actionHelp: '目标类型决定下一步 graph 要创建或更新的对象。',
        existingSolutionBadge: '复用',
        newSolutionBadge: '新建',
        existingSolutionHelp:
          '复用这个 Solution，后续会在它下面继续创建或更新目标。',
        newSolutionSummary: '为本次需求创建一个新的 Solution。',
        newSolutionHelp: '后续节点会先创建新的 Solution，再把本次目标放进去。',
        newSolutionMeta: '将创建新的 Solution',
        solutionIdLabel: 'id',
        includesLabel: '可承载',
        noSolutions: '没有可选择的 Solution',
        noActions: '没有可选择的目标类型',
        submit: '确认选择',
        submitting: '提交中...',
        submitted: '已提交',
        submittedMessage: '选择已提交，LangGraph 将在后台继续执行。',
        failedPrefix: '选择已提交，但 LangGraph 恢复失败：',
        newSolutionNoticeTitle: '可能需要新的 Solution',
        newSolutionNoticeBody:
          '现有 Solution 可能不适合承载当前需求，请确认是否新建。',
        newSolutionNoticeHelp:
          '如果确认复用已有 Solution，请选择已有项后继续。',
        footerRunnerLabel: 'runner',
        footerThreadLabel: 'thread',
        footerCheckpointLabel: 'checkpoint',
        actionLabels: {
          app: {
            label: '应用 / 页面',
            description: '适合单页 HTML、前端页面、可打开的应用界面。',
          },
          unit: {
            label: '执行单元',
            description: '适合后端能力、脚本任务、可调用的业务单元。',
          },
          'data-point': {
            label: '数据触点',
            description: '适合把数据源、数据查询或数据展示触点接入系统。',
          },
        },
      }
    : {
        locale: 'en-US',
        title: 'Confirm Generation Target',
        subtitle:
          'Choose where this request should live and what kind of target code-agent should continue with.',
        decisionNote: canCreateNew
          ? 'Reuse an existing Solution or create a new one for this request.'
          : 'Confirm the Solution and target type before continuing.',
        solutionTitle: 'Container',
        solutionHelp:
          'A Solution groups related outputs. Reuse an existing one or create a new container for this request.',
        actionTitle: 'Target Type',
        actionHelp:
          'The target type tells the graph what object to create or update next.',
        existingSolutionBadge: 'Reuse',
        newSolutionBadge: 'New',
        existingSolutionHelp:
          'Continue under this existing Solution and create or update the selected target there.',
        newSolutionSummary: 'Create a new Solution for this request.',
        newSolutionHelp:
          'The next node will create a new Solution before placing the target inside it.',
        newSolutionMeta: 'Create a new Solution',
        solutionIdLabel: 'id',
        includesLabel: 'Supports',
        noSolutions: 'No selectable Solutions',
        noActions: 'No selectable target types',
        submit: 'Confirm',
        submitting: 'Submitting...',
        submitted: 'Submitted',
        submittedMessage:
          'Selection submitted. LangGraph will continue in the background.',
        failedPrefix: 'Selection submitted, but LangGraph resume failed: ',
        newSolutionNoticeTitle: 'A New Solution May Fit Better',
        newSolutionNoticeBody:
          'The existing Solution may not be the right container for this request.',
        newSolutionNoticeHelp:
          'Choose an existing item if you still want to reuse it.',
        footerRunnerLabel: 'runner',
        footerThreadLabel: 'thread',
        footerCheckpointLabel: 'checkpoint',
        actionLabels: {
          app: {
            label: 'App / Page',
            description:
              'For single-file HTML, frontend pages, and usable app screens.',
          },
          unit: {
            label: 'Unit',
            description:
              'For backend capabilities, scripts, and callable business units.',
          },
          'data-point': {
            label: 'Data Point',
            description:
              'For data sources, queries, or data-facing integration points.',
          },
        },
      };
  return {
    sessionId: args.interrupt.sessionId,
    runnerId: args.interrupt.runnerId,
    agentPrincipalId: args.workflowContext?.agentPrincipalId,
    agentId: args.workflowContext?.agentId,
    aiModelIds: args.workflowContext?.aiModelIds,
    threadId: args.checkpoint.threadId,
    checkpointId: args.checkpoint.checkpointId ?? null,
    interruptId: args.checkpoint.interruptId ?? null,
    requirement: args.interrupt.requirement,
    targetKind: args.interrupt.targetKind,
    uiText,
    reason: args.interrupt.decision.reason,
    requiresNewSolution: args.interrupt.decision.requiresNewSolution,
    newSolutionReason: args.interrupt.decision.newSolutionReason,
    newSolutionOption: args.interrupt.decision.newSolutionOption,
    waitChoose: args.interrupt.decision.waitChoose.map(
      toDependencyChoiceCardSolution,
    ),
    useSolution: args.interrupt.decision.useSolution
      ? toDependencyChoiceCardSolution(args.interrupt.decision.useSolution)
      : null,
    waitChooseAction: args.interrupt.decision.waitChooseAction,
    useAction: args.interrupt.decision.useAction,
    context: args.interrupt.context,
  };
}

/**
 * Project a runner solution into the compact card payload shape.
 * @keyword-cn Solution选择, 卡片payload
 * @keyword-en solution-choice, card-payload
 */
function toDependencyChoiceCardSolution(
  solution: RunnerSolutionSummary,
): Record<string, unknown> {
  return {
    id: solution.id,
    runnerId: solution.runnerId,
    solutionId: solution.solutionId,
    name: solution.name,
    version: solution.version,
    summary: solution.summary,
    description: solution.description,
    includes: solution.includes,
    isInitialized: solution.isInitialized,
  };
}

/**
 * Stringify hook fence JSON while preventing accidental markdown fence closure.
 * @keyword-cn Hook组件消息, JSON序列化
 * @keyword-en hook-fence-json, json-stringify
 */
function stringifyHookFencePayload(value: unknown): string {
  return JSON.stringify(value).replace(/```/g, '\\u0060\\u0060\\u0060');
}

/**
 * Detect a SaaS hook error that was forwarded through Runner's saas.* bridge.
 * @keyword-cn SaaSHook转发, Hook错误
 * @keyword-en saas-hook-forward, hook-error
 */
function assertForwardedSaaSHookDataOk(hookName: string, data: unknown): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  if (record.status === 'error') {
    const rawError = record.error;
    const message =
      typeof rawError === 'string'
        ? rawError
        : rawError === undefined
          ? 'hook error'
          : JSON.stringify(rawError);
    throw new Error(`${hookName} failed: ${message}`);
  }
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
 * Call a runner hook and unwrap the single-handler data payload.
 * @keyword-cn RunnerHook调用, Hook数据
 * @keyword-en runner-hook-call, hook-data
 */
async function callRunnerHookData(
  hookCaller: HookCaller,
  runnerId: string,
  hookName: string,
  payload: unknown,
  workflowContext: WorkflowContext | null,
): Promise<unknown> {
  const reply = await hookCaller.callHook(runnerId, {
    hookName,
    payload,
    context: buildRunnerInvocationContext(workflowContext),
  });
  assertRunnerHookReplyOk(hookName, reply);
  if (Array.isArray(reply.result)) {
    return reply.result.length === 1 ? reply.result[0] : reply.result;
  }
  return reply.result;
}

/**
 * Build the hidden invocation context for Runner RPC calls.
 * @keyword-cn 调用上下文, RunnerHook
 * @keyword-en invocation-context, runner-hook
 */
function buildRunnerInvocationContext(workflowContext: WorkflowContext | null) {
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
 * Throw a readable error when a Runner hook reply is a soft failure.
 * @keyword-cn Hook错误, RunnerHook
 * @keyword-en hook-error, runner-hook
 */
function assertRunnerHookReplyOk(
  hookName: string,
  reply: HookCallReplyLike,
): void {
  const errorMsg = reply.errorMsg ?? [];
  if (errorMsg.length > 0) {
    throw new Error(`${hookName} failed: ${errorMsg.join('; ')}`);
  }
}

/**
 * Read a standard `{ items }` hook payload or array payload.
 * @keyword-cn Hook数据, 列表读取
 * @keyword-en hook-data, item-list
 */
function readItems(value: unknown): Record<string, unknown>[] {
  const rawItems =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).items
      : value;
  if (!Array.isArray(rawItems)) return [];
  return rawItems.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

/**
 * Read one string field from an unknown record.
 * @keyword-cn 字段读取, Hook数据
 * @keyword-en field-read, hook-data
 */
function readStringField(
  value: Record<string, unknown>,
  field: string,
): string {
  const raw = value[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Normalize a runner solution record into the code graph summary shape.
 * @keyword-cn Solution摘要, Runner数据库
 * @keyword-en solution-summary, runner-db-hooks
 */
function toRunnerSolutionSummary(
  value: Record<string, unknown>,
  runnerId: string,
): RunnerSolutionSummary | null {
  const solutionId = readStringField(value, 'solutionId');
  const name = readStringField(value, 'name');
  if (!solutionId || !name) return null;
  const includes = Array.isArray(value.includes)
    ? value.includes.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    id: solutionId,
    runnerId,
    solutionId,
    name,
    version: readStringField(value, 'version') || undefined,
    summary: readStringField(value, 'summary'),
    description: readStringField(value, 'description') || undefined,
    includes,
    isInitialized:
      typeof value.isInitialized === 'boolean'
        ? value.isInitialized
        : undefined,
  };
}

/**
 * Resolve a solution bound by tool/session context before asking the model.
 * @keyword-cn 会话绑定, Solution选择
 * @keyword-en session-binding, solution-selection
 */
function findContextBoundSolution(
  context: CodeGraphRequest['context'],
  solutions: RunnerSolutionSummary[],
): RunnerSolutionSummary | null {
  const candidates = [
    readContextString(context, 'chooseSolution'),
    readContextString(context, 'solution_id'),
    readContextString(context, 'solutionId'),
    readContextString(context, 'boundSolutionId'),
    readContextString(context, 'currentSolutionId'),
    readContextString(context, 'solutionName'),
  ].filter((item): item is string => Boolean(item?.trim()));
  for (const candidate of candidates) {
    const resolved = resolveSolutionChoice(
      { solutionId: candidate, name: candidate },
      solutions,
    );
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Decide whether a bound solution already declares support for the target action.
 * @keyword-cn Solution适配, 目标选择
 * @keyword-en solution-fit, target-selection
 */
function isSolutionSuitableForAction(
  solution: RunnerSolutionSummary,
  action: CodeGraphActionKind,
): boolean {
  return solution.includes.includes(action);
}

/**
 * Resolve an action bound by graph context or tool input.
 * @keyword-cn 动作选择, 会话绑定
 * @keyword-en action-selection, session-binding
 */
function findContextBoundAction(
  context: CodeGraphRequest['context'],
  input: CodeGenOrchestrateInput,
  targetKind: CodeAgentTargetKind,
): CodeGraphActionKind | null {
  return (
    normalizeActionChoice(readContextString(context, 'chooseAction')) ??
    normalizeActionChoice(readContextString(context, 'targetKind')) ??
    normalizeActionChoice(input.targetKind) ??
    normalizeActionChoice(targetKind)
  );
}

/**
 * Read a string field from code graph context.
 * @keyword-cn Graph上下文, 字段读取
 * @keyword-en graph-context, field-read
 */
function readContextString(
  context: CodeGraphRequest['context'],
  field: string,
): string | undefined {
  const raw = context[field];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/**
 * Read an object field from code graph context.
 * @keyword-cn Graph上下文, 字段读取
 * @keyword-en graph-context, field-read
 */
function readContextRecord(
  context: CodeGraphRequest['context'],
  field: string,
): Record<string, unknown> | undefined {
  const raw = context[field];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : undefined;
}

/**
 * Resolve a model-produced solution choice to a real runner solution.
 * @keyword-cn Solution选择, 目标选择
 * @keyword-en solution-selection, target-selection
 */
function resolveSolutionChoice(
  choice: { id?: string; solutionId?: string; name?: string },
  solutions: RunnerSolutionSummary[],
): RunnerSolutionSummary | null {
  const ids = [choice.solutionId, choice.id]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim());
  const names = [choice.name]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim().toLowerCase());
  return (
    solutions.find(
      (solution) =>
        ids.includes(solution.solutionId) ||
        ids.includes(solution.id) ||
        names.includes(solution.name.toLowerCase()),
    ) ?? null
  );
}

/**
 * Normalize action names used by the dependency check node.
 * @keyword-cn 动作选择, 目标类型
 * @keyword-en action-selection, target-kind
 */
function normalizeActionChoice(
  value: string | undefined,
): CodeGraphActionKind | null {
  if (value === 'app' || value === 'unit' || value === 'data-point') {
    return value;
  }
  return null;
}

/**
 * Parse a JSON object from an LLM response, accepting fenced output.
 * @keyword-cn JSON解析, 依赖判定
 * @keyword-en json-parse, dependency-decision
 */
function parseJsonObjectLoose(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Continue to fenced/object extraction below.
  }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue to brace extraction below.
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error('LLM response is not a JSON object');
}

/**
 * Build the tool response for the dependency check node.
 * @keyword-cn 工具回包, 依赖检查节点
 * @keyword-en tool-result, dependency-check-node
 */
function buildDependencyCheckResultMessage(
  request: CodeGraphRequest,
  result: CodeGraphDependencyCheckResult,
): string {
  const body = {
    status: result.status,
    node: result.node,
    runner_id: request.runner_id,
    session_id: request.context.session_id ?? null,
    context: result.context,
    hooks: result.hooks,
    decision: result.decision,
    log: result.log,
    solutions: result.solutions.map((solution) => ({
      id: solution.id,
      runnerId: solution.runnerId,
      solutionId: solution.solutionId,
      name: solution.name,
      summary: solution.summary,
      includes: solution.includes,
      isInitialized: solution.isInitialized,
    })),
    errors: result.errors,
    next:
      result.status === 'ready'
        ? 'dependency-check complete; continue to the next code graph node'
        : result.status === 'waiting_for_selection'
          ? 'pause before next node; caller must resolve waitChoose/waitChooseAction and resume with updated context'
          : 'blocked; fix missing runner hooks, hook caller, or AI adapter first',
  };
  return [
    'code graph dependency-check result:',
    JSON.stringify(body, null, 2),
  ].join('\n');
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
