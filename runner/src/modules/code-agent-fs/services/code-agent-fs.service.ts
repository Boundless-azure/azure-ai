import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import { rgPath } from '@vscode/ripgrep';
import type { RunnerCodeAgentPlanService } from '../../code-agent-plan/services/code-agent-plan.service';
import {
  CODE_AGENT_FS_LIMITS,
  type CollectKeywordsPayload,
  type CollectKeywordsResult,
  type FastSearchPayload,
  type GrepMatch,
  type GrepPayload,
  type InitLockPayload,
  type EditFilePayload,
  type ReadFilePayload,
  type ReadNodePayload,
  type ReadNodeResult,
  type RunCommandPayload,
  type RunCommandResult,
  type SearchByTagPayload,
  type SearchByTagResult,
  type TagHit,
  type VerifyTasksPayload,
  type VerifyTasksResult,
  type WriteFilePayload,
  type WriteTaskFilePayload,
} from '../types/code-agent-fs.types';

/** 内置 ripgrep 二进制所在目录 (注入进终端 PATH, 让 AI 的 run_terminal 也能直接 `rg`) */
const RG_DIR = dirname(rgPath);

/** app 是否已初始化的标记文件 (通用, 不绑具体技术栈) */
const INIT_LOCK_FILE = 'init.lock';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.astro',
  '.cache',
  '.output',
  'coverage',
  '.pnpm-store',
]);
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|otf|mp4|webm|mov|mp3|wav|pdf|zip|gz|tgz|wasm)$/i;

/**
 * @title Runner 代码生成文件工具服务
 * @description 给 code-agent 的并发代码节点提供 plan 作用域的文件读写/搜索。写只认 task 里存的权威 path
 *   (强制"填已规划文件, 不即兴造"), 读/grep/搜索围栏在该 plan 的目标根 (solutions/<sol>/apps|units|data/<name>)
 *   内, 一律防 `..`/越界。task 路径与目标根都从 RunnerCodeAgentPlanService.searchTasks 解析 (计划集合的唯一
 *   所有者仍是 plan store, 本服务只读它、只写 workspace 文件)。
 * @keyword-cn 代码生成文件服务, 作用域围栏
 * @keyword-en code-agent-fs-service, scope-fence
 */
export class RunnerCodeAgentFsService {
  constructor(
    private readonly planService: RunnerCodeAgentPlanService,
    private readonly workspacePath: string,
  ) {}

