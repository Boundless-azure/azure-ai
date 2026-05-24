import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Db } from 'mongodb';
import { ProxyService } from './proxy.service';
import { RunnerDbService } from '../runner-db/services/runner-db.service';
import type { RunnerAppManagement } from '../runner-db/types/runner-db.types';

/**
 * @title 注册代理路由
 * @description 注册 /internal/forward 等代理相关路由。
 * @param app Fastify 实例
 * @param db MongoDB 数据库实例
 * @keywords-cn 注册代理, 路由, Fastify
 * @keywords-en register-proxy, routes, fastify
 */
export async function registerProxyRoutes(app: FastifyInstance, db: Db): Promise<void> {
  const runnerDb = new RunnerDbService(db);
  const proxyService = new ProxyService(runnerDb);

  /**
   * @title 内部转发接口
   * @description 接收 Caddy 转发的请求，根据域名路由到对应应用。
   * @keywords-cn 内部转发, 域名路由, 应用转发
   * @keywords-en internal-forward, domain-route, app-forward
   */
  app.all('/internal/forward', async (req: FastifyRequest, reply: FastifyReply) => {
    const domain = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string);
    const target = await proxyService.resolveTarget(domain);

    if (!target) {
      return reply.status(404).send({ code: 404, message: 'Domain not found' });
    }

    // 使用 Fastify 的代理功能转发到目标服务
    const targetUrl = `http://${target.host}:${target.port}`;
    return reply.redirect(targetUrl + (req.url || '/'));
  });

  /**
   * @title 获取本地域名列表
   * @description 返回 Runner 上配置的所有域名绑定。
   * @keywords-cn 域名列表, 本地域名
   * @keywords-en domain-list, local-domains
   */
  app.get('/internal/domains', async () => {
    const domains = await proxyService.getAllDomains();
    return { code: 0, data: domains };
  });

  /**
   * @title 同步域名到 SaaS
   * @description 将 Runner 的域名绑定同步到 SaaS 端。
   * @keywords-cn 同步域名, SaaS
   * @keywords-en sync-domain, saas
   */
  app.post('/internal/domains/sync', async (req) => {
    // TODO: 调用 SaaS 接口同步域名
    const domains = await proxyService.getAllDomains();
    return { code: 0, data: domains };
  });

  /**
   * @title 创建/更新应用
   * @description 在 Runner 上创建或更新应用信息。
   * @keywords-cn 创建应用, 更新应用
   * @keywords-en create-app, update-app
   */
  app.post('/internal/apps', async (req: FastifyRequest<{ Body: RunnerAppManagement }>) => {
    const appData = req.body;
    await runnerDb.upsertApp(appData as any);
    return { code: 0, message: 'App saved' };
  });

  /**
   * @title 获取应用列表
   * @description 返回 Runner 上配置的所有应用。
   * @keywords-cn 应用列表, Runner应用
   * @keywords-en app-list, runner-apps
   */
  app.get('/internal/apps', async () => {
    const apps = await runnerDb.findApps();
    return { code: 0, data: apps };
  });

  /**
   * @title 删除应用
   * @description 删除指定应用及其域名绑定。
   * @keywords-cn 删除应用, 应用域名
   * @keywords-en delete-app, app-domain
   */
  app.delete('/internal/apps/:appId', async (req: FastifyRequest<{ Params: { appId: string } }>) => {
    const { appId } = req.params;
    // 先删除应用域名绑定
    await proxyService.deleteAppDomains(appId);
    // 再删除应用
    await runnerDb.deleteApp(appId);
    return { code: 0, message: 'App deleted' };
  });
}
