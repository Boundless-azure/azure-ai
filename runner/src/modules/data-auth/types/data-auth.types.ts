import type { ZodTypeAny } from 'zod';

/**
 * @title Data Auth 类型定义
 * @description 定义 Fastify 场景下数据权限模块的上下文、DTO 与解析结果类型。
 * @keywords-cn DataAuth类型, DTO验证, 权限解析
 * @keywords-en data-auth-types, dto-validation, permission-resolve
 */
export interface DataAuthContext {
  principalId?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  attributes: Record<string, unknown>;
}

export interface DataAuthContextInput {
  principalId?: string;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
  attributes?: Record<string, unknown>;
}

export interface DataAuthDtoSpec {
  name: string;
  schema: ZodTypeAny;
}

export interface DataAuthNodeParams<TPayload extends Record<string, unknown>> {
  table: string;
  dtoName: string;
  context: DataAuthContext;
  payload?: TPayload;
}

export interface DataAuthNodeResult {
  allow: boolean;
  where?: Record<string, unknown>;
}

export type DataAuthNodeHandler<TPayload extends Record<string, unknown>> = (
  params: DataAuthNodeParams<TPayload>,
) => DataAuthNodeResult | Promise<DataAuthNodeResult>;

export interface DataAuthResolveResult {
  table: string;
  dtoName: string;
  allow: boolean;
  where: Record<string, unknown>;
  matchedNodes: string[];
  deniedNodes: string[];
}
