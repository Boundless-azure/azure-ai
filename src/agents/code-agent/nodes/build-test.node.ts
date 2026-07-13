import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readStringField } from './dependency-check-context';
import {
  compactRequirementForRouting,
  selectLogicModel,
} from './dependency-check-decision';
import { callRunnerHookData } from './dependency-check-runner-hooks';
import { loadChapters } from './change-plan-knowledge';
import {
  BUILD_GENERATE_LIMITS,
  type BuildFileSend,
} from './build-generate.types';
import type { SaasHookBusLike } from './change-plan.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphChangePlanResult,
  CodeGraphChangeTask,
  CodeGraphDependencyCheckResult,
  CodeGraphExtraTask,
  CodeGraphRequest,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentBuildTest');

/**
 * Build-test node: run the project's build and let an LLM JUDGE whether it is acceptable. The LLM runs
 * the build itself (run_terminal), inspects errors (read_file), and queues rework tasks into extraPlan
 * (add_repair_task). No rework tasks queued = build OK. The rework then REUSES generate-file (fix mode).
 * IMPORTANT: the "is there a problem" decision is ALWAYS the LLM's, never a raw exit-code check.
 * @keyword-cn 构建测试节点, 返修判定
 * @keyword-en build-test-node, rework-judge
 */
export async function runBuildTest(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  hookBus: SaasHookBusLike | null;
  workflowContext: WorkflowContext | null;
  round: number;
}): Promise<{
  dependencyCheck: CodeGraphDependencyCheckResult;
  buildFixFiles: BuildFileSend[];
  round: number;
}> {
  const changePlan = args.dependencyCheck.changePlan;
  const round = args.round + 1;
  if (
    !changePlan ||
    changePlan.status === 'blocked' ||
    !args.hookCaller ||
    !args.aiAdapter
  ) {
    return {
      dependencyCheck: args.dependencyCheck,
      buildFixFiles: [],
      round: args.round,
    };
  }
  // 只有 app 目标有 build 可跑 (unit/data-point 不测)
  const appTasks = changePlan.changeTasks.filter(
    (task) => (task.action ?? 'app') === 'app',
  );
  if (appTasks.length === 0) {
    return {
      dependencyCheck: args.dependencyCheck,
      buildFixFiles: [],
      round: args.round,
    };
  }
  const appIds = [
    ...new Set(
      appTasks
        .map((task) => task.targetId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const hookCaller = args.hookCaller;
  const call = (hookName: string, payload: unknown): Promise<unknown> =>
    callRunnerHookData(
      hookCaller,
      args.request.runner_id,
      hookName,
      payload,
      args.workflowContext,
    );

  const extra: CodeGraphExtraTask[] = [];
  const state = { toolCalls: 0, lastBuild: '' };
  const tools = buildBuildTestTools({
    planId: changePlan.planId,
    call,
    state,
    tasks: changePlan.changeTasks,
    extra,
  });
  // 给 build-test 参考手册 —— 章节里写明"如何验证构建"的流程 (跑什么命令、错误怎么读), 让它走最短路径、少乱探索
  const manualText = await loadManual(
    args.hookBus,
    args.workflowContext,
    changePlan.bookIds,
  );
  const model = selectLogicModel(args.aiAdapter, args.input);
  try {
    await model.chat({
      source: 'code-agent.build-test',
      isolateCallbacks: true,
      messages: [
        {
          role: 'user',
          content: buildBuildTestPrompt({
            requirement: compactRequirementForRouting(
              args.request.full_requirement,
              2000,
            ),
            tasks: appTasks,
            appIds,
            round,
            maxRounds: BUILD_GENERATE_LIMITS.maxBuildTestRounds,
            manualText,
          }),
        },
      ],
      tools,
      // build-test 输出小 (只发几个 add_repair_task), 不写文件 —— 给小预算, 别让 reasoning 模型填满 16k 想太久
      params: {
        temperature: 0,
        maxTokens: BUILD_GENERATE_LIMITS.buildTestMaxTokens,
      },
    });
  } catch (error) {
    logger.warn(`build-test round ${round} loop error: ${asMessage(error)}`);
  }

  // 按 taskId 去重 (取最后一次 issue); 没塞任何返修任务 = LLM 判构建通过
  const byTask = new Map<string, CodeGraphExtraTask>();
  for (const task of extra) byTask.set(task.taskId, task);
  const extraPlan = [...byTask.values()];
  const ok = extraPlan.length === 0;
  const willRepair = !ok && round < BUILD_GENERATE_LIMITS.maxBuildTestRounds;

  let buildFixFiles: BuildFileSend[] = [];
  if (willRepair) {
    const manualText = await loadManual(
      args.hookBus,
      args.workflowContext,
      changePlan.bookIds,
    );
    const byId = new Map(
      changePlan.changeTasks.map((task) => [task.taskId, task]),
    );
    buildFixFiles = extraPlan
      .map((item) => {
        const task = byId.get(item.taskId);
        if (!task) return null;
        return packFixSend({
          task,
          issue: item.issue,
          changePlan,
          request: args.request,
          input: args.input,
          manualText,
        });
      })
      .filter((send): send is BuildFileSend => Boolean(send));
  }

  logger.log(
    `build-test round ${round}/${BUILD_GENERATE_LIMITS.maxBuildTestRounds}: ` +
      (ok
        ? 'build OK (LLM judged)'
        : `${extraPlan.length} rework task(s)` +
          (willRepair ? ' → repairing' : ' → budget exhausted, blocking')),
  );

  const buildTest = {
    ok,
    rounds: round,
    pendingFixes: extraPlan.length,
    ...(state.lastBuild ? { summary: state.lastBuild.slice(0, 400) } : {}),
  };
  const exhaustedFail = !ok && !willRepair;
  const reason = exhaustedFail
    ? `build still failing after ${round} build-test round(s): ${extraPlan
        .map((item) => item.path)
        .join(', ')}`
    : undefined;
  const nextChangePlan: CodeGraphChangePlanResult = {
    ...changePlan,
    ...(extraPlan.length > 0 ? { extraPlan } : {}),
    buildTest,
    ...(exhaustedFail ? { status: 'blocked', reason } : {}),
  };
  const dependencyCheck: CodeGraphDependencyCheckResult = {
    ...args.dependencyCheck,
    changePlan: nextChangePlan,
    ...(exhaustedFail
      ? {
          status: 'blocked',
          errors: [...args.dependencyCheck.errors, reason ?? 'build failed'],
        }
      : {}),
  };
  return { dependencyCheck, buildFixFiles, round };
}

/**
 * Pack a fix-mode BuildFileSend for ONE rework task, reusing the same shape build-dispatch produces so
 * generate-file can process it unchanged (plus the fix.issue that puts it into FIX MODE).
 * @keyword-cn 返修载荷打包, 复用生成节点
 * @keyword-en pack-fix-send, reuse-generate
 */
function packFixSend(args: {
  task: CodeGraphChangeTask;
  issue: string;
  changePlan: CodeGraphChangePlanResult;
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  manualText: string;
}): BuildFileSend {
  const { task, changePlan } = args;
  const byId = new Map(
    changePlan.changeTasks.map((item) => [item.taskId, item]),
  );
  const contracts = (changePlan.contracts ?? [])
    .filter((contract) => contract.taskIds.includes(task.taskId))
    .map((contract) => ({
      ...(contract.name ? { name: contract.name } : {}),
      ...(contract.description ? { description: contract.description } : {}),
      ...(contract.spec !== undefined ? { spec: contract.spec } : {}),
    }));
  return {
    planId: changePlan.planId,
    runnerId: args.request.runner_id,
    sessionId: args.request.context.session_id,
    ...(task.targetId ? { appId: task.targetId } : {}),
    requirement: compactRequirementForRouting(
      args.request.full_requirement,
      2000,
    ),
    input: args.input,
    bookIds: changePlan.bookIds ?? [],
    manualText: args.manualText,
    task: {
      taskId: task.taskId,
      path: task.path,
      ...(task.action ? { action: task.action } : {}),
      ...(task.summary ? { summary: task.summary } : {}),
      hooks: task.hooks.map((hook) => hook.name),
    },
    deps: (task.dependsOn ?? []).map((id) => {
      const dep = byId.get(id);
      return {
        taskId: id,
        ...(dep?.path ? { path: dep.path } : {}),
        ...(dep?.summary ? { summary: dep.summary } : {}),
      };
    }),
    ...(contracts.length > 0 ? { contracts } : {}),
    fix: { issue: args.issue },
  };
}

/**
 * Build the executable tools for the build-test LLM loop (run the build, read source, queue rework).
 * @keyword-cn 构建测试工具, 工具绑定
 * @keyword-en build-test-tools, tool-binding
 */
function buildBuildTestTools(args: {
  planId: string;
  call: (hookName: string, payload: unknown) => Promise<unknown>;
  state: { toolCalls: number; lastBuild: string };
  tasks: CodeGraphChangeTask[];
  extra: CodeGraphExtraTask[];
}): unknown[] {
  const { planId, call, state, tasks, extra } = args;
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const byPath = new Map(tasks.map((task) => [task.path, task]));
  const resolve = (
    taskId?: string,
    path?: string,
  ): CodeGraphChangeTask | undefined =>
    (taskId ? byId.get(taskId) : undefined) ??
    (path ? byPath.get(path) : undefined) ??
    (path
      ? tasks.find((task) => task.path.endsWith(path.replace(/^\.?\/*/, '')))
      : undefined);
  return [
    tool(
      async (input: { command: string; appId?: string }) => {
        state.toolCalls += 1;
        try {
          const data = asRecord(
            await call('runner.app.codeAgentFs.runCommand', {
              planId,
              ...(input.appId ? { appId: input.appId } : {}),
              command: input.command,
              timeoutMs: 240000,
            }),
          );
          const exitCode = readNumberField(data, 'exitCode');
          const stdout = readStringField(data, 'stdout');
          const stderr = readStringField(data, 'stderr');
          state.lastBuild = `exit ${exitCode}${stderr ? `; ${stderr.slice(0, 200)}` : ''}`;
          return JSON.stringify({
            exitCode,
            stdout: stdout.slice(0, 6000),
            stderr: stderr.slice(0, 4000),
            timedOut: data.timedOut === true,
          });
        } catch (error) {
          return `run_terminal error: ${asMessage(error)}`;
        }
      },
      {
        name: 'run_terminal',
        description:
          'Run a shell command inside the app dir to TEST the build — for an Astro/pnpm app that is `pnpm build` (pass appId to target a specific app). You may also run type-checks/diagnostics. Long commands block until done.',
        schema: z.object({ command: z.string(), appId: z.string().optional() }),
      },
    ),
    tool(
      async (input: { path: string }) => {
        try {
          const data = await call('runner.app.codeAgentFs.readFile', {
            planId,
            path: input.path,
          });
          const content = readStringField(asRecord(data), 'content');
          if (!content) return '(empty or missing)';
          // 整份优先: 上限内直接全返, 超上限不静默截断, 明确告知这是大文件、只给了头部
          const READ_WHOLE_CAP = 16000;
          if (content.length <= READ_WHOLE_CAP) return content;
          return (
            `(large file: ${content.length} chars total; showing the first ${READ_WHOLE_CAP}. ` +
            `This is only the HEAD — usually the build error already names the exact file + line, so read only what you need.)\n` +
            content.slice(0, READ_WHOLE_CAP)
          );
        } catch (error) {
          return `read_file error: ${asMessage(error)}`;
        }
      },
      {
        name: 'read_file',
        description:
          'Read a source file to understand a build error before deciding a rework task. Returns the WHOLE file by default (up to a large cap); if the response says it is large/truncated, it showed only the head. Usually the build error already names the offending file + line, so you rarely need this.',
        schema: z.object({ path: z.string() }),
      },
    ),
    tool(
      (input: { taskId?: string; path?: string; issue: string }) => {
        const task = resolve(input.taskId, input.path);
        if (!task) {
          return `add_repair_task ignored: no planned file matches taskId=${input.taskId ?? '-'} path=${input.path ?? '-'}. Use one of the planned file paths.`;
        }
        extra.push({
          taskId: task.taskId,
          path: task.path,
          ...(task.targetId ? { targetId: task.targetId } : {}),
          issue: input.issue.trim(),
          origin: 'build-test',
        });
        return `rework queued for ${task.path}`;
      },
      {
        name: 'add_repair_task',
        description:
          'Queue a REWORK task for ONE planned file the build shows is broken. Give its planned path (or taskId) and a CONCRETE `issue` (the exact error + what to fix). One call per broken file. If the build is genuinely fine, do NOT call this at all — zero calls means the build is accepted.',
        schema: z.object({
          taskId: z.string().optional(),
          path: z.string().optional(),
          issue: z.string(),
        }),
      },
    ),
  ];
}

/**
 * Build the build-test instruction prompt (LLM runs the build and JUDGES; rework goes to extraPlan).
 * @keyword-cn 构建测试提示, 工具驱动
 * @keyword-en build-test-prompt, tool-driven
 */
function buildBuildTestPrompt(args: {
  requirement: string;
  tasks: CodeGraphChangeTask[];
  appIds: string[];
  round: number;
  maxRounds: number;
  manualText: string;
}): string {
  const fileList = args.tasks.map((task) => ({
    taskId: task.taskId,
    path: task.path,
    appId: task.targetId,
  }));
  return [
    'BUILD-TEST STEP. The app files are all generated. Verify the project BUILDS, and YOU judge whether it is acceptable. Follow the SHORTEST path — do not over-explore.',
    `Round ${args.round} of at most ${args.maxRounds}. Be efficient: this whole step should be a build + a look, not an investigation.`,
    'Do EXACTLY this:',
    '1. Run the build ONCE with run_terminal (Astro/pnpm app → `pnpm build`; pass appId). Do not run it repeatedly.',
    '2. Read that output. If it PASSES with no real problem → call add_repair_task ZERO times and STOP. Do NOT open files to double-check a clean build.',
    '3. ONLY if the build FAILS/shows a real problem: the error message already names the offending file + line — read_file it ONLY if you still cannot tell what to fix (usually you can from the error alone). Then call add_repair_task({ path, issue }) once per broken file with the EXACT error + what to fix.',
    'YOU are the judge — do not rely on exit code alone (a zero exit with a broken result is still a problem; some warnings are acceptable). But when the build is clean, trust it and stop — do not go hunting for issues.',
    'Only queue rework for files in the planned list below (rework reuses the file generators). When done, stop calling tools.',
    args.manualText.trim()
      ? `\nDevelopment manual (how this archetype builds + how to read its errors — follow it):\n${args.manualText}`
      : '',
    args.appIds.length > 0 ? `App ids: ${JSON.stringify(args.appIds)}` : '',
    `Requirement (what the app should be):\n${args.requirement}`,
    `Planned app files (ONLY these can be reworked):\n${JSON.stringify(
      fileList,
      null,
      2,
    )}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Load the manual chapters for the plan's books (for fix-mode generation context), capped.
 * @keyword-cn 手册加载, 章节
 * @keyword-en manual-load, chapters
 */
async function loadManual(
  hookBus: SaasHookBusLike | null,
  workflowContext: WorkflowContext | null,
  bookIds: string[] | undefined,
): Promise<string> {
  if (!hookBus || !bookIds || bookIds.length === 0) return '';
  try {
    return (await loadChapters(hookBus, workflowContext, bookIds)).slice(
      0,
      BUILD_GENERATE_LIMITS.maxManualChars,
    );
  } catch (error) {
    logger.warn(`build-test manual load failed: ${asMessage(error)}`);
    return '';
  }
}

/**
 * Coerce unknown hook data into a record for field reads.
 * @keyword-cn 记录转换, 类型守卫
 * @keyword-en as-record, type-guard
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Read a numeric field from an unknown record (default 0).
 * @keyword-cn 数值字段, 字段读取
 * @keyword-en number-field, field-read
 */
function readNumberField(
  value: Record<string, unknown>,
  field: string,
): number {
  const raw = value[field];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * Normalize an unknown error into a message string.
 * @keyword-cn 错误消息, 归一化
 * @keyword-en error-message, normalize
 */
function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
