import { Logger } from '@nestjs/common';
import z from 'zod';
import type {
  AgentAiModelClient,
  AgentAiServer,
} from '@/core/agent-runtime/types/agent-runtime.types';
import type { CodeAgentTargetKind } from '../dialogues/types';
import {
  CODE_GRAPH_ACTION_VALUES,
  NEW_SOLUTION_CHOICE_ID,
} from './dependency-check.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphActionKind,
  CodeGraphDependencyCheckResult,
  CodeGraphDependencyDecision,
  CodeGraphDependencyInterruptPayload,
  CodeGraphDependencyResumeChoice,
  CodeGraphNewSolutionOption,
  CodeGraphNodeLogger,
  CodeGraphRequest,
  CodeGraphRequirementRoute,
  CodeGraphRuntimeContext,
  LlmDependencyDecisionPayload,
  RunnerSolutionSummary,
} from './dependency-check.types';
import {
  normalizeActionChoice,
  readContextRecord,
  readContextString,
  resolveSolutionChoice,
} from './dependency-check-context';

const logger = new Logger('CodeAgentDependencyDecision');

/**
 * Normalize the human dependency selection into a LangGraph resume value.
 * @keyword-cn 依赖选择, 检查点恢复
 * @keyword-en dependency-selection, checkpoint-resume
 */
export function buildDependencyResumeChoice(
  input: CodeGenOrchestrateInput,
): CodeGraphDependencyResumeChoice {
  const context = input.context ?? {};
  const routePlan = normalizeRuntimeRoutePlan(context.routePlan);
  if (routePlan.length === 0) {
    throw new Error('resume requires context.routePlan');
  }
  const chooseSolution =
    readContextString(context, 'chooseSolution') ||
    readPrimaryRouteSolution(routePlan)?.solutionId;
  const chooseAction = normalizeActionChoice(
    readContextString(context, 'chooseAction') ?? input.targetKind,
  );
  const routeActions = readRoutePlanActions(routePlan);
  const chooseActions = normalizeActionList(
    [...readContextActionList(context, 'chooseActions'), ...routeActions],
    chooseAction ?? routeActions[0],
  );
  const selectedSolution = readContextRecord(context, 'selectedSolution');
  return {
    ...(chooseSolution ? { chooseSolution } : {}),
    ...(chooseAction ? { chooseAction } : {}),
    chooseActions,
    routePlan,
    ...(selectedSolution ? { selectedSolution } : {}),
    ...(input.context ? { context: input.context } : {}),
  };
}

/**
 * Decide solution and action using a logic model and deterministic fallbacks.
 * @keyword-cn Solution选择, 依赖判定
 * @keyword-en solution-selection, dependency-decision
 */
export async function decideCodeGraphDependencies(args: {
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
    );
    if (boundAction && isSolutionSuitableForAction(boundSolution, boundAction)) {
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
        useActions: boundAction ? [boundAction] : [],
        routePlan: buildDefaultRoutePlan({
          requirement: args.request.full_requirement,
          solution: boundSolution,
          actions: boundAction ? [boundAction] : [],
          waitChooseAction: boundAction ? [] : [...CODE_GRAPH_ACTION_VALUES],
          reason: boundAction
            ? 'session context binds a suitable solution'
            : 'session context binds a solution; action still requires confirmation',
        }),
        requiresNewSolution: false,
        reason: boundAction
          ? 'session context binds a suitable solution'
          : 'session context binds a solution; action still requires confirmation',
      };
    }
    args.graphLog.warn(
      'decision:context-binding-review',
      boundAction
        ? 'bound solution does not look suitable for the requested action; asking dependency decision to review reuse vs new solution'
        : 'bound solution has no confirmed action; asking dependency decision to choose action with the logic model',
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

  const model = selectLogicModel(args.aiAdapter, args.input);
  const parsed = await requestDependencyDecisionJson({
    model,
    requirement: compactRequirementForRouting(args.request.full_requirement),
    targetKind: args.targetKind,
    solutions: args.solutions,
    graphLog: args.graphLog,
  });
  if (!parsed) {
    args.graphLog.warn(
      'decision:fallback',
      'using deterministic fallback decision after logic model retries',
    );
    return fallback;
  }
  return normalizeLlmDependencyDecision(
    parsed,
    args.solutions,
    fallback,
    args.request.full_requirement,
  );
}

/**
 * Call the logic model for a routing decision, retrying once with a stricter prompt.
 * @keyword-cn 依赖判定, 模型重试
 * @keyword-en dependency-decision, llm-retry
 */
