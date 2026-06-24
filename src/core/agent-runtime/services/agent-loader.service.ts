import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as os from 'os';
import { createHash, randomUUID } from 'crypto';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import type {
  AgentDescriptor,
  LoadedAgent,
  AgentDialoguesContract,
} from '../types/agent-runtime.types';

type HandleLoadOptions = {
  aiServer?: unknown;
  pluginService?: unknown;
  solutionService?: unknown;
  runnerHookRpc?: unknown;
  hookBus?: unknown;
  workflowContext?: unknown;
  checkpointer?: unknown;
  agentConfig?: { aiModelIds?: string[] };
};

/**
 * @title Agent 动态加载服务
 * @description 负责从给定目录加载 agent.desc、agent.handle 与 dialogues.min，并进行类型安全校验与实例化。
 * @keywords-cn 动态加载, 目录解析, 句柄工具, 对话类, 类型校验
 * @keywords-en dynamic-load, path-resolve, handle-tool, dialogues-class, type-guard
 */
@Injectable()
export class AgentLoaderService {
  private readonly logger = new Logger(AgentLoaderService.name);

  /**
   * 解析并标准化 Agent 代码目录：允许传入 name、相对路径或绝对路径
   */
  resolveAgentDir(input: string): string {
    const cwd = process.cwd();
    const candidates: string[] = [];
    const norm = input.replace(/\\/g, '/').trim();
    if (!norm) throw new Error('codeDir 不能为空');

    // 允许传入："code-agent" | "agents/code-agent" | "src/agents/code-agent" | 绝对路径
    if (path.isAbsolute(norm)) {
      candidates.push(norm);
    } else {
      candidates.push(path.join(cwd, norm));
      candidates.push(path.join(cwd, 'src', norm));
      candidates.push(path.join(cwd, 'src', 'agents', norm));
      // 若仅传入名称，拼接到 src/agents
      candidates.push(path.join(cwd, 'src', 'agents', path.basename(norm)));
    }

    for (const dir of candidates) {
      const desc = path.join(dir, 'agent.desc.ts');
      const handle = path.join(dir, 'agent.handle.ts');
      const dialogues = path.join(dir, 'dialogues', 'dialogues.min.ts');
      if (
        fs.existsSync(desc) ||
        fs.existsSync(handle) ||
        fs.existsSync(dialogues)
      ) {
        return dir;
      }
    }
    throw new Error(`无法解析 Agent 目录：${norm}`);
  }

