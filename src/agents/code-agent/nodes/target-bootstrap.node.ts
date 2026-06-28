import { Logger } from '@nestjs/common';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readStringField } from './dependency-check-context';
import {
  parseJsonObjectLoose,
  selectLogicModel,
} from './dependency-check-decision';
import { createCodeGraphNodeLogger } from './dependency-check-log';
import { callRunnerHookData } from './dependency-check-runner-hooks';
import type {
  CodeGenOrchestrateInput,
  CodeGraphBootstrapEntry,
  CodeGraphBootstrapMetadata,
  CodeGraphDependencyCheckResult,
  CodeGraphNewSolutionOption,
  CodeGraphNodeLogger,
  CodeGraphRequest,
  CodeGraphTargetBootstrapResult,
  CodeGraphTargetRouteDecision,
  HookCaller,
  RunnerSolutionSummary,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentTargetBootstrap');

const LlmBootstrapMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  summary: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string().min(1)).min(1).max(8),
});

const LlmBootstrapAppSchema = LlmBootstrapMetadataSchema.extend({
  routeId: z.string().min(1),
});

const LlmBootstrapPlanSchema = z.object({
  solution: LlmBootstrapMetadataSchema.nullable().optional(),
  apps: z.array(LlmBootstrapAppSchema).optional(),
  reason: z.string().optional(),
});

type LlmBootstrapMetadata = z.infer<typeof LlmBootstrapMetadataSchema>;
type LlmBootstrapPlan = z.infer<typeof LlmBootstrapPlanSchema>;
type LlmBootstrapApp = z.infer<typeof LlmBootstrapAppSchema>;

type BootstrapRequests = {
  newSolution: CodeGraphNewSolutionOption | null;
  appTargets: CodeGraphTargetRouteDecision[];
};

/**
 * Ensure initial Solution/App metadata after target-resolution create decisions.
 * @keyword-cn 初始创建, 代码Graph节点
 * @keyword-en target-bootstrap, code-graph-node
 */
