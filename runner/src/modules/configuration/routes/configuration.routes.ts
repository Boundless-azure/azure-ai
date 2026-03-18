import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getRunnerConfig, saveRunnerConfig } from '../../../config/store';
import { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerRedisClient } from '../../redis/redis.client';

/**
 * @title Runner 配置路由
 * @description 提供配置读取、更新与 Mongo/Redis 连接检测接口。
 * @keywords-cn 配置路由, Mongo检测, Redis检测, 配置写入
 * @keywords-en config-routes, mongo-check, redis-check, config-save
 */
export async function registerConfigurationRoutes(
  app: FastifyInstance,
  mongoClient: RunnerMongoClient,
  redisClient: RunnerRedisClient,
): Promise<void> {
  const SaveConfigSchema = z.object({
    saasSocketUrl: z.string().url().optional(),
    runnerKey: z.string().optional(),
    hookbusDebugEnabled: z.boolean().optional(),
    mongoUri: z.string().optional(),
    mongoDbName: z.string().optional(),
    runnerDbName: z.string().optional(),
    redisUri: z.string().optional(),
    serverPort: z.number().int().positive().optional(),
  });
  const TestMongoSchema = z.object({
    mongoUri: z.string().optional(),
    mongoDbName: z.string().optional(),
    runnerDbName: z.string().optional(),
  });
  const TestRedisSchema = z.object({
    redisUri: z.string().optional(),
  });

  app.get('/config/status', async () => {
    const cfg = getRunnerConfig();
    const defaultDb = cfg.runnerDbName || cfg.mongoDbName;
    const mongoReady = cfg.mongoUri && defaultDb ? await mongoClient.ping(defaultDb) : false;
    const redisReady = cfg.redisUri ? await redisClient.ping() : false;
    return {
      ok: true,
      hasRunnerKey: Boolean(cfg.runnerId && cfg.runnerKey),
      hasMongoConfig: Boolean(cfg.mongoUri && defaultDb),
      hasRedisConfig: Boolean(cfg.redisUri),
      mongoConnected: mongoReady,
      redisConnected: redisReady,
      config: { ...cfg },
    };
  });

  app.post('/config/save', async (request, reply) => {
    const parsed = SaveConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        issues: parsed.error.issues.map((item) => item.message),
      });
    }
    const next = saveRunnerConfig(parsed.data);
    if (next.mongoUri && (next.runnerDbName || next.mongoDbName)) {
      await mongoClient.connect(next.mongoUri, next.runnerDbName || next.mongoDbName);
    }
    if (next.redisUri) {
      await redisClient.connect(next.redisUri);
    }
    return { ok: true, config: { ...next } };
  });

  app.post('/config/test/mongo', async (request, reply) => {
    const parsed = TestMongoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        issues: parsed.error.issues.map((item) => item.message),
      });
    }
    const cfg = getRunnerConfig();
    const mongoUri = parsed.data.mongoUri ?? cfg.mongoUri;
    const mongoDbName = parsed.data.runnerDbName ?? parsed.data.mongoDbName ?? cfg.runnerDbName ?? cfg.mongoDbName;
    if (!mongoUri || !mongoDbName) {
      return reply
        .status(400)
        .send({ ok: false, message: 'mongo config is required' });
    }
    try {
      await mongoClient.connect(mongoUri, mongoDbName);
      const connected = await mongoClient.ping(mongoDbName);
      return { ok: connected, message: connected ? 'mongo connected' : 'mongo ping failed' };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'mongo connect failed',
      });
    }
  });

  app.post('/config/test/redis', async (request, reply) => {
    const parsed = TestRedisSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        issues: parsed.error.issues.map((item) => item.message),
      });
    }
    const cfg = getRunnerConfig();
    const redisUri = parsed.data.redisUri ?? cfg.redisUri;
    if (!redisUri) {
      return reply
        .status(400)
        .send({ ok: false, message: 'redis config is required' });
    }
    try {
      await redisClient.connect(redisUri);
      const connected = await redisClient.ping();
      return { ok: connected, message: connected ? 'redis connected' : 'redis ping failed' };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'redis connect failed',
      });
    }
  });
}