  /**
   * 加载 agent 源文件的默认导出：dist 运行时优先复用同名 JS 产物，开发态再尝试直接加载源文件，最后回退到临时 transpile。
   * @keyword-en import-default-from-ts
   */
  private async importDefaultFromTs(filePath: string): Promise<unknown> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在：${filePath}`);
    }

    const builtArtifactPath = this.resolveBuiltArtifactPath(filePath);
    if (builtArtifactPath) {
      try {
        return this.pickDefaultExport(
          await this.loadModuleFromFile(builtArtifactPath),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `加载 dist agent 文件失败 ${builtArtifactPath}: ${msg}`,
        );
      }
    }

    try {
      return this.pickDefaultExport(await this.loadModuleFromFile(filePath));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`直接加载源 agent 文件失败 ${filePath}: ${msg}`);
    }

    const source = fs.readFileSync(filePath, 'utf-8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        skipLibCheck: true,
        isolatedModules: true,
      },
      reportDiagnostics: false,
    });

    const code = transpiled.outputText;
    const hash = createHash('sha1')
      .update(filePath + source)
      .digest('hex')
      .slice(0, 8);
    const tempFile = path.join(
      os.tmpdir(),
      `azureai-agent-${hash}-${randomUUID()}.cjs`,
    );
    fs.writeFileSync(tempFile, code, 'utf-8');

    let mod: unknown;
    try {
      mod = await this.loadModuleFromFile(tempFile);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`加载临时 transpile 文件失败 ${tempFile}: ${msg}`);
      throw error;
    }
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`删除临时文件失败 ${tempFile}: ${msg}`);
    }

    return this.pickDefaultExport(mod);
  }

  /**
   * 从现有文件模块加载导出；Windows 上 import fallback 强制转成 file:// URL。
   * @keyword-en load-module-from-file
   */
  private async loadModuleFromFile(moduleFilePath: string): Promise<unknown> {
    const requireFn = createRequire(__filename);
    try {
      return requireFn(moduleFilePath);
    } catch {
      return import(pathToFileURL(moduleFilePath).href);
    }
  }

  /**
   * dist 运行时把 src 下 agent 源文件映射到 dist 下同名 JS 产物，避免 Temp 路径破坏依赖与相对导入解析。
   * @keyword-en resolve-built-artifact-path
   */
  private resolveBuiltArtifactPath(filePath: string): string | null {
    if (!path.normalize(__filename).includes(`${path.sep}dist${path.sep}`)) {
      return null;
    }

    const srcRoot = path.join(process.cwd(), 'src');
    const normalizedFilePath = path.normalize(filePath);
    const relativeFromSrc = path.relative(srcRoot, normalizedFilePath);
    if (
      relativeFromSrc.startsWith('..') ||
      path.isAbsolute(relativeFromSrc) ||
      !relativeFromSrc.endsWith('.ts')
    ) {
      return null;
    }

    const builtArtifactPath = path
      .join(process.cwd(), 'dist', relativeFromSrc)
      .replace(/\.ts$/, '.js');
    return fs.existsSync(builtArtifactPath) ? builtArtifactPath : null;
  }

  /**
   * 从模块对象中提取默认导出或约定命名导出。
   * @keyword-en pick-default-export
   */
  private pickDefaultExport(mod: unknown): unknown {
    const rec = this.isObject(mod) ? mod : undefined;
    const def = rec
      ? (rec['default'] ??
        rec['Agent'] ??
        rec['AgentHandle'] ??
        rec['DialoguesClass'])
      : undefined;
    return def ?? mod;
  }

  private isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
  }

  private hasString(v: unknown, key: string): boolean {
    return this.isObject(v) && typeof v[key] === 'string';
  }

  /**
   * 加载 agent.desc.ts
   */
  async loadDescriptor(dir: string): Promise<AgentDescriptor | null> {
    const descPath = path.join(dir, 'agent.desc.ts');
    if (!fs.existsSync(descPath)) return null;
    const def = await this.importDefaultFromTs(descPath);
    if (this.isObject(def)) {
      const inst = 'name' in def && 'description' in def ? def : undefined;
      if (
        inst &&
        this.hasString(inst, 'name') &&
        this.hasString(inst, 'description')
      ) {
        const supportDialogue =
          typeof inst['supportDialogue'] === 'boolean'
            ? inst['supportDialogue']
            : false;
        const defaultDebug =
          typeof inst['defaultDebug'] === 'boolean'
            ? inst['defaultDebug']
            : undefined;
        return {
          name: String(inst['name']),
          description: String(inst['description']),
          supportDialogue,
          ...(defaultDebug !== undefined ? { defaultDebug } : {}),
        };
      }
    }
    // 若为类，尝试实例化
    try {
      const obj = this.isCtor(def) ? new def() : def;
      if (
        this.isObject(obj) &&
        this.hasString(obj, 'name') &&
        this.hasString(obj, 'description')
      ) {
        const supportDialogue =
          typeof obj['supportDialogue'] === 'boolean'
            ? obj['supportDialogue']
            : false;
        const defaultDebug =
          typeof obj['defaultDebug'] === 'boolean'
            ? obj['defaultDebug']
            : undefined;
        return {
          name: String(obj['name']),
          description: String(obj['description']),
          supportDialogue,
          ...(defaultDebug !== undefined ? { defaultDebug } : {}),
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * 加载 agent.handle.ts 并返回工具数组；若实例支持可选注入方法，则在导出工具前完成注入。
   */
  async loadHandleTools(
    dir: string,
    options?: HandleLoadOptions,
  ): Promise<unknown[]> {
    const handlePath = path.join(dir, 'agent.handle.ts');
    if (!fs.existsSync(handlePath)) return [];
    const def = await this.importDefaultFromTs(handlePath);

    if (this.isObject(def)) {
      const rec = def;
      if (this.hasGetTools(rec) || this.hasHandleTool(rec)) {
        this.prepareHandle(rec, options);
        return this.extractHandleTools(rec);
      }
    }
    // 若为类构造器
    try {
      const inst = this.isCtor(def) ? new def() : def;
      if (this.isObject(inst)) {
        const rec = inst;
        if (this.hasGetTools(rec) || this.hasHandleTool(rec)) {
          this.prepareHandle(rec, options);
          return this.extractHandleTools(rec);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`实例化 agent.handle 失败：${msg}`);
    }
    return [];
  }

  /**
   * 提取句柄层导出的工具列表，并统一展平为一维数组。
   */
  private extractHandleTools(handle: Record<string, unknown>): unknown[] {
    if (this.hasGetTools(handle)) {
      return this.normalizeToolOutput(handle.getTools());
    }
    if (this.hasHandleTool(handle)) {
      return this.normalizeToolOutput(handle.handleTool());
    }
    return [];
  }

  /**
   * 按实例是否实现对应方法，注入 AI、插件、工作流上下文和模型配置。
   * @keyword-en handle-duck-typing, workflow-context, checkpoint-injection
   */
  private prepareHandle(
    handle: Record<string, unknown>,
    options?: HandleLoadOptions,
  ): void {
    if (!options) return;
    this.callOptionalMethod(handle, 'handleAiServer', options.aiServer);
    this.callOptionalMethod(
      handle,
      'handlePluginService',
      options.pluginService,
    );
    this.callOptionalMethod(
      handle,
      'handleSolutionService',
      options.solutionService,
    );
    this.callOptionalMethod(
      handle,
      'handleRunnerHookRpc',
      options.runnerHookRpc,
    );
    this.callOptionalMethod(handle, 'handleHookBus', options.hookBus);
    this.callOptionalMethod(
      handle,
      'withWorkflowContext',
      options.workflowContext,
    );
    this.callOptionalMethod(handle, 'handleCheckpointer', options.checkpointer);
    this.callOptionalMethod(handle, 'setAgentConfig', options.agentConfig);
  }

  /**
   * 加载 dialogues/dialogues.min.ts，返回实例（若存在）
   */
  async loadDialogues(dir: string): Promise<AgentDialoguesContract | null> {
    const dlgPath = path.join(dir, 'dialogues', 'dialogues.min.ts');
    if (!fs.existsSync(dlgPath)) return null;
    const def = await this.importDefaultFromTs(dlgPath);
    try {
      const inst = this.isCtor(def) ? new def() : def;
      if (this.isObject(inst) && this.isAgentDialoguesContract(inst)) {
        return inst;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`实例化 DialoguesClass 失败：${msg}`);
    }
    return null;
  }

  /**
   * 综合加载结果：返回描述、工具与对话类实例
   */
  async loadAll(
    inputDir: string,
    options?: HandleLoadOptions,
  ): Promise<LoadedAgent> {
    const dir = this.resolveAgentDir(inputDir);
    const [desc, tools, dialogues] = await Promise.all([
      this.loadDescriptor(dir),
      this.loadHandleTools(dir, options),
      this.loadDialogues(dir),
    ]);
    if (dialogues) {
      this.prepareDialogues(dialogues, options);
    }
    return {
      dir,
      descriptor: desc ?? undefined,
      tools,
      dialogues: dialogues ?? undefined,
    };
  }

  /**
   * 按对话层是否实现对应方法，注入插件、Solution 服务和模型配置。
   * @keyword-en dialogue-injection, solution-service, plugin-service
   */
  private prepareDialogues(
    dialogues: AgentDialoguesContract,
    options?: HandleLoadOptions,
  ): void {
    if (!options || !this.isObject(dialogues)) return;
    this.callOptionalMethod(
      dialogues,
      'handlePluginService',
      options.pluginService,
    );
    this.callOptionalMethod(
      dialogues,
      'handleSolutionService',
      options.solutionService,
    );
    this.callOptionalMethod(dialogues, 'setAgentConfig', options.agentConfig);
  }

  /**
   * 统一把工具导出值压平成一维数组，避免 handleTool 返回数组时被二次包裹。
   */
  private normalizeToolOutput(output: unknown[] | unknown): unknown[] {
    if (Array.isArray(output)) {
      return output.flatMap((item) => (Array.isArray(item) ? item : [item]));
    }
    return output ? [output] : [];
  }

  private isCtor(v: unknown): v is new () => unknown {
    return typeof v === 'function';
  }

  private hasGetTools(v: unknown): v is { getTools: () => unknown[] } {
    return this.isObject(v) && typeof v['getTools'] === 'function';
  }

  private hasHandleTool(v: unknown): v is { handleTool: () => unknown } {
    return this.isObject(v) && typeof v['handleTool'] === 'function';
  }

  private callOptionalMethod(
    handle: Record<string, unknown>,
    methodName: string,
    arg: unknown,
  ): void {
    if (arg === undefined) return;
    const method = handle[methodName];
    if (typeof method !== 'function') return;
    try {
      (method as (input: unknown) => unknown).call(handle, arg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`调用 agent.handle.${methodName} 失败：${msg}`);
    }
  }

  private isAgentDialoguesContract(v: unknown): v is AgentDialoguesContract {
    return (
      this.isObject(v) &&
      typeof v['handleAiServer'] === 'function' &&
      typeof v['handle'] === 'function'
    );
  }
}