export async function runTargetBootstrapNode(args: {
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  dependencyCheck: CodeGraphDependencyCheckResult;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphDependencyCheckResult> {
  const graphLog = createCodeGraphNodeLogger(
    'target-bootstrap',
    args.dependencyCheck.context,
  );
  if (args.dependencyCheck.status !== 'ready') {
    graphLog.info(
      'skip',
      'target-bootstrap skipped because dependency-check is not ready',
      { status: args.dependencyCheck.status },
    );
    return withTargetBootstrapResult(
      args.dependencyCheck,
      buildSkippedTargetBootstrap(
        args.dependencyCheck,
        graphLog,
        'dependency-check is not ready',
      ),
      graphLog.entries,
    );
  }
  if (args.dependencyCheck.targetResolution?.status !== 'ready') {
    graphLog.info(
      'skip',
      'target-bootstrap skipped because target-resolution is not ready',
      { targetResolutionStatus: args.dependencyCheck.targetResolution?.status },
    );
    return withTargetBootstrapResult(
      args.dependencyCheck,
      buildSkippedTargetBootstrap(
        args.dependencyCheck,
        graphLog,
        'target-resolution is not ready',
      ),
      graphLog.entries,
    );
  }
  const requests = buildBootstrapRequests(args.dependencyCheck);
  if (!requests.newSolution && requests.appTargets.length === 0) {
    graphLog.info('skip', 'target-bootstrap found no Solution/App creates');
    return withTargetBootstrapResult(
      args.dependencyCheck,
      buildSkippedTargetBootstrap(
        args.dependencyCheck,
        graphLog,
        'no Solution/App metadata needs initial creation',
      ),
      graphLog.entries,
    );
  }
  if (!args.hookCaller) {
    return withTargetBootstrapResult(
      args.dependencyCheck,
      buildBlockedTargetBootstrap(
        args.dependencyCheck,
        graphLog,
        'Hook caller is not injected.',
      ),
      graphLog.entries,
    );
  }
  if (!args.aiAdapter) {
    return withTargetBootstrapResult(
      args.dependencyCheck,
      buildBlockedTargetBootstrap(
        args.dependencyCheck,
        graphLog,
        'Agent AI adapter is not injected.',
      ),
      graphLog.entries,
    );
  }

  try {
    graphLog.info('start', 'target-bootstrap node started', {
      newSolution: requests.newSolution?.name ?? null,
      appCreates: requests.appTargets.length,
    });
    const plan = await generateBootstrapMetadata({
      aiAdapter: args.aiAdapter,
      input: args.input,
      request: args.request,
      bootstrapRequests: requests,
      graphLog,
    });
    const entries = await ensureBootstrapTargets({
      hookCaller: args.hookCaller,
      runnerId: args.request.runner_id,
      workflowContext: args.workflowContext,
      sessionId:
        args.request.context.session_id ?? args.workflowContext?.sessionId,
      dependencyCheck: args.dependencyCheck,
      bootstrapRequests: requests,
      plan,
      graphLog,
    });
    const result: CodeGraphTargetBootstrapResult = {
      status: 'ready',
      node: 'target-bootstrap',
      entries,
      errors: [],
      log: graphLog.entries,
    };
    graphLog.info('complete', 'target-bootstrap completed', {
      entries: entries.map((entry) => ({
        kind: entry.kind,
        routeId: entry.routeId,
        solutionName: entry.solutionName,
        appName: entry.appName,
      })),
    });
    return withTargetBootstrapResult(
      args.dependencyCheck,
      result,
      graphLog.entries,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`target-bootstrap blocked: ${reason}`);
    graphLog.error('fail', 'target-bootstrap failed', { error: reason });
    return withTargetBootstrapResult(
      args.dependencyCheck,
      buildBlockedTargetBootstrap(args.dependencyCheck, graphLog, reason),
      graphLog.entries,
    );
  }
}

/**
 * Build the set of Solution/App metadata objects that need initial creation.
 * @keyword-cn 初始创建, 目标新建
 * @keyword-en target-bootstrap, target-create
 */
function buildBootstrapRequests(
  dependencyCheck: CodeGraphDependencyCheckResult,
): BootstrapRequests {
  const targetPlan = dependencyCheck.context.targetPlan ?? [];
  return {
    newSolution: readNewSolutionOption(dependencyCheck),
    appTargets: targetPlan.filter(
      (target) => target.action === 'app' && target.decision === 'create',
    ),
  };
}

/**
 * Read the selected new Solution option from dependency-check or targetPlan.
 * @keyword-cn 初始创建, 新Solution选项
 * @keyword-en target-bootstrap, new-solution-option
 */
function readNewSolutionOption(
  dependencyCheck: CodeGraphDependencyCheckResult,
): CodeGraphNewSolutionOption | null {
  const selected = dependencyCheck.context.selectedSolution;
  if (isNewSolutionOption(selected)) return selected;
  if (
    dependencyCheck.decision.requiresNewSolution &&
    dependencyCheck.decision.newSolutionOption
  ) {
    return dependencyCheck.decision.newSolutionOption;
  }
  return (
    (dependencyCheck.context.targetPlan ?? [])
      .map((target) => target.solution)
      .find(isNewSolutionOption) ?? null
  );
}

/**
 * Check whether a selected solution object is the new Solution sentinel.
 * @keyword-cn 新Solution选项, 类型守卫
 * @keyword-en new-solution-option, type-guard
 */
function isNewSolutionOption(
  value: unknown,
): value is CodeGraphNewSolutionOption {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).kind === 'new-solution',
  );
}

/**
 * Generate concise bootstrap metadata with the logic model.
 * @keyword-cn 元数据生成, 初始创建
 * @keyword-en metadata-generation, target-bootstrap
 */
async function generateBootstrapMetadata(args: {
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
  request: CodeGraphRequest;
  bootstrapRequests: BootstrapRequests;
  graphLog: CodeGraphNodeLogger;
}): Promise<LlmBootstrapPlan> {
  const model = selectLogicModel(args.aiAdapter, args.input);
  args.graphLog.info(
    'metadata:llm:start',
    'calling logic model for bootstrap metadata',
  );
  const response = await model.chat({
    source: 'code-agent.target-bootstrap',
    // 后台 graph 任务 :: 隔离主对话已关闭的流式 callbacks (见 dependency-check 同理)。
    isolateCallbacks: true,
    messages: [
      {
        role: 'user',
        content: buildBootstrapMetadataPrompt(
          args.request.full_requirement,
          args.bootstrapRequests,
        ),
      },
    ],
    params: { temperature: 0, responseFormat: { type: 'json_object' } },
  });
  const parsed = LlmBootstrapPlanSchema.parse(
    parseJsonObjectLoose(response.content),
  );
  args.graphLog.info(
    'metadata:llm:done',
    'logic model returned bootstrap metadata JSON',
  );
  return parsed;
}

