import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DataAuthRegistry } from '../services/data-auth.registry';
import { DataAuthContextService } from '../services/data-auth.context';
import { DataAuthService } from '../services/data-auth.service';

/**
 * @title Data Auth 路由
 * @description 提供 Fastify 下的数据权限 DTO 校验与解析调试接口。
 * @keywords-cn DataAuth路由, DTO校验, 权限解析
 * @keywords-en data-auth-routes, dto-validation, permission-resolve
 */
export async function registerDataAuthRoutes(app: FastifyInstance): Promise<void> {
  const registry = new DataAuthRegistry();
  const contextService = new DataAuthContextService();
  const service = new DataAuthService(registry);

  const ResolvePayloadSchema = z.object({
    table: z.string().min(1),
    dtoName: z.string().min(1),
    dtoPayload: z.record(z.string(), z.unknown()).default({}),
    context: z.object({
      principalId: z.string().optional(),
      tenantId: z.string().optional(),
      roles: z.array(z.string()).default([]),
      permissions: z.array(z.string()).default([]),
      attributes: z.record(z.string(), z.unknown()).default({}),
    }),
  });

  registry.registerTableDtos('todos', [
    { name: 'QueryTodoDto', schema: z.object({ recipientId: z.string().optional() }) },
  ]);
  registry.registerDtoNodes('QueryTodoDto', ['todo:read-only-myself']);
  registry.registerNodeHandler('todo:read-only-myself', ({ context, payload }) => ({
    allow: Boolean(context.principalId),
    where: context.principalId ? { recipientId: payload?.recipientId ?? context.principalId } : undefined,
  }));

  app.post('/data-auth/resolve', async (request, reply) => {
    const parsed = ResolvePayloadSchema.safeParse(service.parseBody(request));
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        message: 'invalid data-auth resolve payload',
        issues: parsed.error.issues.map((item) => item.message),
      });
    }
    const dtoSpec = parsed.data.dtoName === 'QueryTodoDto'
      ? z.object({ recipientId: z.string().optional() })
      : z.record(z.string(), z.unknown());
    const dtoValid = service.validateDto(dtoSpec, parsed.data.dtoPayload);
    if (!dtoValid.ok) {
      return reply.status(400).send({ ok: false, message: 'dto validation failed', issues: dtoValid.issues });
    }
    const context = contextService.build(parsed.data.context);
    const result = await service.resolve(
      parsed.data.table,
      parsed.data.dtoName,
      context,
      dtoValid.data as Record<string, unknown>,
    );
    return { ok: true, result };
  });
}
