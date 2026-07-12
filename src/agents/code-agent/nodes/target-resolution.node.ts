import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readItems, readStringField } from './dependency-check-context';
import {
  compactRequirementForRouting,
  selectLogicModel,
} from './dependency-check-decision';
import { sendDependencyNotice } from './dependency-choice-card';
import { createCodeGraphNodeLogger } from './dependency-check-log';
import { callRunnerHookData } from './dependency-check-runner-hooks';
import type {
  CodeGenOrchestrateInput,
  CodeGraphActionKind,
  CodeGraphConcreteTargetSummary,
  CodeGraphDependencyCheckResult,
  CodeGraphNewSolutionOption,
  CodeGraphNewTargetOption,
  CodeGraphNodeLogger,
  CodeGraphRequest,
  CodeGraphRequirementRoute,
  CodeGraphTargetResolutionResult,
  CodeGraphTargetRouteDecision,
  HookCaller,
  RunnerSolutionSummary,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentTargetResolution');

const LlmTargetRouteSchema = z.object({
  routeId: z.string().optional(),
  decision: z.enum(['reuse', 'create']),
  useTarget: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      reason: z.string().optional(),
    })
    .nullable()
    .optional(),
  newTarget: z
    .object({
      name: z.string().optional(),
      summary: z.string().optional(),
      reason: z.string().optional(),
    })
    .nullable()
    .optional(),
  reason: z.string().optional(),
});

type LlmTargetRoutePayload = z.infer<typeof LlmTargetRouteSchema>;
// 决策改由 set_target_decision 工具累积, 不再解析大 JSON; 这里只留装配用的类型 (LlmTargetRouteSchema 仍供工具入参)
type LlmTargetResolutionPayload = {
  targetPlan?: LlmTargetRoutePayload[];
  reason?: string;
  notice?: string;
};

type TargetResolutionRouteInput = {
  route: CodeGraphRequirementRoute;
  action: CodeGraphActionKind;
  solution: RunnerSolutionSummary | CodeGraphNewSolutionOption | null;
  candidates: CodeGraphConcreteTargetSummary[];
};

/**
 * Run concrete app/unit/data-point reuse-or-create resolution after dependency-check.
 * @keyword-cn 目标判定, 代码Graph节点
 * @keyword-en target-resolution, code-graph-node
 */
