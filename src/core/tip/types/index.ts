/**
 * Tip 类型定义：供控制器、服务与生成器模块使用。
 *
 * 建议：
 * - 外部模块尽量通过 src/core/tip/index.ts 统一导入这些类型，避免路径耦合。
 * - 每个字段配有简要说明，便于 IDE 自动提示与快速理解。
 */
import type { DynamicModule } from '@nestjs/common';

export type Keyword = string;

/**
 * Tip 模块的配置选项。
 */
export interface TipModuleOptions {
  /** 扫描根目录，默认 src/core */
  rootDir?: string;
  /** 包含模式，例如 ['/*.tip'] */
  includePatterns?: string[];
  /** 排除模式，例如 ['/dist/'] */
  excludePatterns?: string[];
  /** 目录递归最大深度 */
  maxDepth?: number;
}

/**
 * 关键词检索命中项。
 */
export interface TipSearchResult {
  /** 命中的关键词 */
  keyword: string;
  /** 被映射或模糊匹配到的文件路径 */
  filePath: string;
  /** 评分，映射为 1，模糊匹配为 0.5 */
  score: number;
  /** 可选：命中时的原始文本行内容 */
  line?: string;
  /** 可选：命中的位置描述（如 line:XX） */
  section?: string;
}

export type TipSymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'constructor'
  | 'field';

/**
 * AST 提取的函数/类/方法等符号信息。
 */
export interface TipFunctionInfo {
  /** 符号名称（函数名/类名/方法名） */
  name: string;
  /** 符号类型：function/method/class/constructor/field */
  kind: TipSymbolKind;
  /** 可选：角色说明（例如用途/职责） */
  role?: string;
  /** 可选：关联的关键词列表 */
  keywords?: string[];
  /** 是否导出（带有 export 修饰） */
  exported?: boolean;
  /** 源位置：文件路径与行号 */
  location: { filePath: string; line: number };
}

export enum DiagnosticsSeverity {
  info = 'info',
  warning = 'warning',
  error = 'error',
}

/**
 * 诊断问题条目。
 */
export interface TipProblem {
  /** 严重性：info/warning/error */
  severity: DiagnosticsSeverity;
  /** 问题说明 */
  message: string;
  /** 关联文件路径 */
  filePath: string;
  /** 可选：行号 */
  line?: number;
  /** 可选：修复建议 */
  suggestion?: string;
  /** 可选：关键词列表 */
  keywords?: string[];
}

/**
 * 文件层面的索引与描述。
 */
export interface TipFileInfo {
  /** 文件绝对路径 */
  filePath: string;
  /** 文件名（含扩展名） */
  fileName: string;
  /** 可选：文件说明 */
  description?: string;
  /** 可选：关键词 */
  keywords?: string[];
  /** 可选：提取的符号列表 */
  functions?: TipFunctionInfo[];
  /** 可选：诊断问题 */
  diagnostics?: TipProblem[];
}

/**
 * AST 索引总览。
 */
export interface TipIndex {
  /** 文件索引列表 */
  files: TipFileInfo[];
  /** 创建时间戳 */
  createdAt: Date;
}

/**
 * Tip 生成选项。
 */
export interface TipGenerateOptions {
  /** 目标目录（例如 'src/core/ai'） */
  dir: string;
  /** 是否写入到文件（默认 true，文件名见 outputFileName） */
  writeToFile?: boolean;
  /** 输出文件名（默认 'module.tip'） */
  outputFileName?: string;
  /** 是否启用 AI 生成（与 AST 组合），默认根据模型可用性自动处理 */
  useAI?: boolean;
  /** 指定 AI 模型 ID；未提供则自动选择启用模型中的第一个 */
  aiModelId?: string;
  /** 自定义系统提示词，覆盖默认值 */
  systemPrompt?: string;
  /** 是否包含源码片段（默认 true） */
  aiIncludeCode?: boolean;
  /** 是否仅包含带标签的注释块（默认 true） */
  aiIncludeCommentsOnly?: boolean;
  /** 识别的注释标签（例如 ['@tip','@doc','@purpose']） */
  aiCommentTags?: string[];
  /** 源码片段最大字符数预算（默认 8000） */
  aiMaxCodeChars?: number;
}

/**
 * Tip 生成结果。
 */
export interface TipGenerateResult {
  /** 写入目标路径（可能为空字符串表示未写入） */
  outputPath: string;
  /** 生成的文本内容 */
  content: string;
  /** 可选：警告信息列表（例如模型不可用） */
  warnings?: string[];
  /** 可选：错误信息（例如入参缺失） */
  error?: string;
}

/**
 * 诊断结果集合。
 */
export interface TipDiagnostics {
  /** 诊断问题列表 */
  problems: TipProblem[];
  /** 创建时间戳 */
  createdAt: Date;
}

export type TipModuleDynamic = DynamicModule & {};
