import { Logger } from '@nestjs/common';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readContextString } from './dependency-check-context';
import {
  compactRequirementForRouting,
  parseJsonObjectLoose,
  selectLogicModel,
} from './dependency-check-decision';
import { sendDependencyNotice } from './dependency-choice-card';
import { createCodeGraphNodeLogger } from './dependency-check-log';
import { ChangePlanStore, searchSolutionHooks } from './change-plan-store';
import {
  buildManualPromptSection,
  loadPlanningManuals,
} from './change-plan-knowledge';
import {
  CHANGE_PLAN_LIMITS,
  ChangePlanTurnSchema,
  type ChangePlanTaskInput,
  type ChangePlanTurnPayload,
  type ExistingHookSummary,
  type SaasHookBusLike,
} from './change-plan.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphChangePlanEdge,
  CodeGraphChangePlanResult,
  CodeGraphChangeTask,
  CodeGraphDependencyCheckResult,
  CodeGraphHookContract,
  CodeGraphNodeLogger,
  CodeGraphRequest,
  CodeGraphTargetRouteDecision,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentChangePlan');
const OPEN_TODO_STATUS = ['pending', 'in_progress'];

/**
 * Run the create-only change-plan node: a code-driven todo loop that plans which files/hooks to add.
 * @keyword-cn 变更集规划, 代码Graph节点
 * @keyword-en change-plan, code-graph-node
 */
