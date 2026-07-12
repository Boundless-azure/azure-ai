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
import {
  assembleManual,
  loadChapterRecords,
  type ChapterRecord,
} from './change-plan-knowledge';
import { ChangePlanStore } from './change-plan-store';
import {
  BUILD_GENERATE_LIMITS,
  type BuildFileResult,
  type BuildFileSend,
  type BuildValidationResult,
} from './build-generate.types';
import type { SaasHookBusLike } from './change-plan.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphBuildFile,
  CodeGraphBuildSummary,
  CodeGraphChangeTask,
  CodeGraphDependencyCheckResult,
  CodeGraphRequest,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentBuildGenerate');

/**
 * Dispatch stage: seed one generate-file todo per task and pack a per-file Send payload (topo order).
 * @keyword-cn 构建派发, 扇出准备
 * @keyword-en build-dispatch, fan-out-prep
 */
export async function dispatchBuildFiles(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  request: CodeGraphRequest;
  input: CodeGenOrchestrateInput;
  hookCaller: HookCaller | null;
  hookBus: SaasHookBusLike | null;
  workflowContext: WorkflowContext | null;
}): Promise<BuildFileSend[]> {
  const changePlan = args.dependencyCheck.changePlan;
  if (
    !changePlan ||
    changePlan.status !== 'ready' ||
    changePlan.changeTasks.length === 0 ||
    !args.hookCaller
  ) {
    return [];
  }
  const planId = changePlan.planId;
  const tasks = changePlan.changeTasks;
  const order = changePlan.topoOrder ?? tasks.map((task) => task.taskId);
  const rank = new Map(order.map((id, index) => [id, index]));
  const ordered = [...tasks].sort(
    (a, b) => (rank.get(a.taskId) ?? 1e9) - (rank.get(b.taskId) ?? 1e9),
  );
  const byId = new Map(tasks.map((task) => [task.taskId, task]));

  // 加载选中书本的全部章节记录一次, 建 id→记录 映射; 每个文件只拿它 task.chapters 声明的那几章 (change-plan
  // 按文件规划), 没声明的兜底给全量手册。避免把整本知识灌进每个并发文件。
  let chapterById = new Map<string, ChapterRecord>();
  let fallbackManual = '';
  if (args.hookBus && (changePlan.bookIds?.length ?? 0) > 0) {
    try {
      const records = await loadChapterRecords(
        args.hookBus,
        args.workflowContext,
        changePlan.bookIds!,
      );
      chapterById = new Map(records.map((c) => [c.id, c]));
      fallbackManual = assembleManual(records).slice(
        0,
        BUILD_GENERATE_LIMITS.maxManualChars,
      );
    } catch (error) {
      logger.warn(`build manual load failed: ${asMessage(error)}`);
    }
  }
  // 按文件挑章拼手册: 有声明就只给那几章, 否则兜底全量。
  const manualForTask = (task: CodeGraphChangeTask): string => {
    const ids = task.chapters ?? [];
    if (ids.length === 0) return fallbackManual;
    const picked = ids
      .map((id) => chapterById.get(id))
      .filter((c): c is ChapterRecord => Boolean(c));
    if (picked.length === 0) return fallbackManual;
    return assembleManual(picked).slice(0, BUILD_GENERATE_LIMITS.maxManualChars);
  };

  const store = new ChangePlanStore({
    hookCaller: args.hookCaller,
    runnerId: args.request.runner_id,
    workflowContext: args.workflowContext,
  });
  await store.upsertTodos(
    planId,
    ordered.map((task) => ({
      todoId: `generate-file:${task.taskId}`,
      type: 'generate-file',
      status: 'pending',
      title: `Generate file ${task.path} (incl. project-format @keyword comments, keywords reused from the tag list)`,
      refTaskId: task.taskId,
    })),
  );

  const requirement = compactRequirementForRouting(
    args.request.full_requirement,
    2000,
  );
  logger.log(
    `build-dispatch: ${ordered.length} files queued for concurrent generation (planId=${planId})`,
  );
  // 按 taskId 归拢该文件参与的联动契约, 注入每个 Send 载荷 (联动的文件都拿到同一份约定)
  const contractsByTask = new Map<
    string,
    Array<{ name?: string; description?: string; spec?: unknown }>
  >();
  for (const contract of changePlan.contracts ?? []) {
    const entry = {
      ...(contract.name ? { name: contract.name } : {}),
      ...(contract.description ? { description: contract.description } : {}),
      ...(contract.spec !== undefined ? { spec: contract.spec } : {}),
    };
    for (const taskId of contract.taskIds ?? []) {
      const arr = contractsByTask.get(taskId) ?? [];
      arr.push(entry);
      contractsByTask.set(taskId, arr);
    }
  }
  return ordered.map((task) => {
    const contracts = contractsByTask.get(task.taskId) ?? [];
    return {
      planId,
      runnerId: args.request.runner_id,
      sessionId: args.request.context.session_id,
      ...(task.targetId ? { appId: task.targetId } : {}),
      requirement,
      input: args.input,
      bookIds: changePlan.bookIds ?? [],
      manualText: manualForTask(task),
      task: {
        taskId: task.taskId,
        path: task.path,
        ...(task.action ? { action: task.action } : {}),
        ...(task.summary ? { summary: task.summary } : {}),
        hooks: task.hooks.map((hook) => hook.name),
      },
      ...(task.op === 'modify' ? { op: 'modify' as const } : {}),
      deps: (task.dependsOn ?? []).map((id) => {
        const dep = byId.get(id);
        return {
          taskId: id,
          ...(dep?.path ? { path: dep.path } : {}),
          ...(dep?.summary ? { summary: dep.summary } : {}),
        };
      }),
      ...(contracts.length > 0 ? { contracts } : {}),
    };
  });
}

