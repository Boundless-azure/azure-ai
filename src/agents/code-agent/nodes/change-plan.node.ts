import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readContextString, readStringField } from './dependency-check-context';
import {
  compactRequirementForRouting,
  selectLogicModel,
} from './dependency-check-decision';
import { sendDependencyNotice } from './dependency-choice-card';
import { createCodeGraphNodeLogger } from './dependency-check-log';
import { callRunnerHookData } from './dependency-check-runner-hooks';
import { ChangePlanStore, searchSolutionHooks } from './change-plan-store';
import {
  buildManualPromptSection,
  loadPlanningManuals,
} from './change-plan-knowledge';
import {
  CHANGE_PLAN_LIMITS,
  CHANGE_PLAN_TODO_STATUS,
  ChangeTaskInputSchema,
  ContractInputSchema,
  RecordAnalysisInputSchema,
  type AnalysisFinding,
  type ChangePlanTaskInput,
  type ContractInput,
  type ExistingHookSummary,
  type RecordAnalysisInput,
  type SaasHookBusLike,
} from './change-plan.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphChangePlanEdge,
  CodeGraphChangePlanResult,
  CodeGraphChangeTask,
  CodeGraphContract,
  CodeGraphDependencyCheckResult,
  CodeGraphHookContract,
  CodeGraphInitTarget,
  CodeGraphNodeLogger,
  CodeGraphRequest,
  CodeGraphTargetRouteDecision,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentChangePlan');