/**
 * Build the strict JSON prompt for short Solution/App metadata generation.
 * @keyword-cn 元数据生成, JSON输出
 * @keyword-en metadata-generation, json-output
 */
function buildBootstrapMetadataPrompt(
  requirement: string,
  requests: BootstrapRequests,
): string {
  const appBrief = requests.appTargets.map((target) => ({
    routeId: target.routeId,
    action: target.action,
    requirement: target.requirement,
    newTarget: target.newTarget,
    solution:
      target.solution && isNewSolutionOption(target.solution)
        ? {
            kind: 'new-solution',
            name: target.solution.name,
            summary: target.solution.summary,
          }
        : target.solution
          ? {
              kind: 'existing',
              solutionId: target.solution.solutionId,
              name: target.solution.name,
              summary: target.solution.summary,
            }
          : null,
  }));
  return [
    'You are preparing initial metadata for code-agent. Return strict JSON only, no markdown.',
    'Use the user requirement to create short names, summaries, descriptions, and tags that help later coding nodes understand the target.',
    'Only generate metadata. Do not write implementation code, file paths, HTML, CSS, or JS.',
    'Names must be concise lower-kebab-case ASCII slugs, 2-5 words, no company logo/trademark styling.',
    'Summaries must be one short sentence. Descriptions must be brief and practical. Tags must be 3-6 concise terms.',
    'Prefer the same human language as the user for summary/description/tags; keep the slug name in English lower-kebab-case.',
    'If solution is requested, include solution. If app routes are requested, include one apps[] item for each routeId.',
    'JSON shape: {"solution":{"name":"short-solution","version":"1.0.0","summary":"...","description":"...","tags":["..."]},"apps":[{"routeId":"step-1","name":"short-app","version":"1.0.0","summary":"...","description":"...","tags":["..."]}],"reason":"..."}',
    '',
    `Full user requirement:\n${requirement}`,
    '',
    `New Solution request:\n${JSON.stringify(requests.newSolution, null, 2)}`,
    '',
    `New app requests:\n${JSON.stringify(appBrief, null, 2)}`,
  ].join('\n');
}

/**
 * Ensure all requested Solution/App metadata through the Runner ensureTarget hook.
 * @keyword-cn 初始创建, RunnerHook调用
 * @keyword-en target-bootstrap, runner-hook-call
 */