async function requestDependencyDecisionJson(args: {
  model: AgentAiModelClient;
  requirement: string;
  targetKind: CodeAgentTargetKind;
  solutions: RunnerSolutionSummary[];
  graphLog: CodeGraphNodeLogger;
}): Promise<LlmDependencyDecisionPayload | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let rawContent = '';
    let finishReason: string | undefined;
    try {
      args.graphLog.info(
        'decision:llm:start',
        'calling logic model for dependency decision',
        { attempt },
      );
      const response = await args.model.chat({
        source: 'code-agent.dependency-check',
        // 后台 graph 任务 :: 隔离主对话已关闭的流式 callbacks, 否则 minimax 等
        // 走流式 token 的 provider 会因 "WritableStream is closed" 丢掉全部 content。
        isolateCallbacks: true,
        messages: [
          {
            role: 'user',
            content:
              attempt === 0
                ? buildDependencyDecisionPrompt(
                    args.requirement,
                    args.targetKind,
                    args.solutions,
                  )
                : buildDependencyDecisionRetryPrompt(
                    args.requirement,
                    args.targetKind,
                    args.solutions,
                  ),
          },
        ],
        // langchain 限定方式 :: OpenAI 兼容 JSON mode, 强制模型把合法 JSON 放进 content。
        params: { temperature: 0, responseFormat: { type: 'json_object' } },
      });
      rawContent = response.content ?? '';
      finishReason = response.finishReason;
      const parsed = LlmDependencyDecisionSchema.parse(
        parseJsonObjectLoose(rawContent),
      );
      args.graphLog.info(
        'decision:llm:done',
        'logic model returned dependency JSON',
        { attempt },
      );
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `dependency-check llm decision attempt ${attempt} failed: ${message} ` +
          `(finish=${finishReason ?? 'n/a'} contentLen=${rawContent.length})`,
      );
      args.graphLog.warn(
        'decision:llm:parse-fail',
        'logic model output was not valid decision JSON',
        {
          attempt,
          error: message,
          finishReason: finishReason ?? null,
          contentLength: rawContent.length,
          sample: rawContent.slice(0, 500),
        },
      );
    }
  }
  return null;
}

/**
 * Compact an over-long requirement so reasoning models still emit routing JSON.
 * @keyword-cn 需求压缩, 依赖判定
 * @keyword-en requirement-compact, dependency-decision
 */