/**
 * Generate one file, driven by its todo: each round the model runs a REAL tool-calling reply; code
 * then checks completion (file written + valid), marks the todo done (authoritative) or re-prompts
 * "finish per your todo" and updates progress. The LLM may adjust its todo progress via update_todo.
 * @keyword-cn 单文件生成, todo驱动
 * @keyword-en generate-file, todo-driven
 */
export async function runGenerateFile(args: {
  send: BuildFileSend;
  aiAdapter: AgentAiServer | null;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
}): Promise<BuildFileResult> {
  const { send } = args;
  const fail = (error: string, turns = 0): BuildFileResult => ({
    taskId: send.task.taskId,
    path: send.task.path,
    status: 'failed',
    turns,
    error,
  });
  if (!args.aiAdapter || !args.hookCaller) {
    return fail('aiAdapter or hookCaller not injected');
  }
  const hookCaller = args.hookCaller;
  const call = (hookName: string, payload: unknown): Promise<unknown> =>
    callRunnerHookData(
      hookCaller,
      send.runnerId,
      hookName,
      payload,
      args.workflowContext,
    );
  const store = new ChangePlanStore({
    hookCaller,
    runnerId: send.runnerId,
    workflowContext: args.workflowContext,
  });
  const todoId = `generate-file:${send.task.taskId}`;

  const state: FileNodeState = {
    wrote: false,
    bytes: 0,
    toolCalls: 0,
    writeError: '',
    content: '',
    todos: seedFileTodos(send),
  };
  const tools = buildFileNodeTools({ send, call, state, store, todoId });
  const model = selectLogicModel(args.aiAdapter, send.input);

  let miss = '';
  for (
    let round = 0;
    round < BUILD_GENERATE_LIMITS.maxGenerateRounds;
    round++
  ) {
    try {
      await model.chat({
        source: 'code-agent.build-generate',
        isolateCallbacks: true,
        messages: [
          {
            role: 'user',
            content: buildGeneratePrompt(send, round, miss, state.todos),
          },
        ],
        tools,
        // 写整份文件需要足够输出预算, 否则 write_file 的大 content 会被 max_tokens 截断成空 content
        params: {
          temperature: 0,
          maxTokens: BUILD_GENERATE_LIMITS.generateMaxTokens,
        },
      });
    } catch (error) {
      logger.warn(
        `generate-file ${send.task.path} round ${round} loop error: ${asMessage(error)}`,
      );
    }

    // 代码权威判完成: 文件真落盘且校验过 (ground truth) + 全部内存 todo 已 done (LLM 自维护的清单)。
    const validation =
      state.wrote && state.bytes > 0
        ? validateGeneratedFile(send, state.content)
        : undefined;
    const fileReady = state.wrote && state.bytes > 0 && Boolean(validation?.ok);
    const openTodos = openTodoTexts(state.todos);
    if (fileReady && openTodos.length === 0) {
      await safeUpsertTodo(store, send.planId, {
        todoId,
        status: 'done',
        note: `written ${state.bytes}B in ${round + 1} round(s)`,
      });
      return {
        taskId: send.task.taskId,
        path: send.task.path,
        status: 'written',
        bytes: state.bytes,
        turns: state.toolCalls,
        validation,
      };
    }

    // 未完成: 拼催办原因 (文件侧问题 + 未完成 todo 逐项列出), 下一轮"按 todo 完成任务"。
    const fileMiss = !state.wrote
      ? state.writeError
        ? `write_file failed: ${state.writeError}`
        : 'you have not called write_file yet'
      : state.bytes === 0
        ? 'the file you wrote is empty'
        : validation && !validation.ok
          ? `file validation failed: ${(validation.issues ?? []).join('; ') || 'unknown'}`
          : '';
    const todoMiss =
      openTodos.length > 0
        ? `open todos to finish (todo_update each to done when done): ${openTodos.join('; ')}`
        : '';
    miss = [fileMiss, todoMiss].filter(Boolean).join(' | ') || 'not finished';
    await safeUpsertTodo(store, send.planId, {
      todoId,
      status: 'in_progress',
      note: `round ${round + 1}: ${miss}`,
    });
  }

  // 轮次用尽仍未完成 (todo 留 in_progress, 供 build-join 汇总/后续 repair)
  await safeUpsertTodo(store, send.planId, {
    todoId,
    status: 'in_progress',
    note: `unfinished after ${BUILD_GENERATE_LIMITS.maxGenerateRounds} rounds: ${miss}`,
  });
  return fail(miss || 'not completed within round budget', state.toolCalls);
}

/** 单文件生成的内存 todo 条目 (LLM 用 CRUD 工具维护, 全 done + 文件落盘才算完成) */
type FileTodo = { id: string; text: string; status: 'open' | 'done' };

