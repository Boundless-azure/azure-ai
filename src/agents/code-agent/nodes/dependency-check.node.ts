import { interrupt, isGraphInterrupt } from '@langchain/langgraph';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import type { CodeAgentTargetKind } from '../dialogues/types';
import {
  applyDependencyResumeChoice,
  buildDependencyInterruptPayload,
  buildDependencyRuntimeContext,
  decideCodeGraphDependencies,
  getDecisionActions,
  hasPendingRoutePlanSelection,
} from './dependency-check-decision';
import { createCodeGraphNodeLogger } from './dependency-check-log';
import {
  listRunnerSolutions,
  probeRunnerSolutionHooks,
} from './dependency-check-runner-hooks';
import { REQUIRED_RUNNER_SOLUTION_HOOKS } from './dependency-check.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphDependencyCheckResult,
  CodeGraphDependencyDecision,
  CodeGraphDependencyInterruptPayload,
  CodeGraphDependencyResumeChoice,
  CodeGraphRequest,
  CodeGraphRuntimeContext,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

/**
 * Execute the first code graph node: verify runner DB hooks and choose target dependencies.
 * @keyword-cn 依赖检查节点, Runner数据库
 * @keyword-en dependency-check-node, runner-db-hooks
 */
export async function runDependencyCheckNode(args: {
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
    chooseActions: [],
    routePlan: [],
    code_graph_log: graphLog.entries,
  };
  const emptyDecision: CodeGraphDependencyDecision = {
    waitChoose: [],
    useSolution: null,
    waitChooseAction: [],
    useAction: null,
    useActions: [],
    routePlan: [],
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
      useActions: getDecisionActions(decision),
      routePlan: decision.routePlan,
      waitChooseAction: decision.waitChooseAction,
      requiresNewSolution: decision.requiresNewSolution,
      newSolutionReason: decision.newSolutionReason,
      reason: decision.reason,
    });
    let context = buildDependencyRuntimeContext(decision);
    context.code_graph_log = graphLog.entries;
    let finalDecision = decision;
    const routePlanNeedsSelection = hasPendingRoutePlanSelection(decision);
    const needsSelection = routePlanNeedsSelection;

    if (needsSelection) {
      graphLog.warn(
        'pause',
        'dependency-check requires user selection before continuing',
        {
          waitChooseCount: decision.waitChoose.length,
          waitChooseAction: decision.waitChooseAction,
          routePlanNeedsSelection,
          useActions: getDecisionActions(decision),
          routePlan: decision.routePlan,
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
        chooseActions: resumeChoice.chooseActions,
        routePlan: resumeChoice.routePlan ?? resumeChoice.context?.routePlan,
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
      getDecisionActions(finalDecision).length > 0;

    if (
      hasPendingRoutePlanSelection(finalDecision) ||
      (!finalDecision.useSolution && !selectedNewSolution) ||
      getDecisionActions(finalDecision).length === 0
    ) {
      graphLog.error(
        'resume:invalid',
        'dependency-check could not resolve resumed selection',
        {
          chooseSolution: finalDecision.useSolution?.solutionId ?? null,
          chooseAction: finalDecision.useAction,
          useActions: getDecisionActions(finalDecision),
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

    const finalActions = getDecisionActions(finalDecision);
    if (finalDecision.useSolution && finalActions.length > 0) {
      graphLog.info('route:selected', 'solution/action route selected', {
        actions: finalActions,
        solutionId: finalDecision.useSolution.solutionId,
        routePlan: finalDecision.routePlan,
      });
    } else if (selectedNewSolution) {
      graphLog.info(
        'new-solution:selected',
        'dependency-check selected a new Solution option for downstream creation',
        {
          actions: finalActions,
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
