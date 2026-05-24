import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Db } from 'mongodb';
import { RunnerDbService } from '../runner-db/services/runner-db.service';
import type {
  RunnerAppManagement,
  RunnerAppDomain,
} from '../runner-db/types/runner-db.types';
import { RunnerStatsService } from './services/stats.service';
import { RunnerTokenService } from './services/token.service';
import { FrpcService } from '../frpc/services/frpc.service';
import { getRunnerConfig } from '../../config/store';

/**
 * @title 注册 Runner 控制面板路由
 * @description 注册 /runner-control/* 路由，提供 Solution、应用域名、应用、FRPC 管理接口。
 * @param app Fastify 实例
 * @param db MongoDB 数据库实例（可选）
 * @keywords-cn Runner控制面板, 路由, Fastify
 * @keywords-en runner-control, routes, fastify
 */
export async function registerRunnerControlRoutes(
  app: FastifyInstance,
  db?: Db,
): Promise<void> {
  const runnerDb = db ? new RunnerDbService(db) : null;
  const cfg = getRunnerConfig();
  const frpcService = FrpcService.getInstance(cfg.frpcBinPath);
  const tokenService = RunnerTokenService.getInstance();

  // Token 验证中间件（无效返回 404）
  const validateTokenHook = async (
    req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    // 只对 /runner-control/* 路径验证 token
    if (!req.url.startsWith('/runner-control')) {
      return;
    }
    const token =
      req.headers.authorization?.replace(/^Bearer\s+/, '') ||
      (req.query as any)?.token;
    if (!token || !tokenService.validateToken(token)) {
      reply.code(404).send();
      return;
    }
  };

  // 无数据库时的错误响应
  const requireDb = () => {
    if (!runnerDb) {
      throw new Error(
        'Database not configured. Please set mongoUri in config.',
      );
    }
  };

  // 添加 Token 验证 hook，所有 /runner-control/* 路由都需要验证
  app.addHook('preHandler', validateTokenHook);

  // ============================================================
  // Solution 接口
  // ============================================================

  /**
   * @title 获取 Solution 列表
   * @description 返回 Runner 上安装的 Solution 列表。
   */
  app.get('/runner-control/solutions', async () => {
    requireDb();
    const solutions = await runnerDb!.findSolutions();
    return { code: 0, data: solutions };
  });

  /**
   * @title 获取单个 Solution
   * @description 根据 ID 获取 Solution 详情。
   */
  app.get(
    '/runner-control/solutions/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      requireDb();
      const { id } = req.params;
      const solution = await runnerDb!.findSolutionById(id);
      return { code: 0, data: solution };
    },
  );

  /**
   * @title 创建 Solution
   * @description 创建新的 Solution 记录。
   */
  app.post(
    '/runner-control/solutions',
    async (
      req: FastifyRequest<{ Body: { name: string; version: string } }>,
    ) => {
      requireDb();
      const data = req.body;
      await runnerDb!.upsertSolution(data as any);
      return { code: 0, data };
    },
  );

  /**
   * @title 更新 Solution
   * @description 更新指定的 Solution 信息。
   */
  app.put(
    '/runner-control/solutions/:id',
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { name?: string; version?: string };
      }>,
    ) => {
      requireDb();
      const { id } = req.params;
      const data = req.body;
      await runnerDb!.upsertSolution({ _id: id as any, ...data } as any);
      return { code: 0, data: { id, ...data } };
    },
  );

  /**
   * @title 删除 Solution
   * @description 删除指定的 Solution。
   */
  app.delete(
    '/runner-control/solutions/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      requireDb();
      const { id } = req.params;
      await runnerDb!.deleteSolution(id);
      return { code: 0, ok: true };
    },
  );

  // ============================================================
  // 应用域名接口
  // ============================================================

  /**
   * @title 获取应用域名列表
   * @description 返回 Runner 的应用域名绑定列表。
   */
  app.get('/runner-control/app-domains', async () => {
    requireDb();
    const domains = await runnerDb!.findAppDomains();
    return { code: 0, data: domains };
  });

  /**
   * @title 创建应用域名
   * @description 为 Runner 创建新的应用域名绑定，支持选择关联应用。
   */
  app.post(
    '/runner-control/app-domains',
    async (
      req: FastifyRequest<{
        Body: { domain: string; pathPattern?: string; appId?: string };
      }>,
      reply: FastifyReply,
    ) => {
      requireDb();
      const { domain, pathPattern, appId } = req.body;
      if (!domain) {
        return reply
          .status(400)
          .send({ code: 400, message: 'domain is required' });
      }
      const appDomain: RunnerAppDomain = {
        appId: appId || '',
        domain,
        pathPattern: pathPattern || '/',
        targetHost: '127.0.0.1',
        targetPort: 3000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await runnerDb!.upsertAppDomain(appDomain as any);
      return { code: 0, data: { ...appDomain, id: domain } };
    },
  );

  /**
   * @title 更新应用域名
   * @description 更新指定应用域名的 pathPattern 或关联应用。
   */
  app.put(
    '/runner-control/app-domains/:domain',
    async (
      req: FastifyRequest<{
        Params: { domain: string };
        Body: { pathPattern?: string; appId?: string };
      }>,
    ) => {
      requireDb();
      const { domain } = req.params;
      const { pathPattern, appId } = req.body;
      const existing = await runnerDb!.findAppDomainByDomain(
        decodeURIComponent(domain),
      );
      if (!existing) {
        return { code: 404, message: 'app domain not found' };
      }
      const updated: RunnerAppDomain = {
        ...existing,
        ...(pathPattern !== undefined && { pathPattern }),
        ...(appId !== undefined && { appId }),
        updatedAt: new Date(),
      };
      await runnerDb!.upsertAppDomain(updated as any);
      return { code: 0, data: { ...updated, id: updated.domain } };
    },
  );

  /**
   * @title 删除应用域名
   * @description 删除指定的应用域名绑定。
   */
  app.delete(
    '/runner-control/app-domains/:domain',
    async (req: FastifyRequest<{ Params: { domain: string } }>) => {
      requireDb();
      const { domain } = req.params;
      await runnerDb!.deleteAppDomain(decodeURIComponent(domain));
      return { code: 0, ok: true };
    },
  );

  // ============================================================
  // 应用管理接口
  // ============================================================

  /**
   * @title 获取应用列表
   * @description 返回 Runner 上部署的应用列表。
   */
  app.get('/runner-control/apps', async () => {
    requireDb();
    const apps = await runnerDb!.findApps();
    return { code: 0, data: apps };
  });

  /**
   * @title 获取单个应用
   * @description 根据 ID 获取应用详情。
   */
  app.get(
    '/runner-control/apps/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      requireDb();
      const { id } = req.params;
      const app = await runnerDb!.findAppById(id);
      return { code: 0, data: app };
    },
  );

  /**
   * @title 创建应用
   * @description 创建新的应用记录。
   */
  app.post(
    '/runner-control/apps',
    async (
      req: FastifyRequest<{
        Body: { name: string; appPort: number; description?: string };
      }>,
    ) => {
      requireDb();
      const { name, appPort, description } = req.body;
      const appData: RunnerAppManagement = {
        appId: `app-${Date.now()}`,
        name,
        appPort,
        description,
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await runnerDb!.upsertApp(appData as any);
      return { code: 0, data: appData };
    },
  );

  /**
   * @title 更新应用
   * @description 更新指定的应用信息。
   */
  app.put(
    '/runner-control/apps/:id',
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: {
          name?: string;
          appPort?: number;
          description?: string;
          status?: string;
        };
      }>,
    ) => {
      requireDb();
      const { id } = req.params;
      const data = req.body;
      const existing = await runnerDb!.findAppById(id);
      if (existing) {
        const updated = { ...existing, ...data, updatedAt: new Date() };
        await runnerDb!.upsertApp(updated as any);
        return { code: 0, data: updated };
      }
      return { code: 404, message: 'App not found' };
    },
  );

  /**
   * @title 删除应用
   * @description 删除指定的应用。
   */
  app.delete(
    '/runner-control/apps/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      requireDb();
      const { id } = req.params;
      await runnerDb!.deleteApp(id);
      return { code: 0, ok: true };
    },
  );

  // ============================================================
  // 性能面板接口
  // ============================================================

  /**
   * @title 获取性能统计
   * @description 返回 Runner 的 CPU、内存、FRP 状态与核心数量统计。
   */
  app.get('/runner-control/stats', async () => {
    const statsService = RunnerStatsService.getInstance();
    const sysStats = statsService.getStats();
    const solutions = runnerDb ? await runnerDb.findSolutions() : [];
    const domainBindings = runnerDb ? await runnerDb.findAppDomains() : [];
    const apps = runnerDb ? await runnerDb.findApps() : [];
    return {
      code: 0,
      data: {
        cpuUsage: sysStats.cpuUsage,
        memoryUsage: sysStats.memoryUsage,
        frpcRunning: frpcService.isRunning(),
        solutions: solutions.length,
        domainBindings: domainBindings.length,
        apps: apps.length,
      },
    };
  });

  // ============================================================
  // FRPC 接口
  // ============================================================

  /**
   * @title 获取 FRPC 状态
   * @description 返回当前 Runner 上 FRPC 进程运行状态。
   */
  app.get('/runner-control/frpc/status', async () => {
    return { code: 0, data: { running: frpcService.isRunning() } };
  });

  /**
   * @title 启动 FRPC
   * @description 在 Runner 端启动 FRPC 进程。
   */
  app.post('/runner-control/frpc/start', async () => {
    try {
      await frpcService.start();
      return { code: 0, ok: true, message: 'FRPC started' };
    } catch (err) {
      return { code: 1, ok: false, message: String(err) };
    }
  });

  /**
   * @title 停止 FRPC
   * @description 在 Runner 端停止 FRPC 进程。
   */
  app.post('/runner-control/frpc/stop', async () => {
    try {
      await frpcService.stop();
      return { code: 0, ok: true, message: 'FRPC stopped' };
    } catch (err) {
      return { code: 1, ok: false, message: String(err) };
    }
  });

  /**
   * @title 重载 FRPC
   * @description 在 Runner 端重载 FRPC 配置。
   */
  app.post('/runner-control/frpc/reload', async () => {
    try {
      await frpcService.reloadViaApi();
      return { code: 0, ok: true, message: 'FRPC reloaded via admin API' };
    } catch (err) {
      return { code: 1, ok: false, message: String(err) };
    }
  });
}
