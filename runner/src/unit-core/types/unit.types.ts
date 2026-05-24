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
  /**
   * 显式拒绝 LLM 调用; 用于纯内部 / 底层基座 hook (如 mongo.insert/update/delete)。
   * 透传到 HookMetadata.denyLlm; RunnerHookAbilityMiddleware 在 source==='llm' 时软错拒绝。
   * @keyword-en deny-llm
   */
  denyLlm?: boolean;
  /**
   * 所需能力 (CASL action/subject), AND 关系。透传到 HookMetadata.requiredAbility。
   * @keyword-en required-ability
   */
  requiredAbility?:
    | { action: string; subject: string }
    | Array<{ action: string; subject: string }>;
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
  denyLlm?: boolean;
  requiredAbility?:
    | { action: string; subject: string }
    | Array<{ action: string; subject: string }>;
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
  /** 调用 SaaS 侧 hook, 复用 Socket 连接, context 携带用户 token 自动鉴权 */
  callSaaSHook?: (
    hookName: string,
    payload: unknown,
    context?: Record<string, unknown>,
  ) => Promise<{ errorMsg?: string[]; result: unknown }>;
}

export type UnitCoreHandler = (
  ctx: UnitExecutionContext,
  payload: unknown,
) => unknown;

export interface UnitCoreModule {
  unitName: string;
  handlers: Record<string, UnitCoreHandler>;
}