type FileNodeState = {
  wrote: boolean;
  bytes: number;
  toolCalls: number;
  writeError: string;
  content: string;
  /** 内存 todo: code 先按任务种"对应点", LLM 边做边 CRUD 维护; 驱动单文件完成循环 */
  todos: FileTodo[];
};

/**
 * Seed the in-memory per-file todos ("对应点") from the task, so the model has an authoritative checklist
 * to read and work through: the change to make, each shared contract to honor, hooks to declare (unit),
 * the required @keyword comments, and finally writing the file. The model then maintains this via CRUD.
 * @keyword-cn 种子文件todo, 对应点
 * @keyword-en seed-file-todos, checklist
 */
function seedFileTodos(send: BuildFileSend): FileTodo[] {
  const items: string[] = [];
  if (send.fix?.issue) items.push(`修复构建问题: ${send.fix.issue.trim()}`);
  else if (send.op === 'modify')
    items.push(`按需求就地修改本文件 (读现文件 → 定点改)`);
  items.push(`实现文件内容: ${send.task.summary ?? send.task.path}`);
  for (const contract of send.contracts ?? []) {
    items.push(`遵守共享契约: ${contract.name ?? contract.description ?? '(见契约)'}`);
  }
  if (send.task.action === 'unit' && send.task.hooks.length > 0) {
    items.push(`声明/实现 hooks: ${send.task.hooks.join(', ')}`);
  }
  items.push(`每个函数/组件/导出符号补项目格式 @keyword 注释`);
  items.push(`write_file 写入完整文件内容`);
  return items.map((text, index) => ({
    id: `t${index + 1}`,
    text,
    status: 'open' as const,
  }));
}

/** 未完成 todo 文本列表 (催办提示用) */
function openTodoTexts(todos: FileTodo[]): string[] {
  return todos.filter((t) => t.status === 'open').map((t) => `[${t.id}] ${t.text}`);
}

/**
 * Upsert this file's todo without letting a todo-write failure sink the file result.
 * @keyword-cn todo安全写, 容错
 * @keyword-en safe-upsert-todo, tolerant
 */
async function safeUpsertTodo(
  store: ChangePlanStore,
  planId: string,
  todo: Record<string, unknown>,
): Promise<void> {
  try {
    await store.upsertTodos(planId, [todo]);
  } catch (error) {
    logger.warn(`generate-file todo upsert failed: ${asMessage(error)}`);
  }
}

/**
 * Build the executable tools bound to this file's plan/task; the model calls these directly.
 * @keyword-cn 文件节点工具, 工具绑定
 * @keyword-en file-node-tools, tool-binding
 */
