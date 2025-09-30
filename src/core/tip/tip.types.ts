import type { DynamicModule } from '@nestjs/common';

export type Keyword = string;

export interface TipModuleOptions {
  rootDir?: string; // 默认扫描 src/core
  includePatterns?: string[]; // 例如 ['**/*.tip']
  excludePatterns?: string[]; // 例如 ['**/dist/**']
  maxDepth?: number; // 目录递归最大深度
}

export interface TipSearchResult {
  keyword: string;
  filePath: string;
  score: number;
  line?: string;
  section?: string;
}

export type TipSymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'constructor'
  | 'field';

export interface TipFunctionInfo {
  name: string;
  kind: TipSymbolKind;
  role?: string;
  keywords?: string[];
  exported?: boolean;
  location: { filePath: string; line: number };
}

export enum DiagnosticsSeverity {
  info = 'info',
  warning = 'warning',
  error = 'error',
}

export interface TipProblem {
  severity: DiagnosticsSeverity;
  message: string;
  filePath: string;
  line?: number;
  suggestion?: string;
  keywords?: string[];
}

export interface TipFileInfo {
  filePath: string;
  fileName: string;
  description?: string;
  keywords?: string[];
  functions?: TipFunctionInfo[];
  diagnostics?: TipProblem[];
}

export interface TipIndex {
  files: TipFileInfo[];
  createdAt: Date;
}

export interface TipGenerateOptions {
  dir: string;
  writeToFile?: boolean; // 默认写入 module.tip
  outputFileName?: string; // 默认 'module.tip'
  // 新增：支持基于 AI 的内容生成（替代纯 AST 生成）
  useAI?: boolean;
  aiModelId?: string; // 未提供则自动选择第一个启用模型
  systemPrompt?: string; // 自定义系统提示，覆盖默认提示
  // 新增：AI 上下文增强（传入代码/注释，提升准确性）
  aiIncludeCode?: boolean; // 是否在提示中包含源码内容（默认 true）
  aiIncludeCommentsOnly?: boolean; // 仅包含带标签的注释块（默认 true）
  aiCommentTags?: string[]; // 识别的注释标签（例如 ['@tip','@doc','@purpose']）
  aiMaxCodeChars?: number; // 源码片段最大字符数预算（默认 8000）
}

export interface TipGenerateResult {
  outputPath: string;
  content: string;
  warnings?: string[];
  error?: string;
}

export interface TipDiagnostics {
  problems: TipProblem[];
  createdAt: Date;
}

export type TipModuleDynamic = DynamicModule & {};
