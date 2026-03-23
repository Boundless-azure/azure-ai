import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RunnerRegistrationService } from '../services/registration.service';
import { FrpcService } from '../../frpc/services/frpc.service';

/**
 * @title Runner 注册路由
 * @description 提供 runner 注册触发与状态读取接口。
 * @keywords-cn 注册路由, 注册触发, 状态读取
 * @keywords-en registration-routes, trigger-register, status-read
 */
export async function registerRunnerRegistrationRoutes(
  app: FastifyInstance,
  registrationService: RunnerRegistrationService,
): Promise<void> {
  const frpcService = new FrpcService();

  const TestRunnerKeySchema = z.object({
    saasSocketUrl: z.string().optional(),
    runnerKey: z.string().optional(),
    runnerId: z.string().optional(),
  });

  app.get('/registration/status', async () => {
    return { ok: true, ...registrationService.status() };
  });

  app.post('/registration/test-key', async (request, reply) => {
    const parsed = TestRunnerKeySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        issues: parsed.error.issues.map((item) => item.message),
      });
    }
    return await registrationService.testRunnerKey(parsed.data);
  });

  app.post('/registration/register', async () => {
    const result = await registrationService.registerNow();

    // 注册成功后自动启动 FRPC
    if (result.ok) {
      const frpcConfig = registrationService.getFrpcConfig();
      if (frpcConfig) {
        try {
          await frpcService.generateConfig(frpcConfig);
          await frpcService.start();
          console.log('[registration] FRPC started after registration');
        } catch (err) {
          console.error('[registration] Failed to start FRPC:', err);
        }
      }
    }

    return result;
  });
}
