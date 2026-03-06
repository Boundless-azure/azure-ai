/**
 * @title Code-Agent Graph Types
 * @description LangGraph 编排状态与子类型定义
 * @keywords-cn 代码智能体, 图状态, 模块分割, Hook设计
 * @keywords-en code-agent, graph-state, module-spec, hook-design
 */

/** 单个最小模块规格 */
export interface ModuleSpec {
  /** 模块名称（英文，用作目录名）例如 customer-management */
  name: string;
  /** 模块功能描述 */
  description: string;
  /** 是否包含后端逻辑 */
  isBackend: boolean;
  /** 是否包含前端页面/组件 */
  isFrontend: boolean;
}

/** 单个模块的 Hook 开放设计 */
export interface HookSpec {
  moduleName: string;
  hooks: Array<{
    name: string;
    payloadDescription: string;
  }>;
}

/** 已有插件的简要摘要（从 PluginService 加载） */
export interface PluginSummary {
  name: string;
  version: string;
  description: string;
  pluginDir: string;
  hooks: Array<{ name: string; payloadDescription: string }>;
}

/** 单个模块生成结果 */
export interface GeneratedModule {
  moduleName: string;
  /** 输出目录，相对项目根，如 plugins/customer-management */
  pluginDir: string;
  /** 生成的文件列表（每项含相对 pluginDir 的路径和内容） */
  files: Array<{ path: string; content: string }>;
  skipped?: boolean;
  skipReason?: string;
}

/** LangGraph 整体图状态 */
export interface CodeGenState {
  /** 用户原始需求 */
  userRequirement: string;
  /** 关联的 IM 会话 ID（可选，用于按会话过滤 apps） */
  sessionId?: string;
  /** 需求分析节点输出：项目功能概述 */
  projectOverview?: string;
  /** 分割后的最小模块列表 */
  modules?: ModuleSpec[];
  /** 各模块的 Hook 开放设计（先于生成节点执行） */
  hookDesigns?: HookSpec[];
  /** 加载的已有插件信息 */
  existingPlugins?: PluginSummary[];
  /** 各模块的生成结果 */
  generatedModules?: GeneratedModule[];
  /** 累积错误 */
  errors?: string[];
  /** 当前节点名称，用于流式进度输出 */
  currentStep?: string;
}
