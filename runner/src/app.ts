import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join } from 'node:path';
import { Server } from 'socket.io';
import { getRunnerConfig } from './config/store';
import { RunnerMongoClient } from './modules/mongo/mongo.client';
import { RunnerRedisClient } from './modules/redis/redis.client';
import { registerConfigurationRoutes } from './modules/configuration/routes/configuration.routes';
import { registerRunnerRegistrationRoutes } from './modules/registration/routes/registration.routes';
import { RunnerRegistrationService } from './modules/registration/services/registration.service';
import { RunnerHookBusService } from './modules/hookbus/services/hookbus.service';
import { registerHookBusRoutes } from './modules/hookbus/routes/hookbus.routes';
import { registerHookBusGateway } from './modules/hookbus/ws/hookbus.gateway';
import { registerDataAuthRoutes } from './modules/data-auth/routes/data-auth.routes';
import { RunnerWebMcpService } from './modules/webmcp/services/webmcp.service';
import { RunnerDbMigrationService } from './modules/runner-db/services/runner-db.migration.service';
import { RunnerDbService } from './modules/runner-db/services/runner-db.service';
import { UnitCoreService } from './unit-core/services/unit-core.service';
import { registerWebMcpRoutes } from './modules/webmcp/routes/webmcp.routes';
import { registerSolutionRoutes } from './modules/solution/routes/solution.routes';
import { registerProxyRoutes } from './modules/proxy/proxy.routes';
import { registerFrpcRoutes } from './modules/frpc/routes/frpc.routes';
import { registerRunnerControlRoutes } from './modules/runner-control/runner-control.routes';

/**
 * @title 创建 Runner 应用
 * @description 构建 Fastify + Socket.IO 的 runner 主应用与模块路由注册。
 * @keywords-cn Runner应用, Fastify启动, Socket.IO, 路由注册
 * @keywords-en runner-app, fastify-bootstrap, socketio, route-register
 */
export async function createRunnerApp() {
  const app = Fastify({ logger: true });
  const cfg = getRunnerConfig();
  const mongoClient = new RunnerMongoClient();
  const redisClient = new RunnerRedisClient();
  const registrationService = new RunnerRegistrationService();
  const hookBus = new RunnerHookBusService({
    concurrency: 4,
    storage: {
      mode: cfg.redisUri && cfg.redisUri.trim() ? 'redis' : 'memory',
      queueKeyPrefix: 'runner:hookbus:queue',
      bindingKeyPrefix: 'runner:hookbus:binding',
    },
  });
  const webmcpService = new RunnerWebMcpService();
  const unitCore = new UnitCoreService({
    workspacePath: join(process.cwd(), 'workspace'),
    systemUnitPath: UnitCoreService.resolveSystemUnitPath(process.cwd()),
    runnerDbName: cfg.runnerDbName || 'runner',
    mongoClient,
  });

  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'src', 'public'),
    prefix: '/',
  });

  registerConfigurationRoutes(app, mongoClient, redisClient);
  registerRunnerRegistrationRoutes(app, registrationService);
  await registerHookBusRoutes(app, hookBus);
  await registerDataAuthRoutes(app);
  await registerWebMcpRoutes(app, webmcpService);
  await registerSolutionRoutes(app, mongoClient, redisClient);

  // Runner 代理路由和 FRPC 路由（在 MongoDB 初始化后注册）
  let db = null;
  if (cfg.mongoUri) {
    db = await mongoClient.connect(cfg.mongoUri, cfg.runnerDbName || 'runner');
    await registerProxyRoutes(app, db);
  }
  // runner-control 路由始终注册，但数据库操作需要 mongoUri
  await registerRunnerControlRoutes(app, db || undefined);

  await registerFrpcRoutes(app);

  app.get('/health', () => ({ ok: true }));

  /**
   * ping 接口：判断 runner 映射路径是否就绪
   * @keyword-en ping, runner-ready
   */
  app.get('/ping', () => ({ ok: true, message: 'runner ready and ok' }));

  // Socket.IO 配置与连接处理

  const io = new Server(app.server, {
    cors: { origin: '*' },
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  io.on('connection', (socket) => {
    socket.emit('runner/status', { ok: true, ts: Date.now() });
  });

  const hookbusIo = new Server(app.server, {
    path: '/hookbus',
    cors: { origin: '*' },
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  registerHookBusGateway(hookbusIo, hookBus);
  await unitCore.init();
  unitCore.registerToHookBus(hookBus);
  if (cfg.mongoUri) {
    const db = await mongoClient.connect(
      cfg.mongoUri,
      cfg.runnerDbName || 'runner',
    );
    const migration = new RunnerDbMigrationService();
    await migration.run(db);
    const runnerDb = new RunnerDbService(db);
    await unitCore.persistHooks(runnerDb);
  }
  if (cfg.redisUri) {
    await redisClient.connect(cfg.redisUri);
  }

  return { app, io, hookbusIo };
}
