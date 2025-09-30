import { Inject, Injectable } from '@nestjs/common';
import { TIP_OPTIONS } from './tip.tokens';
import type { TipModuleOptions } from './tip.types';
import {
  TipSearchResult,
  TipIndex,
  TipDiagnostics,
  TipProblem,
  DiagnosticsSeverity,
} from './tip.types';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

@Injectable()
export class TipService {
  constructor(
    @Inject(TIP_OPTIONS) private readonly options: TipModuleOptions,
  ) {}

  // 递归列出 .tip 文件
  listTipFiles(): string[] {
    const root =
      this.options.rootDir ?? path.resolve(process.cwd(), 'src', 'core');
    const result: string[] = [];
    const maxDepth = this.options.maxDepth ?? 5;

    const walk = (dir: string, depth: number) => {
      if (depth > maxDepth) return;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // 过滤排除目录
          if (this.isExcluded(full)) continue;
          walk(full, depth + 1);
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.tip')) {
            result.push(full);
          }
        }
      }
    };

    walk(root, 0);
    return result;
  }

  private isExcluded(p: string): boolean {
    const excludes = this.options.excludePatterns ?? [];
    return excludes.some((pat) => p.includes(pat.replace('**/', '')));
  }

  readTipFiles(): { filePath: string; content: string }[] {
    return this.listTipFiles()
      .map((filePath) => {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          return { filePath, content };
        } catch {
          return { filePath, content: '' };
        }
      })
      .filter((x) => x.content.trim().length > 0);
  }

  // Parse Problems & Diagnostics section
  private parseDiagnosticsSectionFromTip(
    content: string,
    filePath: string,
  ): TipProblem[] {
    const problems: TipProblem[] = [];
    const lines = content.split(/\r?\n/);
    let inDiag = false;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (
        /^\s*Problems?\s*&\s*Diagnostics/i.test(ln) ||
        /问题与诊断/.test(ln) ||
        /problems_and_diagnostics/i.test(ln)
      ) {
        inDiag = true;
        continue;
      }
      if (inDiag) {
        if (/^\s*$/.test(ln)) break; // blank line ends section
        const m = ln.match(
          /^\s*-\s*\[(info|warning|error)\]\s*(.+?)(?:\s*->\s*(.+))?\s*$/i,
        );
        if (m) {
          const sev = this.toSeverity(m[1]) ?? DiagnosticsSeverity.info;
          const msg = m[2].trim();
          const sug = (m[3] || '').trim();
          problems.push({
            severity: sev,
            message: msg,
            suggestion: sug || undefined,
            filePath,
            line: i + 1,
          });
        }
      }
    }
    return problems;
  }

  private toSeverity(s: string): DiagnosticsSeverity | undefined {
    switch (s.toLowerCase()) {
      case 'info':
        return DiagnosticsSeverity.info;
      case 'warning':
        return DiagnosticsSeverity.warning;
      case 'error':
        return DiagnosticsSeverity.error;
      default:
        return undefined;
    }
  }

  // 解析 "Keywords -> Files" 行映射
  private parseKeywordMappingsFromTip(
    content: string,
  ): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/-\s*"(.+?)".*?->\s*(.+)$/); // "keyword" -> file
      if (m) {
        const raw = m[1];
        const filesStr = m[2];
        const keywords = raw
          .split(/\s*\/\s*/) // 支持多关键词形式："A" / "B"
          .map((k) => k.trim())
          .filter(Boolean);
        const files = filesStr
          .split(/,\s*/)
          .map((f) => f.replace(/^services\//, 'src/core/ai/services/')) // 兼容简写
          .map((f) => f.trim());
        for (const k of keywords) {
          if (!map.has(k)) map.set(k, new Set<string>());
          const set = map.get(k)!;
          for (const f of files) set.add(f);
        }
      }
    }
    return map;
  }

  // 关键词检索：优先使用 tip 映射，其次在 tip 文本模糊匹配
  searchKeywords(keywords: string[], maxResults = 20): TipSearchResult[] {
    const tipFiles = this.readTipFiles();
    const results: TipSearchResult[] = [];
    const mapping = new Map<string, Set<string>>();
    for (const t of tipFiles) {
      const m = this.parseKeywordMappingsFromTip(t.content);
      for (const [k, set] of m.entries()) {
        if (!mapping.has(k)) mapping.set(k, new Set<string>());
        const acc = mapping.get(k)!;
        for (const f of set) acc.add(f);
      }
    }

    // 使用映射命中
    for (const kw of keywords) {
      const files = mapping.get(kw);
      if (files) {
        for (const f of files) {
          results.push({ keyword: kw, filePath: f, score: 1 });
        }
      }
    }

    // 回退：遍历 tip 内容进行模糊匹配
    for (const kw of keywords) {
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      for (const t of tipFiles) {
        const lines = t.content.split(/\r?\n/);
        lines.forEach((ln, idx) => {
          if (re.test(ln)) {
            const score = 0.5; // 较低权重
            results.push({
              keyword: kw,
              filePath: t.filePath,
              score,
              line: ln,
              section: `line:${idx + 1}`,
            });
          }
        });
      }
    }

    // 去重按最高分
    const byKeyFile = new Map<string, TipSearchResult>();
    for (const r of results) {
      const key = `${r.keyword}|${r.filePath}`;
      const prev = byKeyFile.get(key);
      if (!prev || r.score > prev.score) byKeyFile.set(key, r);
    }

    return Array.from(byKeyFile.values()).slice(0, maxResults);
  }

  // 构建 AST 索引（简版）：提取函数/类/方法
  buildAstIndex(dir?: string): TipIndex {
    const root =
      dir ?? this.options.rootDir ?? path.resolve(process.cwd(), 'src', 'core');
    const files = this.listTsFiles(root);
    const index: TipIndex = { files: [], createdAt: new Date() };
    for (const f of files) {
      const info = this.getAstFunctionsForFile(f);
      index.files.push(info);
    }
    return index;
  }

  // Basic diagnostics: check necessary sections existence in tip content
  private analyzeTipContent(content: string, filePath: string): TipProblem[] {
    const probs: TipProblem[] = [];
    const mustHave = [
      '关键词索引（中文 / English Keyword Index）',
      '快速检索映射（Keywords -> Files）',
      '函数索引（Function Index）',
      '文件列表（File List）',
    ];
    for (const section of mustHave) {
      if (!content.includes(section)) {
        probs.push({
          severity: DiagnosticsSeverity.warning,
          message: `Missing section: ${section}`,
          suggestion:
            'Use TipGeneratorService to regenerate or add this section manually.',
          filePath,
        });
      }
    }
    // Hint for legacy provider mention
    if (/(azure-openai)/i.test(content) && !/已移除\/跳过/.test(content)) {
      probs.push({
        severity: DiagnosticsSeverity.info,
        message: 'Contains legacy provider mention: azure-openai',
        suggestion:
          'Ensure it is documented only as removed/skipped and not used in code.',
        filePath,
      });
    }

    // Cross-module mapping detection: 每个 module.tip 应只引用当前模块内文件
    // 如果映射行引用了其他模块（例如 src/core/other-module/...），给出警告
    const mappings = this.parseKeywordMappingsFromTip(content);
    const moduleDir = path.posix.dirname(filePath.replace(/\\/g, '/'));
    const normalizedModuleDir = moduleDir
      .replace(/^[^/]*\bsrc\b/, 'src') // 规范化前缀
      .replace(/\/+/g, '/');
    for (const files of mappings.values()) {
      for (const f of files) {
        const ff = f.replace(/\\/g, '/');
        // 仅在包含 src/core/ 时进行跨模块检查，避免对相对路径误报
        if (/^src\/core\//.test(ff)) {
          // 如果不以当前模块目录开头，则提示跨模块引用
          if (!ff.startsWith(normalizedModuleDir)) {
            probs.push({
              severity: DiagnosticsSeverity.warning,
              message: `Cross-module mapping detected: ${ff}`,
              suggestion:
                'Ensure each module has its own module.tip and mappings only reference files within that module.',
              filePath,
            });
          }
        }
      }
    }
    return probs;
  }

  // Collect diagnostics across all tip files
  collectDiagnostics(): TipDiagnostics {
    const tips = this.readTipFiles();
    const all: TipProblem[] = [];
    for (const t of tips) {
      const parsed = this.parseDiagnosticsSectionFromTip(t.content, t.filePath);
      const analyzed = this.analyzeTipContent(t.content, t.filePath);
      all.push(...parsed, ...analyzed);
    }
    return { problems: all, createdAt: new Date() };
  }

  // Diagnostics report text
  generateDiagnosticsReport(): string {
    const diag = this.collectDiagnostics();
    const lines: string[] = [];
    lines.push('# Problems & Diagnostics Report');
    lines.push(`Generated At: ${diag.createdAt.toISOString()}`);
    for (const d of diag.problems) {
      const sev = d.severity.toUpperCase();
      const loc = d.line ? `:${d.line}` : '';
      const sug = d.suggestion ? ` -> ${d.suggestion}` : '';
      lines.push(`- [${sev}] ${d.filePath}${loc} : ${d.message}${sug}`);
    }
    return lines.join('\n');
  }

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

  private getAstFunctionsForFile(filePath: string) {
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
    const functions: any[] = [];
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