const OPEN_TODO_STATUS = ['pending', 'in_progress'];
/** 契约复盘门的固定 todo id (code 强制的、专做联动契约的那一步) */
const CONTRACT_REVIEW_TODO_ID = 'contract-review';

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
      // 声明目标根 (既有 app 的 basePath): 让 read/搜工具在规划前的分析阶段也能围栏到既有目标, 否则 roots 空
      scopeRoots: [
        ...new Set(targetPlan.map(deriveTargetBasePath).filter(Boolean)),
      ],
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
    const contracts = new Map<string, CodeGraphContract>();
    // sawSearch: 本轮是否真调过检索工具 (analyze-target 闸门用它逼 LLM 真去分析代码, 而不是空记结论)
    const shared: { notice?: string; sawSearch?: boolean } = {};
    // routeId → 该既有目标的分析结论 (record_analysis 落库), 注入 plan-target 提示让 modify 规划有据
    const analysis = new Map<string, AnalysisFinding[]>();
    const analyzeAttempts = new Map<string, number>();
    const requirement = compactRequirementForRouting(
      args.request.full_requirement,
      2000,
    );
    // change-plan 不再让 LLM 返回大 JSON; 给它一组工具, 由它逐个调用来构建变更集 (与 generate-file 同构)。
    // 完成仍由 code 权威判定: 每轮跑完 LLM 工具循环后, code 重算边 + 同步 resolve-edge todo, 直到 todo 清空。
    const tools = buildChangePlanTools({
      store,
      planId,
      hookCaller: args.hookCaller,
      runnerId: args.request.runner_id,
      workflowContext: args.workflowContext,
      scopeNames,
      targetCtx,
      foundExisting,
      contracts,
      analysis,
      shared,
      graphLog,
    });
    let iterations = 0;
    let contractReviewSeeded = false;

    for (let i = 0; i < CHANGE_PLAN_LIMITS.maxIterations; i++) {
      const openTodos = await store.listTodos(planId, OPEN_TODO_STATUS);
      if (openTodos.length === 0) break;
      iterations = i + 1;
      // 分析闸门优先: 有 analyze-target 未闭合就先做分析轮 (强制分析需求+代码, 再准规划 modify)
      const isAnalysisRound = openTodos.some(
        (todo) => todo.type === 'analyze-target',
      );
      // 契约复盘门: 非分析轮且本轮开放 todo 里有 contract-review, 这一轮就是专做契约的那一轮
      const isContractRound =
        !isAnalysisRound &&
        openTodos.some((todo) => todo.type === 'contract-review');

      shared.sawSearch = false;
      const tasks = await store.searchTasks(planId, { limit: 200 });
      // 手册规划/分析轮**必须全量给** —— 前端 Astro 的多模块拆分约定就在里面, 削了 LLM 会退化成规划单个 index.html。
      // 只有契约复盘轮 (不涉及框架约定, 只找跨文件联动) 才瘦身, 省点重复大块。
      const manualForRound = isContractRound
        ? manuals.manualText.slice(0, CHANGE_PLAN_LIMITS.laterRoundManualChars)
        : manuals.manualText;
      await runChangePlanRound({
        aiAdapter: args.aiAdapter,
        input: args.input,
        requirement,
        targetPlan,
        openTodos,
        tasks,
        existingHooks: [...foundExisting.values()],
        contracts: [...contracts.values()],
        analysis,
        manualText: manualForRound,
        chapterCatalog: manuals.chapters ?? [],
        tools,
        round: i,
        isAnalysisRound,
        isContractRound,
        graphLog,
      });

      // 分析闸门闭合 (code 权威): 已 record_analysis 且本轮真检索过代码 → 关 analyze-target。
      // #2 合并: 分析轮现在也就地规划任务; 该 route 已有任务 (task.targetId===useTarget.id) → 不再单开
      // plan-target 轮 (省一轮); 只分析没规划出任务才兜底 seed plan-target。试满 2 轮没落结论 → fail-open。
      if (isAnalysisRound) {
        const postTasks = await store.searchTasks(planId, { limit: 200 });
        for (const todo of openTodos.filter(
          (t) => t.type === 'analyze-target',
        )) {
          const routeId = todo.todoId.slice('analyze-target:'.length);
          const attempts = (analyzeAttempts.get(routeId) ?? 0) + 1;
          analyzeAttempts.set(routeId, attempts);
          const recorded = (analysis.get(routeId)?.length ?? 0) > 0;
          const forced = attempts >= 2;
          if ((recorded && shared.sawSearch) || forced) {
            const target = targetPlan.find((t) => t.routeId === routeId);
            const targetName =
              target?.useTarget?.name ?? target?.newTarget?.name ?? routeId;
            const targetIdForRoute = target?.useTarget?.id;
            const alreadyPlanned = Boolean(
              targetIdForRoute &&
              postTasks.some((t) => t.targetId === targetIdForRoute),
            );
            await store.upsertTodos(planId, [
              { todoId: todo.todoId, status: 'done' },
            ]);
            if (!alreadyPlanned) {
              // 分析了但没就地规划出任务 → 兜底单开 plan-target 轮 (退回原两轮行为, 不丢文件)
              await store.upsertTodos(planId, [
                {
                  todoId: `plan-target:${routeId}`,
                  type: 'plan-target',
                  status: 'pending',
                  title: `Plan changes for EXISTING ${target?.action ?? 'app'} target ${targetName} using your analysis: op:modify the located files / op:create only genuinely new files`,
                  payload: {
                    routeId,
                    action: target?.action,
                    existing: true,
                    targetName,
                  },
                },
              ]);
            }
            graphLog.info('analyze-target:done', 'analysis gate closed', {
              routeId,
              findings: analysis.get(routeId)?.length ?? 0,
              forced: forced && !(recorded && shared.sawSearch),
              merged: alreadyPlanned,
            });
          } else {
            graphLog.info(
              'analyze-target:retry',
              'analysis not grounded yet (no findings or no code search); re-prompting',
              { routeId, attempts, recorded, sawSearch: shared.sawSearch },
            );
          }
        }
        continue; // 分析轮不跑边/契约逻辑
      }

      // code 权威: 按真实任务重算边并同步 resolve-edge todo (这些 todo LLM 关不掉, 每轮由 code 重裁)
      const allTasks = await store.searchTasks(planId, { limit: 200 });
      const edges = computeEdges(allTasks, foundExisting);
      await syncResolveEdgeTodos({ store, planId, edges, graphLog });

      // 契约复盘门 (code 强制一步): 文件规划一收口就 seed 一个 contract-review todo, 逼 LLM 单独一轮
      // 专门找跨文件共享符号 (锚点/事件/形状) 并 declare_contract —— 契约面之前建好却从没被触发, 就靠这门。
      if (isContractRound) {
        // 专做契约那一轮已跑完 → code 一次性关掉 (一锤子, 别再纠缠), 契约声没声由 LLM 那一轮决定
        await store.upsertTodos(planId, [
          { todoId: CONTRACT_REVIEW_TODO_ID, status: 'done' },
        ]);
        graphLog.info(
          'contract-review:done',
          'dedicated contract-review round complete',
          { contracts: contracts.size },
        );
      } else if (!contractReviewSeeded) {
        const remaining = await store.listTodos(planId, OPEN_TODO_STATUS);
        const planningDone = !remaining.some(
          (todo) => todo.type === 'plan-target' || todo.type === 'resolve-edge',
        );
        // 只有多文件才可能联动; 单文件没跨文件契约可言
        if (planningDone && allTasks.length >= 2) {
          await store.upsertTodos(planId, [
            {
              todoId: CONTRACT_REVIEW_TODO_ID,
              type: 'contract-review',
              status: 'pending',
              title:
                'Review all planned files for cross-file shared symbols and declare coupling contracts',
            },
          ]);
          contractReviewSeeded = true;
          graphLog.info(
            'contract-review:seeded',
            'files planned; forcing a dedicated contract-review pass',
            { tasks: allTasks.length },
          );
        }
      }
    }

    // 契约兜底 (code 强制保证一次): 规划循环跑完 contracts 仍为空且有 ≥2 个文件 →
    // mid-loop 的 contract-review 门从没被触发过 (常见: LLM 没 update_todo 关 plan-target → planningDone 恒 false;
    // 或 analysis 轮就地规划完直接 break; 或撞 maxIterations)。这里无条件补跑一轮专做契约,
    // 保证 declare_contract 一定有一次机会 —— 否则并发盲生成的跨文件符号必漂。
    const tasksForContract = await store.searchTasks(planId, { limit: 200 });
    if (contracts.size === 0 && tasksForContract.length >= 2) {
      graphLog.info(
        'contract-review:forced',
        'planning ended with no contracts; running a guaranteed contract pass',
        { tasks: tasksForContract.length },
      );
      shared.sawSearch = false;
      await runChangePlanRound({
        aiAdapter: args.aiAdapter,
        input: args.input,
        requirement,
        targetPlan,
        openTodos: [],
        tasks: tasksForContract,
        existingHooks: [...foundExisting.values()],
        contracts: [...contracts.values()],
        analysis,
        manualText: manuals.manualText.slice(
          0,
          CHANGE_PLAN_LIMITS.laterRoundManualChars,
        ),
        chapterCatalog: manuals.chapters ?? [],
        tools,
        round: iterations,
        isAnalysisRound: false,
        isContractRound: true,
        graphLog,
      });
      graphLog.info(
        'contract-review:forced-done',
        'guaranteed contract pass complete',
        {
          contracts: contracts.size,
        },
      );
    }

    const notice = shared.notice;

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

    // 是否需脚手架 (init.lock) + 依赖增删 (LLM); 供 project-init 节点消费
    const initPlan = await decideInitTargets({
      targetPlan,
      finalTasks,
      planId,
      runnerId: args.request.runner_id,
      requirement: compactRequirementForRouting(
        args.request.full_requirement,
        2000,
      ),
      aiAdapter: args.aiAdapter,
      input: args.input,
      hookCaller: args.hookCaller,
      workflowContext: args.workflowContext,
      bookIds: manuals.bookIds,
      manualText: manuals.manualText,
      graphLog,
    });

    const result: CodeGraphChangePlanResult = {
      status: 'ready',
      node: 'change-plan',
      planId,
      changeTasks: finalTasks,
      edges,
      ...(topo.order.length > 1 ? { topoOrder: topo.order } : {}),
      ...(contracts.size > 0 ? { contracts: [...contracts.values()] } : {}),
      ...(initPlan.length > 0 ? { initPlan } : {}),
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
 * A target is modifiable (二次修改) when target-resolution REUSED an existing app/unit — i.e. it matched
 * a real row from the runner registry, so there is existing code on disk to op:modify (not only op:create).
 * NOTE: do NOT gate on `useTarget.isInitialized` — that flag means "was scaffolded" (init.lock) and is
 * always false for static view pages (default-view-solution), which have real files but no scaffold step.
 * A reuse→create downgraded decision has decision==='create', so it is naturally excluded.
 * @keyword-cn 可修改目标, 二次修改
 * @keyword-en modifiable-target, create-or-modify
 */
function isModifiableTarget(target: CodeGraphTargetRouteDecision): boolean {
  return (
    target.decision === 'reuse' && !target.downgraded && !!target.useTarget
  );
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
    const existing = isModifiableTarget(target);
    // 既有目标先走 analyze-target 闸门 (强制分析需求+代码), 分析闭合后 code 再 seed 它的 plan-target;
    // 新目标没有存量代码可分析, 直接 plan-target (create-only)。
    return existing
      ? {
          todoId: `analyze-target:${target.routeId}`,
          type: 'analyze-target',
          status: 'pending',
          title: `Analyze EXISTING ${target.action} target ${targetName}: break the requirement into change-intents and LOCATE the existing files for each (read_tags → search_by_tag), then record_analysis`,
          payload: {
            routeId: target.routeId,
            action: target.action,
            decision: target.decision,
            existing: true,
            targetName,
          },
        }
      : {
          todoId: `plan-target:${target.routeId}`,
          type: 'plan-target',
          status: 'pending',
          title: `Plan create files/hooks for ${target.action} target ${targetName}`,
          payload: {
            routeId: target.routeId,
            action: target.action,
            decision: target.decision,
            existing: false,
            targetName,
          },
        };
  });
  await store.upsertTodos(planId, todos);
  graphLog.info('seed-todos', 'seeded plan-target / analyze-target todos', {
    count: todos.length,
    analyze: todos.filter((t) => t.type === 'analyze-target').length,
  });
}

