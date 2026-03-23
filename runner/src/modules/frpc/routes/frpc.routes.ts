import type { FastifyInstance, FastifyRequest } from 'fastify';
import { FrpcService } from '../services/frpc.service';
import type { FrpcConfig, FrpcProxy } from '../types/frpc.types';

/**
 * @title 注册 FRPC 路由
 * @description 提供 FRPC 配置和管理的 API。
 * @param app Fastify 实例
 * @keywords-cn 注册FRPC, 路由, Fastify
 * @keywords-en register-frpc, routes, fastify
 */
export async function registerFrpcRoutes(app: FastifyInstance): Promise<void> {
  const frpcService = new FrpcService();

  /**
   * @title 获取 FRPC 状态
   * @description 返回 FRPC 是否在运行。
   * @keywords-cn FRPC状态, 运行状态
   * @keywords-en frpc-status, running-status
   */
  app.get('/frpc/status', async () => {
    return { code: 0, data: { running: frpcService.isRunning() } };
  });

  /**
   * @title 启动 FRPC
   * @description 根据配置启动 FRP Client。
   * @keywords-cn 启动FRPC
   * @keywords-en start-frpc
   */
  app.post('/frpc/start', async (req: FastifyRequest<{ Body: FrpcConfig }>) => {
    const config = req.body;
    await frpcService.generateConfig(config);
    await frpcService.start();
    return { code: 0, message: 'FRPC started' };
  });

  /**
   * @title 停止 FRPC
   * @description 停止 FRP Client。
   * @keywords-cn 停止FRPC
   * @keywords-en stop-frpc
   */
  app.post('/frpc/stop', async () => {
    await frpcService.stop();
    return { code: 0, message: 'FRPC stopped' };
  });

  /**
   * @title 添加代理
   * @description 动态添加一个 FRP 代理。
   * @keywords-cn 添加代理, FRP代理
   * @keywords-en add-proxy, frp-proxy
   */
  app.post('/frpc/proxies', async (req: FastifyRequest<{ Body: FrpcProxy }>) => {
    await frpcService.addProxy(req.body);
    return { code: 0, message: 'Proxy added' };
  });

  /**
   * @title 移除代理
   * @description 移除一个 FRP 代理。
   * @keywords-cn 移除代理, FRP代理
   * @keywords-en remove-proxy, frp-proxy
   */
  app.delete('/frpc/proxies/:name', async (req: FastifyRequest<{ Params: { name: string } }>) => {
    await frpcService.removeProxy(req.params.name);
    return { code: 0, message: 'Proxy removed' };
  });

  /**
   * @title 重载配置
   * @description 重载 FRPC 配置。
   * @keywords-cn 重载配置, FRPC配置
   * @keywords-en reload-config, frpc-config
   */
  app.post('/frpc/reload', async () => {
    await frpcService.reload();
    return { code: 0, message: 'FRPC reloaded' };
  });
}
