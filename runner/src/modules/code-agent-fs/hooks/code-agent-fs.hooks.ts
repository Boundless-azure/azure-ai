import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerCodeAgentPlanService } from '../../code-agent-plan/services/code-agent-plan.service';
import { RunnerCodeAgentFsService } from '../services/code-agent-fs.service';
import {
  CollectKeywordsPayloadSchema,
  EditFilePayloadSchema,
  FastSearchPayloadSchema,
  GrepPayloadSchema,
  InitLockPayloadSchema,
  ReadFilePayloadSchema,
  ReadNodePayloadSchema,
  RunCommandPayloadSchema,
  SearchByTagPayloadSchema,
  VerifyTasksPayloadSchema,
  WriteFilePayloadSchema,
  WriteTaskFilePayloadSchema,
} from '../types/code-agent-fs.types';

const PLUGIN_NAME = 'runner-code-agent-fs';
const TAGS = ['code-agent', 'code-gen', 'runner-local'];

/**
 * @title 注册 code-agent 生成文件工具 hook
 * @description 在 Runner HookBus 上注册 runner.app.codeAgentFs.{writeTaskFile,writeFile,readFile,grep,fastSearch…}
 *   等业务 hook, 给 code-agent 并发代码节点提供 plan 作用域的文件读写/搜索。writeTaskFile 只写 task 里
 *   存的权威 path (填已规划文件、不即兴造); writeFile 按 LLM 提供的 path 逐字写 (project-init 写 tags.json 等
 *   非 task 文本, 内容原样落盘不经 shell); read/grep/search 围栏在该 plan 的目标根内。内部经
 *   RunnerCodeAgentPlanService 解析 task 路径 (计划集合仍归 plan store)。requiredAbility 复用 solution
 *   subject。重复挂载安全。
 * @keyword-cn 生成文件hook注册, 业务hook
 * @keyword-en code-agent-fs-hook-register, business-hook
 */
