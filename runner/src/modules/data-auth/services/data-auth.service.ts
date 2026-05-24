import type { FastifyRequest } from 'fastify';
import { ZodError, type ZodTypeAny } from 'zod';
import { DataAuthRegistry } from './data-auth.registry';
import type {
  DataAuthContext,
  DataAuthResolveResult,
} from '../types/data-auth.types';

/**
 * @title Data Auth 服务
 * @description 使用 Fastify 请求输入与 Zod DTO 进行验证和权限节点解析。
 * @keywords-cn DataAuth服务, Fastify验证, ZodDTO, 节点解析
 * @keywords-en data-auth-service, fastify-validation, zod-dto, node-resolve
 */
export class DataAuthService {
  constructor(private readonly registry: DataAuthRegistry) {}

  validateDto<TSchema extends ZodTypeAny>(
    schema: TSchema,
    input: unknown,
  ): { ok: true; data: TSchema['_output'] } | { ok: false; issues: string[] } {
    try {
      const data = schema.parse(input);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof ZodError) {
        return { ok: false, issues: error.issues.map((item) => item.message) };
      }
      return { ok: false, issues: ['invalid payload'] };
    }
  }

  async resolve(
    table: string,
    dtoName: string,
    context: DataAuthContext,
    payload?: Record<string, unknown>,
  ): Promise<DataAuthResolveResult> {
    if (!this.registry.hasDtoBinding(table, dtoName)) {
      return {
        table,
        dtoName,
        allow: true,
        where: {},
        matchedNodes: [],
        deniedNodes: [],
      };
    }
    const nodeKeys = this.registry.getDtoNodes(dtoName);
    const where: Record<string, unknown> = {};
    const matchedNodes: string[] = [];
    const deniedNodes: string[] = [];
    let allow = true;
    for (const nodeKey of nodeKeys) {
      const handler = this.registry.getNodeHandler(nodeKey);
      if (!handler) continue;
      const result = await handler({ table, dtoName, context, payload });
      if (result.allow) {
        matchedNodes.push(nodeKey);
        if (result.where) Object.assign(where, result.where);
      } else {
        deniedNodes.push(nodeKey);
        allow = false;
      }
    }
    return { table, dtoName, allow, where, matchedNodes, deniedNodes };
  }

  parseBody(request: FastifyRequest): Record<string, unknown> {
    const body = request.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  }
}
