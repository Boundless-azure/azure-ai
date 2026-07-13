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

/** Init phase: 'scaffold' creates project structure (no install); 'deps' installs node_modules. */
export type InitPhase = 'scaffold' | 'deps';
const MANUAL_CAP = 8000;
// 终端命令输出小, 但给足预算避免 max_tokens 截断成空 content (per-call 覆盖模型默认 4096 兜底)
const INIT_MAX_TOKENS = 8000;

/**
 * Project-init node (SCAFFOLD phase): for each app target change-plan judged as needing init, run an
 * LLM terminal tool-loop (run_terminal / read_file, cwd-fenced to the app dir) to create the project
 * STRUCTURE per the manual — NO dependency install (that runs in a parallel later step via runInstallDeps).
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
  phase?: InitPhase;
}): Promise<CodeGraphDependencyCheckResult> {
  const phase: InitPhase = args.phase ?? 'scaffold';
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
      phase,
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
    `project-init[${phase}]: ${ok}/${targets.length} app(s) processed` +
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
 * Install-deps node (DEPS phase): same shape as runProjectInit but runs the dependency-install loop
 * (`pnpm install` / manual's install command) into the already-scaffolded app dir. Runs in PARALLEL
 * with file generation, so the graph node ignores this return value for state (avoids racing the build
 * branch's dependencyCheck writes) — the loop's effect (node_modules on disk) is what matters downstream.
 * @keyword-cn 依赖安装节点, 并行装依赖
 * @keyword-en install-deps-node, parallel-deps
 */
export async function runInstallDeps(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  hookBus: SaasHookBusLike | null;
  workflowContext: WorkflowContext | null;
}): Promise<CodeGraphDependencyCheckResult> {
  return runProjectInit({ ...args, phase: 'deps' });
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
  phase: InitPhase;
}): Promise<{ appDir: string; ok: boolean; turns: number; error?: string }> {
  const { target, phase } = args;
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
            content: buildInitPrompt(target, args.manualText, miss, phase),
          },
        ],
        tools,
        params: { temperature: 0, maxTokens: INIT_MAX_TOKENS },
      });
    } catch (error) {
      logger.warn(
        `project-init[${phase}] ${target.appDir} round ${round} loop error: ${asMessage(error)}`,
      );
    }
    if (phase === 'deps') {
      // deps 阶段: 结构已在, 只跑安装循环 (幂等); LLM 跑完即认完成, 不校验/不写 init.lock
      return { appDir: target.appDir, ok: true, turns: state.toolCalls };
    }
    if (!target.needsScaffold) {
      // 已脚手架 (有 init.lock), scaffold 阶段无事可做; 跑完即认完成, 不重写 init.lock
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
      : 'package.json is missing OR not valid JSON — scaffold is incomplete. Do NOT hand-write it; re-run the scaffolder so it emits a real package.json.';
  }
  return {
    appDir: target.appDir,
    ok: false,
    turns: state.toolCalls,
    error: miss || 'not initialized within round budget',
  };
}

/**
 * Verify the app got scaffolded: package.json exists AND is valid JSON (read via the fenced readFile hook).
 * 光"非空"不够 —— LLM 用 echo/cat 手搓 package.json 常被逐行转义写坏 (每行成 JSON.stringify 串), 那种坏文件
 * 非空但 JSON.parse 必炸; 只有 parse 得过才算真脚手架, 否则判未完成→重试, 不写 init.lock 把坏结构锁死。
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
    const content = readStringField(asRecord(data), 'content').trim();
    if (!content) return false;
    const parsed: unknown = JSON.parse(content);
    // 合法 JSON 且是对象且带 name/scripts/dependencies 之一 (排除 `{}` 或 JSON 数组这类 parse 得过但不是真 manifest)
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed as Record<string, unknown>).length > 0
    );
  } catch {
    // readFile 失败 (不存在) 或 JSON.parse 失败 (被写坏) → 都判未完成
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
      async ({ path, content }: { path: string; content: string }) => {
        state.toolCalls += 1;
        try {
          const data = await call('runner.app.codeAgentFs.writeFile', {
            planId,
            path,
            content,
          });
          const rec = asRecord(data);
          return `written ${readStringField(rec, 'path') || path} (${readNumberField(rec, 'bytes')} bytes).`;
        } catch (error) {
          state.lastError = asMessage(error);
          return `write_file failed: ${state.lastError}`;
        }
      },
      {
        name: 'write_file',
        description:
          'Write a NON-scaffolder text file verbatim (e.g. the app-root tags.json keyword vocabulary) by supplying its path + full content. The content is written EXACTLY as given — this is the ONLY correct way to author such files. NEVER use run_terminal echo/cat/heredoc for file content (it gets mangled). Do NOT write package.json / astro.config / tsconfig here — those come from the scaffolder.',
        schema: z.object({
          path: z
            .string()
            .describe(
              'workspace-relative path, e.g. solutions/<sol>/apps/<app>/tags.json',
            ),
          content: z
            .string()
            .describe('the entire file content, written verbatim'),
        }),
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
          const content = readStringField(asRecord(data), 'content');
          if (!content) return '(empty)';
          // 整份优先: 上限内直接全返, 超上限不静默截断, 明确告知这是大文件、只给了头部
          const READ_WHOLE_CAP = 16000;
          if (content.length <= READ_WHOLE_CAP) return content;
          return (
            `(large file: ${content.length} chars total; showing the first ${READ_WHOLE_CAP}. This is only the HEAD.)\n` +
            content.slice(0, READ_WHOLE_CAP)
          );
        } catch (error) {
          return `read_file error: ${asMessage(error)}`;
        }
      },
      {
        name: 'read_file',
        description:
          'Read a file in this plan by path (e.g. to check package.json / astro.config). Returns the WHOLE file by default (up to a large cap); if the response says it is large/truncated, it showed only the head — read again for the rest.',
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
 * Build the instruction prompt for initializing one app target (tool-driven), per phase:
 * scaffold = create STRUCTURE only (NO install), deps = install node_modules into existing structure.
 * @keyword-cn 初始化提示, 工具驱动
 * @keyword-en init-prompt, tool-driven
 */