function buildFileNodeTools(args: {
  send: BuildFileSend;
  call: (hookName: string, payload: unknown) => Promise<unknown>;
  state: FileNodeState;
  store: ChangePlanStore;
  todoId: string;
}): unknown[] {
  const { send, call, state, store, todoId } = args;
  const tools: unknown[] = [
    tool(
      async ({ content }: { content: string }) => {
        state.toolCalls += 1;
        try {
          const data = await call('runner.app.codeAgentFs.writeTaskFile', {
            planId: send.planId,
            taskId: send.task.taskId,
            content,
          });
          state.bytes = readNumberField(asRecord(data), 'bytes');
          state.content = content;
          state.wrote = true;
          return `written ${send.task.path} (${state.bytes} bytes). If the file is complete (incl. the required @keyword doc comments), stop and do not call more tools.`;
        } catch (error) {
          state.writeError = asMessage(error);
          return `write_file failed: ${state.writeError}`;
        }
      },
      {
        name: 'write_file',
        description: `Write the FULL content of THIS file (${send.task.path}). The path is fixed by the plan — you only supply the complete content. Call this once the file is ready.`,
        schema: z.object({
          content: z.string().describe('the entire file content'),
        }),
      },
    ),
    tool(
      async ({
        edits,
      }: {
        edits: Array<{ startLine: number; endLine: number; newText: string }>;
      }) => {
        state.toolCalls += 1;
        try {
          const data = await call('runner.app.codeAgentFs.editFile', {
            planId: send.planId,
            taskId: send.task.taskId,
            edits,
          });
          const rec = asRecord(data);
          state.bytes = readNumberField(rec, 'bytes');
          state.content = readStringField(rec, 'content');
          state.wrote = true;
          return `edited ${send.task.path} (${readNumberField(rec, 'applied')} edit(s) applied, now ${state.bytes} bytes). If the change is complete, stop calling tools.`;
        } catch (error) {
          state.writeError = asMessage(error);
          return `edit_file failed: ${state.writeError}. read_file again to get FRESH line numbers, then retry with correct startLine/endLine.`;
        }
      },
      {
        name: 'edit_file',
        description: `Modify THIS file (${send.task.path}) by LINE RANGE — the targeted way to change part of a file without rewriting it. read_file FIRST: it returns the file WITH 1-based line numbers. Each edit replaces lines [startLine..endLine] (inclusive) with newText (may be multi-line; empty string DELETES those lines). Line ranges must not overlap. To INSERT, replace a line with itself plus the new content. Line numbers are unique, so this never has the "ambiguous match" problem.`,
        schema: z.object({
          edits: z
            .array(
              z.object({
                startLine: z
                  .number()
                  .int()
                  .positive()
                  .describe('1-based first line to replace (from read_file numbers)'),
                endLine: z
                  .number()
                  .int()
                  .positive()
                  .describe('1-based last line to replace, inclusive'),
                newText: z
                  .string()
                  .describe('replacement text (multi-line ok; empty deletes the lines)'),
              }),
            )
            .min(1),
        }),
      },
    ),
    tool(
      async ({
        path,
        startLine,
        endLine,
      }: {
        path: string;
        startLine?: number;
        endLine?: number;
      }) => {
        state.toolCalls += 1;
        try {
          const data = await call('runner.app.codeAgentFs.readFile', {
            planId: send.planId,
            path,
            ...(startLine != null ? { startLine } : {}),
            ...(endLine != null ? { endLine } : {}),
          });
          const rec = asRecord(data);
          const content = readStringField(rec, 'content');
          if (!content) return '(empty)';
          const base = readNumberField(rec, 'startLine') || 1;
          const total = readNumberField(rec, 'totalLines') || 0;
          const shown = content.split(/\r?\n/).length;
          const header = total
            ? `(lines ${base}-${base + shown - 1} of ${total})\n`
            : '';
          return clip(header + numberLines(content, base), 16000);
        } catch (error) {
          return `read_file error: ${asMessage(error)}`;
        }
      },
      {
        name: 'read_file',
        description:
          'Read a file in this plan, returned WITH 1-based line numbers ("<n>\\t<line>"). Optionally pass startLine/endLine to read ONLY that window (use for large files — read around the spot you located). Use the numbers for edit_file line ranges.',
        schema: z.object({
          path: z.string(),
          startLine: z.number().int().positive().optional(),
          endLine: z.number().int().positive().optional(),
        }),
      },
    ),
    tool(
      async ({ path, line }: { path: string; line: number }) => {
        state.toolCalls += 1;
        try {
          const data = await call('runner.app.codeAgentFs.readNode', {
            planId: send.planId,
            path,
            line,
          });
          const rec = asRecord(data);
          const content = readStringField(rec, 'content');
          if (!content) return '(empty)';
          const base = readNumberField(rec, 'startLine') || 1;
          const end = readNumberField(rec, 'endLine') || base;
          const total = readNumberField(rec, 'totalLines') || 0;
          return clip(
            `(node lines ${base}-${end} of ${total})\n${numberLines(content, base)}`,
            16000,
          );
        } catch (error) {
          return `read_node error: ${asMessage(error)}`;
        }
      },
      {
        name: 'read_node',
        description:
          "Read the CODE BODY of an annotation node located by search_by_tag: pass the hit's { path, line } and get the whole annotated symbol (its comment + code, down to just before the next @keyword) WITH 1-based line numbers. Feed the returned startLine/endLine straight to edit_file. This is step 2 of the locate flow: search_by_tag (find the comment) → read_node (read its code) → edit_file (change it).",
        schema: z.object({
          path: z.string(),
          line: z.number().int().positive(),
        }),
      },
    ),
    tool(
      async ({ pattern, flags }: { pattern: string; flags?: string }) => {
        state.toolCalls += 1;
        try {
          return JSON.stringify(
            await call('runner.app.codeAgentFs.grep', {
              planId: send.planId,
              pattern,
              ...(flags ? { flags } : {}),
            }),
          );
        } catch (error) {
          return `grep error: ${asMessage(error)}`;
        }
      },
      {
        name: 'grep',
        description: 'Search file contents by regex within this plan.',
        schema: z.object({
          pattern: z.string(),
          flags: z.string().optional(),
        }),
      },
    ),
    tool(
      async ({ query }: { query: string }) => {
        state.toolCalls += 1;
        try {
          return JSON.stringify(
            await call('runner.app.codeAgentFs.fastSearch', {
              planId: send.planId,
              query,
            }),
          );
        } catch (error) {
          return `fast_search error: ${asMessage(error)}`;
        }
      },
      {
        name: 'fast_search',
        description: 'Find files by filename substring within this plan.',
        schema: z.object({ query: z.string() }),
      },
    ),
  ];

  if (send.task.action === 'unit') {
    tools.push(
      tool(
        async ({ hookNames }: { hookNames: string[] }) => {
          state.toolCalls += 1;
          try {
            return JSON.stringify(
              await call('runner.system.hookbus.getInfo', [{ hookNames }]),
            );
          } catch (error) {
            return `get_hook_info error: ${asMessage(error)}`;
          }
        },
        {
          name: 'get_hook_info',
          description:
            'Get real signatures/payloadSchema of hooks this unit file calls.',
          schema: z.object({ hookNames: z.array(z.string()) }),
        },
      ),
    );
  }

  if (send.appId) {
    const appId = send.appId;
    const targetRoot = deriveTargetRoot(send.task.path);
    tools.push(
      tool(
        async ({ tag }: { tag: string }) => {
          state.toolCalls += 1;
          try {
            return JSON.stringify(
              await call('runner.app.codeAgentFs.searchByTag', {
                planId: send.planId,
                path: targetRoot,
                tag,
              }),
            ).slice(0, 4000);
          } catch (error) {
            return `search_by_tag error: ${asMessage(error)}`;
          }
        },
        {
          name: 'search_by_tag',
          description:
            "LOCATE code by its @keyword tag (reverse-lookup via ripgrep): returns matching files with the line number + the annotation node of each hit. When you need to find WHERE to edit, try THIS FIRST — the line number feeds edit_file directly (read_file that window only if you need more context). tag must be one from list_keywords; an undeclared tag returns the available vocabulary.",
          schema: z.object({ tag: z.string() }),
        },
      ),
      tool(
        async () => {
          state.toolCalls += 1;
          try {
            return JSON.stringify(
              await call('runner.app.appTag.getList', { appId }),
            );
          } catch (error) {
            return `list_keywords error: ${asMessage(error)}`;
          }
        },
        {
          name: 'list_keywords',
          description:
            "List this app's existing @keyword vocabulary (plain terms). Check here to REUSE a keyword before creating a new one.",
          schema: z.object({}),
        },
      ),
      tool(
        async ({ query }: { query: string }) => {
          state.toolCalls += 1;
          try {
            return JSON.stringify(
              await call('runner.app.appTag.search', { appId, query }),
            );
          } catch (error) {
            return `search_keywords error: ${asMessage(error)}`;
          }
        },
        {
          name: 'search_keywords',
          description:
            "Search this app's existing @keyword vocabulary by substring, to find a term to REUSE.",
          schema: z.object({ query: z.string() }),
        },
      ),
      tool(
        async ({
          dimension,
          keyword,
        }: {
          dimension?: string;
          keyword: string;
        }) => {
          state.toolCalls += 1;
          try {
            return JSON.stringify(
              await call('runner.app.appTag.ensure', {
                appId,
                ...(dimension ? { dimension } : {}),
                keyword,
              }),
            );
          } catch (error) {
            return `add_keyword error: ${asMessage(error)}`;
          }
        },
        {
          name: 'add_keyword',
          description:
            'Register a NEW keyword under a dimension (功能职责/技术栈/数据接口/依赖关系). keyword is a PLAIN term (no @). Only after list_keywords/search_keywords found no fit. Deduped server-side.',
          schema: z.object({
            dimension: z
              .string()
              .optional()
              .describe('one of 功能职责/技术栈/数据接口/依赖关系'),
            keyword: z.string().describe('a plain keyword term, no @ prefix'),
          }),
        },
      ),
    );
  }

  // 内存 todo 的增删改查 (LLM 维护本文件的完成清单; 全 done + 文件落盘才算完成)
  tools.push(
    tool(
      () => {
        state.toolCalls += 1;
        return JSON.stringify(state.todos);
      },
      {
        name: 'todo_list',
        description:
          'READ your per-file todo checklist (call this FIRST). Work each item, and call todo_update to mark it done when finished. The file is complete only when EVERY todo is done and write_file has succeeded.',
        schema: z.object({}),
      },
    ),
    tool(
      ({ items }: { items: string[] }) => {
        state.toolCalls += 1;
        const base = state.todos.length;
        const added = items.map((text, i) => ({
          id: `t${base + i + 1}`,
          text,
          status: 'open' as const,
        }));
        state.todos.push(...added);
        return `added ${added.length} todo(s): ${added.map((t) => t.id).join(', ')}`;
      },
      {
        name: 'todo_add',
        description:
          'Add new todo item(s) you discover are needed for THIS file while working.',
        schema: z.object({ items: z.array(z.string()).min(1) }),
      },
    ),
    tool(
      ({
        id,
        status,
        text,
      }: {
        id: string;
        status?: 'open' | 'done';
        text?: string;
      }) => {
        state.toolCalls += 1;
        const todo = state.todos.find((t) => t.id === id);
        if (!todo) return `todo ${id} not found`;
        if (status) todo.status = status;
        if (text) todo.text = text;
        return `todo ${id} -> ${todo.status}`;
      },
      {
        name: 'todo_update',
        description:
          'Update a todo item: set status="done" when you have finished it, or edit its text. Mark items done as you go — this is how the system knows the file is complete.',
        schema: z.object({
          id: z.string(),
          status: z.enum(['open', 'done']).optional(),
          text: z.string().optional(),
        }),
      },
    ),
    tool(
      ({ id }: { id: string }) => {
        state.toolCalls += 1;
        const before = state.todos.length;
        state.todos = state.todos.filter((t) => t.id !== id);
        return state.todos.length < before
          ? `removed ${id}`
          : `todo ${id} not found`;
      },
      {
        name: 'todo_remove',
        description:
          'Remove a todo item that is genuinely not needed for THIS file.',
        schema: z.object({ id: z.string() }),
      },
    ),
  );
  return tools;
}