export async function runChangePlanNode(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  dependencyCheck: CodeGraphDependencyCheckResult;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  hookBus: SaasHookBusLike | null;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphDependencyCheckResult> {
  const graphLog = createCodeGraphNodeLogger(
    'change-plan',
    args.dependencyCheck.context,
  );
  if (args.dependencyCheck.status !== 'ready') {
    graphLog.info('skip', 'change-plan skipped because graph is not ready', {
      status: args.dependencyCheck.status,
    });
    return withChangePlanResult(
      args.dependencyCheck,
      buildSkippedChangePlan(graphLog, 'graph is not ready'),
      graphLog.entries,
    );
  }
  const targetPlan = args.dependencyCheck.context.targetPlan ?? [];
  if (targetPlan.length === 0) {
    return withChangePlanResult(
      args.dependencyCheck,
      buildSkippedChangePlan(graphLog, 'no targetPlan to plan files for'),
      graphLog.entries,
    );
  }
  if (!args.hookCaller) {
    return withChangePlanResult(
      args.dependencyCheck,
      buildBlockedChangePlan(graphLog, 'Hook caller is not injected.'),
      graphLog.entries,
    );
  }
  if (!args.aiAdapter) {
    return withChangePlanResult(
      args.dependencyCheck,
      buildBlockedChangePlan(graphLog, 'Agent AI adapter is not injected.'),
      graphLog.entries,
    );
  }

  const planId = derivePlanId(args.request);
  const store = new ChangePlanStore({
    hookCaller: args.hookCaller,
    runnerId: args.request.runner_id,
    workflowContext: args.workflowContext,
  });

  try {
    graphLog.info('start', 'change-plan node started', {
      planId,
      targets: targetPlan.length,
    });
    await store.ensurePlan({
      planId,
      sessionId: args.request.context.session_id,
      runnerId: args.request.runner_id,
      requirement: args.request.full_requirement,
      solutionIds: collectSolutionIds(targetPlan),
    });
    await seedTargetTodos(store, planId, targetPlan, graphLog);

    const scopeNames = collectScopeNames(targetPlan);
    const targetCtx = buildTargetContext(targetPlan);
    // 先选书: 按 routePlan 选用知识库手册 (默认前端用 Astro 定型等), 喂给后续生成。
    const manuals = await loadPlanningManuals({
      hookBus: args.hookBus,
      workflowContext: args.workflowContext,
      aiAdapter: args.aiAdapter,
      input: args.input,
      requirement: compactRequirementForRouting(
        args.request.full_requirement,
        2000,
      ),
      targetPlan,
      graphLog,
    });
    // 选完书向用户发一条告知 (LLM 生成, 语言跟随需求), 与依赖/目标判定的 notice 同一通道。
    if (manuals.notice && args.hookCaller) {
      await sendDependencyNotice({
        hookCaller: args.hookCaller,
        request: args.request,
        workflowContext: args.workflowContext,
        notice: manuals.notice,
        graphLog,
      });
    }
    const foundExisting = new Map<string, ExistingHookSummary>();
    let notice: string | undefined;
    let lastSearchResults: ExistingHookSummary[] = [];
    let iterations = 0;

    for (let i = 0; i < CHANGE_PLAN_LIMITS.maxIterations; i++) {
      const openTodos = await store.listTodos(planId, OPEN_TODO_STATUS);
      if (openTodos.length === 0) break;
      iterations = i + 1;

      const tasks = await store.searchTasks(planId, { limit: 200 });
      const turn = await requestChangePlanTurn({
        aiAdapter: args.aiAdapter,
        input: args.input,
        request: args.request,
        targetPlan,
        openTodos,
        tasks,
        existingHooks: [...foundExisting.values()],
        lastSearchResults,
        manualText: manuals.manualText,
        graphLog,
        iteration: i,
      });
      if (turn.notice?.trim()) notice = turn.notice.trim();

      await applyTurn({ store, planId, turn, targetCtx, graphLog });

      lastSearchResults = await runSearchRequests({
        turn,
        hookCaller: args.hookCaller,
        runnerId: args.request.runner_id,
        workflowContext: args.workflowContext,
        scopeNames,
        foundExisting,
        graphLog,
      });

      const allTasks = await store.searchTasks(planId, { limit: 200 });
      const edges = computeEdges(allTasks, foundExisting);
      await syncResolveEdgeTodos({ store, planId, edges, graphLog });
    }

    const snapshot = await store.getSnapshot(planId);
    const finalTasks = await store.searchTasks(planId, { limit: 200 });
    const edges = computeEdges(finalTasks, foundExisting);
    const unresolved = edges.filter((edge) => edge.resolved === 'unresolved');
    const topo = computeTopoOrder(finalTasks);
    if (topo.dangling.length > 0) {
      graphLog.warn(
        'topo:dangling',
        'dependsOn referenced taskIds not in this plan (ignored for ordering)',
        { dangling: topo.dangling.slice(0, 20) },
      );
    }
    if (topo.cyclic.length > 0) {
      graphLog.warn(
        'topo:cycle',
        'dependsOn has a cycle; cyclic tasks appended at the end of topoOrder',
        { cyclic: topo.cyclic.slice(0, 20) },
      );
    }
    if (snapshot.openTodos > 0) {
      logger.warn(
        `change-plan finished with ${snapshot.openTodos} open todos (planId=${planId}, iterations=${iterations})`,
      );
      graphLog.warn(
        'incomplete',
        'change-plan loop ended with open todos; not blocking the pipeline',
        { openTodos: snapshot.openTodos, unresolvedEdges: unresolved.length },
      );
    }

    const result: CodeGraphChangePlanResult = {
      status: 'ready',
      node: 'change-plan',
      planId,
      changeTasks: finalTasks,
      edges,
      ...(topo.order.length > 1 ? { topoOrder: topo.order } : {}),
      openTodos: snapshot.openTodos,
      iterations,
      ...(manuals.bookIds.length > 0 ? { bookIds: manuals.bookIds } : {}),
      ...(notice ? { notice } : {}),
      ...(snapshot.openTodos > 0
        ? { reason: `loop ended with ${snapshot.openTodos} open todos` }
        : {}),
      errors: [],
      log: graphLog.entries,
    };
    graphLog.info('complete', 'change-plan completed', {
      tasks: finalTasks.length,
      edges: edges.length,
      unresolvedEdges: unresolved.length,
      topoOrdered: topo.order.length,
      danglingDeps: topo.dangling.length,
      cyclicTasks: topo.cyclic.length,
      openTodos: snapshot.openTodos,
      iterations,
    });

    if (notice && args.hookCaller) {
      await sendDependencyNotice({
        hookCaller: args.hookCaller,
        request: args.request,
        workflowContext: args.workflowContext,
        notice,
        graphLog,
      });
    }
    return withChangePlanResult(args.dependencyCheck, result, graphLog.entries);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`change-plan blocked: ${reason}`);
    graphLog.error('fail', 'change-plan failed', { error: reason });
    return withChangePlanResult(
      args.dependencyCheck,
      buildBlockedChangePlan(graphLog, reason, planId),
      graphLog.entries,
    );
  }
}

/**
 * Seed one plan-target todo per target so the loop has work to start from.
 * @keyword-cn 种子todo, 规划目标
 * @keyword-en seed-todos, plan-target
 */