export function compactRequirementForRouting(
  requirement: string,
  maxChars = 1200,
): string {
  const text = (requirement ?? '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)} …(truncated for routing; later nodes use the full requirement)`;
}

/**
 * Select the logic model client for graph analysis.
 * @keyword-cn 逻辑模型, 依赖判定
 * @keyword-en logic-model, dependency-decision
 */
export function selectLogicModel(
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
    'You are the dependency-check routing node for code-agent. Return strict JSON only, no markdown.',
    'Scope: for each existing requirement item, route it to a Runner Solution (reuse an existing one or propose a new one) and pick the broad action lane: app, unit, or data-point.',
    '',
    'Decision policy (most important):',
    '- Decide, do not defer. A user choice card is shown only when a field is left unresolved, so leave a field unresolved ONLY when you genuinely cannot decide. Whenever the evidence supports one best choice, commit it and leave the matching waitChoose / waitChooseAction empty.',
    '- Solution reuse: if an existing Solution is a reasonable home for the requirement (its name/summary/domain overlaps and its `includes` can host the action), set route.useSolution to it and leave route.waitChoose empty. A single plausible Solution must be reused directly via useSolution, never parked in waitChoose. An imperfect-but-clear match is still a decision: reuse it.',
    '- Only set route.waitChoose (and leave route.useSolution null) when two or more existing Solutions are genuinely comparable homes AND picking the wrong one would materially change the outcome. Do not ask the user to break a loose tie; pick the best and commit.',
    '- New Solution: set requiresNewSolution=true with newSolutionOption ONLY when no existing Solution is a sensible home for this requirement. Do not invent a new Solution just because no match is perfect; prefer reuse over creating a near-duplicate container.',
    '- Action lane: infer app/unit/data-point from the requirement. UI / page / screen / frontend / HTML / component => app; backend capability / service / business logic / hook / API => unit; data schema / storage / collection / record / touchpoint / field => data-point. Commit route.useAction and leave route.waitChooseAction empty.',
    '- Treat the default action hint as a strong prior: adopt it as route.useAction unless the requirement clearly points to a different lane. Leave route.useAction null with route.waitChooseAction candidates ONLY when the requirement is truly undecidable between lanes.',
    '',
    'Routing rules:',
    'Do not split one vague requirement into implementation tasks. Only create multiple routePlan entries when the user requirement already contains multiple explicit steps/items.',
    'Do not resolve concrete app/unit/data-point ids, names, files, modules, code targets, or dependencies. That belongs to later nodes.',
    'routePlan is required and is the source of truth. Do not collapse requirement items that point to different Solutions or actions into one route.',
    'Each routePlan entry represents one existing requirement item and may include: id, requirement, title, summary, useSolution, waitChoose, useAction, waitChooseAction, reason.',
    'Top-level useSolution/useAction/useActions/waitChoose/waitChooseAction are compatibility summaries derived from routePlan only.',
    'Only use Solutions from the Runner solutions list. Do not invent an existing Solution.',
    'Also return a short user-facing `notice` (1-2 sentences) written IN THE SAME NATURAL LANGUAGE AS THE REQUIREMENT (Chinese requirement => Chinese notice). It tells the user, in plain words, which Solution will carry this work and whether it is being reused or newly created — e.g. reusing an existing dedicated Solution, reusing a general/shared display container, or creating a new Solution. If the Solution is a generic container (like a default display solution), say so, so the user understands it is a shared home rather than an unrelated project. Do NOT mention solutionId / payload / JSON / action-lane / internal field names; speak like a teammate.',
    'JSON shape: {"waitChoose":[{"solutionId":"...","name":"...","reason":"..."}],"useSolution":{"solutionId":"...","name":"...","reason":"..."}|null,"waitChooseAction":["app","unit","data-point"],"useAction":"app"|"unit"|"data-point"|null,"useActions":["app","unit"],"routePlan":[{"id":"step-1","requirement":"original requirement item","title":"...","summary":"...","useSolution":{"solutionId":"...","name":"..."}|null,"waitChoose":[{"solutionId":"...","name":"...","reason":"..."}],"useAction":"app"|"unit"|"data-point"|null,"waitChooseAction":["app","unit"],"reason":"..."}],"requiresNewSolution":false,"newSolutionOption":{"name":"new-solution-name","summary":"why new container is better","reason":"..."}|null,"newSolutionReason":"","reason":"...","notice":"用户语言的一句话告知，比如：我会把这个页面放进通用展示容器 default-view-solution 里新建一个独立页面应用。"}',
    `Default action hint: ${targetKind}`,
    `Requirement: ${requirement}`,
    `Runner solutions: ${JSON.stringify(solutionBrief)}`,
  ].join('\n');
}

/**
 * Build a minimal, strict retry prompt for models that emitted non-JSON.
 * @keyword-cn 依赖判定, 模型重试
 * @keyword-en dependency-decision, llm-retry
 */