  /**
   * 写某 task 已规划的文件 (path 取自 task, 非 LLM 提供); 目录不存在则建。
   * @keyword-cn 写任务文件, 权威路径
   * @keyword-en write-task-file, authoritative-path
   */
  async writeTaskFile(
    payload: WriteTaskFilePayload,
  ): Promise<{ path: string; bytes: number }> {
    const tasks = await this.planService.searchTasks({
      planId: payload.planId,
      taskIds: [payload.taskId],
      limit: 1,
    });
    const task = tasks[0];
    if (!task) {
      throw new Error(
        `task not in plan (planId=${payload.planId} taskId=${payload.taskId}) — ` +
          'generation must fill a PLANNED file; add a task in change-plan instead of inventing one',
      );
    }
    const rel = task.path?.trim();
    if (!rel) throw new Error(`task has no path: ${payload.taskId}`);
    const abs = this.resolveInsideWorkspace(rel);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, payload.content, 'utf8');
    return { path: rel, bytes: Buffer.byteLength(payload.content, 'utf8') };
  }

  /**
   * 按行号区间修改某 task 已规划的文件: 读现文件 → 逐个 edit 用 1-based startLine..endLine (含端点) 把那些行
   * 替成 newText (可多行; 空串=删除) → 写回。行号越界/区间反了/多个 edit 重叠都抛错 (原子: 全成才落盘)。
   * 行号从 readFile 带行号输出取, 天然唯一 → 根除"子串不唯一"。path 取自 task (权威)。供返修/op:modify。
   * @keyword-cn 编辑文件, 按行编辑
   * @keyword-en edit-file, line-edit
   */
  async editFile(
    payload: EditFilePayload,
  ): Promise<{
    path: string;
    bytes: number;
    applied: number;
    content: string;
  }> {
    const tasks = await this.planService.searchTasks({
      planId: payload.planId,
      taskIds: [payload.taskId],
      limit: 1,
    });
    const task = tasks[0];
    if (!task) {
      throw new Error(
        `task not in plan (planId=${payload.planId} taskId=${payload.taskId}) — ` +
          'edit must target a PLANNED file',
      );
    }
    const rel = task.path?.trim();
    if (!rel) throw new Error(`task has no path: ${payload.taskId}`);
    const abs = this.resolveInsideWorkspace(rel);
    let content: string;
    try {
      content = await fs.readFile(abs, 'utf8');
    } catch {
      throw new Error(
        `file does not exist yet: ${rel} — use write_file to create it first, edit_file only modifies`,
      );
    }
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    const lineCount = lines.length;
    // 校验: 行号边界 + 区间方向 (原子: 任一失败即抛, 不落盘)
    payload.edits.forEach((edit, index) => {
      if (edit.startLine > edit.endLine) {
        throw new Error(
          `edit ${index + 1}: startLine ${edit.startLine} > endLine ${edit.endLine}`,
        );
      }
      if (edit.endLine > lineCount) {
        throw new Error(
          `edit ${index + 1}: endLine ${edit.endLine} exceeds file length (${lineCount} lines) in ${rel}`,
        );
      }
    });
    // 校验: 多个 edit 不能重叠 (按 startLine 升序检查)
    const asc = [...payload.edits].sort((a, b) => a.startLine - b.startLine);
    for (let i = 1; i < asc.length; i++) {
      if (asc[i].startLine <= asc[i - 1].endLine) {
        throw new Error(
          `edits overlap around line ${asc[i].startLine} in ${rel} — line ranges must not overlap`,
        );
      }
    }
    // 从后往前应用, 避免前面的替换移动后面 edit 的行号
    const desc = [...payload.edits].sort((a, b) => b.startLine - a.startLine);
    for (const edit of desc) {
      const newLines = edit.newText === '' ? [] : edit.newText.split(/\r?\n/);
      lines.splice(
        edit.startLine - 1,
        edit.endLine - edit.startLine + 1,
        ...newLines,
      );
    }
    content = lines.join(eol);
    await fs.writeFile(abs, content, 'utf8');
    return {
      path: rel,
      bytes: Buffer.byteLength(content, 'utf8'),
      applied: payload.edits.length,
      content,
    };
  }

  /**
   * 读 plan 目标根内的一个文件 (workspace 相对路径)。
   * @keyword-cn 读文件, 作用域围栏
   * @keyword-en read-file, scope-fence
   */
  async readFile(payload: ReadFilePayload): Promise<{
    path: string;
    content: string;
    startLine: number;
    totalLines: number;
  }> {
    const roots = await this.allowedRoots(payload.planId);
    const abs = this.resolveInsideRoots(payload.path, roots);
    const full = await fs.readFile(abs, 'utf8');
    const lines = full.split(/\r?\n/);
    const totalLines = lines.length;
    const start =
      payload.startLine != null ? Math.max(1, payload.startLine) : 1;
    const end =
      payload.endLine != null
        ? Math.min(totalLines, payload.endLine)
        : totalLines;
    const content =
      start === 1 && end === totalLines
        ? full
        : lines.slice(start - 1, Math.max(start - 1, end)).join('\n');
    return { path: this.toRel(abs), content, startLine: start, totalLines };
  }

  /**
   * 写 plan 目标根内的一个文件 (LLM 提供 workspace 相对 path + content); 越界拒, 目录不存在自动建。
   * 内容走工具入参、原样落盘, 不经 shell echo/cat/heredoc → 根除 project-init 手搓文件被逐行转义写坏。
   * task 文件仍走 writeTaskFile (路径权威); 此方法给 tags.json 等非 task 的结构/配置文本。
   * @keyword-cn 写文件, 作用域围栏
   * @keyword-en write-file, scope-fence
   */
  async writeFile(
    payload: WriteFilePayload,
  ): Promise<{ path: string; bytes: number }> {
    const roots = await this.allowedRoots(payload.planId);
    const abs = this.resolveInsideRoots(payload.path, roots);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, payload.content, 'utf8');
    return {
      path: this.toRel(abs),
      bytes: Buffer.byteLength(payload.content, 'utf8'),
    };
  }

  /**
   * 第二层"读代码": 给定 search_by_tag 命中的 @keyword 行, 读它标注的整个符号代码体 —— 从该注释块起, 截到
   * 下一个 @keyword 注释块之前 (或文件尾, B 机制)。回 1-based 行号区间 + 原文, 直接喂 edit_file。
   * @keyword-cn 读节点, 注释代码体
   * @keyword-en read-node, node-body
   */
  async readNode(payload: ReadNodePayload): Promise<ReadNodeResult> {
    const roots = await this.allowedRoots(payload.planId);
    const abs = this.resolveInsideRoots(payload.path, roots);
    const full = await fs.readFile(abs, 'utf8');
    const eol = full.includes('\r\n') ? '\r\n' : '\n';
    const lines = full.split(/\r?\n/);
    const total = lines.length;
    const kwIdx = Math.min(Math.max(payload.line - 1, 0), total - 1);
    const startIdx = commentBlockStart(lines, kwIdx);
    // 下一个 @keyword 行 → 它的注释块起始行前一行 = 本符号体结束
    const kwRe = /@keyword(?:-(?:cn|en))?[\s:]/;
    let nextKwIdx = -1;
    for (let i = kwIdx + 1; i < total; i++) {
      if (kwRe.test(lines[i])) {
        nextKwIdx = i;
        break;
      }
    }
    const endIdx =
      nextKwIdx === -1 ? total - 1 : commentBlockStart(lines, nextKwIdx) - 1;
    const from = Math.min(startIdx, kwIdx);
    const to = Math.max(from, endIdx);
    return {
      path: this.toRel(abs),
      content: lines.slice(from, to + 1).join(eol),
      startLine: from + 1,
      endLine: to + 1,
      totalLines: total,
    };
  }

  /**
   * 在 plan 目标根内按正则搜内容, 返回命中行 (bounded)。
   * @keyword-cn grep搜索, 内容搜索
   * @keyword-en grep-search, content-search
   */
  async grep(payload: GrepPayload): Promise<{ matches: GrepMatch[] }> {
    const cap = Math.min(
      payload.maxResults ?? 60,
      CODE_AGENT_FS_LIMITS.maxGrepMatches,
    );
    const roots = await this.allowedRoots(payload.planId);
    if (roots.length === 0) return { matches: [] };
    // 改用内置 ripgrep (跟 searchByTag 一致): 快、正确 —— 根除旧 JS 遍历的慢 + `g` flag 下 re.test 有状态漏行 bug。
    // flags 只取大小写 (i); rg 行内本就找全部命中, g/m/s 无意义。
    const caseInsensitive = (payload.flags ?? '').includes('i');
    const matches = await this.runRipgrepContent(
      roots,
      payload.pattern,
      caseInsensitive,
      cap,
    );
    return { matches };
  }

  /**
   * 用内置 ripgrep 在 roots (绝对路径) 内按正则搜内容, 回 {path(相对 workspace), line, text}; bounded + 超时 best-effort。
   * @keyword-cn ripgrep内容搜索, grep
   * @keyword-en ripgrep-content-search, grep
   */
  private runRipgrepContent(
    roots: string[],
    pattern: string,
    caseInsensitive: boolean,
    cap: number,
  ): Promise<GrepMatch[]> {
    const args = [
      '--no-heading',
      '--line-number',
      '--color',
      'never',
      caseInsensitive ? '--ignore-case' : '--case-sensitive',
      '-g',
      '!**/node_modules/**',
      '-g',
      '!**/dist/**',
      '-g',
      '!**/.git/**',
      '-g',
      '!**/.astro/**',
      '-g',
      '!**/.pnpm-store/**',
      '--max-count',
      String(cap),
      '-e',
      pattern,
      ...roots,
    ];
    return new Promise((resolvePromise) => {
      const out: GrepMatch[] = [];
      let buffer = '';
      let done = false;
      const child = spawn(rgPath, args, { windowsHide: true });
      const finish = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolvePromise(out);
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish();
      }, CODE_AGENT_FS_LIMITS.tagSearchTimeoutMs);
      child.stdout?.on('data', (d: Buffer) => {
        if (out.length >= cap) return;
        buffer += d.toString();
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const raw = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          // rg 行: `<file>:<line>:<text>`; 非贪婪定位到 :<digits>: 这一处 (盘符 C: 不含数字, 不误匹配)
          const m = /^(.*?):(\d+):(.*)$/.exec(raw);
          if (m && out.length < cap) {
            out.push({
              path: this.toRel(m[1]),
              line: Number(m[2]),
              text: m[3].slice(0, 240),
            });
          }
        }
      });
      child.on('error', finish);
      child.on('close', finish);
    });
  }

  /**
   * 在 plan 目标根内按文件名子串快速找文件。
   * @keyword-cn 快速搜索, 文件名搜索
   * @keyword-en fast-search, filename-search
   */
  async fastSearch(payload: FastSearchPayload): Promise<{ files: string[] }> {
    const cap = Math.min(
      payload.maxResults ?? 50,
      CODE_AGENT_FS_LIMITS.maxSearchResults,
    );
    const query = payload.query.trim().toLowerCase();
    const roots = await this.allowedRoots(payload.planId);
    const files = await this.walkFiles(roots);
    const hit = files
      .map((abs) => this.toRel(abs))
      .filter((relPath) => relPath.toLowerCase().includes(query))
      .slice(0, cap);
    return { files: hit };
  }

  /**
   * 用内置 ripgrep 在 path (须在 plan 目标根内) 下按注释 @keyword `tag` 反查关联文件, 展开命中处的整个注释节点。
   * 门控: tag 必须在该 app 的 tags.json 已声明, 否则不搜, 返回可用词表引导 LLM 改用真实 tag (先声明后搜、不编造)。
   * @keyword-cn 标签搜索, 反查关联文件
   * @keyword-en search-by-tag, reverse-lookup
   */
  async searchByTag(payload: SearchByTagPayload): Promise<SearchByTagResult> {
    const tag = payload.tag.trim();
    const roots = await this.allowedRoots(payload.planId);
    const searchAbs = this.resolveInsideRoots(payload.path, roots);
    const searchRel = this.toRel(searchAbs);
    // tags.json 挂在目标根 (app 目录顶层); path 可能是其子目录, 所以往上定位到所属目标根。
    const root =
      roots.find((r) => searchRel === r || searchRel.startsWith(`${r}/`)) ??
      searchRel;
    const rootAbs = join(this.workspacePath, root);

    // 门控: tag 必须在该 app tags.json 已声明 (先声明后搜、不编造)
    const store = await this.readTagsStore(rootAbs);
    const declared = Object.values(store).some((words) =>
      words.some((w) => w.trim().toLowerCase() === tag.toLowerCase()),
    );
    if (!declared) {
      return {
        tag,
        declared: false,
        message:
          `tag "${tag}" 未在 ${root}/tags.json 声明。按 tag 搜索只认已声明的词 —— ` +
          `请从 availableTags 里挑一个已声明的词再搜; 若确实需要该词, 应先在代码注释里补 @keyword 并同步进 tags.json, 而不是用未声明的词搜。`,
        availableTags: store,
      };
    }

    const cap = Math.min(
      payload.maxResults ?? CODE_AGENT_FS_LIMITS.maxTagHits,
      CODE_AGENT_FS_LIMITS.maxTagHits,
    );
    const located = await this.runRipgrep(searchAbs, tag, cap);
    const hits: TagHit[] = [];
    const contentCache = new Map<string, string | null>();
    for (const loc of located) {
      if (hits.length >= cap) break;
      const abs = resolve(searchAbs, loc.file);
      let content = contentCache.get(abs);
      if (content === undefined) {
        content = await this.readTextSafe(abs);
        contentCache.set(abs, content);
      }
      if (content == null) continue;
      hits.push({
        path: this.toRel(abs),
        line: loc.line,
        node: extractCommentNode(content, loc.line),
      });
    }
    return { tag, declared: true, hits };
  }

  /**
   * 读某目标根顶层的 tags.json 为维度化词表 {维度:[词]}; 缺文件回空, 兼容旧扁平 string[] (归 `其他`)。
   * @keyword-cn 读词表, 兼容旧格式
   * @keyword-en read-tags-store, legacy-tolerant
   */
  private async readTagsStore(
    rootAbs: string,
  ): Promise<Record<string, string[]>> {
    try {
      const raw = await fs.readFile(join(rootAbs, 'tags.json'), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          其他: parsed.filter((x): x is string => typeof x === 'string'),
        };
      }
      if (parsed && typeof parsed === 'object') {
        const out: Record<string, string[]> = {};
        for (const [dim, words] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (Array.isArray(words)) {
            out[dim] = words.filter((x): x is string => typeof x === 'string');
          }
        }
        return out;
      }
    } catch {
      // 无 tags.json / 解析失败 → 空词表 (门控会引导 LLM 先读/补 tags.json)
    }
    return {};
  }

  /**
   * 用内置 ripgrep 在 dirAbs 下定位含该 tag 的 @keyword 注释行 (bounded + 超时); 回 {file(相对 dirAbs), line}。
   * rg 不可用/出错 → 空结果, 不抛 (best-effort)。
   * @keyword-cn ripgrep定位, 关键词行命中
   * @keyword-en ripgrep-locate, keyword-line-hit
   */
  private runRipgrep(
    dirAbs: string,
    tag: string,
    cap: number,
  ): Promise<Array<{ file: string; line: number }>> {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `@keyword(?:-(?:cn|en))?[\\s:].*${escaped}`;
    const args = [
      '--no-heading',
      '--line-number',
      '--color',
      'never',
      '--smart-case',
      '-g',
      '!**/node_modules/**',
      '-g',
      '!**/dist/**',
      '-g',
      '!**/.git/**',
      '-g',
      '!**/.astro/**',
      '-g',
      '!**/.pnpm-store/**',
      '--max-count',
      String(cap),
      '-e',
      pattern,
      '.',
    ];
    return new Promise((resolvePromise) => {
      const out: Array<{ file: string; line: number }> = [];
      let buffer = '';
      let done = false;
      const child = spawn(rgPath, args, { cwd: dirAbs, windowsHide: true });
      const finish = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolvePromise(out);
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish();
      }, CODE_AGENT_FS_LIMITS.tagSearchTimeoutMs);
      child.stdout?.on('data', (d: Buffer) => {
        if (out.length >= cap) return;
        buffer += d.toString();
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const raw = buffer.slice(0, nl).replace(/\\/g, '/');
          buffer = buffer.slice(nl + 1);
          const m = /^(.*?):(\d+):/.exec(raw);
          if (m && out.length < cap) {
            out.push({ file: m[1], line: Number(m[2]) });
          }
        }
      });
      child.on('error', finish);
      child.on('close', finish);
    });
  }

  /**
   * 按 changePlan 校验每个 task 的文件是否已落盘 (存在且非空); 供构建后的验证/repair 节点用。
   * @keyword-cn 落盘校验, 缺失文件
   * @keyword-en verify-tasks, missing-files
   */
  async verifyTasks(payload: VerifyTasksPayload): Promise<VerifyTasksResult> {
    const tasks = await this.planService.searchTasks({
      planId: payload.planId,
      limit: 200,
    });
    const present: string[] = [];
    const missing: Array<{ taskId: string; path: string }> = [];
    for (const task of tasks) {
      const rel = task.path?.trim();
      if (!rel) {
        missing.push({ taskId: task.taskId, path: rel ?? '' });
        continue;
      }
      try {
        const stat = await fs.stat(this.resolveInsideWorkspace(rel));
        if (stat.isFile() && stat.size > 0) present.push(task.taskId);
        else missing.push({ taskId: task.taskId, path: rel });
      } catch {
        missing.push({ taskId: task.taskId, path: rel });
      }
    }
    return { present, missing };
  }

  /**
   * 扫描 plan 全部文件的注释, 收集 @keyword 关键词, 按 appId (task.targetId) 分组去重。
   * @keyword-cn 关键词收集, 注释扫描
   * @keyword-en collect-keywords, comment-scan
   */
  async collectKeywords(
    payload: CollectKeywordsPayload,
  ): Promise<CollectKeywordsResult> {
    const tasks = await this.planService.searchTasks({
      planId: payload.planId,
      limit: 200,
    });
    const byApp: Record<
      string,
      Array<{ dimension?: string; keyword: string }>
    > = {};
    for (const task of tasks) {
      const appId = task.targetId?.trim();
      const rel = task.path?.trim();
      if (!appId || !rel) continue;
      let content: string;
      try {
        content = await fs.readFile(this.resolveInsideWorkspace(rel), 'utf8');
      } catch {
        continue;
      }
      const entries = extractKeywordEntries(content);
      if (entries.length === 0) continue;
      (byApp[appId] ??= []).push(...entries);
    }
    return { byApp };
  }

  /**
   * 在某 app 目录内跑一条终端命令 (项目初始化脚手架/装依赖用); cwd 围栏到 app 目录、有界超时、无用户通知。
   * @keyword-cn 跑命令, 项目初始化
   * @keyword-en run-command, project-init
   */
  async runCommand(payload: RunCommandPayload): Promise<RunCommandResult> {
    const cwd = await this.resolveAppDir(payload.planId, payload.appId);
    await fs.mkdir(cwd, { recursive: true });
    const timeout = Math.min(
      payload.timeoutMs ?? CODE_AGENT_FS_LIMITS.defaultCommandTimeoutMs,
      600_000,
    );
    return execCommand(payload.command, cwd, timeout);
  }

  /**
   * 查该 app 是否已初始化 (app 目录顶层有 init.lock 标记文件)。通用, 不依赖 package.json。
   * @keyword-cn 查初始化锁, app初始化
   * @keyword-en check-init-lock, app-initialized
   */
  async checkInitLock(
    payload: InitLockPayload,
  ): Promise<{ initialized: boolean }> {
    try {
      const dir = await this.resolveAppDir(payload.planId, payload.appId);
      const stat = await fs.stat(join(dir, INIT_LOCK_FILE));
      return { initialized: stat.isFile() };
    } catch {
      return { initialized: false };
    }
  }

  /**
   * 写 init.lock 标记该 app 已初始化 (project-init 成功后调)。
   * @keyword-cn 写初始化锁, 标记初始化
   * @keyword-en write-init-lock, mark-initialized
   */
  async writeInitLock(
    payload: InitLockPayload,
  ): Promise<{ ok: boolean; path: string }> {
    const dir = await this.resolveAppDir(payload.planId, payload.appId);
    await fs.mkdir(dir, { recursive: true });
    const file = join(dir, INIT_LOCK_FILE);
    await fs.writeFile(
      file,
      `initialized ${new Date().toISOString()}\n`,
      'utf8',
    );
    return { ok: true, path: this.toRel(file) };
  }

  /**
   * 由 planId (+ 可选 appId) 解析出该 app 的目录绝对路径 (围栏在 workspace 内)。
   * @keyword-cn app目录解析, 初始化cwd
   * @keyword-en resolve-app-dir, init-cwd
   */
  private async resolveAppDir(planId: string, appId?: string): Promise<string> {
    const tasks = (
      await this.planService.searchTasks({ planId, limit: 200 })
    ).filter((t) => Boolean(t.path));
    // 目标根 (app 目录) 是从 task 路径推导的真相; appId 只是"多 app plan"时的选择器。
    // appId 与 task.targetId 约定可能不一致 (一边完整 id、一边 app 名), 所以: 先精确匹配, 不中再按
    // 目标根去回退 —— appId 里含 app 名 (如 ...-baidu-company-intro-1-0-0), 拿它匹配目标根末段; 仍不中且
    // 全 plan 只有一个目标根就直接用它 (单 app 场景永远安全)。别因 id 对不上就硬挂。
    const rootOf = (t: (typeof tasks)[number]): string | null =>
      targetRoot(t.path ?? '');
    let target = appId ? tasks.find((t) => t.targetId === appId) : undefined;
    if (!target && appId) {
      target = tasks.find((t) => {
        const root = rootOf(t);
        const name = root ? root.split('/').pop() : '';
        return name
          ? appId.includes(`-${name}-`) || appId.endsWith(name)
          : false;
      });
    }
    if (!target) {
      const roots = new Set(tasks.map((t) => rootOf(t)).filter(Boolean));
      target = roots.size <= 1 ? tasks[0] : undefined;
    }
    const root = target ? rootOf(target) : null;
    if (!root) {
      throw new Error(
        `cannot resolve app dir for init (planId=${planId} appId=${appId ?? '-'}; ${tasks.length} tasks)`,
      );
    }
    return this.resolveInsideWorkspace(root);
  }

  /**
   * 从 plan 的全部 task 路径推导目标根集合 (solutions/<sol>/apps|units|data/<name>)。
   * @keyword-cn 目标根, 围栏根集
   * @keyword-en target-roots, fence-roots
   */
  private async allowedRoots(planId: string): Promise<string[]> {
    const tasks = await this.planService.searchTasks({ planId, limit: 200 });
    const roots = new Set<string>();
    for (const task of tasks) {
      const root = targetRoot(task.path ?? '');
      if (root) roots.add(root);
    }
    // 并上计划声明的目标根 —— 规划前 (分析阶段) 还没 task, 靠它围栏才能读/搜既有目标, 否则 roots 空→全越界。
    for (const root of await this.planService.getScopeRoots(planId)) {
      const trimmed = root.trim().replace(/\/+$/, '');
      if (trimmed) roots.add(trimmed);
    }
    return [...roots];
  }

  /**
   * 递归遍历目标根下的文件 (跳过 node_modules/.git/dist 等, bounded)。
   * @keyword-cn 文件遍历, 有界
   * @keyword-en walk-files, bounded
   */
  private async walkFiles(roots: string[]): Promise<string[]> {
    const out: string[] = [];
    const cap = CODE_AGENT_FS_LIMITS.maxWalkFiles;
    const visit = async (absDir: string): Promise<void> => {
      if (out.length >= cap) return;
      const entries = await fs
        .readdir(absDir, { withFileTypes: true })
        .catch(() => null);
      if (!entries) return;
      for (const entry of entries) {
        if (out.length >= cap) return;
        const abs = join(absDir, entry.name);
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await visit(abs);
        } else if (entry.isFile()) {
          out.push(abs);
        }
      }
    };
    for (const root of roots) {
      if (out.length >= cap) break;
      await visit(join(this.workspacePath, root));
    }
    return out;
  }

  /**
   * 读文本文件, 跳过二进制/超大文件 (grep/search 用)。
   * @keyword-cn 安全读文本, 跳二进制
   * @keyword-en read-text-safe, skip-binary
   */
  private async readTextSafe(abs: string): Promise<string | null> {
    if (BINARY_EXT.test(abs)) return null;
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile() || stat.size > CODE_AGENT_FS_LIMITS.maxTextFileBytes) {
        return null;
      }
      return await fs.readFile(abs, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * 解析 workspace 相对路径为绝对路径并防越界 (writeTaskFile 的 task path 用)。
   * @keyword-cn 工作区内解析, 防越界
   * @keyword-en resolve-in-workspace, no-escape
   */
  private resolveInsideWorkspace(relPath: string): string {
    const base = resolve(this.workspacePath);
    const abs = resolve(join(base, relPath));
    if (abs !== base && !abs.startsWith(base + sep)) {
      throw new Error(`path escapes workspace: ${relPath}`);
    }
    return abs;
  }

  /**
   * 解析路径并要求落在某个 plan 目标根内 (read/grep/search 的 LLM 路径用)。
   * @keyword-cn 目标根内解析, 作用域围栏
   * @keyword-en resolve-in-roots, scope-fence
   */
  private resolveInsideRoots(relPath: string, roots: string[]): string {
    const abs = this.resolveInsideWorkspace(relPath);
    const rel = this.toRel(abs);
    const ok = roots.some((root) => rel === root || rel.startsWith(`${root}/`));
    if (!ok) {
      throw new Error(
        `path outside this plan's target roots [${roots.join(', ')}]: ${relPath}`,
      );
    }
    return abs;
  }

  /**
   * 绝对路径转 workspace 相对 (正斜杠)。
   * @keyword-cn 工作区相对, 路径归一化
   * @keyword-en workspace-relative, path-normalize
   */
  private toRel(abs: string): string {
    return relative(resolve(this.workspacePath), abs).split(sep).join('/');
  }
}