async function ensureBootstrapTargets(args: {
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  sessionId?: string;
  dependencyCheck: CodeGraphDependencyCheckResult;
  bootstrapRequests: BootstrapRequests;
  plan: LlmBootstrapPlan;
  graphLog: CodeGraphNodeLogger;
}): Promise<CodeGraphBootstrapEntry[]> {
  const entries: CodeGraphBootstrapEntry[] = [];
  const solutionMetadata = args.bootstrapRequests.newSolution
    ? normalizeBootstrapMetadata(
        args.plan.solution,
        args.bootstrapRequests.newSolution.name,
      )
    : null;
  const appMetadataByRoute = new Map(
    (args.plan.apps ?? []).map((app) => [
      app.routeId,
      normalizeBootstrapMetadata(app, app.name),
    ]),
  );
  const ensuredNewSolution = new Set<string>();

  if (
    args.bootstrapRequests.newSolution &&
    args.bootstrapRequests.appTargets.length === 0
  ) {
    if (!solutionMetadata) {
      throw new Error('bootstrap metadata missing for new Solution');
    }
    const data = await callEnsureTargetHook({
      hookCaller: args.hookCaller,
      runnerId: args.runnerId,
      workflowContext: args.workflowContext,
      payload: buildEnsureTargetPayload({
        solutionMetadata,
        sessionId: args.sessionId,
      }),
    });
    entries.push(
      buildSolutionBootstrapEntry({
        metadata: solutionMetadata,
        data,
        reason: args.bootstrapRequests.newSolution.reason,
      }),
    );
    ensuredNewSolution.add(solutionMetadata.name);
  }

  for (const target of args.bootstrapRequests.appTargets) {
    const appMetadata = appMetadataByRoute.get(target.routeId);
    if (!appMetadata) {
      throw new Error(
        `bootstrap metadata missing app entry for route ${target.routeId}`,
      );
    }
    const solutionRef = resolveBootstrapSolutionRef({
      target,
      dependencyCheck: args.dependencyCheck,
      newSolutionMetadata: solutionMetadata,
    });
    // summary 回写 :: 既有 Solution 的 summary 是占位/弱文案时, 用本次生成的 app 摘要回写,
    // 让 Runner 端把占位摘要升级成真实描述 (Runner 只刷新弱摘要, 不覆盖已有真摘要)。
    const solutionMetadataForPayload =
      !solutionRef.isNew && isWeakBootstrapSummary(solutionRef.metadata.summary)
        ? {
            ...solutionRef.metadata,
            summary: appMetadata.summary,
            description: appMetadata.description ?? appMetadata.summary,
          }
        : solutionRef.metadata;
    const data = await callEnsureTargetHook({
      hookCaller: args.hookCaller,
      runnerId: args.runnerId,
      workflowContext: args.workflowContext,
      payload: buildEnsureTargetPayload({
        solutionMetadata: solutionMetadataForPayload,
        appMetadata,
        sessionId: args.sessionId,
      }),
    });
    if (
      solutionRef.isNew &&
      !ensuredNewSolution.has(solutionRef.metadata.name)
    ) {
      entries.push(
        buildSolutionBootstrapEntry({
          metadata: solutionRef.metadata,
          data,
          reason: args.bootstrapRequests.newSolution?.reason,
        }),
      );
      ensuredNewSolution.add(solutionRef.metadata.name);
    }
    entries.push(
      buildAppBootstrapEntry({
        target,
        solutionName: solutionRef.metadata.name,
        metadata: appMetadata,
        data,
      }),
    );
  }

  args.graphLog.info('ensure:done', 'initial Solution/App metadata ensured', {
    entries: entries.map((entry) => ({
      kind: entry.kind,
      solutionName: entry.solutionName,
      appName: entry.appName,
    })),
  });
  return entries;
}

/**
 * Build the ensureTarget hook payload from generated metadata.
 * @keyword-cn 初始创建, Hook数据
 * @keyword-en target-bootstrap, hook-data
 */
function buildEnsureTargetPayload(args: {
  solutionMetadata: CodeGraphBootstrapMetadata;
  appMetadata?: CodeGraphBootstrapMetadata;
  sessionId?: string;
}) {
  return {
    solutionName: args.solutionMetadata.name,
    solutionVersion: args.solutionMetadata.version ?? '1.0.0',
    solutionSummary: args.solutionMetadata.summary,
    solutionDescription: args.solutionMetadata.description ?? '',
    ...(args.appMetadata
      ? {
          appName: args.appMetadata.name,
          appVersion: args.appMetadata.version ?? '1.0.0',
          appDescription:
            args.appMetadata.description ?? args.appMetadata.summary,
          tags: args.appMetadata.tags,
        }
      : {}),
    ...(args.sessionId ? { sessionId: args.sessionId } : {}),
  };
}

/**
 * Call the Runner ensureTarget hook and return its data payload.
 * @keyword-cn RunnerHook调用, 初始创建
 * @keyword-en runner-hook-call, target-bootstrap
 */
async function callEnsureTargetHook(args: {
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  payload: unknown;
}): Promise<unknown> {
  return callRunnerHookData(
    args.hookCaller,
    args.runnerId,
    'runner.app.solution.ensureTarget',
    args.payload,
    args.workflowContext,
  );
}

/**
 * Resolve which Solution metadata should carry an app create target.
 * @keyword-cn 初始创建, Solution选择
 * @keyword-en target-bootstrap, solution-selection
 */
