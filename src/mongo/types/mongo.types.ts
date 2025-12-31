/**
 * @title Mongo 模块选项
 * @description 用于配置 Mongo 模块的环境与开关。
 * @keywords-cn Mongo选项, 配置, 环境, 开关
 * @keywords-en mongo-options, config, env, toggle
 */
export interface MongoModuleOptions {
  enabled?: boolean;
  uri?: string;
  dbName?: string;
}

/**
 * @title Mongo 文档类型：插件
 * @description 与插件实体等价的文档结构（Mongo）。
 * @keywords-cn 插件文档, 名称, 版本, 描述, 关键词
 * @keywords-en plugin-doc, name, version, description, keywords
 */
export interface PluginDoc {
  _id?: string;
  name: string;
  version: string;
  description: string;
  hooks: { name: string; payloadDescription: string }[];
  keywordsZh?: string | null;
  keywordsEn?: string | null;
  pluginDir: string;
  registered: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isDelete?: boolean;
}

/**
 * @title Mongo 文档类型：Agent
 * @description Agent 元信息文档结构（Mongo）。
 * @keywords-cn Agent文档, 昵称, 用途, 关联
 * @keywords-en agent-doc, nickname, purpose, association
 */
export interface AgentDoc {
  _id?: string;
  codeDir: string;
  nickname: string;
  isAiGenerated: boolean;
  purpose: string | null;
  embedding: string | number[] | Record<string, unknown> | null;
  keywords?: string[] | null;
  nodes: Record<string, unknown> | null;
  conversationGroupId: string | null;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isDelete?: boolean;
}

/**
 * @title Mongo 文档类型：AgentExecution
 * @description 执行记录文档结构（Mongo）。
 * @keywords-cn 执行文档, 节点状态, 最新返回
 * @keywords-en execution-doc, node-status, latest-response
 */
export interface AgentExecutionDoc {
  _id?: string;
  agentId: string;
  nodeStatus?: Record<string, unknown> | null;
  latestResponse?: Record<string, unknown> | null;
  contextMessageId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  isDelete?: boolean;
}