/**
 * Build the change-plan agent's tool set. The LLM CONSTRUCTS the change set by CALLING these tools
 * — NOT by returning a big JSON blob. Each tool mutates the store or shared state; completion stays
 * code-authoritative (todo + edge closure re-derived each round after the LLM's tool loop).
 * @keyword-cn 变更集工具集, 工具调用
 * @keyword-en change-plan-tools, tool-calling
 */
function buildChangePlanTools(deps: {
  store: ChangePlanStore;
  planId: string;
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  scopeNames: string[];
  targetCtx: Map<string, TargetContext>;
  foundExisting: Map<string, ExistingHookSummary>;
  contracts: Map<string, CodeGraphContract>;
  analysis: Map<string, AnalysisFinding[]>;
  shared: { notice?: string; sawSearch?: boolean };
  graphLog: CodeGraphNodeLogger;
}): unknown[] {
  const call = (hook: string, payload: unknown) =>
    callRunnerHookData(
      deps.hookCaller,
      deps.runnerId,
      hook,
      payload,
      deps.workflowContext,
    );
  const soleCtx =
    deps.targetCtx.size === 1 ? [...deps.targetCtx.values()][0] : undefined;
  return [
    tool(
      async (input: ChangePlanTaskInput) => {
        const ctx =
          (input.routeId ? deps.targetCtx.get(input.routeId) : undefined) ??
          soleCtx;
        const task = normalizeTurnTask(input, 0, ctx);
        await deps.store.upsertTasks(deps.planId, [task]);
        deps.graphLog.info('tool:upsert_task', 'planned a file', {
          taskId: task.taskId,
          path: task.path,
          hooks: task.hooks.length,
        });
        return `stored task "${task.taskId}" @ ${task.path}${
          task.hooks.length
            ? ` (hooks: ${task.hooks.map((h) => h.name).join(', ')})`
            : ''
        }`;
      },
      {
        name: 'upsert_task',
        description:
          'Add or update ONE change task = a file to produce. `op`: "create" (default) writes a NEW file; "modify" edits an EXISTING file IN PLACE — use modify ONLY for a file you have actually located (via search_by_tag / search_files) and give its real existing path. ALWAYS set routeId to the target this file belongs to. For a unit (backend) file, put its hook contracts in `hooks` (name + optional signature/calls/compatibleWith). Reuse the same taskId to refine a task. Use `dependsOn` for sibling files this one relies on.',
        schema: ChangeTaskInputSchema,
      },
    ),
    tool(
      async (input: { todoId: string; status: string; note?: string }) => {
        await deps.store.upsertTodos(deps.planId, [
          {
            todoId: input.todoId,
            status: input.status,
            ...(input.note ? { note: input.note } : {}),
          },
        ]);
        return `todo "${input.todoId}" -> ${input.status}`;
      },
      {
        name: 'update_todo',
        description:
          'Update a todo status. Close a plan-target todo (status="done") once you have planned all files/hooks for that target. You CANNOT fake resolve-edge / fix-validation completion — the system re-derives those from the real task edges every round and will reopen them.',
        schema: z.object({
          todoId: z.string(),
          status: z.enum(CHANGE_PLAN_TODO_STATUS),
          note: z.string().optional(),
        }),
      },
    ),
    tool(
      async (input: { pattern: string; flags?: string }) => {
        deps.shared.sawSearch = true;
        try {
          const data = await call('runner.app.codeAgentFs.grep', {
            planId: deps.planId,
            pattern: input.pattern,
            ...(input.flags ? { flags: input.flags } : {}),
          });
          return JSON.stringify(data).slice(0, 4000);
        } catch (error) {
          return `grep error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'grep',
        description:
          'Prefer search_by_tag / search_files FIRST (much faster, more precise); use grep only as a regex-content FALLBACK when tag/filename search does not pinpoint the code. Regex-search the contents of existing files within this plan.',
        schema: z.object({
          pattern: z.string(),
          flags: z.string().max(8).optional(),
        }),
      },
    ),
    tool(
      async (input: { query: string }) => {
        deps.shared.sawSearch = true;
        try {
          const data = await call('runner.app.codeAgentFs.fastSearch', {
            planId: deps.planId,
            query: input.query,
          });
          return JSON.stringify(data).slice(0, 4000);
        } catch (error) {
          return `search_files error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'search_files',
        description:
          'FAST filename-substring search — one of the two first-choice ways (with search_by_tag) to locate WHICH file to inspect/modify, before falling back to grep. Find existing files by filename substring within this plan.',
        schema: z.object({ query: z.string() }),
      },
    ),
    tool(
      async (input: { routeId?: string }) => {
        deps.shared.sawSearch = true;
        const ctx =
          (input.routeId ? deps.targetCtx.get(input.routeId) : undefined) ??
          soleCtx;
        if (!ctx?.targetId) {
          return 'read_tags error: unknown target — pass routeId of the target whose tags.json you want.';
        }
        try {
          const data = await call('runner.app.appTag.getList', {
            appId: ctx.targetId,
          });
          return JSON.stringify(data).slice(0, 4000);
        } catch (error) {
          return `read_tags error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'read_tags',
        description:
          "Read a target app's DECLARED keyword vocabulary (tags.json, grouped by dimension). Do this FIRST before search_by_tag so you search with a real, declared tag — searching an undeclared tag returns nothing but the available list.",
        schema: z.object({ routeId: z.string().optional() }),
      },
    ),
    tool(
      async (input: { tag: string; routeId?: string }) => {
        deps.shared.sawSearch = true;
        const ctx =
          (input.routeId ? deps.targetCtx.get(input.routeId) : undefined) ??
          soleCtx;
        if (!ctx?.basePath) {
          return 'search_by_tag error: unknown target — pass routeId of the target to search within.';
        }
        try {
          const data = await call('runner.app.codeAgentFs.searchByTag', {
            planId: deps.planId,
            path: ctx.basePath,
            tag: input.tag,
          });
          return JSON.stringify(data).slice(0, 4000);
        } catch (error) {
          return `search_by_tag error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'search_by_tag',
        description:
          "FIRST CHOICE to locate code (fastest, most precise) — reach for this before grep. Fast reverse-lookup (built-in ripgrep): find EXISTING files in a target whose @keyword comments carry `tag`, and get back the full annotation node of each hit — the precise way to locate code to reuse or modify. `tag` MUST be a term declared in that app's tags.json (call read_tags first); an undeclared tag returns declared=false + the available vocabulary so you can retry with a real tag. Use grep only as a regex-content fallback when tag/filename search does not pinpoint it.",
        schema: z.object({
          tag: z.string(),
          routeId: z.string().optional(),
        }),
      },
    ),
    tool(
      (input: RecordAnalysisInput) => {
        const soleRouteId =
          deps.targetCtx.size === 1 ? [...deps.targetCtx.keys()][0] : undefined;
        const routeId = input.routeId ?? soleRouteId ?? '';
        if (!routeId) {
          return 'record_analysis error: unknown target — pass routeId of the existing target you analyzed.';
        }
        const findings: AnalysisFinding[] = input.findings.map((f) => ({
          intent: f.intent,
          files: (f.files ?? []).map((p) => p.trim()).filter(Boolean),
          ...(f.note ? { note: f.note } : {}),
        }));
        deps.analysis.set(routeId, findings);
        deps.graphLog.info('tool:record_analysis', 'recorded target analysis', {
          routeId,
          findings: findings.length,
        });
        return `analysis recorded for ${routeId}: ${findings.length} change-intent(s). Now the plan-target for this target will be opened so you can upsert_task (op:modify/create) grounded in it.`;
      },
      {
        name: 'record_analysis',
        description:
          'Record your analysis of an EXISTING target BEFORE planning it: decompose the requirement into change-intents, and for each list the existing files you LOCATED (via read_tags/search_by_tag) that it touches. This gate must be satisfied (with real code inspection) before the target can be planned — do NOT fabricate file paths you did not find.',
        schema: RecordAnalysisInputSchema,
      },
    ),
    tool(
      async (input: { query: string }) => {
        deps.shared.sawSearch = true;
        const hits = await searchSolutionHooks({
          hookCaller: deps.hookCaller,
          runnerId: deps.runnerId,
          workflowContext: deps.workflowContext,
          scopeNames: deps.scopeNames,
          query: input.query,
        });
        for (const hit of hits)
          if (!deps.foundExisting.has(hit.name))
            deps.foundExisting.set(hit.name, hit);
        return JSON.stringify(
          hits.map((h) => ({
            name: h.name,
            description: h.description,
            signature: h.signature,
          })),
        ).slice(0, 4000);
      },
      {
        name: 'search_hooks',
        description:
          'Search EXISTING runner hooks (scoped to the routePlan solutions) so a unit file can call/adapt to them. A referenced existing hook becomes a resolved edge.',
        schema: z.object({ query: z.string() }),
      },
    ),
    tool(
      async (input: { hookNames: string[] }) => {
        try {
          const data = await call('runner.system.hookbus.getInfo', [
            { hookNames: input.hookNames },
          ]);
          return JSON.stringify(data).slice(0, 4000);
        } catch (error) {
          return `get_hook_info error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'get_hook_info',
        description:
          'Get real signatures / payload schema of existing hooks a unit file will call.',
        schema: z.object({ hookNames: z.array(z.string()) }),
      },
    ),
    tool(
      (input: ContractInput) => {
        deps.contracts.set(input.contractId, {
          contractId: input.contractId,
          ...(input.name ? { name: input.name } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.spec !== undefined ? { spec: input.spec } : {}),
          taskIds: [...new Set((input.taskIds ?? []).filter(Boolean))],
        });
        return `contract "${input.contractId}" declared over ${
          input.taskIds?.length ?? 0
        } task(s)`;
      },
      {
        name: 'declare_contract',
        description:
          'Add/update ONE coupling contract (联动开发): a shared agreement several concurrently-generated files must AGREE on. ' +
          'ALL generate-file nodes read the WHOLE contract array by default, so you do NOT list party taskIds. ' +
          'Write the agreement as a **plain-text statement** (`description`) with the concrete names/ids/shapes inline — NO JSON spec needed. ' +
          'e.g. "锚点 id: nav 链接 #about #ai #apollo, 各 Section 用同名 id, 客户端脚本 querySelector 这些 id" or ' +
          '"Hero.astro 导出组件 Hero, props {title, subtitle}; index.astro 按此 import 并传参". ' +
          'Same contractId re-declares (updates); to remove a stale one call remove_contract. One contract per distinct coupling.',
        schema: ContractInputSchema,
      },
    ),
    tool(
      (input: { contractId: string }) => {
        const existed = deps.contracts.delete(input.contractId);
        return existed
          ? `contract "${input.contractId}" removed`
          : `contract "${input.contractId}" not found`;
      },
      {
        name: 'remove_contract',
        description:
          'Remove a stale coupling contract by contractId (增删改查的删). The current contract array is shown to you each contract round.',
        schema: z.object({ contractId: z.string().min(1) }),
      },
    ),
    tool(
      (input: { notice: string }) => {
        if (input.notice.trim()) deps.shared.notice = input.notice.trim();
        return 'notice set';
      },
      {
        name: 'set_notice',
        description:
          'Set a short user-facing notice (same language as the requirement, plain words) about what will be created. Optional; call at most once.',
        schema: z.object({ notice: z.string() }),
      },
    ),
  ];
}

/**
 * Run ONE change-plan round: the LLM works the currently-open todos by calling tools (real tool-calling,
 * no JSON to parse). createAgent loops internally until the model stops; code then re-derives edges.
 * @keyword-cn 单轮工具循环, 变更集
 * @keyword-en change-plan-round, tool-calling
 */
async function runChangePlanRound(args: {
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
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
  contracts: CodeGraphContract[];
  analysis: Map<string, AnalysisFinding[]>;
  manualText: string;
  chapterCatalog: Array<{ id: string; title: string }>;
  tools: unknown[];
  round: number;
  isAnalysisRound: boolean;
  isContractRound: boolean;
  graphLog: CodeGraphNodeLogger;
}): Promise<void> {
  const model = selectLogicModel(args.aiAdapter, args.input);
  args.graphLog.info('round:start', 'change-plan tool-calling round', {
    round: args.round,
    openTodos: args.openTodos.length,
    tasks: args.tasks.length,
    analysisRound: args.isAnalysisRound,
    contractRound: args.isContractRound,
  });
  try {
    await model.chat({
      source: 'code-agent.change-plan',
      isolateCallbacks: true,
      messages: [
        {
          role: 'user',
          content: buildChangePlanPrompt({
            requirement: args.requirement,
            targetPlan: args.targetPlan,
            openTodos: args.openTodos,
            tasks: args.tasks,
            existingHooks: args.existingHooks,
            contracts: args.contracts,
            analysis: args.analysis,
            manualText: args.manualText,
            chapterCatalog: args.chapterCatalog,
            isAnalysisRound: args.isAnalysisRound,
            isContractRound: args.isContractRound,
          }),
        },
      ],
      tools: args.tools,
      // 一轮可能 upsert 很多文件, 给足输出预算避免 max_tokens 截断成空
      params: { temperature: 0, maxTokens: CHANGE_PLAN_LIMITS.maxTokens },
    });
  } catch (error) {
    args.graphLog.warn('round:error', 'change-plan round errored', {
      round: args.round,
      error: asErrorMessage(error),
    });
  }
}

// NOTE: applyTurn / runSearchRequests / runFileReads were removed in the tool-calling refactor —
// their logic now lives as tool funcs (upsert_task / update_todo / grep / search_files /
// search_hooks) inside buildChangePlanTools above. No big-JSON turn is parsed anymore.

/**
 * Coerce unknown hook data into a record for field reads.
 * @keyword-cn 记录转换, 类型守卫
 * @keyword-en as-record, type-guard
 */
function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Normalize an unknown error into a message string.
 * @keyword-cn 错误消息, 归一化
 * @keyword-en error-message, normalize
 */
function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const cyclic = tasks.map((task) => task.taskId).filter((id) => !seen.has(id));
  return { order: [...order, ...cyclic], dangling, cyclic };
}

/**
 * 判定每个 app 目标要不要脚手架初始化 (ground-truth 查 init.lock) + 要增删哪些依赖 (LLM)。产出的每个
 * target 带 needsScaffold + deps; 只在"要脚手架 或 有依赖变更"时才入 initPlan。
 * @keyword-cn 初始化依赖判定, 初始化锁
 * @keyword-en init-deps-decision, init-lock
 */
async function decideInitTargets(args: {
  targetPlan: CodeGraphTargetRouteDecision[];
  finalTasks: CodeGraphChangeTask[];
  planId: string;
  runnerId: string;
  requirement: string;
  aiAdapter: AgentAiServer | null;
  input: CodeGenOrchestrateInput;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
  bookIds: string[];
  manualText: string;
  graphLog: CodeGraphNodeLogger;
}): Promise<CodeGraphInitTarget[]> {
  const candidates = args.targetPlan.filter((t) => t.action === 'app');
  if (candidates.length === 0 || !args.hookCaller) return [];
  const hookCaller = args.hookCaller;
  const depsByRoute = await decideDependencies({
    aiAdapter: args.aiAdapter,
    input: args.input,
    candidates,
    finalTasks: args.finalTasks,
    requirement: args.requirement,
    manualText: args.manualText,
    planId: args.planId,
    runnerId: args.runnerId,
    hookCaller,
    workflowContext: args.workflowContext,
    graphLog: args.graphLog,
  });
  const out: CodeGraphInitTarget[] = [];
  for (const target of candidates) {
    const appId = target.useTarget?.id;
    let initialized = false;
    try {
      const data = await callRunnerHookData(
        hookCaller,
        args.runnerId,
        'runner.app.codeAgentFs.checkInitLock',
        { planId: args.planId, ...(appId ? { appId } : {}) },
        args.workflowContext,
      );
      initialized =
        data !== null &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        (data as { initialized?: unknown }).initialized === true;
    } catch (error) {
      args.graphLog.warn(
        'init-decision:check',
        'checkInitLock failed; treating app as not-initialized',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
    const needsScaffold = !initialized;
    const deps = depsByRoute.get(target.routeId) ?? { add: [], remove: [] };
    const hasDeps = deps.add.length > 0 || deps.remove.length > 0;
    if (!needsScaffold && !hasDeps) continue;
    out.push({
      ...(appId ? { appId } : {}),
      appDir: deriveTargetBasePath(target),
      needsScaffold,
      ...(hasDeps ? { deps } : {}),
      ...(args.bookIds.length > 0 ? { bookIds: args.bookIds } : {}),
      reason: needsScaffold
        ? target.decision === 'create'
          ? 'new app, no init.lock'
          : 'no init.lock'
        : 'dependency change',
    });
  }
  args.graphLog.info('init-decision', 'decided project-init/deps targets', {
    count: out.length,
  });
  return out;
}

/**
 * change-plan 决定每个 app 要增删哪些 npm 依赖: 一轮 **工具循环** —— LLM 可先 read_file 现有
 * package.json / search_files 探查已装依赖, 再逐 app 调 set_deps 落决策 (保持最小)。
 * @keyword-cn 依赖判定, 依赖增删
 * @keyword-en dependency-decision, dep-add-remove
 */
async function decideDependencies(args: {
  aiAdapter: AgentAiServer | null;
  input: CodeGenOrchestrateInput;
  candidates: CodeGraphTargetRouteDecision[];
  finalTasks: CodeGraphChangeTask[];
  requirement: string;
  manualText: string;
  planId: string;
  runnerId: string;
  hookCaller: HookCaller;
  workflowContext: WorkflowContext | null;
  graphLog: CodeGraphNodeLogger;
}): Promise<Map<string, { add: string[]; remove: string[] }>> {
  const map = new Map<string, { add: string[]; remove: string[] }>();
  if (!args.aiAdapter) return map;
  const validRouteIds = new Set(args.candidates.map((c) => c.routeId));
  const call = (hook: string, payload: unknown) =>
    callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      hook,
      payload,
      args.workflowContext,
    );
  const tools = [
    tool(
      async (input: { path: string }) => {
        try {
          const data = await call('runner.app.codeAgentFs.readFile', {
            planId: args.planId,
            path: input.path,
          });
          const content = readStringField(asPlainRecord(data), 'content');
          if (!content) return '(empty or missing)';
          // 依赖判定只需看 package.json / 少量清单, 8000 足够, 超出给头部即可
          return content.length <= 8000 ? content : content.slice(0, 8000);
        } catch (error) {
          return `read_file error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'read_file',
        description:
          'Read an EXISTING file (e.g. an app’s current package.json) to see what is ALREADY installed before deciding add/remove. New apps have no files yet.',
        schema: z.object({ path: z.string() }),
      },
    ),
    tool(
      async (input: { query: string }) => {
        try {
          const data = await call('runner.app.codeAgentFs.fastSearch', {
            planId: args.planId,
            query: input.query,
          });
          return JSON.stringify(data).slice(0, 3000);
        } catch (error) {
          return `search_files error: ${asErrorMessage(error)}`;
        }
      },
      {
        name: 'search_files',
        description:
          'Filename-substring search within this plan — e.g. locate a package.json / config to read before deciding deps.',
        schema: z.object({ query: z.string() }),
      },
    ),
    tool(
      (input: { routeId: string; add?: string[]; remove?: string[] }) => {
        if (!validRouteIds.has(input.routeId)) {
          return `unknown routeId "${input.routeId}"; valid: ${[...validRouteIds].join(', ')}`;
        }
        map.set(input.routeId, {
          add: dedupePackages(input.add ?? []),
          remove: dedupePackages(input.remove ?? []),
        });
        return `deps for "${input.routeId}" set (add ${input.add?.length ?? 0}, remove ${input.remove?.length ?? 0})`;
      },
      {
        name: 'set_deps',
        description:
          'Record the FINAL npm dependency decision for ONE app (call once per app). `add` = real npm packages the planned files actually import and the scaffold does NOT already provide; `remove` = packages to drop (only ones you CONFIRMED are installed via read_file). Keep it MINIMAL — many simple sites need no extra deps: call set_deps with empty arrays. Re-call to correct.',
        schema: z.object({
          routeId: z.string(),
          add: z.array(z.string()).optional(),
          remove: z.array(z.string()).optional(),
        }),
      },
    ),
  ];
  try {
    const model = selectLogicModel(args.aiAdapter, args.input);
    await model.chat({
      source: 'code-agent.change-plan.deps',
      isolateCallbacks: true,
      messages: [
        {
          role: 'user',
          content: buildDepsPrompt(
            args.candidates,
            args.finalTasks,
            args.requirement,
            args.manualText,
          ),
        },
      ],
      tools,
      params: { temperature: 0, maxTokens: 4000 },
    });
    args.graphLog.info('deps', 'decided app dependencies', {
      apps: map.size,
    });
  } catch (error) {
    args.graphLog.warn('deps:fail', 'dependency decision failed; no changes', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return map;
}

/**
 * Build the strict-JSON prompt that decides each app's npm dependency add/remove set.
 * @keyword-cn 依赖判定提示, JSON输出
 * @keyword-en deps-prompt, json-output
 */
function buildDepsPrompt(
  candidates: CodeGraphTargetRouteDecision[],
  finalTasks: CodeGraphChangeTask[],
  requirement: string,
  manualText: string,
): string {
  const byRoute = new Map<string, Array<{ path: string; summary?: string }>>();
  for (const task of finalTasks) {
    if (!task.routeId) continue;
    const arr = byRoute.get(task.routeId) ?? [];
    arr.push({
      path: task.path,
      ...(task.summary ? { summary: task.summary } : {}),
    });
    byRoute.set(task.routeId, arr);
  }
  const targets = candidates.map((target) => ({
    routeId: target.routeId,
    name: target.useTarget?.name || target.newTarget?.name || target.routeId,
    summary: target.summary,
    files: (byRoute.get(target.routeId) ?? []).slice(0, 40),
  }));
  return [
    'You decide the npm dependencies each app needs, by CALLING TOOLS (do NOT return JSON).',
    'Tools: read_file (read an existing package.json to see what is ALREADY installed), search_files (locate a package.json/config), set_deps({routeId, add, remove}) to record the decision for ONE app.',
    'Process: for EACH app below — if it already exists on disk, first read_file its package.json to know its current deps (so you only "remove" things truly installed and only "add" things missing); a brand-new app has no files yet, judge purely from its planned files. Then call set_deps ONCE for that app.',
    '"add" = real npm package names the planned files actually import/use and the archetype scaffold does NOT already provide (e.g. never re-add astro itself); "remove" = packages to drop. Keep it MINIMAL — many simple sites need no extra deps: call set_deps with empty add/remove. Use only real, existing package names — no versions, no invented scoped names.',
    'Call set_deps for every app, then stop.',
    '',
    `Requirement:\n${requirement}`,
    '',
    `Apps and their planned files:\n${JSON.stringify(targets, null, 2)}`,
    manualText.trim()
      ? `\nDevelopment manual (archetype/stack):\n${manualText.slice(0, 2000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Dedupe + trim npm package names.
 * @keyword-cn 包名去重, 依赖归一
 * @keyword-en dedupe-packages, dep-normalize
 */
function dedupePackages(packages: string[]): string[] {
  return [...new Set(packages.map((p) => p.trim()).filter(Boolean))];
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
 * Build the focused prompt for the code-forced contract-review round: files are already planned; the
 * LLM's ONLY job is to find cross-file shared symbols and declare_contract for each coupling.
 * @keyword-cn 契约复盘提示, 联动契约
 * @keyword-en contract-review-prompt, coupling-contract
 */
function buildContractReviewPrompt(args: {
  requirement: string;
  tasks: CodeGraphChangeTask[];
  contracts: CodeGraphContract[];
}): string {
  const fileBrief = args.tasks.map((task) => ({
    taskId: task.taskId,
    action: task.action,
    path: task.path,
    summary: task.summary,
  }));
  return [
    'CONTRACT-REVIEW STEP. All files for this plan are ALREADY planned (listed below). Do NOT plan, add, or change files here — your ONE job is to declare cross-file coupling contracts, then stop.',
    'These files will be generated CONCURRENTLY and BLINDLY: each generator sees only its own file plus the contracts you declare. So any symbol that MUST match across files WILL DRIFT unless you pin it in a contract now.',
    'Review the file list for shared symbols that multiple files must AGREE on, e.g.:',
    ' · anchor ids — a nav/header links `href="#x"`, a section/component renders `id="x"`, a client script queries `#x`; ALL must share the SAME id set (the most common drift).',
    ' · shared class / data-attribute / CSS custom-property names one file uses and another styles or queries.',
    ' · event names / custom-event detail shapes one file dispatches and another listens for.',
    ' · a shared data / payload / props shape, config keys, route paths, storage keys.',
    'For EACH coupling, call declare_contract({ contractId, name, description }):',
    ' · description = a PLAIN-TEXT agreement with the concrete names/ids/shapes inline (NO JSON). e.g. "锚点 id: nav 链接 #about #ai #apollo, 各 Section 用同名 id, 客户端脚本 querySelector 这些 id" / "Hero.astro 导出 Hero, props {title, subtitle}; index.astro 按此 import 传参".',
    ' · No taskIds needed — EVERY generate-file node reads the WHOLE contract array by default. Use remove_contract to drop a stale one.',
    'Declare one contract per distinct coupling. Only if you are certain there is genuinely NO cross-file shared symbol, declare nothing. When done, stop calling tools.',
    args.contracts.length > 0
      ? `Contracts already declared (refine / remove / add):\n${args.contracts
          .map(
            (c) =>
              `- ${c.contractId}${c.name ? ` (${c.name})` : ''}: ${c.description ?? c.spec ?? ''}`,
          )
          .join('\n')}`
      : '',
    '',
    `Requirement (context):\n${args.requirement}`,
    '',
    `All planned files:\n${JSON.stringify(fileBrief, null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Build the tool-calling prompt for one change-plan round: the LLM CONSTRUCTS the change set by
 * CALLING TOOLS (upsert_task / update_todo / grep / search_files / search_hooks /
 * get_hook_info / declare_contract / remove_contract / set_notice) — no JSON is returned or parsed.
 * @keyword-cn 变更集提示, 工具调用
 * @keyword-en change-plan-prompt, tool-calling
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
  contracts: CodeGraphContract[];
  analysis?: Map<string, AnalysisFinding[]>;
  manualText: string;
  chapterCatalog?: Array<{ id: string; title: string }>;
  isAnalysisRound?: boolean;
  isContractRound: boolean;
}): string {
  // 契约复盘门那一轮: 文件已规划完, 这一轮 LLM 的唯一任务是找联动、声明契约 (聚焦, 不跟文件规划抢注意力)
  if (args.isContractRound) return buildContractReviewPrompt(args);
  // 分析闸门那一轮: 既有目标只做"分析需求+分析代码", 用检索工具定位既有文件, record_analysis, 不规划文件
  if (args.isAnalysisRound) return buildAnalysisPrompt(args);
  const hasExisting = args.targetPlan.some(isModifiableTarget);
  const targetBrief = args.targetPlan.map((target) => ({
    routeId: target.routeId,
    action: target.action,
    decision: target.decision,
    // existing:true = 既有已初始化目标 (二次修改可 op:modify); false = 新建 (create-only)
    existing: isModifiableTarget(target),
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
  const contractBrief = args.contracts.map((contract) => ({
    contractId: contract.contractId,
    name: contract.name,
    taskIds: contract.taskIds,
  }));
  const analysisBrief = [...(args.analysis?.entries() ?? [])].map(
    ([routeId, findings]) => ({ routeId, findings }),
  );
  return [
    'You are the change-plan node for code-agent. You CONSTRUCT the change set by CALLING TOOLS — do NOT print JSON or prose describing the plan; every action is a tool call.',
    hasExisting
      ? 'Goal: for each target across the routePlan, plan the change set. NEW targets (existing:false) are create-only — every file op="create". EXISTING targets (existing:true) already have files on disk: plan op="modify" for files that must change and op="create" only for genuinely new files. You do NOT write code / function bodies here — only WHICH files (and, for units, which hooks).'
      : 'Goal: plan WHICH new files to create for each target across the whole routePlan. CREATE-ONLY: every file is op="create"; never plan modify or delete. You do NOT write code / function bodies here — only WHICH files (and, for units, which hooks).',
    '',
    'Tools: upsert_task (plan one file), update_todo (close a plan-target when its files are planned), grep / search_files (find text/filenames in EXISTING files), read_tags / search_by_tag (declared-keyword reverse-lookup: locate existing files to reuse or modify — read_tags for a target first, then search_by_tag with a DECLARED tag), search_hooks / get_hook_info (find existing runner hooks for unit edges), declare_contract / remove_contract (maintain the shared cross-file contract list), set_notice (one short user notice).',
    'LOCATING CODE (do it FAST): you only LOCATE which files change and capture the thinking-chain — you do NOT read file bodies here. To find WHICH existing file changes, use search_by_tag (by @keyword tag — fastest, most precise) or search_files (by filename) FIRST; fall back to grep only as a regex-content search when those do not pinpoint it. Put the exact edit intent into the task summary; generate-file re-searches and reads the file itself when it produces that one file.',
    '',
    'You are driven by the OPEN TODOS below. Work them each round:',
    '- plan-target (NEW target, existing:false): call upsert_task (op="create") for EVERY file that target needs (for action="unit", include its hooks), then call update_todo({todoId, status:"done"}).',
    hasExisting
      ? '- plan-target (EXISTING target, existing:true) — 二次修改: the app ALREADY has files. Do NOT recreate it. FIRST inspect: read_tags({routeId}) for its declared keywords, then search_by_tag({tag, routeId}) with a DECLARED tag (and/or search_files) to find the exact files the requirement touches. THEN upsert_task op="modify" (with the file\'s REAL existing path) for each file that must change, and op="create" only for genuinely new files. Plan ONLY the files that actually change — do NOT re-plan unchanged files. Close the plan-target todo when the needed changes are planned.'
      : '',
    '- resolve-edge (units only): a hook references another hook not defined here nor found existing. Resolve by upsert_task-ing a file that defines it, or search_hooks to ground it on an existing hook. Do NOT close it yourself — the system re-derives and closes it.',
    'Only close plan-target todos. The system owns resolve-edge / fix-validation status (re-derived from real edges each round).',
    '',
    'CRITICAL — plan by each target\'s "action" (shown below):',
    '- action="app" (frontend page / UI / static site): FILES ONLY. A plain page has NO hooks — do NOT invent hooks/edges; its internal JS functions are not hooks. Follow the manual archetype: normally MULTIPLE files (layout / page / component / style), never one inline index.html.',
    '- action="data-point" (data schema / collection / storage): FILES ONLY (the schema/data file). No hooks, no edges.',
    '- action="unit" (backend capability via the HookBus): files AND the hooks each file declares. ONLY here build the hook action tree: each hook = { name (real runner.<app>.<module>.<action>), summary, signature, calls[], compatibleWith[] }. Edges (calls/compatibleWith) connect hooks; the ONLY action that produces hooks/edges.',
    '',
    'upsert_task fields: { taskId, routeId (ALWAYS — which target this file belongs to), action, path, summary, hooks? (unit only), dependsOn?, chapters? }. Reuse the same taskId to refine a file.',
    (args.chapterCatalog?.length ?? 0) > 0
      ? `chapters: for EACH file, set "chapters" to the ids of ONLY the manual chapters that file's generator actually needs to write it well (e.g. a page component needs the frontend archetype chapter, not the change-plan planning chapter). Pick the few relevant ones, not all — this keeps each generator's context focused. Available chapters:\n${JSON.stringify(
          args.chapterCatalog,
          null,
          2,
        )}`
      : '',
    'Paths: each target shows a "basePath" (its location under the runner workspace, e.g. solutions/<sol>/apps/<app>). Give "path" as the file location INSIDE that target (e.g. "src/pages/index.astro", "assets/app.js"); the system roots it under basePath. Never use "../" or absolute paths.',
    'Dependencies & order (ALL actions): give each task a coarse "dependsOn": string[] = taskIds of OTHER tasks IN THIS PLAN this file directly composes or uses (a page dependsOn its layout + the section components + its stylesheet; a component dependsOn the shared stylesheet it needs). TASK-LEVEL sibling taskIds only — NOT import paths, file names, or hook edges (hook wiring stays in calls/compatibleWith). Leaf files (a stylesheet, a standalone script) usually have empty dependsOn. Only reference taskIds that exist here; keep it acyclic — the system derives the generation order (leaves first) from dependsOn.',
    'Unit edges & existing hooks: a hook may list calls[] (hooks it invokes) and compatibleWith[] (hooks whose shape it must align with), targeting other NEW hooks in this plan (preferred) or EXISTING hooks. To reference an existing hook, confirm it via search_hooks first; under create-only the NEW side adapts to it.',
    'Coupling contracts (联动开发): when several files must AGREE on shared symbols to interoperate — anchor ids, shared class/symbol names, event names, config keys, or a shared data/payload shape — call declare_contract({ contractId, name, description, spec (the AGREED concrete values/names/shape, written semantically), taskIds (ALL files party to it) }). Each listed task is injected this contract when it is generated, so their cross-file wiring lines up (e.g. the nav links and the section ids share ONE anchor contract, so anchors never drift). Declare a contract for ANY such coupling, not just anchors.',
    'set_notice: optional, at most once — a short user-facing line in the SAME natural language as the requirement, plain words, no ids/JSON/field names.',
    'When every open todo you can act on is handled (files upserted + plan-targets closed), STOP calling tools.',
    buildManualPromptSection(args.manualText),
    '',
    `Full requirement:\n${args.requirement}`,
    '',
    `Targets (routePlan resolved):\n${JSON.stringify(targetBrief, null, 2)}`,
    analysisBrief.length > 0
      ? `\nYour analysis of existing targets (GROUND your op:modify tasks in these — use these located file paths):\n${JSON.stringify(
          analysisBrief,
          null,
          2,
        )}`
      : '',
    '',
    `Open todos (work these):\n${JSON.stringify(args.openTodos, null, 2)}`,
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
    `Contracts declared so far:\n${JSON.stringify(contractBrief, null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The analysis-gate round prompt: for EXISTING (二次修改) targets the LLM must ANALYZE the requirement
 * and the real code (via the search tools) and record_analysis — NOT plan files yet. This makes the tag
 * search load-bearing so op:modify planning is grounded in located files, not guessed.
 * @keyword-cn 分析闸门提示, 需求代码分析
 * @keyword-en analysis-prompt, requirement-code-analysis
 */
function buildAnalysisPrompt(args: {
  requirement: string;
  targetPlan: CodeGraphTargetRouteDecision[];
  openTodos: Array<{ todoId: string; type?: string; title?: string }>;
  manualText?: string;
}): string {
  const routeIds = new Set(
    args.openTodos
      .filter((todo) => todo.type === 'analyze-target')
      .map((todo) => todo.todoId.slice('analyze-target:'.length)),
  );
  const targets = args.targetPlan
    .filter((target) => routeIds.has(target.routeId))
    .map((target) => ({
      routeId: target.routeId,
      action: target.action,
      target: target.useTarget?.name || target.routeId,
      basePath: deriveTargetBasePath(target),
      summary: target.summary,
    }));
  // 选中的手册 (前端 Astro 多模块约定等) 必须投给分析轮的 LLM —— 本轮已就地规划文件, 没约定就退化成单个 index.html。
  const manual = (args.manualText ?? '').trim();
  return [
    'LOCATE + PLAN STEP (二次修改, 轻量一轮). The target(s) below ALREADY EXIST with real code. Your job here is LIGHT: LOCATE which files are likely affected and PLAN them with a thinking hint. You do NOT deep-read files, trace exact dependencies, or resolve the precise code changes — generate-file does its own fast search and figures out the specifics per file, and each generate-file writes its ONE file only.',
    manual
      ? `PROJECT MANUAL — follow these framework/module conventions when you plan files (e.g. front-end = Astro, split into src/pages + src/components + src/layouts + src/styles + src/scripts, one component per file — do NOT plan a single index.html):\n${manual}\n`
      : '',
    'For EACH target under review:',
    '1. Break the requirement into concrete CHANGE-INTENTS — what behavior / UI / capability must change or be added.',
    '2. LOCATE the likely-affected files (LIGHT + fast): read_tags({routeId}) then search_by_tag({tag, routeId}) with a DECLARED tag, and/or search_files (by filename). Locating the file(s) is ENOUGH — do NOT read full file contents here; generate-file will search + read the specifics itself when it writes. Do not invent paths.',
    '3. Call record_analysis({ routeId, findings: [{ intent, files: [located paths], note }] }) — note = a short THINKING-CHAIN / likely issue for each intent (what to change, what to watch for), NOT the exact code.',
    '4. PLAN in this SAME step: upsert_task op="modify" for each located file (REAL existing path), op="create" only for genuinely new files (split per the manual\'s module conventions). Put the intent + thinking-chain in the task SUMMARY so generate-file knows WHAT to change and WHAT to watch for — generate-file resolves the exact edit itself.',
    'Keep it LIGHT: locate the files + give a thinking hint, do NOT solve the change here. But do a real tag/file search to locate — do not guess paths.',
    '',
    `Requirement:\n${args.requirement}`,
    '',
    `Existing targets to locate + plan:\n${JSON.stringify(targets, null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n');
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
  // targetId/solutionId 是 code 权威 (由 routeId→ctx 定, 复用目标即 useTarget.id): 优先 ctx, 别让 LLM 用
  // 自填的 app 名覆盖 —— 否则 task.targetId=名字 与 initPlan.appId=完整id 对不上, project-init 的 resolveAppDir 找不到 app 目录而挂。
  const targetId = ctx?.targetId || task.targetId?.trim();
  const solutionId = ctx?.solutionId || task.solutionId?.trim();
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
    op: task.op === 'modify' ? 'modify' : 'create',
    path,
    ...(task.summary ? { summary: task.summary } : {}),
    hooks,
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    ...(task.chapters && task.chapters.length > 0
      ? {
          chapters: [
            ...new Set(task.chapters.map((c) => c.trim()).filter(Boolean)),
          ],
        }
      : {}),
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