function buildInitPrompt(
  target: CodeGraphInitTarget,
  manualText: string,
  miss: string,
  phase: InitPhase,
): string {
  return phase === 'deps'
    ? buildDepsPrompt(target, manualText, miss)
    : buildScaffoldPrompt(target, manualText, miss);
}

/**
 * SCAFFOLD-phase prompt: create the project structure + tags.json vocabulary WITHOUT installing deps.
 * @keyword-cn 脚手架提示, 结构生成
 * @keyword-en scaffold-prompt, structure-only
 */
function buildScaffoldPrompt(
  target: CodeGraphInitTarget,
  manualText: string,
  miss: string,
): string {
  return [
    miss
      ? `⚠ NOT DONE YET. ${miss}. Read the manual and re-run the commands; make sure package.json exists.`
      : '',
    'You set up the STRUCTURE of ONE app project. Two tools: run_terminal (RUN commands — the scaffolder, etc.) and write_file (author a non-scaffolder text file verbatim, e.g. tags.json). Do not write source files here (that happens later); only create the framework skeleton (via the scaffolder) + the app-root tags.json keyword vocabulary (via write_file).',
    `App dir: ${target.appDir}${target.archetype ? ` · archetype: ${target.archetype}` : ''}. run_terminal ALREADY runs inside this dir — treat it as your working directory.`,
    'CRITICAL — scaffold IN PLACE: any scaffolder (npm/npx create…) MUST receive "." as the project directory so it builds into the current dir. NEVER pass a project name or a path — that creates a wrong nested folder and will be REFUSED. Scaffold at most ONCE.',
    'CRITICAL — NEVER hand-write package.json / astro.config / tsconfig by piping content through the shell (echo/cat/printf/heredoc/`>` redirection). Those files MUST be produced by the SCAFFOLDER command only. Hand-authored config gets mangled (each line wrongly quoted/escaped) and corrupts the project. If the scaffolder errored, read its stderr and re-run the SCAFFOLDER correctly — do NOT fabricate the files yourself.',
    'CRITICAL — DO NOT INSTALL DEPENDENCIES. Do NOT run `npm/pnpm/yarn install`, `pnpm add/remove`, or any `create` that auto-installs. If a scaffolder supports it, pass `--no-install` (and skip any `--install` flag). Dependency install runs in a SEPARATE later step. Your job is ONLY the file structure.',
    target.needsScaffold
      ? 'SCAFFOLD per the manual with pnpm, WITHOUT installing. Run EXACTLY this (note the `.` and `--no-install`): `pnpm create astro@latest . --template minimal --no-install --no-git --skip-houston --yes`. A package.json + the project structure must exist at the app-dir root afterward.'
      : 'This app is ALREADY scaffolded — do NOT re-scaffold and do NOT install anything.',
    'Ensure the app-root tags.json keyword vocabulary file exists per the manual — create it with write_file (NOT run_terminal echo/cat).',
    'Stop making tool calls once package.json + the project structure (from the scaffolder) + tags.json (via write_file) exist.',
    manualText.trim()
      ? `\nDevelopment manual (AUTHORITATIVE for archetype + scaffold):\n${manualText}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * DEPS-phase prompt: install node_modules into the already-scaffolded structure (no structure recreation).
 * @keyword-cn 依赖安装提示, 装依赖
 * @keyword-en deps-prompt, install-deps
 */
function buildDepsPrompt(
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
    miss ? `⚠ NOT DONE YET. ${miss}. Re-run the install command.` : '',
    'You INSTALL the dependencies of ONE app project by CALLING run_terminal. The project STRUCTURE already exists — do NOT scaffold, do NOT recreate files, do NOT write source files.',
    `App dir: ${target.appDir}${target.archetype ? ` · archetype: ${target.archetype}` : ''}. run_terminal ALREADY runs inside this dir — treat it as your working directory.`,
    'Step 1 — INSTALL: run the dependency install so node_modules is present. Use `pnpm install` (or the install command the manual specifies). A shared store makes this fast; the command blocks until done.',
    depLines.length > 0
      ? `Step 2 — DEPENDENCY CHANGES (apply exactly these; do not add extras):\n${depLines.join('\n')}`
      : 'No extra dependency changes requested — just run the install.',
    'When done, stop making tool calls.',
    manualText.trim()
      ? `\nDevelopment manual (AUTHORITATIVE for the install command):\n${manualText}`
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
