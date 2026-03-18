import type { ZodTypeAny } from 'zod';

/**
 * @title Unit Core 类型
 * @description 定义 unit 基座的 Hook 描述、执行上下文与映射结构。
 * @keywords-cn Unit类型, Hook描述, 执行上下文
 * @keywords-en unit-types, hook-descriptor, execution-context
 */
export interface UnitDescriptor {
  name: string;
  description: string;
  keywordsCn?: string[];
  keywordsEn?: string[];
}

export interface UnitHookDeclaration {
  name: string;
  description: string;
  payloadSchema?: ZodTypeAny;
}

export interface UnitHookModule {
  unit: UnitDescriptor;
  hooks: UnitHookDeclaration[];
  tags?: string[];
}

export interface UnitSource {
  unitName: string;
  unitPath: string;
  hookFilePath: string;
  coreFilePath: string | null;
  descFilePath: string | null;
  source: 'workspace' | 'system';
}

export interface UnitHookRecord {
  unitName: string;
  hookName: string;
  description: string;
  keywordsCn?: string[];
  keywordsEn?: string[];
  payloadSchema?: ZodTypeAny;
  source: 'workspace' | 'system';
}

export interface UnitExecutionContext {
  workspacePath: string;
  runnerDbName: string;
  invokeHook: <TPayload, TResult>(
    hookName: string,
    payload: TPayload,
    options?: { hot?: boolean },
  ) => Promise<TResult>;
  mongo: {
    getDb: (dbName?: string) => import('mongodb').Db | null;
  };
}

export type UnitCoreHandler = (
  ctx: UnitExecutionContext,
  payload: unknown,
) => Promise<unknown> | unknown;

export interface UnitCoreModule {
  unitName: string;
  handlers: Record<string, UnitCoreHandler>;
}