export function registerCodeAgentFsHooks(
  hookBus: RunnerHookBusService,
  mongoClient: RunnerMongoClient,
  workspacePath: string,
): void {
  // 把 pnpm store 钉在 workspace 同卷 → 硬链接生效, 所有 app 共享一份、第二个起装依赖极快 (不同版本各存各的, 不冲突)
  ensureWorkspacePnpmStore(workspacePath);
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));
  const getService = (): RunnerCodeAgentFsService | null => {
    const db = mongoClient.getDb();
    if (!db) return null;
    return new RunnerCodeAgentFsService(
      new RunnerCodeAgentPlanService(db),
      workspacePath,
    );
  };
  const withService = async <T>(
    run: (svc: RunnerCodeAgentFsService) => Promise<T>,
  ): Promise<
    { status: 'success'; data: T } | { status: 'error'; error: string }
  > => {
    const svc = getService();
    if (!svc) return { status: 'error', error: 'runner mongo is unavailable' };
    try {
      return { status: 'success', data: await run(svc) };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  if (!existing.has('runner.app.codeAgentFs.writeTaskFile')) {
    hookBus.register(
      'runner.app.codeAgentFs.writeTaskFile',
      async (event) =>
        withService((svc) =>
          svc.writeTaskFile(
            WriteTaskFilePayloadSchema.parse(event.payload ?? {}),
          ),
        ),
      {
        description:
          '写某 task 已规划的文件 (path 取自 task, 强制填已规划文件、不即兴造)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: WriteTaskFilePayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.writeFile')) {
    hookBus.register(
      'runner.app.codeAgentFs.writeFile',
      async (event) =>
        withService((svc) =>
          svc.writeFile(WriteFilePayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '按 workspace 相对 path 逐字写 plan 目标根内的一个文件 (越界拒, 目录自建); 内容原样落盘、不经 shell → 供 project-init 写 tags.json 等非 task 文本, 根除手搓文件被逐行转义写坏',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: WriteFilePayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.editFile')) {
    hookBus.register(
      'runner.app.codeAgentFs.editFile',
      async (event) =>
        withService((svc) =>
          svc.editFile(EditFilePayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '定点修改某 task 已规划的文件 (字串精确替换, 原子; 代码节点的修改能力, 供返修/op:modify)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: EditFilePayloadSchema,
        requiredAbility: { action: 'update', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.readFile')) {
    hookBus.register(
      'runner.app.codeAgentFs.readFile',
      async (event) =>
        withService((svc) =>
          svc.readFile(ReadFilePayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '读 plan 目标根内的一个文件 (workspace 相对路径, 越界拒)。默认不传行号→返回整份; ' +
          '改文件前优先整份读一次拿全貌再批量 edit, 别一小段一小段读改; 仅超大文件才用 startLine/endLine 窗口',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: ReadFilePayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.grep')) {
    hookBus.register(
      'runner.app.codeAgentFs.grep',
      async (event) =>
        withService((svc) =>
          svc.grep(GrepPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description: '在 plan 目标根内按正则搜文件内容, 返回命中行 (bounded)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: GrepPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.fastSearch')) {
    hookBus.register(
      'runner.app.codeAgentFs.fastSearch',
      async (event) =>
        withService((svc) =>
          svc.fastSearch(FastSearchPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description: '在 plan 目标根内按文件名子串快速找文件路径',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: FastSearchPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.readNode')) {
    hookBus.register(
      'runner.app.codeAgentFs.readNode',
      async (event) =>
        withService((svc) =>
          svc.readNode(ReadNodePayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '读 search_by_tag 命中的注释节点标注的整个符号代码体 (注释块起→下一个 @keyword 注释前); 回 {path,content,startLine,endLine,totalLines}, 直接喂 edit_file',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: ReadNodePayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.searchByTag')) {
    hookBus.register(
      'runner.app.codeAgentFs.searchByTag',
      async (event) =>
        withService((svc) =>
          svc.searchByTag(SearchByTagPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '用内置 ripgrep 在 path (plan 目标根内) 下按注释 @keyword tag 反查关联文件 + 展开注释节点; tag 须在 tags.json 已声明, 否则回可用词表',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: SearchByTagPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.verifyTasks')) {
    hookBus.register(
      'runner.app.codeAgentFs.verifyTasks',
      async (event) =>
        withService((svc) =>
          svc.verifyTasks(VerifyTasksPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '按 changePlan 校验每个 task 的文件是否已落盘 (存在且非空), 返回 present/missing',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: VerifyTasksPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.collectKeywords')) {
    hookBus.register(
      'runner.app.codeAgentFs.collectKeywords',
      async (event) =>
        withService((svc) =>
          svc.collectKeywords(
            CollectKeywordsPayloadSchema.parse(event.payload ?? {}),
          ),
        ),
      {
        description:
          '扫描 plan 全部文件注释收集 @keyword 关键词, 按 appId 分组去重',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: CollectKeywordsPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.runCommand')) {
    hookBus.register(
      'runner.app.codeAgentFs.runCommand',
      async (event) =>
        withService((svc) =>
          svc.runCommand(RunCommandPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '在某 app 目录 (cwd 围栏) 跑一条终端命令 (脚手架/装依赖), 有界超时, 返回 exitCode/stdout/stderr',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: RunCommandPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.checkInitLock')) {
    hookBus.register(
      'runner.app.codeAgentFs.checkInitLock',
      async (event) =>
        withService((svc) =>
          svc.checkInitLock(InitLockPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description:
          '查该 app 是否已初始化 (app 目录顶层有 init.lock), 返回 { initialized }',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: InitLockPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentFs.writeInitLock')) {
    hookBus.register(
      'runner.app.codeAgentFs.writeInitLock',
      async (event) =>
        withService((svc) =>
          svc.writeInitLock(InitLockPayloadSchema.parse(event.payload ?? {})),
        ),
      {
        description: '写 init.lock 标记该 app 已初始化 (project-init 成功后)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: InitLockPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }
}

/**
 * @title 固定 pnpm store 到 workspace 同卷
 * @description 在 workspace 根写一份 `.npmrc`, 把 pnpm `store-dir` 指到 \`<workspace>/.pnpm-store\` —— 与各 app 的
 *   node_modules **同一个盘**, 硬链接才生效; 所有 app 共享这一份 store, 第二个起装依赖近乎秒过 (每个包+版本在
 *   store 里各存一份, 不同版本并存、不冲突)。已有 store-dir 配置则不动; 失败不致命 (pnpm 退回默认 store)。
 * @keyword-cn pnpm-store固定, 硬链接同卷
 * @keyword-en pin-pnpm-store, hardlink-same-volume
 */
function ensureWorkspacePnpmStore(workspacePath: string): void {
  try {
    const storeDir = join(workspacePath, '.pnpm-store');
    mkdirSync(storeDir, { recursive: true });
    const npmrcPath = join(workspacePath, '.npmrc');
    const line = `store-dir=${storeDir.replace(/\\/g, '/')}`;
    const current = existsSync(npmrcPath)
      ? readFileSync(npmrcPath, 'utf8')
      : '';
    if (/^store-dir=/m.test(current)) return;
    const next = current.trim()
      ? `${current.trimEnd()}\n${line}\n`
      : `${line}\n`;
    writeFileSync(npmrcPath, next, 'utf8');
  } catch {
    // 配不上不致命: pnpm 默认 store 在同盘时也能硬链接
  }
}