type MissingFile = { taskId: string; path: string };

/**
 * Ground-truth check via the Runner: which planned files actually landed on disk (exist + non-empty).
 * @keyword-cn 落盘校验, 断链检测
 * @keyword-en verify-files, dangling-detect
 */
async function verifyPlanFiles(args: {
  planId: string;
  runnerId: string;
  hookCaller: HookCaller;
  workflowContext: WorkflowContext | null;
}): Promise<{ present: string[]; missing: MissingFile[] }> {
  const data = await callRunnerHookData(
    args.hookCaller,
    args.runnerId,
    'runner.app.codeAgentFs.verifyTasks',
    { planId: args.planId },
    args.workflowContext,
  );
  const rec = asRecord(data);
  const present = Array.isArray(rec.present)
    ? rec.present.filter((x): x is string => typeof x === 'string')
    : [];
  const missing = Array.isArray(rec.missing)
    ? rec.missing
        .map((item) => {
          const r = asRecord(item);
          return {
            taskId: readStringField(r, 'taskId'),
            path: readStringField(r, 'path'),
          };
        })
        .filter((m) => Boolean(m.taskId))
    : [];
  return { present, missing };
}

/**
 * Verify stage (after the fan-out barrier): ground-truth which planned files landed; queue the missing
 * for repair up to maxRepairRounds. Verify errors fail-open (assume complete) to avoid an endless loop.
 * @keyword-cn 构建校验, repair调度
 * @keyword-en build-verify, repair-dispatch
 */
