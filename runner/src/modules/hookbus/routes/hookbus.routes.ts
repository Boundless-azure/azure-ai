import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RunnerHookBusService } from '../services/hookbus.service';

/**
 * @title HookBus 路由
 * @description 提供 Hook 注册列表与触发调试接口。
 * @keywords-cn HookBus路由, 注册列表, 触发接口
 * @keywords-en hookbus-routes, registry-list, emit-api
 */
export async function registerHookBusRoutes(
  app: FastifyInstance,
  hookBus: RunnerHookBusService,
): Promise<void> {
  const EmitSchema = z.object({
    name: z.string().min(1),
    payload: z.unknown().optional(),
  });

  app.get('/hookbus/registrations', async () => {
    return { ok: true, items: hookBus.listRegistrations() };
  });

  app.post('/hookbus/emit', async (request, reply) => {
    const parsed = EmitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        message: 'invalid emit payload',
        issues: parsed.error.issues.map((item) => item.message),
      });
    }
    const results = await hookBus.emit({
      name: parsed.data.name,
      payload: parsed.data.payload,
    });
    return { ok: true, results };
  });
}