async function seedTargetTodos(
  store: ChangePlanStore,
  planId: string,
  targetPlan: CodeGraphTargetRouteDecision[],
  graphLog: CodeGraphNodeLogger,
): Promise<void> {
  const todos = targetPlan.map((target) => {
    const targetName =
      target.useTarget?.name || target.newTarget?.name || target.routeId;
    return {
      todoId: `plan-target:${target.routeId}`,
      type: 'plan-target',
      status: 'pending',
      title: `Plan create files/hooks for ${target.action} target ${targetName}`,
      payload: {
        routeId: target.routeId,
        action: target.action,
        decision: target.decision,
        targetName,
      },
    };
  });
  await store.upsertTodos(planId, todos);
  graphLog.info('seed-todos', 'seeded plan-target todos', {
    count: todos.length,
  });
}

/**
 * Call the logic model for one change-plan loop turn and parse its JSON actions.
 * @keyword-cn LLM动作, 变更集
 * @keyword-en llm-turn, change-plan
 */
async function requestChangePlanTurn(args: {
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
  request: CodeGraphRequest;
  targetPlan: CodeGraphTargetRouteDecision[];
  openTodos: Array<{
    todoId: string;
    type?: string;
    title?: string;
    refHook?: string;
  }>;
  tasks: CodeGraphChangeTask[];
  existingHooks: ExistingHookSummary[];
  lastSearchResults: ExistingHookSummary[];
  manualText: string;
  graphLog: CodeGraphNodeLogger;
  iteration: number;
}): Promise<ChangePlanTurnPayload> {
  const model = selectLogicModel(args.aiAdapter, args.input);
  args.graphLog.info(
    'turn:llm:start',
    'calling logic model for change-plan turn',
    {
      iteration: args.iteration,
      openTodos: args.openTodos.length,
    },
  );
  const response = await model.chat({
    source: 'code-agent.change-plan',
    isolateCallbacks: true,
    messages: [
      {
        role: 'user',
        content: buildChangePlanPrompt({
          requirement: compactRequirementForRouting(
            args.request.full_requirement,
            2000,
          ),
          targetPlan: args.targetPlan,
          openTodos: args.openTodos,
          tasks: args.tasks,
          existingHooks: args.existingHooks,
          lastSearchResults: args.lastSearchResults,
          manualText: args.manualText,
        }),
      },
    ],
    params: { temperature: 0, responseFormat: { type: 'json_object' } },
  });
  const parsed = ChangePlanTurnSchema.parse(
    parseJsonObjectLoose(response.content),
  );
  args.graphLog.info('turn:llm:done', 'logic model returned change-plan turn', {
    iteration: args.iteration,
    tasks: parsed.tasks?.length ?? 0,
    todoUpdates: parsed.todoUpdates?.length ?? 0,
    searchRequests: parsed.searchRequests?.length ?? 0,
  });
  return parsed;
}

/**
 * Apply one parsed turn: upsert tasks, then upsert todo adds + updates.
 * @keyword-cn 应用动作, 变更集
 * @keyword-en apply-turn, change-plan
 */
async function applyTurn(args: {
  store: ChangePlanStore;
  planId: string;
  turn: ChangePlanTurnPayload;
  targetCtx: Map<string, TargetContext>;
  graphLog: CodeGraphNodeLogger;
}): Promise<void> {
  const soleCtx =
    args.targetCtx.size === 1 ? [...args.targetCtx.values()][0] : undefined;
  const tasks = (args.turn.tasks ?? []).map((task, index) => {
    const ctx =
      (task.routeId ? args.targetCtx.get(task.routeId) : undefined) ?? soleCtx;
    return normalizeTurnTask(task, index, ctx);
  });
  if (tasks.length > 0) await args.store.upsertTasks(args.planId, tasks);

  const todoDocs: Array<Record<string, unknown>> = [];
  for (const add of args.turn.todoAdds ?? []) {
    todoDocs.push({
      todoId: add.todoId,
      ...(add.type ? { type: add.type } : {}),
      status: 'pending',
      ...(add.title ? { title: add.title } : {}),
      ...(add.refTaskId ? { refTaskId: add.refTaskId } : {}),
      ...(add.refHook ? { refHook: add.refHook } : {}),
    });
  }
  for (const update of args.turn.todoUpdates ?? []) {
    todoDocs.push({
      todoId: update.todoId,
      status: update.status,
      ...(update.note ? { note: update.note } : {}),
    });
  }
  if (todoDocs.length > 0) await args.store.upsertTodos(args.planId, todoDocs);
  args.graphLog.info('apply-turn', 'applied change-plan turn actions', {
    tasks: tasks.length,
    todos: todoDocs.length,
  });
}

