import { createRunnerApp } from './app';
import { getRunnerConfig } from './config/store';

/**
 * @title Runner 启动入口
 * @description 启动 runner Fastify 服务。
 * @keywords-cn 启动入口, Fastify服务, Runner
 * @keywords-en bootstrap, fastify-server, runner
 */
async function bootstrap() {
  const { app } = await createRunnerApp();
  const cfg = getRunnerConfig();
  const port = cfg.serverPort || 4310;
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
