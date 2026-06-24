import { Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
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
  allowCreateSolution?: boolean;
  solutionName?: string;
  solutionVersion?: string;
  solutionSummary?: string;
  appName?: string;
  appVersion?: string;
  appDescription?: string;
  unitName?: string;
};

type CodeGraphActionKind = 'solution' | 'app' | 'view' | 'unit';

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

type CodeGraphDependencyDecision = {
  waitChoose: RunnerSolutionSummary[];
  useSolution: RunnerSolutionSummary | null;
  waitChooseAction: CodeGraphActionKind[];
  useAction: CodeGraphActionKind | null;
  reason?: string;
};

type CodeGraphRuntimeContext = {
  chooseSolution: string;
  chooseAction: CodeGraphActionKind | '';
  selectedSolution?: RunnerSolutionSummary;
  selectedApps?: unknown[];
  selectedUnits?: unknown[];
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
  reason?: string;
};

const REQUIRED_RUNNER_SOLUTION_HOOKS = [
  'runner.app.solution.list',
  'runner.app.solution.get',
  'runner.app.solution.listApps',
  'runner.app.solution.listUnits',
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
      .object({
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
        targetKind: z.enum(['solution', 'app', 'view', 'unit']).optional(),
        logicModelId: z.string().optional(),
        frontendModelId: z.string().optional(),
        logicModelIndex: z.number().int().min(0).optional(),
        frontendModelIndex: z.number().int().min(0).optional(),
        allowCreateSolution: z.boolean().optional(),
        solutionName: z.string().optional(),
        solutionVersion: z.string().optional(),
        solutionSummary: z.string().optional(),
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
        logger.log(
          `code_gen_orchestrate accepted graph shell request runner_id=${request.runner_id} session_id=${request.context.session_id ?? ''} targetKind=${targetKind}`,
        );

        const dependencyCheck = await runCodeGenGraph({
          request,
          input,
          targetKind,
          aiAdapter: this.#aiAdapter,
          hookCaller: this.#hookCaller,
          workflowContext: this.#workflowContext,
          checkpointer: this.#checkpointer,
        });

        return buildDependencyCheckResultMessage(request, dependencyCheck);
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

    if (!finalDecision.useSolution || !finalDecision.useAction) {
      graphLog.error(
        'resume:invalid',
        'dependency-check could not resolve resumed selection',
        {
          chooseSolution: finalDecision.useSolution?.solutionId ?? null,
          chooseAction: finalDecision.useAction,
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
      graphLog.info(
        'list-selected-action:done',
        'selected action associations listed',
        {
          appsCount: selectedLists.apps.length,
          unitsCount: selectedLists.units.length,
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
    args.input,
    args.solutions,
  );
  if (boundSolution) {
    const boundAction = findContextBoundAction(
      args.request.context,
      args.input,
      args.targetKind,
    );
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
      waitChooseAction: boundAction ? [] : ['app', 'unit'],
      useAction: boundAction,
      reason: 'session context already binds a solution',
    };
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
    '任务: 根据完整需求和 Runner 已有 solution 列表, 选择最合适的 solution, 并判断本次目标动作是 app、unit、view 还是 solution。',
    '如果无法确定唯一 solution, 返回 waitChoose 数组; 如果无法确定动作, 返回 waitChooseAction 数组。',
    'JSON 形状: {"waitChoose":[{"solutionId":"...","name":"...","reason":"..."}],"useSolution":{"solutionId":"...","name":"...","reason":"..."}|null,"waitChooseAction":["app","unit"],"useAction":"app"|"unit"|"view"|"solution"|null,"reason":"..."}',
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
  waitChooseAction: z
    .array(z.enum(['solution', 'app', 'view', 'unit']))
    .optional(),
  useAction: z.enum(['solution', 'app', 'view', 'unit']).nullable().optional(),
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

  return {
    waitChoose:
      useSolution || waitChoose.length > 0 ? waitChoose : fallback.waitChoose,
    useSolution: useSolution ?? fallback.useSolution,
    waitChooseAction:
      useAction || waitChooseAction.length > 0
        ? waitChooseAction
        : fallback.waitChooseAction,
    useAction: useAction ?? fallback.useAction,
    reason: payload.reason ?? fallback.reason,
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
  const explicitSolution = findExplicitSolution(input, solutions);
  const onlySolution = solutions.length === 1 ? solutions[0] : null;
  const useSolution = explicitSolution ?? onlySolution;
  const useAction = normalizeActionChoice(input.targetKind ?? targetKind);
  return {
    waitChoose: useSolution ? [] : solutions.slice(0, 6),
    useSolution,
    waitChooseAction: useAction ? [] : ['app', 'unit'],
    useAction,
    reason: useSolution
      ? 'deterministic fallback selected solution'
      : 'multiple or zero runner solutions require selection',
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
  return {
    chooseSolution: decision.useSolution?.solutionId ?? '',
    chooseAction: decision.useAction ?? '',
    code_graph_log: [],
    ...(decision.useSolution ? { selectedSolution: decision.useSolution } : {}),
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
  const useAction = normalizeActionChoice(args.selection.chooseAction);
  return {
    waitChoose: [],
    useSolution,
    waitChooseAction: [],
    useAction,
    reason: 'dependency selection resumed from LangGraph interrupt',
  };
}

/**
 * List selected solution apps or units after the dependency node has a target action.
 * @keyword-cn 应用单元列表, Runner数据库
 * @keyword-en app-unit-list, runner-db-hooks
 */
async function listSelectedSolutionActions(args: {
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  solution: RunnerSolutionSummary;
  action: CodeGraphActionKind;
}): Promise<{ apps: unknown[]; units: unknown[] }> {
  if (args.action === 'app') {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      'runner.app.solution.listApps',
      { solutionId: args.solution.solutionId },
      args.workflowContext,
    );
    return { apps: readItems(data), units: [] };
  }
  if (args.action === 'unit') {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      'runner.app.solution.listUnits',
      { solutionId: args.solution.solutionId },
      args.workflowContext,
    );
    return { apps: [], units: readItems(data) };
  }
  return { apps: [], units: [] };
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
  return [
    '需要先确认 code-agent 的目标后继续。',
    '',
    '```hook',
    fence,
    '```',
  ].join('\n');
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
    reason: args.interrupt.decision.reason,
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
  input: CodeGenOrchestrateInput,
  solutions: RunnerSolutionSummary[],
): RunnerSolutionSummary | null {
  const candidates = [
    readContextString(context, 'chooseSolution'),
    readContextString(context, 'solution_id'),
    readContextString(context, 'solutionId'),
    readContextString(context, 'boundSolutionId'),
    readContextString(context, 'currentSolutionId'),
    readContextString(context, 'solutionName'),
    input.solutionName,
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
 * Read a string field from code graph context.
 * @keyword-cn Graph上下文, 字段读取
 * @keyword-en graph-context, field-read
 */
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
 * Resolve an explicit tool solution field.
 * @keyword-cn Solution选择, 工具入参
 * @keyword-en solution-selection, tool-input
 */
function findExplicitSolution(
  input: CodeGenOrchestrateInput,
  solutions: RunnerSolutionSummary[],
): RunnerSolutionSummary | null {
  if (!input.solutionName?.trim()) return null;
  return resolveSolutionChoice({ name: input.solutionName }, solutions);
}

/**
 * Normalize action names used by the dependency check node.
 * @keyword-cn 动作选择, 目标类型
 * @keyword-en action-selection, target-kind
 */
function normalizeActionChoice(
  value: string | undefined,
): CodeGraphActionKind | null {
  if (
    value === 'solution' ||
    value === 'app' ||
    value === 'view' ||
    value === 'unit'
  ) {
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
 * @keyword-cn 目标类型推断, 默认View
 * @keyword-en infer-tool-target-kind, default-view-target
 */
function inferToolTargetKind(
  input: CodeGenOrchestrateInput,
): CodeAgentTargetKind {
  const requirement = normalizeCodeGraphRequirement(input);
  if (input.targetKind) return input.targetKind;
  if (input.appName?.trim()) return 'app';
  if (input.unitName?.trim()) return 'unit';
  if (looksLikeLightweightViewRequirement(requirement)) return 'view';
  if (input.solutionName?.trim()) return 'solution';
  return 'unit';
}

/**
 * Detect whether a requirement looks like a lightweight view target.
 * @keyword-cn 轻量View, 目标类型推断
 * @keyword-en detect-lightweight-view, default-view-target
 */
function looksLikeLightweightViewRequirement(requirement: string): boolean {
  return /页面|单页|展示|表格|看板|可视化|报表|大屏|仪表盘|dashboard|page|view|html/i.test(
    requirement,
  );
}