export async function runTargetResolutionNode(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  dependencyCheck: CodeGraphDependencyCheckResult;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphDependencyCheckResult> {
  const graphLog = createCodeGraphNodeLogger(
    'target-resolution',
    args.dependencyCheck.context,
  );
  if (args.dependencyCheck.status !== 'ready') {
    graphLog.info(
      'skip',
      'target-resolution skipped because dependency-check is not ready',
      { status: args.dependencyCheck.status },
    );
    return withTargetResolutionResult(
      args.dependencyCheck,
      buildSkippedTargetResolution(
        args.dependencyCheck,
        graphLog,
        'dependency-check is not ready',
      ),
      graphLog.entries,
    );
  }
  if (!args.hookCaller) {
    return withTargetResolutionResult(
      args.dependencyCheck,
      buildBlockedTargetResolution(
        args.dependencyCheck,
        graphLog,
        'Hook caller is not injected.',
      ),
      graphLog.entries,
    );
  }
  if (!args.aiAdapter) {
    return withTargetResolutionResult(
      args.dependencyCheck,
      buildBlockedTargetResolution(
        args.dependencyCheck,
        graphLog,
        'Agent AI adapter is not injected.',
      ),
      graphLog.entries,
    );
  }

  try {
    graphLog.info('start', 'target-resolution node started', {
      routes: args.dependencyCheck.context.routePlan.length,
    });
    const routeInputs = await buildTargetRouteInputs({
      dependencyCheck: args.dependencyCheck,
      hookCaller: args.hookCaller,
      runnerId: args.request.runner_id,
      workflowContext: args.workflowContext,
      graphLog,
    });
    if (routeInputs.length === 0) {
      return withTargetResolutionResult(
        args.dependencyCheck,
        buildBlockedTargetResolution(
          args.dependencyCheck,
          graphLog,
          'No resolved app/unit/data-point route is available for target resolution.',
        ),
        graphLog.entries,
      );
    }
    const { targetPlan, notice } = await decideTargetResolution({
      aiAdapter: args.aiAdapter,
      input: args.input,
      request: args.request,
      routes: routeInputs,
      graphLog,
    });
    const result: CodeGraphTargetResolutionResult = {
      status: 'ready',
      node: 'target-resolution',
      targetPlan,
      ...(notice ? { notice } : {}),
      errors: [],
      log: graphLog.entries,
    };
    graphLog.info('complete', 'target-resolution completed', {
      targetPlan: targetPlan.map((item) => ({
        routeId: item.routeId,
        action: item.action,
        decision: item.decision,
        targetId: item.useTarget?.id ?? null,
        newTargetName: item.newTarget?.name ?? null,
      })),
    });
    // app/unit/data-point 复用或新建一旦定下, 主动告知用户复用了哪个目标 / 新建什么,
    // 文案语言由逻辑模型跟随需求生成。发送失败只 warn, 不阻断 graph。
    if (notice && args.hookCaller) {
      await sendDependencyNotice({
        hookCaller: args.hookCaller,
        request: args.request,
        workflowContext: args.workflowContext,
        notice,
        graphLog,
      });
    }
    return withTargetResolutionResult(
      args.dependencyCheck,
      result,
      graphLog.entries,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`target-resolution blocked: ${reason}`);
    graphLog.error('fail', 'target-resolution failed', { error: reason });
    return withTargetResolutionResult(
      args.dependencyCheck,
      buildBlockedTargetResolution(args.dependencyCheck, graphLog, reason),
      graphLog.entries,
    );
  }
}

/**
 * Build route inputs by listing candidates under each selected Solution/action pair.
 * @keyword-cn 目标判定, 路由计划
 * @keyword-en target-resolution, route-plan
 */
async function buildTargetRouteInputs(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  graphLog: CodeGraphNodeLogger;
}): Promise<TargetResolutionRouteInput[]> {
  const routes =
    args.dependencyCheck.context.routePlan.length > 0
      ? args.dependencyCheck.context.routePlan
      : args.dependencyCheck.decision.routePlan;
  const targetCache = new Map<string, CodeGraphConcreteTargetSummary[]>();
  const out: TargetResolutionRouteInput[] = [];
  for (const route of routes) {
    if (!route.useAction) continue;
    const solution = readSelectedRouteSolution(route, args.dependencyCheck);
    const cacheKey =
      solution && isRunnerSolution(solution)
        ? `${route.useAction}:${solution.solutionId}`
        : '';
    const candidates =
      cacheKey && targetCache.has(cacheKey)
        ? (targetCache.get(cacheKey) ?? [])
        : await listConcreteTargets({
            action: route.useAction,
            solution,
            hookCaller: args.hookCaller,
            runnerId: args.runnerId,
            workflowContext: args.workflowContext,
          });
    if (cacheKey) targetCache.set(cacheKey, candidates);
    args.graphLog.info('targets:list', 'listed concrete target candidates', {
      routeId: route.id,
      action: route.useAction,
      solutionId: isRunnerSolution(solution) ? solution.solutionId : null,
      candidates: candidates.length,
    });
    out.push({
      route,
      action: route.useAction,
      solution,
      candidates,
    });
  }
  return out;
}

/**
 * Read the selected existing or new Solution for one route.
 * @keyword-cn 目标选择, 路由计划
 * @keyword-en target-selection, route-plan
 */
function readSelectedRouteSolution(
  route: CodeGraphRequirementRoute,
  dependencyCheck: CodeGraphDependencyCheckResult,
): RunnerSolutionSummary | CodeGraphNewSolutionOption | null {
  if (route.useSolution) return route.useSolution;
  const selected = dependencyCheck.context.selectedSolution;
  if (selected) return selected;
  if (
    dependencyCheck.decision.requiresNewSolution &&
    dependencyCheck.decision.newSolutionOption
  ) {
    return dependencyCheck.decision.newSolutionOption;
  }
  return null;
}

/**
 * Detect whether a selected Solution is an existing Runner Solution.
 * @keyword-cn Solution选择, 类型守卫
 * @keyword-en solution-selection, type-guard
 */
function isRunnerSolution(
  value: RunnerSolutionSummary | CodeGraphNewSolutionOption | null,
): value is RunnerSolutionSummary {
  return Boolean(
    value && !('kind' in value) && typeof value.solutionId === 'string',
  );
}

/**
 * List concrete target candidates for one action and existing Solution.
 * @keyword-cn 目标候选, Runner数据库Hook
 * @keyword-en target-candidate, runner-db-hooks
 */