function buildDependencyDecisionRetryPrompt(
  requirement: string,
  targetKind: CodeAgentTargetKind,
  solutions: RunnerSolutionSummary[],
): string {
  const solutionBrief = solutions.map((solution) => ({
    solutionId: solution.solutionId,
    name: solution.name,
    summary: solution.summary,
    includes: solution.includes,
  }));
  return [
    'Output ONLY one minified JSON object. No prose, no markdown, no <think> blocks, no explanation before or after.',
    'Task: route this code-agent requirement to a Solution and an action lane (app|unit|data-point).',
    'Reuse an existing Solution when one is a reasonable home (commit it in routePlan[].useSolution). Set requiresNewSolution=true with newSolutionOption ONLY when no existing Solution fits.',
    'Commit routePlan[].useAction from the requirement; adopt the action hint when the requirement does not clearly point elsewhere. Leave fields null only when genuinely undecidable.',
    'Add a short user-facing `notice` (1-2 sentences) in the SAME language as the requirement, plainly telling the user which Solution carries this work and whether it is reused or newly created; no technical field names.',
    'Shape: {"routePlan":[{"id":"step-1","useSolution":{"solutionId":"...","name":"..."}|null,"waitChoose":[{"solutionId":"...","name":"..."}],"useAction":"app"|"unit"|"data-point"|null,"waitChooseAction":["app"],"reason":"..."}],"requiresNewSolution":false,"newSolutionOption":{"name":"...","summary":"...","reason":"..."}|null,"reason":"...","notice":"..."}',
    `Action hint: ${targetKind}`,
    `Requirement: ${requirement}`,
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
  useActions: z.array(z.enum(CODE_GRAPH_ACTION_VALUES)).optional(),
  routePlan: z
    .array(
      z
        .object({
          id: z.string().optional(),
          requirement: z.string().optional(),
          title: z.string().optional(),
          summary: z.string().optional(),
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
            .array(z.enum(CODE_GRAPH_ACTION_VALUES))
            .optional(),
          useAction: z.enum(CODE_GRAPH_ACTION_VALUES).nullable().optional(),
          reason: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
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
  notice: z.string().optional(),
});

/**
 * Normalize a logic-model dependency decision against actual runner solutions.
 * @keyword-cn Solution选择, 依赖判定
 * @keyword-en solution-selection, dependency-decision
 */
function normalizeLlmDependencyDecision(
  payload: LlmDependencyDecisionPayload,
  solutions: RunnerSolutionSummary[],
  fallback: CodeGraphDependencyDecision,
  requirement: string,
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
  const candidateActions = normalizeActionList(
    payload.useActions,
    useAction ?? fallback.useAction,
  );
  const reason = payload.newSolutionReason || payload.reason || fallback.reason;
  const notice =
    typeof payload.notice === 'string' && payload.notice.trim()
      ? payload.notice.trim()
      : undefined;
  const routePlan = normalizeRoutePlan({
    raw: payload.routePlan,
    solutions,
    fallback: fallback.routePlan,
    fallbackSolution: useSolution ?? fallback.useSolution,
    fallbackWaitChoose:
      waitChoose.length > 0 ? waitChoose : fallback.waitChoose,
    fallbackActions:
      candidateActions.length > 0 ? candidateActions : fallback.useActions,
    fallbackWaitChooseAction:
      waitChooseAction.length > 0
        ? waitChooseAction
        : fallback.waitChooseAction,
    reason,
    requirement,
  });
  const routeActions = readRoutePlanActions(routePlan);
  const useActions =
    routeActions.length > 0
      ? routeActions
      : normalizeActionList(
          payload.useActions,
          useAction ?? fallback.useAction,
        );
  const primaryRouteSolution =
    readPrimaryRouteSolution(routePlan) ?? useSolution ?? fallback.useSolution;
  const pendingRouteSolutions = readPendingRouteSolutions(routePlan);
  const pendingRouteActions = readPendingRouteActions(routePlan);
  const requiresNewSolution = payload.requiresNewSolution === true;
  const newSolutionOption = normalizeNewSolutionOption(
    payload.newSolutionOption
      ? (payload.newSolutionOption as Record<string, unknown>)
      : undefined,
    fallback.newSolutionOption,
    useActions[0] ?? fallback.useActions[0] ?? fallback.useAction,
    reason,
  );

  if (requiresNewSolution) {
    return {
      waitChoose: pendingRouteSolutions,
      useSolution: null,
      waitChooseAction: pendingRouteActions,
      useAction: useAction ?? useActions[0] ?? fallback.useAction,
      useActions: useActions.length > 0 ? useActions : fallback.useActions,
      routePlan,
      requiresNewSolution: true,
      ...(newSolutionOption ? { newSolutionOption } : {}),
      newSolutionReason: payload.newSolutionReason ?? payload.reason,
      reason,
      ...(notice ? { notice } : {}),
    };
  }

  return {
    waitChoose: pendingRouteSolutions,
    useSolution: primaryRouteSolution,
    waitChooseAction: pendingRouteActions,
    useAction: useAction ?? useActions[0] ?? fallback.useAction,
    useActions: useActions.length > 0 ? useActions : fallback.useActions,
    routePlan,
    requiresNewSolution: false,
    ...(newSolutionOption ? { newSolutionOption } : {}),
    reason,
    ...(notice ? { notice } : {}),
  };
}

/**
 * Normalize a possibly plural action list while preserving order.
 * @keyword-cn 动作选择, 路由计划
 * @keyword-en action-selection, route-plan
 */
function normalizeActionList(
  values: CodeGraphActionKind[] | undefined,
  fallback: CodeGraphActionKind | null | undefined,
): CodeGraphActionKind[] {
  const actions = [...(values ?? []), fallback]
    .map((item) => normalizeActionChoice(item ?? undefined))
    .filter((item): item is CodeGraphActionKind => Boolean(item));
  return [...new Set(actions)];
}

/**
 * Normalize model route plan entries and synthesize one when only actions exist.
 * @keyword-cn ????, ????
 * @keyword-en route-plan, dependency-decision
 */
function normalizeRoutePlan(args: {
  raw: LlmDependencyDecisionPayload['routePlan'];
  solutions: RunnerSolutionSummary[];
  fallback: CodeGraphRequirementRoute[];
  fallbackSolution: RunnerSolutionSummary | null;
  fallbackWaitChoose: RunnerSolutionSummary[];
  fallbackActions: CodeGraphActionKind[];
  fallbackWaitChooseAction: CodeGraphActionKind[];
  reason: string | undefined;
  requirement: string;
}): CodeGraphRequirementRoute[] {
  const normalized = (args.raw ?? [])
    .map((item, index) => normalizeRoutePlanItem(item, index, args))
    .filter((item): item is CodeGraphRequirementRoute => Boolean(item));
  if (normalized.length > 0) return normalized;
  if (args.fallback.length > 0) return args.fallback;
  return buildDefaultRoutePlan({
    requirement: args.requirement,
    solution: args.fallbackSolution,
    waitChoose: args.fallbackWaitChoose,
    actions: args.fallbackActions,
    waitChooseAction: args.fallbackWaitChooseAction,
    reason: args.reason,
  });
}

/**
 * Normalize one model route plan entry, auto-committing single-candidate choices.
 * @keyword-cn 路由计划, 字段读取
 * @keyword-en route-plan, field-read
 */
function normalizeRoutePlanItem(
  item: NonNullable<LlmDependencyDecisionPayload['routePlan']>[number],
  index: number,
  fallback: {
    solutions: RunnerSolutionSummary[];
    fallbackSolution: RunnerSolutionSummary | null;
    fallbackWaitChoose: RunnerSolutionSummary[];
    fallbackActions: CodeGraphActionKind[];
    fallbackWaitChooseAction: CodeGraphActionKind[];
    reason: string | undefined;
    requirement: string;
  },
): CodeGraphRequirementRoute | null {
  const explicitUseSolution = item.useSolution
    ? resolveSolutionChoice(item.useSolution, fallback.solutions)
    : null;
  const waitChoose = (item.waitChoose ?? [])
    .map((choice) => resolveSolutionChoice(choice, fallback.solutions))
    .filter((choice): choice is RunnerSolutionSummary => Boolean(choice));
  // A choice with a single candidate is not a real choice: commit it directly
  // instead of pausing for the user. Only keep it pending when 2+ remain.
  const useSolution =
    explicitUseSolution ??
    (waitChoose.length === 1
      ? waitChoose[0]
      : waitChoose.length > 0
        ? null
        : fallback.fallbackSolution);
  const explicitUseAction = normalizeActionChoice(item.useAction ?? undefined);
  const waitChooseAction = (item.waitChooseAction ?? [])
    .map((choice) => normalizeActionChoice(choice))
    .filter((choice): choice is CodeGraphActionKind => Boolean(choice));
  const useAction =
    explicitUseAction ??
    (waitChooseAction.length === 1
      ? waitChooseAction[0]
      : waitChooseAction.length > 0
        ? null
        : (fallback.fallbackActions[0] ?? null));
  const id = readRouteString(item, 'id') || `step-${index + 1}`;
  const routeRequirement =
    readRouteString(item, 'requirement') || fallback.requirement;
  const title = readRouteString(item, 'title') || routeRequirement;
  const summary = readRouteString(item, 'summary') || routeRequirement;
  return {
    id,
    requirement: routeRequirement,
    title,
    summary,
    waitChoose: useSolution
      ? []
      : waitChoose.length > 0
        ? waitChoose
        : fallback.fallbackWaitChoose,
    useSolution,
    waitChooseAction: useAction
      ? []
      : waitChooseAction.length > 0
        ? waitChooseAction
        : fallback.fallbackWaitChooseAction,
    useAction,
    reason: readRouteString(item, 'reason') || fallback.reason,
  };
}

/**
 * Build a default route plan from known actions.
 * @keyword-cn ????, ????
 * @keyword-en route-plan, fallback-decision
 */
function buildDefaultRoutePlan(args: {
  requirement: string;
  solution?: RunnerSolutionSummary | null;
  waitChoose?: RunnerSolutionSummary[];
  actions: CodeGraphActionKind[];
  waitChooseAction?: CodeGraphActionKind[];
  reason?: string;
}): CodeGraphRequirementRoute[] {
  const heading = args.requirement
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  const actions: Array<CodeGraphActionKind | null> =
    args.actions.length > 0 ? args.actions : [null];
  return actions.map((action, index) => ({
    id: `step-${index + 1}`,
    requirement: args.requirement,
    title: heading || 'requirement route',
    summary: args.requirement,
    waitChoose: args.waitChoose ?? [],
    useSolution: args.solution ?? null,
    waitChooseAction: action ? [] : (args.waitChooseAction ?? []),
    useAction: action,
    reason: args.reason,
  }));
}

/**
 * Normalize a route plan received from runtime context or a hook payload.
 * @keyword-cn ????, ????
 * @keyword-en route-plan, field-read
 */
function normalizeRuntimeRoutePlan(raw: unknown): CodeGraphRequirementRoute[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? normalizeRuntimeRoutePlanItem(item as Record<string, unknown>, index)
        : null,
    )
    .filter((item): item is CodeGraphRequirementRoute => Boolean(item));
}

/**
 * Normalize one runtime route plan item.
 * @keyword-cn ????, ????
 * @keyword-en route-plan, field-read
 */
function normalizeRuntimeRoutePlanItem(
  item: Record<string, unknown>,
  index: number,
): CodeGraphRequirementRoute | null {
  const useAction = normalizeActionChoice(readRouteString(item, 'useAction'));
  const useSolution = normalizeRuntimeRouteSolution(item.useSolution);
  const waitChoose = Array.isArray(item.waitChoose)
    ? item.waitChoose
        .map((choice) => normalizeRuntimeRouteSolution(choice))
        .filter((choice): choice is RunnerSolutionSummary => Boolean(choice))
    : [];
  const waitChooseAction = Array.isArray(item.waitChooseAction)
    ? item.waitChooseAction
        .map((choice) =>
          typeof choice === 'string' ? normalizeActionChoice(choice) : null,
        )
        .filter((choice): choice is CodeGraphActionKind => Boolean(choice))
    : [];
  return {
    id: readRouteString(item, 'id') || `step-${index + 1}`,
    requirement: readRouteString(item, 'requirement'),
    title:
      readRouteString(item, 'title') || readRouteString(item, 'requirement'),
    summary:
      readRouteString(item, 'summary') || readRouteString(item, 'requirement'),
    waitChoose,
    useSolution,
    waitChooseAction,
    useAction,
    reason: readRouteString(item, 'reason'),
  };
}

/**
 * Normalize a Solution-like value embedded in a runtime route plan.
 * @keyword-cn 路由计划, Solution选择
 * @keyword-en route-plan, solution-selection
 */
function normalizeRuntimeRouteSolution(
  value: unknown,
): RunnerSolutionSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const solutionId =
    readRouteString(record, 'solutionId') ||
    readRouteString(record, 'id') ||
    readRouteString(record, 'name');
  const name = readRouteString(record, 'name') || solutionId;
  if (!solutionId || !name) return null;
  return {
    id: readRouteString(record, 'id') || solutionId,
    runnerId: readRouteString(record, 'runnerId'),
    solutionId,
    name,
    version: readRouteString(record, 'version') || undefined,
    summary: readRouteString(record, 'summary'),
    description: readRouteString(record, 'description') || undefined,
    includes: Array.isArray(record.includes)
      ? record.includes.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    isInitialized:
      typeof record.isInitialized === 'boolean'
        ? record.isInitialized
        : undefined,
  };
}

/**
 * Check whether any route still lacks a concrete Solution or action.
 * @keyword-cn 璺敱璁″垝, 渚濊禆閫夋嫨
 * @keyword-en route-plan, dependency-selection
 */
export function hasPendingRoutePlanSelection(
  decision: Pick<
    CodeGraphDependencyDecision,
    'routePlan' | 'requiresNewSolution' | 'newSolutionOption'
  >,
): boolean {
  if (decision.routePlan.length === 0) return true;
  return decision.routePlan.some((route) => {
    const solutionResolved =
      Boolean(route.useSolution) ||
      (decision.requiresNewSolution &&
        Boolean(decision.newSolutionOption) &&
        route.waitChoose.length === 0);
    const actionResolved = Boolean(route.useAction);
    return !solutionResolved || !actionResolved;
  });
}

/**
 * Read the de-duplicated concrete actions from routePlan.
 * @keyword-cn 璺敱璁″垝, 鍔ㄤ綔閫夋嫨
 * @keyword-en route-plan, action-selection
 */
function readRoutePlanActions(
  routePlan: CodeGraphRequirementRoute[],
): CodeGraphActionKind[] {
  return normalizeActionList(
    routePlan
      .map((route) => route.useAction)
      .filter((action): action is CodeGraphActionKind => Boolean(action)),
    null,
  );
}

/**
 * Read the first concrete route Solution.
 * @keyword-cn 璺敱璁″垝, Solution閫夋嫨
 * @keyword-en route-plan, solution-selection
 */
function readPrimaryRouteSolution(
  routePlan: CodeGraphRequirementRoute[],
): RunnerSolutionSummary | null {
  return routePlan.find((route) => route.useSolution)?.useSolution ?? null;
}

/**
 * Read pending Solution choices from unresolved routePlan entries.
 * @keyword-cn 璺敱璁″垝, Solution閫夋嫨
 * @keyword-en route-plan, solution-selection
 */
function readPendingRouteSolutions(
  routePlan: CodeGraphRequirementRoute[],
): RunnerSolutionSummary[] {
  const choices = routePlan.flatMap((route) =>
    route.useSolution ? [] : route.waitChoose,
  );
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = choice.solutionId || choice.id || choice.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Read pending action choices from unresolved routePlan entries.
 * @keyword-cn 璺敱璁″垝, 鍔ㄤ綔閫夋嫨
 * @keyword-en route-plan, action-selection
 */
function readPendingRouteActions(
  routePlan: CodeGraphRequirementRoute[],
): CodeGraphActionKind[] {
  return normalizeActionList(
    routePlan.flatMap((route) =>
      route.useAction ? [] : route.waitChooseAction,
    ),
    null,
  );
}

/**
 * Read one optional string from a route plan record.
 * @keyword-cn ????, ????
 * @keyword-en route-plan, field-read
 */
function readRouteString(
  value: Record<string, unknown>,
  field: string,
): string {
  const raw = value[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Normalize the complete requirement for dependency-check fallback naming.
 * @keyword-en full-requirement, tool-input
 */
function normalizeDependencyNodeRequirement(
  input: Pick<CodeGenOrchestrateInput, 'full_requirement' | 'requirement'>,
): string {
  return (input.full_requirement ?? input.requirement ?? '').trim();
}

/**
 * Build a deterministic dependency decision when LLM selection is unavailable.
 * @keyword-cn Solution选择, 回退策略
 * @keyword-en solution-selection, fallback-decision
 */
function buildFallbackDependencyDecision(
  input: CodeGenOrchestrateInput,
  targetKind: CodeAgentTargetKind,
  solutions: RunnerSolutionSummary[],
): CodeGraphDependencyDecision {
  // Even when the logic model is unavailable, the action lane is usually known
  // from the inferred targetKind / tool input, so commit it instead of asking
  // the user to pick app/unit/data-point again. Only the Solution stays open.
  const useAction =
    normalizeActionChoice(
      readContextString(input.context ?? {}, 'chooseAction'),
    ) ?? normalizeActionChoice(targetKind);
  const useActions = useAction ? [useAction] : [];
  const hasSolutions = solutions.length > 0;
  const reason = hasSolutions
    ? 'LLM decision unavailable; choose an existing solution or create a new one'
    : 'runner returned no solutions; a new solution must be created or bound before continuing';
  const newSolutionOption = buildNewSolutionOption({
    requirement: normalizeDependencyNodeRequirement(input),
    targetKind,
    reason,
  });
  return {
    waitChoose: solutions.slice(0, 6),
    useSolution: null,
    waitChooseAction: useAction ? [] : [...CODE_GRAPH_ACTION_VALUES],
    useAction,
    useActions,
    routePlan: buildDefaultRoutePlan({
      requirement: normalizeDependencyNodeRequirement(input),
      actions: useActions,
      waitChooseAction: useAction ? [] : [...CODE_GRAPH_ACTION_VALUES],
      reason,
    }),
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
 * Read the effective action list from a dependency decision.
 * @keyword-cn 动作选择, 路由计划
 * @keyword-en action-selection, route-plan
 */
export function getDecisionActions(
  decision: Pick<CodeGraphDependencyDecision, 'useActions' | 'useAction'> &
    Partial<Pick<CodeGraphDependencyDecision, 'routePlan'>>,
): CodeGraphActionKind[] {
  const routeActions = readRoutePlanActions(decision.routePlan ?? []);
  if (routeActions.length > 0) return routeActions;
  return normalizeActionList(decision.useActions, decision.useAction);
}

/**
 * Build runtime context from dependency decision.
 * @keyword-cn Graph上下文, Solution选择
 * @keyword-en graph-context, solution-selection
 */
export function buildDependencyRuntimeContext(
  decision: CodeGraphDependencyDecision,
): CodeGraphRuntimeContext {
  const actions = getDecisionActions(decision);
  const selectedRouteSolution = readPrimaryRouteSolution(decision.routePlan);
  const selectedNewSolution =
    decision.requiresNewSolution &&
    !selectedRouteSolution &&
    !decision.useSolution &&
    Boolean(decision.newSolutionOption);
  return {
    chooseSolution:
      selectedRouteSolution?.solutionId ??
      decision.useSolution?.solutionId ??
      (selectedNewSolution ? NEW_SOLUTION_CHOICE_ID : ''),
    chooseAction: actions[0] ?? '',
    chooseActions: actions,
    routePlan: decision.routePlan,
    code_graph_log: [],
    ...(selectedRouteSolution
      ? { selectedSolution: selectedRouteSolution }
      : decision.useSolution
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
export function buildDependencyInterruptPayload(args: {
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
export function applyDependencyResumeChoice(args: {
  selection: CodeGraphDependencyResumeChoice;
  solutions: RunnerSolutionSummary[];
  fallback: CodeGraphDependencyDecision;
}): CodeGraphDependencyDecision {
  const selectionRoutePlan = normalizeRuntimeRoutePlan(
    args.selection.routePlan,
  );
  const contextRoutePlan = normalizeRuntimeRoutePlan(
    args.selection.context?.routePlan,
  );
  const routePlan =
    selectionRoutePlan.length > 0
      ? selectionRoutePlan
      : contextRoutePlan.length > 0
        ? contextRoutePlan
        : args.fallback.routePlan.length > 0
          ? args.fallback.routePlan
          : buildDefaultRoutePlan({
              requirement: '',
              actions: [],
              reason: args.fallback.reason,
            });
  const routeActions = readRoutePlanActions(routePlan);
  const useAction =
    normalizeActionChoice(args.selection.chooseAction) ??
    routeActions[0] ??
    null;
  const useActions =
    routeActions.length > 0
      ? routeActions
      : normalizeActionList(args.selection.chooseActions, useAction);
  const routeSolution = readPrimaryRouteSolution(routePlan);
  const selectedSolutionId =
    args.selection.chooseSolution ?? routeSolution?.solutionId ?? '';
  const selectedSolutionName =
    routeSolution?.name ??
    (typeof args.selection.selectedSolution?.name === 'string'
      ? args.selection.selectedSolution.name
      : undefined);
  if (selectedSolutionId === NEW_SOLUTION_CHOICE_ID) {
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
      useAction: useAction ?? useActions[0] ?? null,
      useActions,
      routePlan,
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
        id: selectedSolutionId,
        solutionId: selectedSolutionId,
        name: selectedSolutionName,
      },
      args.solutions,
    ) ??
    (routeSolution
      ? resolveSolutionChoice(routeSolution, args.solutions)
      : null) ??
    args.fallback.useSolution;
  return {
    waitChoose: readPendingRouteSolutions(routePlan),
    useSolution,
    waitChooseAction: readPendingRouteActions(routePlan),
    useAction: useAction ?? useActions[0] ?? null,
    useActions,
    routePlan,
    requiresNewSolution: false,
    reason: 'dependency selection resumed from LangGraph interrupt',
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
 * Decide whether a bound solution already declares support for the requested action.
 * @keyword-cn Solution适配, 动作选择
 * @keyword-en solution-fit, action-selection
 */
function isSolutionSuitableForAction(
  solution: RunnerSolutionSummary,
  action: CodeGraphActionKind,
): boolean {
  return solution.includes.includes(action);
}

/**
 * Resolve an action already bound by graph context.
 * @keyword-cn 动作选择, 会话绑定
 * @keyword-en action-selection, session-binding
 */
function findContextBoundAction(
  context: CodeGraphRequest['context'],
): CodeGraphActionKind | null {
  return (
    normalizeActionChoice(readContextString(context, 'chooseAction')) ??
    normalizeActionChoice(readContextString(context, 'targetKind'))
  );
}

/**
 * Read a normalized action list from graph context.
 * @keyword-cn Graph上下文, 动作选择
 * @keyword-en graph-context, action-selection
 */
function readContextActionList(
  context: CodeGraphRequest['context'],
  field: string,
): CodeGraphActionKind[] {
  const raw = context[field];
  if (!Array.isArray(raw)) return [];
  return normalizeActionList(
    raw.filter((item): item is CodeGraphActionKind => typeof item === 'string'),
    null,
  );
}

/**
 * Parse a JSON object from an LLM response, accepting fenced output.
 * @keyword-cn JSON解析, 依赖判定
 * @keyword-en json-parse, dependency-decision
 */
export function parseJsonObjectLoose(raw: string): unknown {
  const text = stripReasoningArtifacts(raw);
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
  const balanced = extractFirstJsonObject(text);
  if (balanced) {
    return JSON.parse(balanced);
  }
  throw new Error('LLM response is not a JSON object');
}

/**
 * Strip reasoning/think wrappers some models emit around their JSON answer.
 * @keyword-cn JSON解析, 思考剥离
 * @keyword-en json-parse, reasoning-strip
 */
function stripReasoningArtifacts(raw: string): string {
  return (raw ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

/**
 * Extract the first balanced JSON object, ignoring leading/trailing prose.
 * @keyword-cn JSON解析, 括号配平
 * @keyword-en json-parse, brace-balance
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
