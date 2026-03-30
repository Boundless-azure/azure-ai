import type { FastifyInstance, FastifyRequest } from 'fastify';
import { FrpcService } from '../services/frpc.service';
import type { FrpcConfig } from '../types/frpc.types';
import { getRunnerConfig } from '../../../config/store';

/**
 * @title 注册 FRPC 路由
 * @description 提供 FRPC 配置、启停与状态查询的 REST API。
 * @param app Fastify 实例
 * @keywords-cn 注册FRPC路由, Fastify
 * @keywords-en register-frpc-routes, fastify
 */
export async function registerFrpcRoutes(app: FastifyInstance): Promise<void> {
  const cfg = getRunnerConfig();
  const frpcService = new FrpcService(cfg.frpcBinPath);

  /**
   * @title 获取 FRPC 状态
   * @description 返回 FRPC 进程是否在运行。
   * @keywords-cn FRPC状态
   * @keywords-en frpc-status
   */
  app.get('/frpc/status', async () => {
    return { code: 0, data: { running: frpcService.isRunning() } };
  });

  /**
   * @title 启动 FRPC
   * @description 生成 TOML 配置并启动 frpc 进程，携带 metadata.runner_key 供 frps plugin 鉴权。
   * @keywords-cn 启动FRPC, TOML配置
   * @keywords-en start-frpc, toml-config
   */
  app.post('/frpc/start', async (req: FastifyRequest<{ Body: FrpcConfig }>) => {
    const config = req.body;
    await frpcService.generateConfig(config);
    await frpcService.start();
    return { code: 0, message: 'FRPC started' };
  });

  /**
   * @title 停止 FRPC
   * @description 停止 frpc 进程。
   * @keywords-cn 停止FRPC
   * @keywords-en stop-frpc
   */
  app.post('/frpc/stop', async () => {
    await frpcService.stop();
    return { code: 0, message: 'FRPC stopped' };
  });

  /**
   * @title 重载配置（通过 admin API）
   * @description 调用 frpc admin API 热重载配置，无需重启进程。
   * @keywords-cn 重载配置, admin-api
   * @keywords-en reload-config, admin-api
   */
  app.post('/frpc/reload', async () => {
    await frpcService.reloadViaApi();
    return { code: 0, message: 'FRPC reloaded via admin API' };
  });
}