async function listConcreteTargets(args: {
  action: CodeGraphActionKind;
  solution: RunnerSolutionSummary | CodeGraphNewSolutionOption | null;
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphConcreteTargetSummary[]> {
  if (!isRunnerSolution(args.solution)) return [];
  const solution = args.solution;
  const payload = {
    solutionIds: [solution.solutionId],
    names: [solution.name],
  };
  const data =
    args.action === 'app'
      ? await callRunnerHookData(
          args.hookCaller,
          args.runnerId,
          'runner.app.solution.listApps',
          payload,
          args.workflowContext,
        )
      : args.action === 'unit'
        ? await callRunnerHookData(
            args.hookCaller,
            args.runnerId,
            'runner.app.solution.listUnits',
            payload,
            args.workflowContext,
          )
        : await callRunnerHookData(
            args.hookCaller,
            args.runnerId,
            'runner.app.dataTouchpoint.list',
            { solutionId: solution.solutionId },
            args.workflowContext,
          );
  return readItems(data)
    .map((item) => normalizeTargetCandidate(args.action, item))
    .filter((item): item is CodeGraphConcreteTargetSummary => item !== null);
}

/**
 * Normalize app, unit, or data-point hook rows into target candidates.
 * @keyword-cn 目标候选, 字段读取
 * @keyword-en target-candidate, field-read
 */
function normalizeTargetCandidate(
  action: CodeGraphActionKind,
  value: Record<string, unknown>,
): CodeGraphConcreteTargetSummary | null {
  const id =
    action === 'app'
      ? readStringField(value, 'appId') || readStringField(value, 'id')
      : action === 'unit'
        ? readStringField(value, 'unitId') || readStringField(value, 'id')
        : readStringField(value, '_id') ||
          readStringField(value, 'id') ||
          readStringField(value, 'dataPointId');
  const name =
    action === 'unit'
      ? readStringField(value, 'unitName') || readStringField(value, 'name')
      : readStringField(value, 'name');
  const candidateId = id || name;
  const candidateName = name || id;
  if (!candidateId || !candidateName) return null;
  const path =
    readStringField(value, 'location') ||
    readStringField(value, 'sourcePath') ||
    readStringField(value, 'filePath');
  const enabledStatus =
    typeof value.enabled === 'boolean'
      ? value.enabled
        ? 'enabled'
        : 'disabled'
      : '';
  return {
    id: candidateId,
    action,
    name: candidateName,
    solutionId: readStringField(value, 'solutionId') || undefined,
    solutionName: readStringField(value, 'solutionName') || undefined,
    description: readStringField(value, 'description') || undefined,
    path: path || undefined,
    status: readStringField(value, 'status') || enabledStatus || undefined,
    isInitialized:
      typeof value.isInitialized === 'boolean'
        ? value.isInitialized
        : undefined,
    sources: readStringArrayField(value, 'sources'),
  };
}

/**
 * Read a string array field from an unknown hook row.
 * @keyword-cn 字段读取, 目标候选
 * @keyword-en field-read, target-candidate
 */
function readStringArrayField(
  value: Record<string, unknown>,
  field: string,
): string[] | undefined {
  const raw = value[field];
  if (!Array.isArray(raw)) return undefined;
  const items = raw.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  return items.length > 0 ? items : undefined;
}

/**
 * Ask the logic model to choose concrete target reuse or creation.
 * @keyword-cn 目标判定, 依赖判定
 * @keyword-en target-resolution, dependency-decision
 */
async function decideTargetResolution(args: {
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
  request: CodeGraphRequest;
  routes: TargetResolutionRouteInput[];
  graphLog: CodeGraphNodeLogger;
}): Promise<{ targetPlan: CodeGraphTargetRouteDecision[]; notice?: string }> {
  const model = selectLogicModel(args.aiAdapter, args.input);
  const routes: LlmTargetRoutePayload[] = [];
  const shared: { notice?: string } = {};
  const tools = [
    tool(
      (route: LlmTargetRoutePayload) => {
        routes.push(route);
        return `route "${route.routeId ?? routes.length}" → ${route.decision}${
          route.decision === 'reuse'
            ? ` ${route.useTarget?.name ?? route.useTarget?.id ?? '?'}`
            : ` (new ${route.newTarget?.name ?? '?'})`
        }`;
      },
      {
        name: 'set_target_decision',
        description:
          'Decide reuse-or-create for ONE route. {routeId, decision:"reuse"|"create", useTarget?({id,name,reason}) copied EXACTLY from that route\'s NON-EMPTY candidates, newTarget?({name,summary,reason}) when creating, reason}. A route whose candidate list is EMPTY MUST be decision="create". Never invent a reuse target — reuse only by copying an exact id/name from candidates. Call once per route.',
        schema: LlmTargetRouteSchema,
      },
    ),
    tool(
      (input: { notice: string }) => {
        if (input.notice.trim()) shared.notice = input.notice.trim();
        return 'notice set';
      },
      {
        name: 'set_notice',
        description:
          'Set a short user-facing notice IN THE SAME LANGUAGE AS THE REQUIREMENT (which target is reused or created). Plain words, no ids/JSON/field names. Call once.',
        schema: z.object({ notice: z.string() }),
      },
    ),
  ];
  args.graphLog.info(
    'target:llm:start',
    'calling logic model for target resolution (tool-calling)',
  );
  try {
    await model.chat({
      source: 'code-agent.target-resolution',
      // 后台 graph 任务 :: 隔离主对话已关闭的流式 callbacks (见 dependency-check 同理)。
      isolateCallbacks: true,
      messages: [
        {
          role: 'user',
          content: buildTargetResolutionPrompt(
            compactRequirementForRouting(args.request.full_requirement),
            args.routes,
          ),
        },
      ],
      params: { temperature: 0, maxTokens: 8000 },
      tools,
    });
  } catch (error) {
    args.graphLog.warn(
      'target:llm:error',
      'target-resolution tool loop errored',
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
  // 每条 route 都要有判定: LLM 没产出就全默认 create (code 保底, 不出现"不判定"); reuse 幻觉由 normalize 降级兜底
  const payload: LlmTargetResolutionPayload = {
    targetPlan:
      routes.length > 0
        ? routes
        : args.routes.map((item) => ({
            routeId: item.route.id,
            decision: 'create' as const,
          })),
    ...(shared.notice ? { notice: shared.notice } : {}),
  };
  args.graphLog.info(
    'target:llm:done',
    'target-resolution assembled from tool calls',
    { routes: routes.length },
  );
  const targetPlan = normalizeLlmTargetResolution(payload, args.routes);
  // 若有 route 由 reuse 降级为 create, LLM 的 notice 多半基于"复用"判定生成、会误导用户,
  // 此时丢弃 notice 不发, 只在日志记录 (宁可不发, 不发错的)。
  const hasDowngrade = targetPlan.some((item) => item.downgraded === true);
  if (hasDowngrade) {
    args.graphLog.info(
      'target:notice:skip',
      'dropping app notice because a reuse decision was downgraded to create',
    );
  }
  const notice =
    !hasDowngrade && typeof payload.notice === 'string' && payload.notice.trim()
      ? payload.notice.trim()
      : undefined;
  return { targetPlan, notice };
}

/**
 * Build the strict JSON prompt for concrete target resolution.
 * @keyword-cn 目标判定, JSON输出
 * @keyword-en target-resolution, json-output
 */
function buildTargetResolutionPrompt(
  requirement: string,
  routes: TargetResolutionRouteInput[],
): string {
  const routeBrief = routes.map((item) => ({
    routeId: item.route.id,
    requirement: item.route.requirement,
    title: item.route.title,
    summary: item.route.summary,
    action: item.action,
    solution: item.solution
      ? {
          id: item.solution.id,
          name: item.solution.name,
          kind: 'kind' in item.solution ? item.solution.kind : 'existing',
        }
      : null,
    candidates: item.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      description: candidate.description,
      path: candidate.path,
      status: candidate.status,
      sources: candidate.sources,
    })),
  }));
  return [
    'You are the target-resolution node for code-agent. You record decisions by CALLING TOOLS — do NOT print JSON.',
    'Dependency-check already selected the broad action lane for every route. Do not change any action.',
    'Call set_target_decision ONCE for EVERY route below: decide whether the concrete app/unit/data-point target should reuse one listed candidate or create a new target. Decide it yourself from the evidence; this node never asks the user.',
    'HARD RULE: a route whose candidate list is EMPTY has nothing to reuse — you MUST use decision="create" for it. decision="reuse" is only valid when you copy an exact id or name from that route\'s NON-EMPTY candidates; never invent a target.',
    'Prefer reuse: pick decision="reuse" when any listed candidate is a reasonable home for this route (its name/description/path/sources already cover the requirement and the selected action), even if the match is not perfect.',
    'Use decision="create" only when no candidate is a sensible home, the route clearly asks for a distinct new app/unit/data-point, or the selected Solution is new and has no candidates yet.',
    'Never create a near-duplicate of an existing candidate; reuse it instead. For reuse, copy one candidate id or name exactly from that route. For create, give a short newTarget.name + summary; later nodes do the actual creation.',
    'Call set_notice ONCE: 1-2 sentences IN THE SAME NATURAL LANGUAGE AS THE REQUIREMENT (Chinese requirement => Chinese notice), plainly telling the user which concrete app/unit/data-point will be reused (name it) or newly created. No ids / JSON / candidate / internal field names; speak like a teammate.',
    'When every route has a set_target_decision, stop calling tools.',
    '',
    `Full requirement:\n${requirement}`,
    '',
    `Routes and candidates:\n${JSON.stringify(routeBrief, null, 2)}`,
  ].join('\n');
}

/**
 * Normalize the LLM target-resolution payload into the graph target plan.
 * @keyword-cn 目标判定, 路由计划
 * @keyword-en target-resolution, route-plan
 */
function normalizeLlmTargetResolution(
  payload: LlmTargetResolutionPayload,
  routes: TargetResolutionRouteInput[],
): CodeGraphTargetRouteDecision[] {
  const payloadRoutes = payload.targetPlan ?? [];
  if (payloadRoutes.length === 0) {
    throw new Error('target-resolution LLM response must include targetPlan');
  }
  return routes.map((route, index) =>
    normalizeTargetRouteDecision({
      route,
      payload: findPayloadRouteDecision(payloadRoutes, index, route.route.id),
    }),
  );
}

/**
 * Normalize one LLM target route decision.
 * @keyword-cn 目标判定, 目标选择
 * @keyword-en target-resolution, target-selection
 */
function normalizeTargetRouteDecision(args: {
  route: TargetResolutionRouteInput;
  payload: LlmTargetRoutePayload | undefined;
}): CodeGraphTargetRouteDecision {
  if (!args.payload) {
    throw new Error(
      `target-resolution missing decision for route ${args.route.route.id}`,
    );
  }
  const reason =
    args.payload.reason ||
    args.payload.useTarget?.reason ||
    args.payload.newTarget?.reason;
  if (args.payload.decision === 'reuse') {
    const candidate = resolveTargetCandidate(
      args.payload.useTarget ?? {},
      args.route.candidates,
    );
    if (candidate) {
      return {
        routeId: args.route.route.id,
        requirement: args.route.route.requirement,
        title: args.route.route.title,
        summary: args.route.route.summary,
        action: args.route.action,
        solution: args.route.solution,
        decision: 'reuse',
        useTarget: candidate,
        newTarget: null,
        candidates: args.route.candidates,
        reason,
      };
    }
    // LLM 判了 reuse 但候选里解析不到 (典型: 候选为空却硬判 reuse, 或 id/name 对不上)。
    // 语义上"没有可复用的候选"= 应当新建; 降级为 create 而不是 blocked 卡死整条流程。
    const downgradeReason =
      args.route.candidates.length === 0
        ? 'logic model chose reuse but this Solution has no existing target candidates; creating a new target instead'
        : 'logic model chose reuse but referenced a target that is absent from the candidate list; creating a new target instead';
    logger.warn(
      `target-resolution reuse downgraded to create for route ${args.route.route.id} (candidates=${args.route.candidates.length})`,
    );
    return buildCreateRouteDecision(
      args.route,
      args.payload.newTarget ?? undefined,
      downgradeReason,
      true,
    );
  }
  return buildCreateRouteDecision(
    args.route,
    args.payload.newTarget ?? undefined,
    reason,
    false,
  );
}

/**
 * Build a "create" route decision, synthesizing a new target option.
 * @keyword-cn 目标新建, 目标判定
 * @keyword-en target-create, target-resolution
 */
function buildCreateRouteDecision(
  route: TargetResolutionRouteInput,
  newTargetPayload:
    | { name?: string; summary?: string; reason?: string }
    | undefined,
  reason: string | undefined,
  downgraded: boolean,
): CodeGraphTargetRouteDecision {
  return {
    routeId: route.route.id,
    requirement: route.route.requirement,
    title: route.route.title,
    summary: route.route.summary,
    action: route.action,
    solution: route.solution,
    decision: 'create',
    useTarget: null,
    newTarget: buildNewTargetOption({
      route,
      payload: newTargetPayload,
      reason,
    }),
    candidates: route.candidates,
    reason,
    ...(downgraded ? { downgraded: true } : {}),
  };
}

/**
 * Match one payload route by route id first and by position second.
 * @keyword-cn 字段读取, 目标判定
 * @keyword-en field-read, target-resolution
 */
function findPayloadRouteDecision(
  values: LlmTargetRoutePayload[],
  index: number,
  routeId: string,
): LlmTargetRoutePayload | undefined {
  return values.find((item) => item.routeId === routeId) ?? values[index];
}

/**
 * Resolve a model-selected target candidate from candidate id or name.
 * @keyword-cn 目标选择, 字段读取
 * @keyword-en target-selection, field-read
 */
function resolveTargetCandidate(
  choice: { id?: string; name?: string },
  candidates: CodeGraphConcreteTargetSummary[],
): CodeGraphConcreteTargetSummary | null {
  const ids = [choice.id]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim());
  const names = [choice.name]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim().toLowerCase());
  return (
    candidates.find(
      (candidate) =>
        ids.includes(candidate.id) ||
        names.includes(candidate.name.toLowerCase()),
    ) ?? null
  );
}