/**
 * 从一个 workspace 相对 task 路径提取目标根 solutions/<sol>/apps|units|data/<name>。
 * @keyword-cn 目标根提取, 路径分段
 * @keyword-en target-root-extract, path-segments
 */
function targetRoot(relPath: string): string | null {
  const segs = relPath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (
    segs[0] === 'solutions' &&
    segs.length >= 4 &&
    (segs[2] === 'apps' || segs[2] === 'units' || segs[2] === 'data')
  ) {
    return segs.slice(0, 4).join('/');
  }
  return null;
}

/**
 * 在指定 cwd 跑一条 shell 命令, 有界超时 + 输出截断; 超时 SIGKILL。resolve 不 reject (错误进结果)。
 * @keyword-cn 执行命令, 子进程
 * @keyword-en exec-command, child-process
 */
function execCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<RunCommandResult> {
  return new Promise((resolvePromise) => {
    const cap = CODE_AGENT_FS_LIMITS.maxCommandOutputBytes;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    // 把内置 ripgrep 目录塞进 PATH, 让 AI 的终端命令 (run_terminal) 也能直接 `rg`。保留原 PATH 键的大小写 (Windows 是 `Path`)。
    const env = { ...process.env };
    const pathKey =
      Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
    env[pathKey] = `${RG_DIR}${delimiter}${env[pathKey] ?? ''}`;
    const child = spawn(command, { cwd, shell: true, windowsHide: true, env });
    child.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < cap) stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < cap) stderr += d.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: -1,
        stdout: stdout.slice(0, cap),
        stderr: `${stderr}\n${String(err)}`.slice(0, cap),
        timedOut,
        cwd,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: code ?? -1,
        stdout: stdout.slice(0, cap),
        stderr: stderr.slice(0, cap),
        timedOut,
        cwd,
      });
    });
  });
}