export async function runBuildVerify(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  request: CodeGraphRequest;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
  buildFiles: BuildFileSend[];
  prevRound: number;
}): Promise<{
  repairRound: number;
  repairFiles: BuildFileSend[];
  present: string[];
  missing: MissingFile[];
}> {
  const round = args.prevRound + 1;
  const planId = args.dependencyCheck.changePlan?.planId ?? '';
  if (!args.hookCaller || !planId) {
    return { repairRound: round, repairFiles: [], present: [], missing: [] };
  }
  let present: string[] = [];
  let missing: MissingFile[] = [];
  try {
    ({ present, missing } = await verifyPlanFiles({
      planId,
      runnerId: args.request.runner_id,
      hookCaller: args.hookCaller,
      workflowContext: args.workflowContext,
    }));
  } catch (error) {
    logger.warn(
      `build-verify: verifyTasks failed, assuming complete: ${asMessage(error)}`,
    );
    return { repairRound: round, repairFiles: [], present: [], missing: [] };
  }

  let repairFiles: BuildFileSend[] = [];
  if (missing.length > 0 && round <= BUILD_GENERATE_LIMITS.maxRepairRounds) {
    const missingIds = new Set(missing.map((m) => m.taskId));
    repairFiles = args.buildFiles.filter((f) => missingIds.has(f.task.taskId));
    logger.warn(
      `build-verify round ${round}: ${missing.length} file(s) missing (${missing
        .map((m) => m.path)
        .join(', ')}); re-dispatching ${repairFiles.length}`,
    );
  } else if (missing.length > 0) {
    logger.warn(
      `build-verify: ${missing.length} file(s) still missing after ${BUILD_GENERATE_LIMITS.maxRepairRounds} repair rounds: ${missing
        .map((m) => m.path)
        .join(', ')}`,
    );
  } else {
    logger.log(`build-verify: all ${present.length} planned files present`);
  }
  return { repairRound: round, repairFiles, present, missing };
}

/**
 * Join stage: build the summary from verify ground-truth; if files still missing, propagate blocked.
 * @keyword-cn 构建汇聚, 产物汇总
 * @keyword-en build-join, build-summary
 */
export function finalizeBuild(args: {
  dependencyCheck: CodeGraphDependencyCheckResult;
  results: BuildFileResult[];
  present: string[];
  missing: MissingFile[];
}): CodeGraphDependencyCheckResult {
  const changePlan = args.dependencyCheck.changePlan;
  if (!changePlan) return args.dependencyCheck;
  // repair 轮里 buildResults 会累加, 按 taskId 取最后一次做每文件详情; 状态以 verify 落盘真相为准
  const latest = new Map<string, BuildFileResult>();
  for (const r of args.results) latest.set(r.taskId, r);
  const missingIds = new Set(args.missing.map((m) => m.taskId));
  const files: CodeGraphBuildFile[] = changePlan.changeTasks.map((task) => {
    const r = latest.get(task.taskId);
    const ok = !missingIds.has(task.taskId);
    return {
      taskId: task.taskId,
      path: task.path,
      status: ok ? 'written' : 'failed',
      ...(r?.bytes !== undefined ? { bytes: r.bytes } : {}),
      turns: r?.turns ?? 0,
      ...(ok
        ? {}
        : { error: r?.error ?? 'file not materialized after repair rounds' }),
    };
  });
  const written = files.filter((f) => f.status === 'written').length;
  const build: CodeGraphBuildSummary = {
    total: files.length,
    written,
    failed: files.length - written,
    files,
  };
  logger.log(
    `build-join: ${written}/${files.length} files present` +
      (args.missing.length > 0
        ? `; missing: ${args.missing.map((m) => m.path).join(', ')}`
        : ''),
  );
  if (args.missing.length === 0) {
    return { ...args.dependencyCheck, changePlan: { ...changePlan, build } };
  }
  const reason = `build incomplete after ${BUILD_GENERATE_LIMITS.maxRepairRounds} repair rounds: ${written}/${files.length} files present; missing: ${args.missing
    .map((m) => m.path)
    .join(', ')}`;
  return {
    ...args.dependencyCheck,
    status: 'blocked',
    changePlan: { ...changePlan, build, status: 'blocked', reason },
    errors: [...args.dependencyCheck.errors, reason],
  };
}

/**
 * After the build: scan all files' @keyword comments (Runner) and sync them into each app's tags.json
 * (add-missing + dedup). Best-effort — a sync failure never fails the build.
 * @keyword-cn 关键词同步, 词表回填
 * @keyword-en keyword-sync, vocab-backfill
 */