function resolveBootstrapSolutionRef(args: {
  target: CodeGraphTargetRouteDecision;
  dependencyCheck: CodeGraphDependencyCheckResult;
  newSolutionMetadata: CodeGraphBootstrapMetadata | null;
}): { metadata: CodeGraphBootstrapMetadata; isNew: boolean } {
  if (isNewSolutionOption(args.target.solution)) {
    if (!args.newSolutionMetadata) {
      throw new Error('bootstrap metadata missing for new Solution');
    }
    return { metadata: args.newSolutionMetadata, isNew: true };
  }
  if (isBootstrapRunnerSolution(args.target.solution)) {
    return {
      metadata: {
        name: args.target.solution.name,
        version: args.target.solution.version ?? '1.0.0',
        summary: args.target.solution.summary,
        description: args.target.solution.description,
        tags: [],
      },
      isNew: false,
    };
  }
  const selected = args.dependencyCheck.context.selectedSolution;
  if (isBootstrapRunnerSolution(selected)) {
    return {
      metadata: {
        name: selected.name,
        version: selected.version ?? '1.0.0',
        summary: selected.summary,
        description: selected.description,
        tags: [],
      },
      isNew: false,
    };
  }
  if (!args.newSolutionMetadata) {
    throw new Error('bootstrap target has no Solution to attach to');
  }
  return { metadata: args.newSolutionMetadata, isNew: true };
}

/**
 * Detect a placeholder / weak Solution summary that should be refreshed.
 * @keyword-cn 占位摘要, 摘要回写
 * @keyword-en placeholder-summary, summary-writeback
 */
function isWeakBootstrapSummary(summary?: string): boolean {
  const value = (summary ?? '').trim();
  if (!value) return true;
  if (/^create or bind a new solution/i.test(value)) return true;
  if (/solution managed by code-agent$/i.test(value)) return true;
  return false;
}

/**
 * Check whether a solution object is an existing Runner Solution.
 * @keyword-cn Solution选择, 类型守卫
 * @keyword-en solution-selection, type-guard
 */
function isBootstrapRunnerSolution(
  value: unknown,
): value is RunnerSolutionSummary {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as RunnerSolutionSummary).solutionId === 'string' &&
    !('kind' in value),
  );
}

/**
 * Build a Solution bootstrap entry from ensureTarget data.
 * @keyword-cn 初始创建, Graph输出
 * @keyword-en target-bootstrap, graph-output
 */
function buildSolutionBootstrapEntry(args: {
  metadata: CodeGraphBootstrapMetadata;
  data: unknown;
  reason?: string;
}): CodeGraphBootstrapEntry {
  const solution = readEnsureRecord(args.data, 'solution');
  return {
    kind: 'solution',
    solutionId: readStringField(solution, 'solutionId') || undefined,
    solutionName: readStringField(solution, 'name') || args.metadata.name,
    metadata: args.metadata,
    reason: args.reason,
  };
}

/**
 * Build an app bootstrap entry from ensureTarget data.
 * @keyword-cn 初始创建, Graph输出
 * @keyword-en target-bootstrap, graph-output
 */
function buildAppBootstrapEntry(args: {
  target: CodeGraphTargetRouteDecision;
  solutionName: string;
  metadata: CodeGraphBootstrapMetadata;
  data: unknown;
}): CodeGraphBootstrapEntry {
  const app = readEnsureRecord(args.data, 'app');
  const solution = readEnsureRecord(args.data, 'solution');
  return {
    kind: 'app',
    routeId: args.target.routeId,
    action: args.target.action,
    solutionId: readStringField(solution, 'solutionId') || undefined,
    solutionName: readStringField(solution, 'name') || args.solutionName,
    appId: readStringField(app, 'appId') || undefined,
    appName: readStringField(app, 'name') || args.metadata.name,
    metadata: args.metadata,
    reason: args.target.reason,
  };
}

/**
 * Read one nested ensureTarget record from an unknown payload.
 * @keyword-cn Hook数据, 字段读取
 * @keyword-en hook-data, field-read
 */
function readEnsureRecord(
  data: unknown,
  field: 'solution' | 'app',
): Record<string, unknown> {
  return data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>)[field] &&
    typeof (data as Record<string, unknown>)[field] === 'object' &&
    !Array.isArray((data as Record<string, unknown>)[field])
    ? ((data as Record<string, unknown>)[field] as Record<string, unknown>)
    : {};
}