/**
 * 从某一行向上找到它所属注释块的起始行 (0-based): 块注释 `/* … *\/` / HTML `<!-- … -->` 找 opener,
 * 否则连续行注释 (// 或 #) 的最上一行。readNode 用它定符号体起点。
 * @keyword-cn 注释块起始, 读节点
 * @keyword-en comment-block-start, read-node
 */
function commentBlockStart(lines: string[], idx: number): number {
  for (let i = idx; i >= 0 && idx - i <= 120; i--) {
    if (i < idx && (lines[i].includes('*/') || lines[i].includes('-->'))) break;
    if (/\/\*/.test(lines[i]) || lines[i].includes('<!--')) return i;
  }
  let s = idx;
  while (s > 0 && /^\s*(\/\/|#)/.test(lines[s - 1])) s -= 1;
  return s;
}

/**
 * 从文件内容里把某一行 (@keyword 命中行) 所属的整个注释节点展开出来: JSDoc/块注释 `/* … *\/`、HTML/Astro/Vue
 * `<!-- … -->`、或连续行注释 (//、*、#); 再附上被注释的声明片段, 让调用方看到"注释 + 它注释的东西"。有界。
 * @keyword-cn 注释节点展开, 跨注释风格
 * @keyword-en extract-comment-node, comment-style-agnostic
 */
function extractCommentNode(content: string, lineNo: number): string {
  const lines = content.split(/\r?\n/);
  const maxSpan = CODE_AGENT_FS_LIMITS.maxCommentNodeLines;
  const idx = Math.min(Math.max(lineNo - 1, 0), lines.length - 1);

  const clampSlice = (start: number, end: number): string =>
    lines
      .slice(Math.max(0, start), Math.min(lines.length, end + 1))
      .join('\n')
      .slice(0, 4000);
  // 注释块之后紧跟的非空行通常是被注释的声明 (函数/类/常量), 附最多 2 行让节点自解释。
  const withDecl = (start: number, end: number): string => {
    let added = 0;
    for (let d = end + 1; d < lines.length && d - start < maxSpan; d++) {
      const t = lines[d].trim();
      if (!t) continue;
      added++;
      if (/[;{]\s*$/.test(t) || added >= 2) return clampSlice(start, d);
    }
    return clampSlice(start, end);
  };

  // 1) 块注释 /* … */ (含 JSDoc /**)
  let open = -1;
  for (let i = idx; i >= 0 && idx - i <= maxSpan; i--) {
    if (i < idx && lines[i].includes('*/')) break; // 命中前已闭合 → 不在块内
    if (/\/\*\*?/.test(lines[i])) {
      open = i;
      break;
    }
  }
  if (open !== -1) {
    for (
      let i = Math.max(open, idx);
      i < lines.length && i - open <= maxSpan;
      i++
    ) {
      if (lines[i].includes('*/')) return withDecl(open, i);
    }
  }

  // 2) HTML/Astro/Vue 注释 <!-- … -->
  let hopen = -1;
  for (let i = idx; i >= 0 && idx - i <= maxSpan; i--) {
    if (i < idx && lines[i].includes('-->')) break;
    if (lines[i].includes('<!--')) {
      hopen = i;
      break;
    }
  }
  if (hopen !== -1) {
    for (
      let i = Math.max(hopen, idx);
      i < lines.length && i - hopen <= maxSpan;
      i++
    ) {
      if (lines[i].includes('-->')) return withDecl(hopen, i);
    }
  }

  // 3) 连续行注释 (// 或 * 续行 或 #)
  const isLineComment = (s: string): boolean => /^\s*(\/\/|\*|#)/.test(s);
  if (isLineComment(lines[idx])) {
    let s = idx;
    let e = idx;
    while (s > 0 && isLineComment(lines[s - 1]) && idx - s < maxSpan) s--;
    while (
      e < lines.length - 1 &&
      isLineComment(lines[e + 1]) &&
      e - idx < maxSpan
    )
      e++;
    return withDecl(s, e);
  }

  // 兜底: 命中行 ± 少量上下文
  return clampSlice(idx - 1, idx + 1);
}

/**
 * 从文件内容抽出注释里的**维度化** @keyword 条目 (`维度:词`; 无维度归 undefined 由 appTag 兜 `其他`);
 * 兼容旧 @keyword-cn/-en; 每行截断到维度上限、去前导 @。
 * @keyword-cn 关键词抽取, 维度解析
 * @keyword-en extract-keywords, dimension-parse
 */
function extractKeywordEntries(
  content: string,
): Array<{ dimension?: string; keyword: string }> {
  const out: Array<{ dimension?: string; keyword: string }> = [];
  const line = /@keyword(?:-(?:cn|en))?[\s:]+([^\n*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = line.exec(content)) !== null) {
    const parts = match[1]
      .split(/[,，]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, CODE_AGENT_FS_LIMITS.maxKeywordsPerLine);
    for (const part of parts) {
      const sep = part.search(/[:：]/);
      if (sep > 0) {
        const dimension = part.slice(0, sep).trim();
        const keyword = part
          .slice(sep + 1)
          .trim()
          .replace(/^@+/, '')
          .trim();
        if (keyword) out.push({ dimension, keyword });
      } else {
        const keyword = part.replace(/^@+/, '').trim();
        if (keyword) out.push({ keyword });
      }
    }
  }
  return out;
}