export async function collectAndSyncKeywords(args: {
  planId: string;
  runnerId: string;
  hookCaller: HookCaller | null;
  workflowContext: WorkflowContext | null;
}): Promise<void> {
  if (!args.hookCaller || !args.planId) return;
  try {
    const data = await callRunnerHookData(
      args.hookCaller,
      args.runnerId,
      'runner.app.codeAgentFs.collectKeywords',
      { planId: args.planId },
      args.workflowContext,
    );
    const byApp = asRecord(asRecord(data).byApp);
    let collected = 0;
    let added = 0;
    for (const [appId, value] of Object.entries(byApp)) {
      const entries = Array.isArray(value)
        ? value
            .map((item) => asRecord(item))
            .map((item) => ({
              dimension: readStringField(item, 'dimension') || undefined,
              keyword: readStringField(item, 'keyword'),
            }))
            .filter((entry) => Boolean(entry.keyword))
        : [];
      if (entries.length === 0) continue;
      collected += entries.length;
      try {
        const res = asRecord(
          await callRunnerHookData(
            args.hookCaller,
            args.runnerId,
            'runner.app.appTag.ensureMany',
            { appId, entries },
            args.workflowContext,
          ),
        );
        added += readNumberField(res, 'added');
      } catch (error) {
        logger.warn(
          `keyword sync ensureMany failed for app ${appId}: ${asMessage(error)}`,
        );
      }
    }
    logger.log(
      `keyword sync: collected ${collected} @keyword term(s), added ${added} new to tags.json`,
    );
  } catch (error) {
    logger.warn(`keyword sync (collectKeywords) failed: ${asMessage(error)}`);
  }
}

/**
 * File-level rule validation (completion layer ②; the todo supervises this). Enforces the project's
 * fixed-format @keyword doc comments (single field, no cn/en split) on code files.
 * @keyword-cn 文件校验, 注释监督
 * @keyword-en file-validate, comment-supervision
 */
function validateGeneratedFile(
  send: BuildFileSend,
  content: string,
): BuildValidationResult {
  if (
    requiresKeywordComments(send.task.path, content) &&
    !/@keyword\b/.test(content)
  ) {
    return {
      rule: 'doc-keywords',
      ok: false,
      issues: [
        'missing project-format doc comments: add a single @keyword line (2-5 comma-separated terms) on functions/components/exports, reusing keywords from the list',
      ],
    };
  }
  return { rule: 'doc-keywords', ok: true };
}

/**
 * Whether this file needs R5 @keyword doc comments — has function/class/exported-symbol declarations;
 * pure style/asset/markup files (.css/.json/.svg/.html/…) are exempt.
 * @keyword-cn 需注释判定, 声明探测
 * @keyword-en needs-comments, declaration-detect
 */
function requiresKeywordComments(path: string, content: string): boolean {
  if (
    /\.(css|scss|less|json|md|txt|svg|png|jpe?g|webp|ico|html)$/i.test(path)
  ) {
    return false;
  }
  return /\b(?:function\s|class\s|interface\s|enum\s)|=>|\bexport\s/.test(
    content,
  );
}

/**
 * Build the instruction prompt for one file node (tool-driven; retry rounds nudge per the todo).
 * @keyword-cn 生成提示, 工具驱动
 * @keyword-en generate-prompt, tool-driven
 */