/**
 * Fulfill the model's existing-hook search requests and record what was found.
 * @keyword-cn 搜索履行, 边解析
 * @keyword-en fulfill-search, edge-resolution
 */
async function runSearchRequests(args: {
  turn: ChangePlanTurnPayload;
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  scopeNames: string[];
  foundExisting: Map<string, ExistingHookSummary>;
  graphLog: CodeGraphNodeLogger;
}): Promise<ExistingHookSummary[]> {
  const requests = (args.turn.searchRequests ?? []).slice(
    0,
    CHANGE_PLAN_LIMITS.maxSearchRequestsPerTurn,
  );
  if (requests.length === 0) return [];
  const found: ExistingHookSummary[] = [];
  for (const request of requests) {
    const hits = await searchSolutionHooks({
      hookCaller: args.hookCaller,
      runnerId: args.runnerId,
      workflowContext: args.workflowContext,
      scopeNames: args.scopeNames,
      query: request.query,
    });
    for (const hit of hits) {
      if (!args.foundExisting.has(hit.name))
        args.foundExisting.set(hit.name, hit);
      found.push(hit);
    }
  }
  args.graphLog.info('search:done', 'fulfilled existing-hook search requests', {
    requests: requests.length,
    found: found.length,
  });
  return found;
}

/**
 * Derive call/compatible edges from all tasks and classify how each target resolves.
 * @keyword-cn 边推导, 边解析
 * @keyword-en edge-derive, edge-resolution
 */
