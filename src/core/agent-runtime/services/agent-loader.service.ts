import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as os from 'os';
import { createHash } from 'crypto';
import { pathToFileURL } from 'url';
import type {
  AgentDescriptor,
  LoadedAgent,
  AgentDialoguesContract,
} from '../types/agent-runtime.types';

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
   * 将 TS 文件动态转译为 CJS 并以 data:URL 方式导入，返回模块的 default 导出
   */
  private async importDefaultFromTs(filePath: string): Promise<unknown> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在：${filePath}`);
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
      `azureai-agent-${hash}-${Date.now()}.cjs`,
    );
    fs.writeFileSync(tempFile, code, 'utf-8');

    const mod: unknown = await import(pathToFileURL(tempFile).href);
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`删除临时文件失败 ${tempFile}: ${msg}`);
    }

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
        return {
          name: String(inst['name']),
          description: String(inst['description']),
          supportDialogue,
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
        return {
          name: String(obj['name']),
          description: String(obj['description']),
          supportDialogue,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * 加载 agent.handle.ts 并返回工具数组
   */
  async loadHandleTools(dir: string): Promise<unknown[]> {
    const handlePath = path.join(dir, 'agent.handle.ts');
    if (!fs.existsSync(handlePath)) return [];
    const def = await this.importDefaultFromTs(handlePath);

    if (this.isObject(def)) {
      const rec = def;
      if (this.hasGetTools(rec)) {
        const tools = rec.getTools();
        return Array.isArray(tools) ? tools : [];
      }
      if (this.hasHandleTool(rec)) {
        const toolObj = rec.handleTool();
        return toolObj ? [toolObj] : [];
      }
    }
    // 若为类构造器
    try {
      const inst = this.isCtor(def) ? new def() : def;
      if (this.isObject(inst)) {
        const rec = inst;
        if (this.hasGetTools(rec)) {
          const tools = rec.getTools();
          return Array.isArray(tools) ? tools : [];
        }
        if (this.hasHandleTool(rec)) {
          const t = rec.handleTool();
          return t ? [t] : [];
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`实例化 agent.handle 失败：${msg}`);
    }
    return [];
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
  async loadAll(inputDir: string): Promise<LoadedAgent> {
    const dir = this.resolveAgentDir(inputDir);
    const [desc, tools, dialogues] = await Promise.all([
      this.loadDescriptor(dir),
      this.loadHandleTools(dir),
      this.loadDialogues(dir),
    ]);
    return {
      dir,
      descriptor: desc ?? undefined,
      tools,
      dialogues: dialogues ?? undefined,
    };
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

  private isAgentDialoguesContract(v: unknown): v is AgentDialoguesContract {
    return (
      this.isObject(v) &&
      typeof v['handleAiServer'] === 'function' &&
      typeof v['handle'] === 'function'
    );
  }
}
