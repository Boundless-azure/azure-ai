import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RunnerWebMcpService } from '../services/webmcp.service';

/**
 * @title WebMCP 路由
 * @description 提供描述注册、读取与操作分发接口。
 * @keywords-cn WebMCP路由, 描述注册, 操作分发
 * @keywords-en webmcp-routes, descriptor-register, operation-dispatch
 */
export async function registerWebMcpRoutes(
  app: FastifyInstance,
  service: RunnerWebMcpService,
): Promise<void> {
  const RegisterSchema = z.object({
    page: z.string().min(1),
    descriptor: z.unknown(),
    ts: z.number().int().optional(),
  });
  const DispatchSchema = z.object({
    op: z.union([z.literal('callHook'), z.literal('setData')]),
    pointer: z.string().optional(),
    page: z.string().optional(),
    keyword: z.array(z.string()).optional(),
    value: z.unknown().optional(),
    args: z.unknown().optional(),
  });

  app.post('/webmcp/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, issues: parsed.error.issues.map((item) => item.message) });
    }
    service.registerDescriptor({
      page: parsed.data.page,
      descriptor: parsed.data.descriptor,
      ts: parsed.data.ts ?? Date.now(),
    });
    return { ok: true };
  });

  app.get('/webmcp/pages', async () => {
    return { ok: true, pages: service.listPages() };
  });

  app.post('/webmcp/op', async (request, reply) => {
    const parsed = DispatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, issues: parsed.error.issues.map((item) => item.message) });
    }
    return service.dispatchOperation(parsed.data);
  });
}
