import {
  CODE_AGENT_DEPENDENCY_CHOICE_COMPONENT_HOOK,
  CONVERSATION_SEND_MSG_HOOK,
} from './dependency-check.types';
import type {
  CodeGraphDependencyInterruptPayload,
  CodeGraphNodeLogger,
  CodeGraphRequest,
  CodeGraphResumeRef,
  CodeGraphRequirementRoute,
  HookCaller,
  RunnerSolutionSummary,
  WorkflowContext,
} from './dependency-check.types';
import { callRunnerHookData } from './dependency-check-runner-hooks';

/**
 * Send the dependency choice hook component as an agent message.
 * @keyword-cn 选择卡片发送, Hook组件
 * @keyword-en selection-card-send, hook-component
 */
export async function sendDependencyChoiceCard(args: {
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
 * Send a plain-text notice telling the user which Solution will carry the work
 * and whether it is reused or newly created. Failure is non-fatal (warn only).
 * @keyword-cn 复用告知, 选择卡片发送
 * @keyword-en reuse-notice, selection-card-send
 */
export async function sendDependencyNotice(args: {
  hookCaller: HookCaller;
  request: CodeGraphRequest;
  workflowContext: WorkflowContext | null;
  notice: string;
  graphLog: CodeGraphNodeLogger;
}): Promise<void> {
  const sessionId = args.request.context.session_id;
  const content = args.notice.trim();
  if (!sessionId || !content) {
    args.graphLog.warn(
      'send-notice:skip',
      'missing session_id or empty notice; skip dependency notice',
    );
    return;
  }
  try {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.request.runner_id,
      CONVERSATION_SEND_MSG_HOOK,
      [{ sessionId, content }],
      args.workflowContext,
    );
    assertForwardedSaaSHookDataOk(CONVERSATION_SEND_MSG_HOOK, data);
    args.graphLog.info('send-notice:done', 'dependency reuse notice sent', {
      sessionId,
    });
  } catch (error) {
    args.graphLog.warn(
      'send-notice:fail',
      'failed to send dependency reuse notice',
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
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
        title: '确认 Solution 与动作',
        subtitle:
          '请选择本次需求的承载位置和动作类型，确认后 code-agent 会在后台继续执行。',
        decisionNote: canCreateNew
          ? '可以复用已有 Solution，也可以为这次需求新建一个 Solution。'
          : '请确认后续要复用的 Solution 与动作。',
        solutionTitle: '承载位置',
        solutionHelp:
          'Solution 用来归档同一类产物。复用会把本次结果放到已有 Solution 下；新建会先创建新的承载容器。',
        actionTitle: '动作',
        actionHelp: '动作决定后续 graph 走 app、unit 还是 data-point 通道。',
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
        noActions: '没有可选择的动作类型',
        routePlanTitle: '需求路由',
        routePlanHelp:
          '这些需求项只确认对应的 Solution 与 action，后续节点再解析具体对象。',
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
        title: 'Confirm Solution and Action',
        subtitle:
          'Choose which Solution should carry this request and which action code-agent should continue with.',
        decisionNote: canCreateNew
          ? 'Reuse an existing Solution or create a new one for this request.'
          : 'Confirm the Solution and action before continuing.',
        solutionTitle: 'Container',
        solutionHelp:
          'A Solution groups related outputs. Reuse an existing one or create a new container for this request.',
        actionTitle: 'Action',
        actionHelp:
          'The action tells the graph which broad lane to continue with; later nodes resolve the concrete object.',
        existingSolutionBadge: 'Reuse',
        newSolutionBadge: 'New',
        existingSolutionHelp:
          'Continue under this existing Solution with the selected action.',
        newSolutionSummary: 'Create a new Solution for this request.',
        newSolutionHelp:
          'The next node will create a new Solution before continuing with the selected action.',
        newSolutionMeta: 'Create a new Solution',
        solutionIdLabel: 'id',
        includesLabel: 'Supports',
        noSolutions: 'No selectable Solutions',
        noActions: 'No selectable actions',
        routePlanTitle: 'Requirement Routes',
        routePlanHelp:
          'These requirement items only confirm Solution and action. Later nodes resolve the concrete app, unit, or data point.',
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
    useActions: args.interrupt.decision.useActions,
    routePlan: args.interrupt.decision.routePlan.map(
      toDependencyChoiceCardRoute,
    ),
    context: args.interrupt.context,
  };
}

/**
 * Project one routePlan item into the compact card payload shape.
 * @keyword-cn 璺敱璁″垝, 鍗＄墖payload
 * @keyword-en route-plan, card-payload
 */
function toDependencyChoiceCardRoute(
  route: CodeGraphRequirementRoute,
): Record<string, unknown> {
  return {
    id: route.id,
    requirement: route.requirement,
    title: route.title,
    summary: route.summary,
    waitChoose: route.waitChoose.map(toDependencyChoiceCardSolution),
    useSolution: route.useSolution
      ? toDependencyChoiceCardSolution(route.useSolution)
      : null,
    waitChooseAction: route.waitChooseAction,
    useAction: route.useAction,
    reason: route.reason,
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