function buildGeneratePrompt(
  send: BuildFileSend,
  round: number,
  miss: string,
  todos: FileTodo[],
): string {
  const isUnit = send.task.action === 'unit';
  const todoBlock = [
    'Your per-file TODO checklist (maintain it with todo_add/todo_update/todo_remove; the file is DONE only when every item is done AND write_file has succeeded):',
    JSON.stringify(
      todos.map((t) => ({ id: t.id, text: t.text, status: t.status })),
      null,
      2,
    ),
    '',
  ];
  const retry =
    round > 0 && miss
      ? [
          `⚠ THIS FILE IS NOT DONE YET (attempt ${round + 1}). Reason: ${miss}.`,
          `Your todo "Generate file ${send.task.path}" is still open. Use read_file to see the current file if needed, then FINISH it now by calling write_file with the complete content. Do not stop until write_file has succeeded.`,
          '',
        ]
      : [];
  // FIX 模式 (build-test 返修): 文件已存在, 构建判定了具体问题 —— 读现文件、精准修、重写整份
  const fix =
    send.fix && send.fix.issue.trim()
      ? [
          '⚠ FIX MODE — this file ALREADY EXISTS and the project build reported a problem with it:',
          `    ${send.fix.issue.trim()}`,
          'To LOCATE the code to fix: (1) search_by_tag by a declared tag (from list_keywords) → gives the hit path + line; (2) read_node({path, line}) → reads that symbol\'s code body WITH line numbers. If search_by_tag does not find it, fall back to read_file (optionally a startLine/endLine window). Then make a TARGETED fix with edit_file BY LINE RANGE — startLine/endLine + newText; change only the affected lines, do NOT rewrite the whole file. Keep the required @keyword doc comments intact. (Fall back to write_file only if the change spans most of the file.)',
          '',
        ]
      : [];
  // MODIFY 模式 (二次修改): 文件已存在, 按需求就地改 —— 与 FIX 同机制 (读现文件 → edit_file 定点改), 只是驱动源是用户需求而非构建报错
  const modify =
    !send.fix && send.op === 'modify'
      ? [
          '⚠ MODIFY MODE — this file ALREADY EXISTS. Change it IN PLACE to satisfy the requirement below; do NOT recreate it from scratch.',
          'To LOCATE what to change: (1) search_by_tag by a declared tag (from list_keywords) → gives the hit path + line; (2) read_node({path, line}) → reads that symbol\'s code body WITH line numbers. If search_by_tag does not find it, fall back to read_file (optionally a startLine/endLine window). Then make TARGETED changes with edit_file BY LINE RANGE — replace only the line ranges that must change; leave everything else untouched. Keep the required @keyword doc comments intact (add/adjust only for lines you actually change). (Fall back to write_file only if the change spans most of the file.)',
          '',
        ]
      : [];
  return [
    ...retry,
    ...fix,
    ...modify,
    ...todoBlock,
    'You are ONE concurrent code node in code-agent. Generate exactly ONE file by CALLING TOOLS — do NOT print the file in chat; write it with the write_file tool.',
    `Your file: ${send.task.path} (action=${send.task.action ?? 'app'}).`,
    `What it is: ${send.task.summary ?? '(see requirement)'}.`,
    isUnit
      ? `Hooks this file must declare: ${JSON.stringify(send.task.hooks)}. Use get_hook_info for the real signatures of any hooks you call.`
      : 'This is a page/asset file — no hooks.',
    (send.contracts?.length ?? 0) > 0
      ? `SHARED CONTRACTS you MUST honor (agreed with your coupled files — use the EXACT ids / names / shapes below; do NOT invent your own, or cross-file wiring breaks):\n${JSON.stringify(send.contracts, null, 2)}`
      : '',
    '',
    'Workflow: FIRST call todo_list to read your per-file todos; work them one by one, marking each todo_update({id, status:"done"}) as you finish it (add_todo if you discover more). You may read_file/grep/fast_search to check existing or sibling files (dependsOn siblings may still be generating concurrently — prefer their summaries above). Call write_file ONCE with the complete file content. Stop calling tools only when EVERY todo is done and the file is written.',
    'Comments (REQUIRED to finish this file): every function / component / interface / exported symbol needs a doc comment in EXACTLY this project format — a SINGLE `@keyword` line whose terms are DIMENSION-QUALIFIED as `<dimension>:<term>`. The dimensions are a FIXED set — think about the code along each and give a term for each RELEVANT one (2-5 terms total):',
    ' · 功能职责 — what this code is / does (its responsibility)',
    ' · 技术栈 — the technology/framework it uses',
    ' · 数据接口 — its data shape / props / interface',
    ' · 依赖关系 — what it composes or depends on',
    'Invented @-tags like @component / @param DO NOT count and WILL fail the check. Exact format:',
    '/**',
    ' * <one-line description of the symbol>',
    ' * @keyword 功能职责:顶部导航, 技术栈:astro组件, 依赖关系:BaseLayout',
    ' */',
    send.appId
      ? 'Keywords are a CONTROLLED, dimension-organized vocabulary. Within a dimension, call search_keywords / list_keywords to REUSE an existing term before making a new one; only add_keyword({dimension, keyword}) a plain term (no @) when none fits. Never invent freely.'
      : '',
    'Follow the development manual below for archetype, stack, and file structure. Keep the file self-contained; reference sibling files by their planned paths.',
    manualBlock(send.manualText),
    '',
    `Requirement:\n${send.requirement}`,
    '',
    `Your dependsOn siblings (compose/use these; reference by path):\n${JSON.stringify(
      send.deps,
      null,
      2,
    )}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Wrap the manual text as an authoritative prompt block (empty when no manual).
 * @keyword-cn 手册段落, 提示注入
 * @keyword-en manual-block, prompt-inject
 */
function manualBlock(manualText: string): string {
  if (!manualText.trim()) return '';
  return `\nDevelopment manual (AUTHORITATIVE for structure/stack/layout):\n${manualText}`;
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
 * Truncate long strings for prompt/tool-result embedding.
 * @keyword-cn 截断, 提示裁剪
 * @keyword-en clip, prompt-trim
 */
function clip(text: string | undefined, max: number): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…(truncated)` : text;
}

/**
 * Prefix each line with its 1-based number ("<n>\t<line>"), numbering from `start` (for windowed reads),
 * so the model can reference exact lines for edit_file.
 * @keyword-cn 行号标注, 按行编辑
 * @keyword-en number-lines, line-edit
 */
function numberLines(text: string, start = 1): string {
  return text
    .split(/\r?\n/)
    .map((line, i) => `${start + i}\t${line}`)
    .join('\n');
}

/**
 * Derive the app/unit/data target root (solutions/<sol>/apps|units|data/<name>) from a task file path,
 * for scoping search_by_tag to the whole target; falls back to the file's parent dir.
 * @keyword-cn 目标根推导, 标签搜索范围
 * @keyword-en derive-target-root, tag-search-scope
 */
function deriveTargetRoot(path: string): string {
  const segs = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (
    segs[0] === 'solutions' &&
    segs.length >= 4 &&
    ['apps', 'units', 'data'].includes(segs[2])
  ) {
    return segs.slice(0, 4).join('/');
  }
  return segs.slice(0, -1).join('/') || path;
}

/**
 * Normalize an unknown error into a message string.
 * @keyword-cn 错误消息, 归一化
 * @keyword-en error-message, normalize
 */
function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
