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
import {
  createRunnerHookAbilityMiddleware,
  RunnerAbilityService,
  RunnerIdentityRepository,
} from './modules/identity';
import { registerIdentityAdminHooks } from './modules/identity/hooks/identity.hooks';
import { registerHookBusRoutes } from './modules/hookbus/routes/hookbus.routes';
import { registerHookBusGateway } from './modules/hookbus/ws/hookbus.gateway';
import { attachHookRpc } from './modules/hookbus/ws/hook-rpc.client';
import type { Socket as ClientSocket } from 'socket.io-client';
import { registerDataAuthRoutes } from './modules/data-auth/routes/data-auth.routes';
import { RunnerWebMcpService } from './modules/webmcp/services/webmcp.service';
import { RunnerDbMigrationService } from './modules/runner-db/services/runner-db.migration.service';
import { RunnerDbService } from './modules/runner-db/services/runner-db.service';
import { UnitCoreService } from './unit-core/services/unit-core.service';
import { registerWebMcpRoutes } from './modules/webmcp/routes/webmcp.routes';
import { registerSolutionRoutes } from './modules/solution/routes/solution.routes';
import { registerSolutionHooks } from './modules/solution/hooks/solution.hooks';
import { RunnerSolutionService } from './modules/solution/services/solution.service';
import { registerDataTouchpointHooks } from './modules/data-touchpoint/hooks/data-touchpoint.hooks';
import { registerCodeAgentPlanHooks } from './modules/code-agent-plan/hooks/code-agent-plan.hooks';
import { registerAppTagHooks } from './modules/app-tag/hooks/app-tag.hooks';
import { registerCodeAgentFsHooks } from './modules/code-agent-fs/hooks/code-agent-fs.hooks';
import { RunnerTouchpointTriggerService } from './modules/data-touchpoint/services/touchpoint-trigger.service';
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
  // hookBus 必须在 registrationService 之后注入回调, 但需先实例化以便闭包使用
  const hookBus = new RunnerHookBusService({
    concurrency: 4,
    storage: {
      mode: cfg.redisUri && cfg.redisUri.trim() ? 'redis' : 'memory',
      queueKeyPrefix: 'runner:hookbus:queue',
      bindingKeyPrefix: 'runner:hookbus:binding',
    },
  });
  // identity (RBAC + ability) 占位; mongo 起来后真正 init
  let ability: RunnerAbilityService | null = null;
  let identityRepo: RunnerIdentityRepository | null = null;
  const webmcpService = new RunnerWebMcpService();
  const unitCore = new UnitCoreService({
    workspacePath: join(process.cwd(), 'workspace'),
    systemUnitPath: UnitCoreService.resolveSystemUnitPath(process.cwd()),
    runnerDbName: cfg.runnerDbName || 'runner',
    mongoClient,
  });
  // 数据触点触发服务 (BullMQ 异步队列 + worker_thread 真 kill + OTel 运行历史)
  // 实例化在前以便 socket 回调注入 callSaaSHook; queue/worker 在 redis + runnerId 都就绪后 start
  // 没有 runnerId (未注册) 时不创建, 避免 redis key 无前缀导致多租户漏租
  const touchpointTrigger =
    cfg.redisUri && cfg.runnerId
      ? new RunnerTouchpointTriggerService(
          cfg.redisUri,
          hookBus,
          mongoClient,
          cfg.runnerId,
        )
      : undefined;

  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'src', 'public'),
    prefix: '/',
  });

  // socket connect 后挂 hook-rpc 协议 (attach 内部幂等; 同时把 callSaaSHook 注入 hookBus.setForwardToSaaS, saas.* hook 调用自动转发)
  registrationService.setOnSocketReady((socket: ClientSocket) =>
    attachHookRpc(socket, hookBus, unitCore),
  );

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
    await new RunnerSolutionService(db).ensureDefaultLightweightSolution();

    // identity: seed 内置 principal/role + 注册 hookBus middleware (本地 mongo + push hint fallback)
    identityRepo = new RunnerIdentityRepository(db);
    await identityRepo.seedBuiltin();
    ability = new RunnerAbilityService(identityRepo);
    hookBus.use(createRunnerHookAbilityMiddleware(ability));
    registerIdentityAdminHooks(hookBus, identityRepo, ability);

    registerSolutionHooks(hookBus, mongoClient, runnerDb);
    registerDataTouchpointHooks(hookBus, mongoClient, touchpointTrigger);
    registerCodeAgentPlanHooks(hookBus, mongoClient);
    registerAppTagHooks(hookBus, runnerDb, join(process.cwd(), 'workspace'));
    registerCodeAgentFsHooks(
      hookBus,
      mongoClient,
      join(process.cwd(), 'workspace'),
    );
  }
  if (cfg.redisUri) {
    await redisClient.connect(cfg.redisUri);
    // redis 就绪后启动数据触点队列 + Worker (并发 4); 然后扫表恢复 schedule (兜底 redis 数据丢失)
    if (touchpointTrigger) {
      await touchpointTrigger.start();
      // 异步执行不 block 启动 — schedule 扫表失败不该挡 runner 启动
      touchpointTrigger.bootstrapSchedules().catch((e: unknown) => {
        app.log.warn(
          { err: e instanceof Error ? e.message : e },
          '[touchpoint] bootstrapSchedules failed',
        );
      });
    }
  }

  return { app, io, hookbusIo };
}