/**
 * Build a new target option from the LLM payload and route fallback text.
 * @keyword-cn 目标新建, 回退策略
 * @keyword-en target-create, fallback-decision
 */
function buildNewTargetOption(args: {
  route: TargetResolutionRouteInput;
  payload?: { name?: string; summary?: string; reason?: string };
  reason?: string;
}): CodeGraphNewTargetOption {
  const payloadName = args.payload?.name?.trim();
  const fallbackName =
    args.route.route.title.trim() ||
    `${args.route.action}-${args.route.route.id}`.trim();
  return {
    action: args.route.action,
    name: payloadName || fallbackName || `${args.route.action}-target`,
    summary:
      args.payload?.summary?.trim() ||
      args.route.route.summary ||
      `Create a new ${args.route.action} target for this route.`,
    reason: args.payload?.reason ?? args.reason,
  };
}

/**
 * Attach target-resolution output to the dependency-check result envelope.
 * @keyword-cn 目标判定, Graph输出
 * @keyword-en target-resolution, graph-output
 */
function withTargetResolutionResult(
  dependencyCheck: CodeGraphDependencyCheckResult,
  result: CodeGraphTargetResolutionResult,
  log: CodeGraphTargetResolutionResult['log'],
): CodeGraphDependencyCheckResult {
  return {
    ...dependencyCheck,
    status: result.status === 'blocked' ? 'blocked' : dependencyCheck.status,
    context: {
      ...dependencyCheck.context,
      targetPlan: result.targetPlan,
      code_graph_log: log,
    },
    targetResolution: result,
    errors:
      result.status === 'blocked'
        ? [...dependencyCheck.errors, ...result.errors]
        : dependencyCheck.errors,
    log,
  };
}

/**
 * Build a blocked target-resolution result.
 * @keyword-cn 目标判定, 阻塞状态
 * @keyword-en target-resolution, blocked-status
 */
function buildBlockedTargetResolution(
  dependencyCheck: CodeGraphDependencyCheckResult,
  graphLog: CodeGraphNodeLogger,
  reason: string,
): CodeGraphTargetResolutionResult {
  graphLog.error('blocked', reason);
  return {
    status: 'blocked',
    node: 'target-resolution',
    targetPlan: dependencyCheck.context.targetPlan ?? [],
    errors: [reason],
    log: graphLog.entries,
  };
}

/**
 * Build a skipped target-resolution result.
 * @keyword-cn 目标判定, Graph输出
 * @keyword-en target-resolution, graph-output
 */
function buildSkippedTargetResolution(
  dependencyCheck: CodeGraphDependencyCheckResult,
  graphLog: CodeGraphNodeLogger,
  reason: string,
): CodeGraphTargetResolutionResult {
  return {
    status: 'skipped',
    node: 'target-resolution',
    targetPlan: dependencyCheck.context.targetPlan ?? [],
    reason,
    errors: [],
    log: graphLog.entries,
  };
}