/**
 * Normalize LLM bootstrap metadata into concise safe fields.
 * @keyword-cn 元数据生成, 字段归一化
 * @keyword-en metadata-generation, field-normalize
 */
function normalizeBootstrapMetadata(
  raw: LlmBootstrapMetadata | LlmBootstrapApp | null | undefined,
  fallbackName: string,
): CodeGraphBootstrapMetadata {
  if (!raw) {
    throw new Error(`bootstrap metadata missing for ${fallbackName}`);
  }
  return {
    name: normalizeBootstrapName(raw.name, fallbackName),
    version: raw.version?.trim() || '1.0.0',
    summary: trimText(raw.summary, 120),
    description: raw.description ? trimText(raw.description, 240) : undefined,
    tags: normalizeBootstrapTags(raw.tags),
  };
}

/**
 * Normalize a generated name into a short lower-kebab-case slug.
 * @keyword-cn 字段归一化, 元数据生成
 * @keyword-en field-normalize, metadata-generation
 */
function normalizeBootstrapName(name: string, fallbackName: string): string {
  const normalized = slugifyName(name);
  if (normalized) return normalized;
  return slugifyName(fallbackName) || 'code-agent-target';
}

/**
 * Normalize generated tags into a compact list.
 * @keyword-cn 字段归一化, 元数据生成
 * @keyword-en field-normalize, metadata-generation
 */
function normalizeBootstrapTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const value = tag.trim().replace(/\s+/g, '-').slice(0, 32);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  if (out.length === 0) {
    throw new Error('bootstrap metadata tags must not be empty');
  }
  return out.slice(0, 6);
}

/**
 * Convert a generated name to a stable ASCII slug.
 * @keyword-cn 字段归一化, 文件路径
 * @keyword-en field-normalize, file-path
 */
function slugifyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Trim generated text to a compact single-line value.
 * @keyword-cn 字段归一化, 元数据生成
 * @keyword-en field-normalize, metadata-generation
 */
function trimText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

/**
 * Attach target-bootstrap output to the dependency-check result envelope.
 * @keyword-cn 初始创建, Graph输出
 * @keyword-en target-bootstrap, graph-output
 */
function withTargetBootstrapResult(
  dependencyCheck: CodeGraphDependencyCheckResult,
  result: CodeGraphTargetBootstrapResult,
  log: CodeGraphTargetBootstrapResult['log'],
): CodeGraphDependencyCheckResult {
  return {
    ...dependencyCheck,
    status: result.status === 'blocked' ? 'blocked' : dependencyCheck.status,
    context: {
      ...dependencyCheck.context,
      targetBootstrap: result.entries,
      code_graph_log: log,
    },
    targetBootstrap: result,
    errors:
      result.status === 'blocked'
        ? [...dependencyCheck.errors, ...result.errors]
        : dependencyCheck.errors,
    log,
  };
}

/**
 * Build a blocked target-bootstrap result.
 * @keyword-cn 初始创建, 阻塞状态
 * @keyword-en target-bootstrap, blocked-status
 */
function buildBlockedTargetBootstrap(
  dependencyCheck: CodeGraphDependencyCheckResult,
  graphLog: CodeGraphNodeLogger,
  reason: string,
): CodeGraphTargetBootstrapResult {
  graphLog.error('blocked', reason);
  return {
    status: 'blocked',
    node: 'target-bootstrap',
    entries: dependencyCheck.context.targetBootstrap ?? [],
    errors: [reason],
    log: graphLog.entries,
  };
}

/**
 * Build a skipped target-bootstrap result.
 * @keyword-cn 初始创建, Graph输出
 * @keyword-en target-bootstrap, graph-output
 */
function buildSkippedTargetBootstrap(
  dependencyCheck: CodeGraphDependencyCheckResult,
  graphLog: CodeGraphNodeLogger,
  reason: string,
): CodeGraphTargetBootstrapResult {
  return {
    status: 'skipped',
    node: 'target-bootstrap',
    entries: dependencyCheck.context.targetBootstrap ?? [],
    reason,
    errors: [],
    log: graphLog.entries,
  };
}
