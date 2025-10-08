/* cspell:words deepseek subdirs */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TIP_OPTIONS } from './tip.tokens';
import type {
  TipGenerateOptions,
  TipModuleOptions,
  TipFileInfo,
  TipFunctionInfo,
  TipGenerateResult,
} from './tip.types';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AIModelService } from '../ai/services/ai-model.service';

@Injectable()
export class TipGeneratorService {
  private readonly logger = new Logger(TipGeneratorService.name);
  constructor(
    @Inject(TIP_OPTIONS) private readonly options: TipModuleOptions,
    private readonly aiModelService: AIModelService,
  ) {}

  async generateModuleTip(
    opts: TipGenerateOptions,
  ): Promise<TipGenerateResult> {
    const dir = path.resolve(opts.dir);
    const outName = opts.outputFileName ?? 'module.tip';
    const outputPath = path.join(dir, outName);

    // 1) AST：扫描目录与函数信息
    const files = this.listTsFiles(dir);
    const fileInfos: TipFileInfo[] = files.map((f) =>
      this.getAstFunctionsForFile(f),
    );

    // 2) 构造关键词索引与快速检索映射
    const keywordIndexLines: string[] = [];
    const quickMapLines: string[] = [];
    const warnings: string[] = [];
    if (fileInfos.length === 0) {
      warnings.push(
        'No TypeScript files found under target dir. Ensure the dir is correct.',
      );
    }
    for (const info of fileInfos) {
      const base = path.basename(info.filePath);
      const baseNoExt = base.replace(/\.[^.]+$/, '');
      const rel = this.relativePath(info.filePath);
      keywordIndexLines.push(`- "${baseNoExt}" / "${base}" -> ${rel}`);
      quickMapLines.push(`- "${baseNoExt}" -> ${rel}`);
      (info.functions ?? []).forEach((fn) => {
        const tokens = [fn.name, fn.kind].filter(Boolean).join(' ');
        keywordIndexLines.push(`- "${tokens}" -> ${rel}`);
        quickMapLines.push(`- "${fn.name}" -> ${rel}`);
      });
    }

    // 3) AST 基础文档
    const lines: string[] = [];
    lines.push(`# Module Tip（自动生成，AST+AI 组合）`);
    lines.push(`目标目录: ${dir}`);
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('文件列表（File List）');
    for (const info of fileInfos) {
      lines.push(
        `- ${this.relativePath(info.filePath)}：${path.basename(info.filePath)}`,
      );
    }
    lines.push('');
    lines.push('函数索引（Function Index）');
    for (const info of fileInfos) {
      lines.push(`- 文件：${this.relativePath(info.filePath)}`);
      for (const fn of info.functions ?? []) {
        lines.push(`  - ${fn.kind}: ${fn.name} (line ${fn.location.line})`);
      }
    }

    // 4) AI 生成说明与关键词（若可用）
    let aiKeywords: string[] = [];
    let aiFileDesc = '';
    let aiFuncDesc = '';
    const modelId = await this.pickAIModelId(opts.aiModelId);
    this.logger.log(
      `[AI] generateModuleTip: selected modelId=${modelId ?? 'none'}`,
    );
    if (modelId) {
      try {
        const context = this.buildAIContextForDir(dir, fileInfos, opts);
        const systemPrompt =
          opts.systemPrompt ||
          '你是资深的技术文档生成器。请严格输出以下三个部分：\n' +
            '文件说明\n函数说明\n关键词索引（中文 / English Keyword Index）\n' +
            '要求：仅引用当前模块目录下的文件路径（避免跨模块）；关键词包含文件名、类名与方法名；简明但覆盖核心职责。';
        const userPrompt =
          `目标目录: ${dir}\n以下为 AST 基础索引与上下文：\n\n` + context;
        this.logger.log(
          `[AI] generateModuleTip: invoking chat for dir=${dir} with modelId=${modelId}`,
        );
        const resp = await this.aiModelService.chat({
          modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          params: { maxTokens: 4096, temperature: 0.3 },
        });
        this.logger.log(
          `[AI] generateModuleTip: chat done model=${resp.model ?? modelId}, time=${resp.responseTime ?? 'n/a'}, requestId=${resp.requestId ?? 'n/a'}`,
        );
        const content = resp.content || '';
        const fileDescMatch = content.match(
          /文件说明[\s\S]*?(?=\n\s*函数说明|$)/,
        );
        const funcDescMatch = content.match(
          /函数说明[\s\S]*?(?=\n\s*关键词索引|$)/,
        );
        const keywordsMatch = content.match(
          /关键词索引（中文 \/? English Keyword Index）[\s\S]*$/,
        );
        aiFileDesc = fileDescMatch?.[0]?.trim() || '';
        aiFuncDesc = funcDescMatch?.[0]?.trim() || '';
        const aiKw = keywordsMatch?.[0]?.split('\n') ?? [];
        aiKeywords = aiKw
          .slice(1)
          .map((l) => l.trim())
          .filter(Boolean);
      } catch (e) {
        this.logger.error(
          `[AI] generateModuleTip: chat failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        warnings.push(
          `AI generation failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      warnings.push('No AI model available');
    }

    // 5) 合并输出
    lines.push('');
    lines.push('文件说明');
    lines.push(aiFileDesc || '- （AI 未生成，待补充）');
    lines.push('');
    lines.push('函数说明');
    lines.push(aiFuncDesc || '- （AI 未生成，待补充）');
    lines.push('');
    lines.push('关键词索引（中文 / English Keyword Index）');
    if (aiKeywords.length > 0) {
      lines.push(...aiKeywords);
    }
    lines.push(...keywordIndexLines);
    lines.push('');
    lines.push('快速检索映射（Keywords -> Files）');
    lines.push(...quickMapLines);

    // 6) 诊断与提示
    lines.push('');
    lines.push('#problems_and_diagnostics');
    lines.push(
      '- [info] 此 tip 文件由 AST+AI 组合生成。添加新服务或方法后请更新关键词索引',
    );
    lines.push('- [warning] 若函数索引为空，AST 解析可能受限或目录不正确');
    lines.push(
      '- [info] Provider 说明需与实际支持的提供者保持一致：openai、anthropic、google、gemini、deepseek',
    );

    const content = lines.join('\n');
    if (opts.writeToFile !== false) {
      try {
        fs.writeFileSync(outputPath, content, 'utf-8');
      } catch (e) {
        return {
          outputPath,
          content,
          warnings,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    return { outputPath, content, warnings };
  }

  /**
   * 基于 AI 的 Tip 生成（异步）。
   * - 构建目录与函数索引作为提示信息
   * - 调用 AIModelService.chat 生成包含：目录结构、函数清单、文件说明、函数说明、关键词索引 的完整文档
   */
  async generateModuleTipAI(
    opts: TipGenerateOptions,
  ): Promise<TipGenerateResult> {
    const dir = path.resolve(opts.dir);
    const outName = opts.outputFileName ?? 'module.tip';
    const outputPath = path.join(dir, outName);

    // 1) 收集上下文（文件与函数索引 + 源码/注释片段）
    const files = this.listTsFiles(dir);
    const fileInfos: TipFileInfo[] = files.map((f) =>
      this.getAstFunctionsForFile(f),
    );
    const context = this.buildAIContextForDir(dir, fileInfos, opts);

    // 2) 选择模型
    let modelId = opts.aiModelId;
    if (!modelId) {
      try {
        const enabled = await this.aiModelService.getEnabledModels();
        modelId = enabled[0]?.id;
        this.logger.log(
          `[AI] generateModuleTipAI: enabled models=${enabled.map((m) => m.id).join(', ') || 'none'}, selected=${modelId ?? 'none'}`,
        );
      } catch (e) {
        this.logger.warn(`Failed to get enabled models: ${String(e)}`);
      }
    }
    if (!modelId) {
      const content =
        context + '\n\n[warning] 无可用 AI 模型，已回退到原始索引输出。';
      if (opts.writeToFile !== false) {
        try {
          fs.writeFileSync(outputPath, content, 'utf-8');
        } catch (e) {
          return {
            outputPath,
            content,
            warnings: ['No AI model available'],
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
      return { outputPath, content, warnings: ['No AI model available'] };
    }

    // 3) 构建提示
    const systemPrompt =
      opts.systemPrompt ||
      '你是资深的技术文档生成器。请严格输出以下结构：\n' +
        '1) 目录结构\n2) 函数清单\n3) 文件说明\n4) 函数说明\n5) 关键词索引（中文 / English Keyword Index）\n' +
        '要求：\n- 仅引用当前模块目录下的文件路径（避免跨模块）\n- 中英文关键词均可，包含文件名、类名与方法名\n- 精炼、准确，可用于快速检索\n';
    const userPrompt =
      `目标目录: ${dir}\n` +
      '以下为原始索引与上下文，请据此生成完整 Tip：\n\n' +
      context;

    // 4) 调用 AI 生成
    try {
      this.logger.log(
        `[AI] generateModuleTipAI: invoking chat for dir=${dir} with modelId=${modelId}`,
      );
      const resp = await this.aiModelService.chat({
        modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        params: { maxTokens: 4096, temperature: 0.3 },
      });
      this.logger.log(
        `[AI] generateModuleTipAI: chat done model=${resp.model ?? modelId}, time=${resp.responseTime ?? 'n/a'}, requestId=${resp.requestId ?? 'n/a'}`,
      );
      const content =
        (resp.content || '') +
        '\n\n#problems_and_diagnostics' +
        '\n- [info] 此 tip 文件由 AI 生成，内容依赖源代码与注释上下文' +
        '\n- [warning] 如存在跨模块映射或缺失章节，请运行 GET /tip/diagnostics 修复';
      if (opts.writeToFile !== false) {
        try {
          fs.writeFileSync(outputPath, content, 'utf-8');
        } catch (e) {
          return {
            outputPath,
            content,
            warnings: [],
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
      return { outputPath, content, warnings: [] };
    } catch (e) {
      this.logger.error(
        `[AI] generateModuleTipAI: chat failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      console.error(e);
      // 回退：输出原始索引，并记录错误
      const fallback =
        context +
        '\n\n#problems_and_diagnostics' +
        `\n- [error] AI 生成失败：${e instanceof Error ? e.message : String(e)}` +
        '\n- [info] 已回退到原始索引输出。';
      if (opts.writeToFile !== false) {
        try {
          fs.writeFileSync(outputPath, fallback, 'utf-8');
        } catch (err) {
          return {
            outputPath,
            content: fallback,
            warnings: ['AI generation failed'],
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
      return {
        outputPath,
        content: fallback,
        warnings: ['AI generation failed'],
      };
    }
  }

  // 为 baseDir 直接子目录分别生成 module.tip（确保每个模块都有独立的 tip，不混在一起）
  async generateTipsForModules(
    baseDir: string,
    writeToFile = true,
  ): Promise<TipGenerateResult[]> {
    const dir = path.resolve(baseDir);
    const subdirs = this.listSubDirs(dir);
    const results: TipGenerateResult[] = [];
    for (const sd of subdirs) {
      const res = await this.generateModuleTip({
        dir: sd,
        writeToFile,
        outputFileName: 'module.tip',
      });
      results.push(res);
    }
    return results;
  }

  private buildAIContextForDir(
    dir: string,
    fileInfos: TipFileInfo[],
    opts?: TipGenerateOptions,
  ): string {
    const lines: string[] = [];
    const tags = opts?.aiCommentTags?.length
      ? opts.aiCommentTags
      : ['@tip', '@doc', '@purpose'];
    const includeCode = opts?.aiIncludeCode !== false; // 默认包含代码
    const commentsOnly = opts?.aiIncludeCommentsOnly !== false ? true : false; // 默认仅注释块
    const maxChars = opts?.aiMaxCodeChars ?? 8000;

    lines.push('文件列表（File List）');
    for (const info of fileInfos) {
      lines.push(
        `- ${this.relativePath(info.filePath)}：${path.basename(info.filePath)}`,
      );
    }
    lines.push('');
    lines.push('函数索引（Function Index）');
    for (const info of fileInfos) {
      lines.push(`- 文件：${this.relativePath(info.filePath)}`);
      for (const fn of info.functions ?? []) {
        lines.push(`  - ${fn.kind}: ${fn.name} (line ${fn.location.line})`);
      }
    }

    if (includeCode) {
      lines.push('');
      lines.push('源码片段（Annotated Source Context）');
      lines.push(`- 注释标签识别：${tags.join(', ')}`);
      const perFileBudget = Math.max(
        400,
        Math.floor(maxChars / Math.max(1, fileInfos.length)),
      );
      for (const info of fileInfos) {
        lines.push(`-- 文件：${this.relativePath(info.filePath)}`);
        let sourceText = '';
        try {
          sourceText = fs.readFileSync(info.filePath, 'utf-8');
        } catch {
          sourceText = '';
        }
        if (!sourceText) {
          lines.push('  (读取失败或为空)');
          continue;
        }
        if (commentsOnly) {
          const blocks = this.extractAnnotatedComments(sourceText, tags);
          if (blocks.length > 0) {
            for (const b of blocks) {
              const trimmed = b.trim();
              const chunk =
                trimmed.length > perFileBudget
                  ? trimmed.slice(0, perFileBudget) + '\n...（截断）'
                  : trimmed;
              lines.push(chunk);
            }
          } else {
            // 若没有带标签注释，则回退包含前 N 字符的代码
            const chunk = this.truncateContentByBudget(
              sourceText,
              perFileBudget,
            );
            lines.push(chunk);
          }
        } else {
          const chunk = this.truncateContentByBudget(sourceText, perFileBudget);
          lines.push(chunk);
        }
      }
    }
    return lines.join('\n');
  }

  private extractAnnotatedComments(
    sourceText: string,
    tags: string[],
  ): string[] {
    const out: string[] = [];
    const tagRegex = new RegExp(
      tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
      'i',
    );
    // 匹配块注释
    const blockRegex = /\/*[^]*?\*\//g;
    const lineRegex = /\/\/[^\n]*/g;
    const blocks = sourceText.match(blockRegex) ?? [];
    for (const b of blocks) {
      if (tagRegex.test(b)) out.push(b);
    }
    const lines = sourceText.match(lineRegex) ?? [];
    for (const l of lines) {
      if (tagRegex.test(l)) out.push(l);
    }
    return out;
  }

  private truncateContentByBudget(sourceText: string, budget: number): string {
    if (sourceText.length <= budget) return sourceText;
    // 优先保留文件头部与主要导出部分（简单策略：头部 + 尾部）
    const head = sourceText.slice(0, Math.floor(budget * 0.7));
    const tail = sourceText.slice(-Math.floor(budget * 0.3));
    return head + '\n...（截断）\n' + tail;
  }

  private async pickAIModelId(pref?: string): Promise<string | undefined> {
    if (pref) return pref;
    try {
      const enabled = await this.aiModelService.getEnabledModels();
      return enabled[0]?.id;
    } catch (e) {
      this.logger.warn(`Failed to get enabled models: ${String(e)}`);
      return undefined;
    }
  }

  // 列出直接子目录（排除 excludePatterns）
  private listSubDirs(dir: string): string[] {
    const out: string[] = [];
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (this.isExcluded(full)) continue;
      out.push(full);
    }
    return out;
  }

  // 工具：相对路径（相对于 src/ 根，方便检索）
  private relativePath(abs: string): string {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const rel = path.relative(srcRoot, abs).replace(/\\/g, '/');
    return rel.startsWith('..') ? abs.replace(/\\/g, '/') : rel;
  }

  // 扫描 TS 文件
  private listTsFiles(dir: string, depth = 0, acc: string[] = []): string[] {
    const maxDepth = this.options.maxDepth ?? 5;
    if (depth > maxDepth) return acc;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return acc;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (this.isExcluded(full)) continue;
        this.listTsFiles(full, depth + 1, acc);
      } else if (entry.isFile()) {
        if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts') &&
          !entry.name.endsWith('.e2e-spec.ts')
        ) {
          acc.push(full);
        }
      }
    }
    return acc;
  }

  private isExcluded(p: string): boolean {
    const excludes = this.options.excludePatterns ?? [];
    return excludes.some((pat) => p.includes(pat.replace('**/', '')));
  }

  // AST 提取函数/类/方法信息
  private getAstFunctionsForFile(filePath: string): TipFileInfo {
    const sourceText = (() => {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {
        return '';
      }
    })();
    const sf = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const functions: TipFunctionInfo[] = [];
    const fileName = path.basename(filePath);

    const getModifiers = (
      node: ts.Node,
    ): readonly ts.ModifierLike[] | undefined => {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isVariableStatement(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node)
      ) {
        return node.modifiers;
      }
      return undefined;
    };

    const hasExportModifier = (node: ts.Node): boolean => {
      const mods = getModifiers(node);
      return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    };

    const getNodeName = (n?: ts.Node): string | undefined => {
      if (!n) return undefined;
      if (
        ts.isIdentifier(n) ||
        ts.isStringLiteral(n) ||
        ts.isNumericLiteral(n)
      ) {
        return n.text;
      }
      if (ts.isComputedPropertyName(n)) {
        const expr = n.expression;
        if (
          ts.isIdentifier(expr) ||
          ts.isStringLiteral(expr) ||
          ts.isNumericLiteral(expr)
        ) {
          return expr.text;
        }
        return undefined;
      }
      return undefined;
    };

    const visit = (node: ts.Node) => {
      const pos = sf.getLineAndCharacterOfPosition(node.getStart());
      const line = pos.line + 1;
      const exported = hasExportModifier(node);

      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push({
          name: node.name.text,
          kind: 'function',
          location: { filePath, line },
          exported,
        });
      }
      if (ts.isClassDeclaration(node) && node.name) {
        functions.push({
          name: node.name.text,
          kind: 'class',
          location: { filePath, line },
          exported,
        });
        node.members.forEach((m) => {
          const mPos = sf.getLineAndCharacterOfPosition(m.getStart());
          const mLine = mPos.line + 1;
          if (ts.isMethodDeclaration(m) && m.name) {
            functions.push({
              name: getNodeName(m.name) || 'anonymous',
              kind: 'method',
              location: { filePath, line: mLine },
              exported,
            });
          }
          if (ts.isConstructorDeclaration(m)) {
            functions.push({
              name: 'constructor',
              kind: 'constructor',
              location: { filePath, line: mLine },
              exported,
            });
          }
        });
      }
    };

    const walk = (n: ts.Node) => {
      visit(n);
      n.forEachChild(walk);
    };
    walk(sf);

    return { filePath, fileName, functions };
  }
}
