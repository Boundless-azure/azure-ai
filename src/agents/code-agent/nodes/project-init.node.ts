import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readStringField } from './dependency-check-context';
import { selectLogicModel } from './dependency-check-decision';
import { callRunnerHookData } from './dependency-check-runner-hooks';
import { loadChapters } from './change-plan-knowledge';
import type { SaasHookBusLike } from './change-plan.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphDependencyCheckResult,
  CodeGraphInitSummary,
  CodeGraphInitTarget,
  CodeGraphRequest,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentProjectInit');
const MAX_INIT_ROUNDS = 2;
const MANUAL_CAP = 8000;
// 终端命令输出小, 但给足预算避免 max_tokens 截断成空 content (per-call 覆盖模型默认 4096 兜底)
const INIT_MAX_TOKENS = 8000;

/**
 * Project-init node: for each app target change-plan judged as needing init, run an LLM terminal
 * tool-loop (run_terminal / read_file, cwd-fenced to the app dir) to scaffold + install per the manual.
 * @keyword-cn 项目初始化节点, 脚手架
 * @keyword-en project-init-node, scaffold
 */
export async function runProjectInit(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  hookBus: SaasHookBusLike | null;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphDependencyCheckResult> {
  const changePlan = args.dependencyCheck.changePlan;
  const initPlan = changePlan?.initPlan ?? [];
  if (
    !changePlan ||
    initPlan.length === 0 ||
    !args.hookCaller ||
    !args.aiAdapter
  ) {
    return args.dependencyCheck;
  }

  const manualText = await loadInitManual(
    args.hookBus,
    args.workflowContext,
    initPlan,
  );
  const targets: CodeGraphInitSummary['targets'] = [];
  for (const target of initPlan) {
    const result = await initOneTarget({
      target,
      planId: changePlan.planId,
      request: args.request,
      input: args.input,
      aiAdapter: args.aiAdapter,
      hookCaller: args.hookCaller,
      workflowContext: args.workflowContext,
      manualText,
    });
    targets.push(result);
  }

  const ok = targets.filter((t) => t.ok).length;
  const failed = targets.filter((t) => !t.ok);
  const init: CodeGraphInitSummary = {
    total: targets.length,
    ok,
    failed: failed.length,
    targets,
  };
  logger.log(
    `project-init: ${ok}/${targets.length} app(s) initialized` +
      (failed.length > 0
        ? `; failed: ${failed.map((t) => t.appDir).join(', ')}`
        : ''),
  );
  if (failed.length === 0) {
    return {
      ...args.dependencyCheck,
      changePlan: { ...changePlan, init },
    };
  }
  const reason = `project init incomplete: ${ok}/${targets.length} initialized; failed: ${failed
    .map((t) => `${t.appDir} (${t.error ?? 'unknown'})`)
    .join(', ')}`;
  return {
    ...args.dependencyCheck,
    status: 'blocked',
    changePlan: { ...changePlan, init, status: 'blocked', reason },
    errors: [...args.dependencyCheck.errors, reason],
  };
}

/**
 * Initialize one app target: bounded LLM tool-loop (terminal + read), then verify package.json landed.
 * @keyword-cn 单目标初始化, 工具循环
 * @keyword-en init-one-target, tool-loop
 */
async function initOneTarget(args: {
  target: CodeGraphInitTarget;
  planId: string;
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  aiAdapter: AgentAiServer;
  hookCaller: HookCaller;
  workflowContext: WorkflowContext | null;
  manualText: string;
}): Promise<{ appDir: string; ok: boolean; turns: number; error?: string }> {
  const { target } = args;
  const call = (hookName: string, payload: unknown): Promise<unknown> =>
    callRunnerHookData(
      args.hookCaller,
      args.request.runner_id,
      hookName,
      payload,
      args.workflowContext,
    );
  const state = { toolCalls: 0, lastError: '', scaffoldRan: false };
  const tools = buildInitTools({
    target,
    planId: args.planId,
    call,
    state,
  });
  const model = selectLogicModel(args.aiAdapter, args.input);

  let miss = '';
  for (let round = 0; round < MAX_INIT_ROUNDS; round++) {
    try {
      await model.chat({
        source: 'code-agent.project-init',
        isolateCallbacks: true,
        messages: [
          {
            role: 'user',
            content: buildInitPrompt(target, args.manualText, miss),
          },
        ],
        tools,
        params: { temperature: 0, maxTokens: INIT_MAX_TOKENS },
      });
    } catch (error) {
      logger.warn(
        `project-init ${target.appDir} round ${round} loop error: ${asMessage(error)}`,
      );
    }
    if (!target.needsScaffold) {
      // 已脚手架 (有 init.lock), 本轮只做依赖增删; LLM 跑完即认完成, 不重写 init.lock
      return { appDir: target.appDir, ok: true, turns: state.toolCalls };
    }
    const ok = await isScaffolded(args.planId, target.appDir, call);
    if (ok) {
      // 成功初始化 → 写 init.lock, 之后 change-plan 判定看这个锁跳过重复初始化
      try {
        await call('runner.app.codeAgentFs.writeInitLock', {
          planId: args.planId,
          ...(target.appId ? { appId: target.appId } : {}),
        });
      } catch (error) {
        logger.warn(
          `project-init ${target.appDir} writeInitLock failed: ${asMessage(error)}`,
        );
      }
      return { appDir: target.appDir, ok: true, turns: state.toolCalls };
    }
    miss = state.lastError
      ? `last command failed: ${state.lastError}`
      : 'package.json not found in the app dir — scaffold is incomplete';
  }
  return {
    appDir: target.appDir,
    ok: false,
    turns: state.toolCalls,
    error: miss || 'not initialized within round budget',
  };
}

/**
 * Verify the app got scaffolded: package.json exists (read via the fenced readFile hook).
 * @keyword-cn 脚手架校验, package检测
 * @keyword-en scaffold-verify, package-check
 */
async function isScaffolded(
  planId: string,
  appDir: string,
  call: (hookName: string, payload: unknown) => Promise<unknown>,
): Promise<boolean> {
  try {
    const data = await call('runner.app.codeAgentFs.readFile', {
      planId,
      path: `${appDir}/package.json`,
    });
    return Boolean(readStringField(asRecord(data), 'content').trim());
  } catch {
    return false;
  }
}

/**
 * Build the executable tools for one init target (run_terminal + read_file, bound to plan/app).
 * @keyword-cn 初始化工具, 工具绑定
 * @keyword-en init-tools, tool-binding
 */
function buildInitTools(args: {
  target: CodeGraphInitTarget;
  planId: string;
  call: (hookName: string, payload: unknown) => Promise<unknown>;
  state: { toolCalls: number; lastError: string; scaffoldRan: boolean };
}): unknown[] {
  const { target, planId, call, state } = args;
  return [
    tool(
      async ({ command }: { command: string }) => {
        state.toolCalls += 1;
        // 脚手架护栏: create* 命令必须就地 (带 `.`), 否则会在 app 目录里建随机名/嵌套子工程; 已建过就拒二次。
        const scaffold = isScaffoldCommand(command);
        if (scaffold) {
          if (!commandIsInPlace(command)) {
            state.lastError =
              'scaffold command was not in-place (missing `.` target dir)';
            return '❌ Refused — this scaffold command would create a WRONG nested folder inside the app dir. Re-run it targeting the CURRENT directory: pass `.` as the project dir, e.g. `pnpm create astro@latest . --template minimal --install --no-git --skip-houston --yes`. NEVER pass a project name or a path.';
          }
          if (state.scaffoldRan) {
            return '❌ Refused — this app was already scaffolded in this session. Do NOT scaffold again. To add/remove a package use pnpm add/remove; if a step failed, read the error and fix that specific thing.';
          }
        }
        try {
          const data = asRecord(
            await call('runner.app.codeAgentFs.runCommand', {
              planId,
              ...(target.appId ? { appId: target.appId } : {}),
              command,
            }),
          );
          const exitCode = readNumberField(data, 'exitCode');
          if (exitCode !== 0) {
            state.lastError = `exit ${exitCode}: ${readStringField(data, 'stderr').slice(0, 400)}`;
          } else if (scaffold) {
            state.scaffoldRan = true;
          }
          return JSON.stringify({
            exitCode,
            stdout: readStringField(data, 'stdout').slice(0, 4000),
            stderr: readStringField(data, 'stderr').slice(0, 2000),
            timedOut: data.timedOut === true,
          });
        } catch (error) {
          state.lastError = asMessage(error);
          return `run_terminal error: ${state.lastError}`;
        }
      },
      {
        name: 'run_terminal',
        description: `Run a shell command to initialize this app. It ALREADY runs INSIDE the app dir (${target.appDir}). Use pnpm (a shared store makes installs fast). For any scaffolder (pnpm/npm/npx create…) you MUST pass "." as the project dir so it scaffolds in place — never a name or path. Long commands (pnpm install) block until done.`,
        schema: z.object({ command: z.string() }),
      },
    ),
    tool(
      async ({ path }: { path: string }) => {
        state.toolCalls += 1;
        try {
          const data = await call('runner.app.codeAgentFs.readFile', {
            planId,
            path,
          });
          return (
            readStringField(asRecord(data), 'content').slice(0, 4000) ||
            '(empty)'
          );
        } catch (error) {
          return `read_file error: ${asMessage(error)}`;
        }
      },
      {
        name: 'read_file',
        description:
          'Read a file in this plan by path (e.g. to check package.json / astro.config).',
        schema: z.object({ path: z.string() }),
      },
    ),
  ];
}

/**
 * Whether a command invokes a project scaffolder (npm/pnpm/yarn/bun/npx create*) — these MUST be in-place.
 * @keyword-cn 脚手架命令识别, 护栏
 * @keyword-en scaffold-command-detect, guardrail
 */
function isScaffoldCommand(command: string): boolean {
  return /\b(?:npm|pnpm|yarn|bun|npx)\s+(?:create\b|create-|dlx\s+create-)/i.test(
    command,
  );
}

/**
 * Whether a command targets the CURRENT dir (a standalone `.` token) — the in-place scaffold invariant.
 * @keyword-cn 就地判定, 当前目录
 * @keyword-en in-place-check, current-dir
 */
function commandIsInPlace(command: string): boolean {
  return /(?:^|\s)\.(?:\s|$)/.test(command);
}

/**
 * Build the instruction prompt for initializing one app target (tool-driven).
 * @keyword-cn 初始化提示, 工具驱动
 * @keyword-en init-prompt, tool-driven
 */
function buildInitPrompt(
  target: CodeGraphInitTarget,
  manualText: string,
  miss: string,
): string {
  const add = target.deps?.add ?? [];
  const remove = target.deps?.remove ?? [];
  const depLines: string[] = [];
  if (add.length > 0) {
    depLines.push(
      `- ADD these packages: ${add.join(', ')} — e.g. \`pnpm add ${add.join(' ')}\`.`,
    );
  }
  if (remove.length > 0) {
    depLines.push(
      `- REMOVE these packages: ${remove.join(', ')} — e.g. \`pnpm remove ${remove.join(' ')}\`.`,
    );
  }
  return [
    miss
      ? `⚠ NOT DONE YET. ${miss}. Read the manual and re-run the commands; make sure package.json exists.`
      : '',
    'You set up ONE app project by CALLING run_terminal. Do not write source files here (that happens later); only bootstrap + manage dependencies.',
    `App dir: ${target.appDir}${target.archetype ? ` · archetype: ${target.archetype}` : ''}. run_terminal ALREADY runs inside this dir — treat it as your working directory.`,
    'CRITICAL — scaffold IN PLACE: any scaffolder (npm/npx create…) MUST receive "." as the project directory so it builds into the current dir. NEVER pass a project name or a path — that creates a wrong nested folder and will be REFUSED. Scaffold at most ONCE.',
    target.needsScaffold
      ? 'Step 1 — SCAFFOLD per the manual with pnpm (a shared store makes install fast). Run EXACTLY this (note the `.`): `pnpm create astro@latest . --template minimal --install --no-git --skip-houston --yes`. A package.json must exist at the app-dir root afterward.'
      : 'This app is ALREADY scaffolded — do NOT re-scaffold. Only apply the dependency changes below.',
    depLines.length > 0
      ? `Step 2 — DEPENDENCIES (apply exactly these; do not add extras):\n${depLines.join('\n')}`
      : target.needsScaffold
        ? ''
        : 'No dependency changes requested.',
    'When done, stop making tool calls.',
    manualText.trim()
      ? `\nDevelopment manual (AUTHORITATIVE for archetype + scaffold):\n${manualText}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Load the manual chapters for the init targets' books (union of bookIds), capped.
 * @keyword-cn 初始化手册加载, 章节
 * @keyword-en init-manual-load, chapters
 */
async function loadInitManual(
  hookBus: SaasHookBusLike | null,
  workflowContext: WorkflowContext | null,
  initPlan: CodeGraphInitTarget[],
): Promise<string> {
  const bookIds = [...new Set(initPlan.flatMap((t) => t.bookIds ?? []))];
  if (!hookBus || bookIds.length === 0) return '';
  try {
    return (await loadChapters(hookBus, workflowContext, bookIds)).slice(
      0,
      MANUAL_CAP,
    );
  } catch (error) {
    logger.warn(`project-init manual load failed: ${asMessage(error)}`);
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
