import type { ObjectId } from 'mongodb';

/**
 * @title Runner 数据库类型
 * @description 描述 runner 管理库中的主要数据结构。
 * @keywords-cn Runner类型, 管理库, 数据结构
 * @keywords-en runner-db-types, management-db, data-shapes
 */
export interface RunnerBaseRecord {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunnerConnectionHistory extends RunnerBaseRecord {
  runnerId: string;
  runnerKey: string;
  saasSocketUrl: string;
  status: 'success' | 'error';
  message?: string;
}

export interface RunnerHookFailure extends RunnerBaseRecord {
  hookName: string;
  payload?: unknown;
  error: string;
  source?: string;
}

export interface RunnerAppManagement extends RunnerBaseRecord {
  appId: string;
  name: string;
  version?: string;
  description?: string;
  keywords?: string[];
  solutionId?: string;
  solutionName?: string;
  appPort: number;
  status: 'running' | 'stopped';
}

export interface RunnerAppDomain extends RunnerBaseRecord {
  appId: string;
  domain: string;
  pathPattern?: string;
  targetHost: string;
  targetPort: number;
  status: 'active' | 'inactive' | 'error';
}

export interface RunnerCapabilityManagement extends RunnerBaseRecord {
  capabilityId: string;
  unitName: string;
  hookName: string;
  description?: string;
  keywordsCn?: string[];
  keywordsEn?: string[];
  source: 'workspace' | 'system';
}

export interface RunnerResourceLibrary extends RunnerBaseRecord {
  resourceId: string;
  name: string;
  type: string;
  uri: string;
  description?: string;
}

export interface RunnerWebMcpRecord extends RunnerBaseRecord {
  domain: string;
  injectScriptPath: string;
  protocolPath: string;
  description?: string;
}

export interface RunnerMcpRecord extends RunnerBaseRecord {
  name: string;
  version?: string;
  baseUrl?: string;
  description?: string;
}

export interface RunnerSkillRecord extends RunnerBaseRecord {
  name: string;
  description?: string;
  entry?: string;
  keywords?: string[];
}