function computeEdges(
  tasks: CodeGraphChangeTask[],
  foundExisting: Map<string, ExistingHookSummary>,
): CodeGraphChangePlanEdge[] {
  const newHookNames = new Set<string>();
  for (const task of tasks) {
    for (const hook of task.hooks) newHookNames.add(hook.name);
  }
  const edges: CodeGraphChangePlanEdge[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    for (const hook of task.hooks) {
      const out: Array<{ to: string; kind: 'calls' | 'compatibleWith' }> = [
        ...(hook.calls ?? []).map((to) => ({ to, kind: 'calls' as const })),
        ...(hook.compatibleWith ?? []).map((to) => ({
          to,
          kind: 'compatibleWith' as const,
        })),
      ];
      for (const edge of out) {
        const key = `${hook.name}=>${edge.to}:${edge.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const resolved = newHookNames.has(edge.to)
          ? 'new'
          : foundExisting.has(edge.to)
            ? 'existing'
            : 'unresolved';
        edges.push({ from: hook.name, to: edge.to, kind: edge.kind, resolved });
      }
    }
  }
  return edges;
}

/**
 * Derive a leaf-first topological generation order from tasks' coarse dependsOn.
 * @description Kahn over task-level dependsOn (a task's deps generate before it). Refs to taskIds
 *   not in this plan go to `dangling`; tasks caught in a cycle are appended at the end and reported
 *   in `cyclic`. Never throws — the returned order always covers every task exactly once.
 * @keyword-cn 拓扑排序, 依赖顺序
 * @keyword-en topo-order, dependency-order
 */
function computeTopoOrder(tasks: CodeGraphChangeTask[]): {
  order: string[];
  dangling: Array<{ from: string; to: string }>;
  cyclic: string[];
} {
  const ids = new Set(tasks.map((task) => task.taskId));
  const dangling: Array<{ from: string; to: string }> = [];
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const task of tasks) {
    let deps = 0;
    const counted = new Set<string>();
    for (const dep of task.dependsOn ?? []) {
      if (dep === task.taskId || counted.has(dep)) continue;
      if (!ids.has(dep)) {
        dangling.push({ from: task.taskId, to: dep });
        continue;
      }
      counted.add(dep);
      deps += 1;
      const list = dependents.get(dep) ?? [];
      list.push(task.taskId);
      dependents.set(dep, list);
    }
    indegree.set(task.taskId, deps);
  }
  // 稳定入队: 按任务原始顺序取 indegree=0 的叶子
  const queue = tasks
    .map((task) => task.taskId)
    .filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }
  // 环里的任务永远不会 indegree 归零, 稳定补在末尾, 保证 order 覆盖全部任务
  const cyclic = tasks
    .map((task) => task.taskId)
    .filter((id) => !seen.has(id));
  return { order: [...order, ...cyclic], dangling, cyclic };
}

/**
 * Keep resolve-edge todos in sync with real edge state (code-authoritative self-correction).
 * @keyword-cn 边todo同步, 验图自纠
 * @keyword-en resolve-edge-sync, validation-self-correct
 */
async function syncResolveEdgeTodos(args: {
  store: ChangePlanStore;
  planId: string;
  edges: CodeGraphChangePlanEdge[];
  graphLog: CodeGraphNodeLogger;
}): Promise<void> {
  const unresolved = args.edges.filter(
    (edge) => edge.resolved === 'unresolved',
  );
  const desired = new Map<string, CodeGraphChangePlanEdge>();
  for (const edge of unresolved) {
    desired.set(edgeTodoId(edge), edge);
  }
  const existingTodos = await args.store.listTodos(args.planId);
  const docs: Array<Record<string, unknown>> = [];
  // 已解决/已消失的 resolve-edge todo -> 关掉 (code 权威, 不信 LLM 早退)
  for (const todo of existingTodos) {
    if (todo.type !== 'resolve-edge') continue;
    if (!desired.has(todo.todoId) && todo.status !== 'done') {
      docs.push({ todoId: todo.todoId, status: 'done' });
    }
  }
  // 仍未解决的边 -> 确保有 pending todo (被 LLM 错误关掉的也重新打开)
  for (const [todoId, edge] of desired) {
    docs.push({
      todoId,
      type: 'resolve-edge',
      status: 'pending',
      title: `Resolve ${edge.kind} edge ${edge.from} -> ${edge.to} (define a new task for it, search an existing hook, or drop the edge)`,
      refHook: edge.to,
    });
  }
  if (docs.length > 0) await args.store.upsertTodos(args.planId, docs);
  if (unresolved.length > 0) {
    args.graphLog.info(
      'validate',
      'unresolved edges kept as resolve-edge todos',
      {
        unresolved: unresolved.length,
      },
    );
  }
}

/**
 * Build the strict JSON prompt for one change-plan loop turn.
 * @keyword-cn 变更集提示, JSON输出
 * @keyword-en change-plan-prompt, json-output
 */
function buildChangePlanPrompt(args: {
  requirement: string;
  targetPlan: CodeGraphTargetRouteDecision[];
  openTodos: Array<{
    todoId: string;
    type?: string;
    title?: string;
    refHook?: string;
  }>;
  tasks: CodeGraphChangeTask[];
  existingHooks: ExistingHookSummary[];
  lastSearchResults: ExistingHookSummary[];
  manualText: string;
}): string {
  const targetBrief = args.targetPlan.map((target) => ({
    routeId: target.routeId,
    action: target.action,
    decision: target.decision,
    target: target.useTarget?.name || target.newTarget?.name || target.routeId,
    basePath: deriveTargetBasePath(target),
    solutionId:
      target.useTarget?.solutionId ||
      (target.solution && 'solutionId' in target.solution
        ? target.solution.solutionId
        : undefined),
    summary: target.summary,
  }));
  const taskBrief = args.tasks.map((task) => ({
    taskId: task.taskId,
    action: task.action,
    path: task.path,
    summary: task.summary,
    hooks: task.hooks.map((hook) => hook.name),
  }));
  return [
    'You are the change-plan node for code-agent. Return strict JSON only, no markdown, no <think>.',
    'Goal: plan WHICH new files to create for each target across the whole routePlan. This is CREATE-ONLY: every change is op="create"; never plan modify or delete. You do NOT write code or function bodies here.',
    '',
    'CRITICAL — plan by the target\'s action. Each target below carries an "action":',
    '- action="app" (a frontend page / UI / static site): plan FILES ONLY. Each task is { taskId, routeId, action:"app", path, summary }. summary says what the file is. A plain page has NO hooks — DO NOT invent hooks, signatures, calls, or edges for it. Its internal JS functions are NOT hooks. Leave "hooks" empty/omitted and send NO searchRequests.',
    '- action="data-point" (data schema / collection / storage): also FILES ONLY for now — { taskId, routeId, action:"data-point", path, summary } describing the schema/data file. No hooks, no edges.',
    '- action="unit" (a backend capability exposed via the HookBus): plan files AND the hooks each file declares. ONLY here do you build the hook action tree: each hook = { name (real runner.<app>.<module>.<action> namespace), summary, signature, calls[], compatibleWith[] }. Edges (calls/compatibleWith) connect hooks. This is the ONLY action that produces hooks and edges.',
    '',
    'You are driven by a todo list. Work the open todos:',
    '- plan-target: decide the files (and, for action="unit", the hooks) needed for that target, emit them in "tasks", then mark the todo done in "todoUpdates".',
    '- resolve-edge (only ever appears for unit hook edges): a hook references another hook that is neither defined in this plan nor found as an existing hook. Resolve it by adding a new task that defines it, removing that edge, or searching via searchRequests. Do not mark it done yourself; the system re-checks and closes it.',
    'Only mark plan-target todos done. The system owns resolve-edge / fix-validation todo status.',
    '',
    'Unit-only — edges & existing hooks: each hook may list calls[] (hooks it invokes) and compatibleWith[] (hooks whose shape it must align with), targeting other NEW hooks in this plan (preferred) or EXISTING hooks. To reference an existing hook, first confirm it via searchRequests[{query, solutionId?}] (scoped to the routePlan solutions); under create-only you cannot change an existing hook, so the new side adapts to it.',
    '',
    'JSON shape for an app target (files only; follow the manual archetype — normally MULTIPLE files, never one inline index.html): {"tasks":[{"taskId":"global-css","routeId":"step-1","action":"app","path":"src/styles/global.css","summary":"theme + layout styles"},{"taskId":"layout","routeId":"step-1","action":"app","path":"src/layouts/BaseLayout.astro","summary":"site shell","dependsOn":["global-css"]},{"taskId":"hero","routeId":"step-1","action":"app","path":"src/components/Hero.astro","summary":"hero section component","dependsOn":["global-css"]},{"taskId":"home","routeId":"step-1","action":"app","path":"src/pages/index.astro","summary":"home page composing sections","dependsOn":["layout","hero"]}],"todoUpdates":[{"todoId":"plan-target:step-1","status":"done"}],"notice":"将按 Astro 规范拆成布局/页面/组件/样式等多个文件"}',
    'For a data-point target, plan files only (schema/data files), no hooks/edges.',
    'JSON shape for a unit target (files + hooks): {"tasks":[{"taskId":"...","routeId":"step-2","action":"unit","path":"src/foo/foo.hook.ts","summary":"...","hooks":[{"name":"runner.app.foo.bar","summary":"...","signature":{"params":{},"returns":{}},"calls":["runner.app.foo.baz"],"compatibleWith":[]}]}],"todoUpdates":[{"todoId":"plan-target:step-2","status":"done"}],"searchRequests":[{"query":"keyword"}],"notice":"将新增 foo 能力"}',
    'Paths: every target shows a "basePath" (its location under the runner workspace, e.g. solutions/<sol>/apps/<app>). Emit "path" as the file location INSIDE that target (e.g. "index.html", "assets/app.js"); the system roots it under basePath so the stored path is the full solution/app-relative path. ALWAYS set "routeId" so the system knows which target a file belongs to. Never use "../" or absolute paths.',
    'Dependencies & order (ALL actions): give each task a coarse "dependsOn": string[] = the taskIds of OTHER tasks IN THIS PLAN that this file directly composes or uses (a page dependsOn its layout + the section components + its stylesheet; a component dependsOn the shared stylesheet/script it needs; a unit file dependsOn another unit file it builds on). This is TASK-LEVEL only: sibling taskIds — NOT import paths, file names, or hook edges (hook wiring stays in calls/compatibleWith). Leaf files (a stylesheet, a standalone script) usually have empty dependsOn — omit it. Only list taskIds that exist in this plan and keep it acyclic; the system derives the generation order (leaves first) from dependsOn.',
    'Reuse taskId across turns to update the same file; emit only what changed this turn. Keep "notice" in the SAME natural language as the requirement, plain words, no ids/JSON/field names.',
    buildManualPromptSection(args.manualText),
    '',
    `Full requirement:\n${args.requirement}`,
    '',
    `Targets (routePlan resolved):\n${JSON.stringify(targetBrief, null, 2)}`,
    '',
    `Open todos:\n${JSON.stringify(args.openTodos, null, 2)}`,
    '',
    `Tasks already planned:\n${JSON.stringify(taskBrief, null, 2)}`,
    '',
    `Existing hooks found so far:\n${JSON.stringify(
      args.existingHooks.map((hook) => ({
        name: hook.name,
        description: hook.description,
      })),
      null,
      2,
    )}`,
    '',
    `Results of your previous searchRequests:\n${JSON.stringify(
      args.lastSearchResults.map((hook) => ({
        name: hook.name,
        description: hook.description,
        signature: hook.signature,
      })),
      null,
      2,
    )}`,
  ].join('\n');
}

/**
 * Normalize one LLM task input into a stored change task (create-only).
 * @keyword-cn 任务归一化, 新增
 * @keyword-en task-normalize, create-only
 */
function normalizeTurnTask(
  task: ChangePlanTaskInput,
  index: number,
  ctx?: TargetContext,
): CodeGraphChangeTask {
  const hooks: CodeGraphHookContract[] = (task.hooks ?? [])
    .map((hook) => ({
      name: hook.name.trim(),
      ...(hook.summary ? { summary: hook.summary } : {}),
      ...(hook.signature &&
      typeof hook.signature === 'object' &&
      !Array.isArray(hook.signature)
        ? { signature: hook.signature as Record<string, unknown> }
        : {}),
      ...(hook.calls && hook.calls.length > 0
        ? { calls: hook.calls.map((item) => item.trim()).filter(Boolean) }
        : {}),
      ...(hook.compatibleWith && hook.compatibleWith.length > 0
        ? {
            compatibleWith: hook.compatibleWith
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : {}),
    }))
    .filter((hook) => Boolean(hook.name));
  const path = joinTargetPath(ctx?.basePath ?? '', task.path.trim());
  const taskId =
    task.taskId?.trim() || slugifyPath(path) || `task-${index + 1}`;
  const targetId = task.targetId?.trim() || ctx?.targetId;
  const solutionId = task.solutionId?.trim() || ctx?.solutionId;
  const action = task.action ?? ctx?.action;
  // 粗粒度依赖: 只留本 plan 内引用到的兄弟 taskId, 去重、去空、去自引用 (拓扑排序输入)
  const dependsOn = [
    ...new Set(
      (task.dependsOn ?? [])
        .map((id) => id.trim())
        .filter((id) => id && id !== taskId),
    ),
  ];
  return {
    taskId,
    ...(task.routeId ? { routeId: task.routeId } : {}),
    ...(targetId ? { targetId } : {}),
    ...(solutionId ? { solutionId } : {}),
    ...(action ? { action } : {}),
    op: 'create',
    path,
    ...(task.summary ? { summary: task.summary } : {}),
    hooks,
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    ...(task.reason ? { reason: task.reason } : {}),
  };
}

/**
 * Derive a stable resolve-edge todo id from an edge.
 * @keyword-cn 边todoId, 字段归一化
 * @keyword-en edge-todo-id, field-normalize
 */
function edgeTodoId(edge: CodeGraphChangePlanEdge): string {
  return `resolve-edge:${edge.kind}:${edge.from}=>${edge.to}`.slice(0, 240);
}

type TargetContext = {
  basePath: string;
  targetId?: string;
  solutionId?: string;
  action?: CodeGraphChangeTask['action'];
};

/**
 * Build a routeId -> { basePath, targetId, solutionId } map from the target plan.
 * @keyword-cn 目标上下文, 路径基址
 * @keyword-en target-context, base-path
 */
function buildTargetContext(
  targetPlan: CodeGraphTargetRouteDecision[],
): Map<string, TargetContext> {
  const map = new Map<string, TargetContext>();
  for (const target of targetPlan) {
    map.set(target.routeId, {
      basePath: deriveTargetBasePath(target),
      ...(target.action ? { action: target.action } : {}),
      ...(target.useTarget?.id ? { targetId: target.useTarget.id } : {}),
      ...(target.useTarget?.solutionId ||
      (target.solution && 'solutionId' in target.solution)
        ? {
            solutionId:
              target.useTarget?.solutionId ||
              (target.solution as { solutionId: string }).solutionId,
          }
        : {}),
    });
  }
  return map;
}

/**
 * Derive a target's solution/app-relative base path (under the runner workspace).
 * @keyword-cn 路径基址, 目标路径
 * @keyword-en base-path, target-path
 */
function deriveTargetBasePath(target: CodeGraphTargetRouteDecision): string {
  if (target.useTarget?.path) return toWorkspaceRelative(target.useTarget.path);
  const solutionName =
    target.useTarget?.solutionName || target.solution?.name || 'solution';
  const name =
    target.useTarget?.name || target.newTarget?.name || target.routeId;
  const sub =
    target.action === 'unit'
      ? 'units'
      : target.action === 'data-point'
        ? 'data'
        : 'apps';
  return `solutions/${solutionName.trim()}/${sub}/${name.trim()}`;
}

/**
 * Strip an absolute runner path down to its workspace-relative form.
 * @keyword-cn 工作区相对, 路径归一化
 * @keyword-en workspace-relative, path-normalize
 */
function toWorkspaceRelative(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/');
  const marker = '/workspace/';
  const idx = norm.toLowerCase().indexOf(marker);
  if (idx >= 0) return norm.slice(idx + marker.length).replace(/\/+$/, '');
  return norm.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * Join a model-provided in-target file path under the target base path (escape-safe).
 * @keyword-cn 路径拼接, 作用域围栏
 * @keyword-en path-join, scope-fence
 */
function joinTargetPath(base: string, file: string): string {
  const clean = file
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
  if (!base) return clean;
  if (clean === base || clean.startsWith(`${base}/`)) return clean;
  return `${base}/${clean}`;
}

/**
 * Slugify a file path into a stable task id fragment.
 * @keyword-cn 路径slug, 字段归一化
 * @keyword-en path-slug, field-normalize
 */
function slugifyPath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Derive the plan id from the stable code graph thread id.
 * @keyword-cn 计划Id, 检查点线程
 * @keyword-en plan-id, checkpoint-thread
 */
function derivePlanId(request: CodeGraphRequest): string {
  return (
    readContextString(request.context, 'codeGraphThreadId') ||
    readContextString(request.context, 'threadId') ||
    `plan:${request.context.session_id ?? 'no-session'}`
  );
}

/**
 * Collect the distinct existing solution ids referenced by the target plan.
 * @keyword-cn Solution收集, 变更集
 * @keyword-en collect-solutions, change-plan
 */
function collectSolutionIds(
  targetPlan: CodeGraphTargetRouteDecision[],
): string[] {
  const ids = new Set<string>();
  for (const target of targetPlan) {
    const id =
      target.useTarget?.solutionId ||
      (target.solution && 'solutionId' in target.solution
        ? target.solution.solutionId
        : undefined);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Collect candidate app/unit/target names used to scope existing-hook search.
 * @keyword-cn 作用域名集, 存量hook搜索
 * @keyword-en scope-names, existing-hook-search
 */
function collectScopeNames(
  targetPlan: CodeGraphTargetRouteDecision[],
): string[] {
  const names = new Set<string>();
  for (const target of targetPlan) {
    if (target.useTarget?.name) names.add(target.useTarget.name);
    for (const candidate of target.candidates) {
      if (candidate.name) names.add(candidate.name);
    }
    if (target.solution?.name) names.add(target.solution.name);
  }
  return [...names];
}

/**
 * Attach the change-plan output to the dependency-check result envelope.
 * @keyword-cn 变更集结果, Graph输出
 * @keyword-en change-plan-result, graph-output
 */
function withChangePlanResult(
  dependencyCheck: CodeGraphDependencyCheckResult,
  result: CodeGraphChangePlanResult,
  log: CodeGraphChangePlanResult['log'],
): CodeGraphDependencyCheckResult {
  return {
    ...dependencyCheck,
    status: result.status === 'blocked' ? 'blocked' : dependencyCheck.status,
    context: {
      ...dependencyCheck.context,
      changePlan: result.changeTasks,
      code_graph_log: log,
    },
    changePlan: result,
    errors:
      result.status === 'blocked'
        ? [...dependencyCheck.errors, ...result.errors]
        : dependencyCheck.errors,
    log,
  };
}

/**
 * Build a skipped change-plan result.
 * @keyword-cn 变更集跳过, Graph输出
 * @keyword-en change-plan-skip, graph-output
 */
function buildSkippedChangePlan(
  graphLog: CodeGraphNodeLogger,
  reason: string,
): CodeGraphChangePlanResult {
  graphLog.info('skip', reason);
  return {
    status: 'skipped',
    node: 'change-plan',
    planId: '',
    changeTasks: [],
    edges: [],
    openTodos: 0,
    iterations: 0,
    reason,
    errors: [],
    log: graphLog.entries,
  };
}

/**
 * Build a blocked change-plan result.
 * @keyword-cn 变更集阻塞, 阻塞状态
 * @keyword-en change-plan-blocked, blocked-status
 */
function buildBlockedChangePlan(
  graphLog: CodeGraphNodeLogger,
  reason: string,
  planId = '',
): CodeGraphChangePlanResult {
  graphLog.error('blocked', reason);
  return {
    status: 'blocked',
    node: 'change-plan',
    planId,
    changeTasks: [],
    edges: [],
    openTodos: 0,
    iterations: 0,
    errors: [reason],
    log: graphLog.entries,
  };
}
