import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerRedisClient } from '../../redis/redis.client';
import { RunnerSolutionService } from '../services/solution.service';
import {
  InstallSolutionSchema,
  ListSolutionSchema,
  SearchSolutionSchema,
  SolutionIncludeEnum,
  SolutionSourceEnum,
} from '../types/solution.types';

/**
 * @title Runner Solution 路由
 * @description 提供 Solution 的查看、安装、删除、升级、搜索 API
 * @keywords-cn solution路由, solution接口, solution管理
 * @keywords-en solution-routes, solution-api, solution-management
 */
export async function registerSolutionRoutes(
  app: FastifyInstance,
  mongoClient: RunnerMongoClient,
  _redisClient: RunnerRedisClient,
): Promise<void> {
  const getService = (): RunnerSolutionService => {
    const db = mongoClient.getDb();
    if (!db) throw new Error('MongoDB not connected');
    return new RunnerSolutionService(db);
  };

  /**
   * @title 获取 Solution 列表
   * @description 获取当前 Runner 上所有已安装的 Solution
   */
  app.get('/solutions', async (request, reply) => {
    try {
      const query = ListSolutionSchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ ok: false, issues: query.error.issues });
      }

      const service = getService();
      const solutions = await service.list();

      // 按来源筛选
      let filtered = solutions;
      if (query.data.source) {
        filtered = solutions.filter((s) => s.source === query.data.source);
      }

      // 分页
      const page = query.data.page;
      const pageSize = query.data.pageSize;
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return {
        ok: true,
        data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });

  /**
   * @title 获取 Solution 详情
   * @description 根据名称获取 Solution 详细信息
   */
  app.get('/solutions/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const service = getService();
      const solution = await service.getByName(name);

      if (!solution) {
        return reply.status(404).send({ ok: false, message: 'Solution not found' });
      }

      return { ok: true, data: solution };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });

  /**
   * @title 安装 Solution
   * @description 从指定源安装 Solution 到 Runner
   */
  app.post('/solutions/install', async (request, reply) => {
    try {
      const body = InstallSolutionSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ ok: false, issues: body.error.issues });
      }

      const service = getService();
      const solution = await service.install(body.data);

      return { ok: true, data: solution };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });

  /**
   * @title 删除 Solution
   * @description 从 Runner 删除指定的 Solution
   */
  app.delete('/solutions/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const service = getService();
      const deleted = await service.delete(name);

      if (!deleted) {
        return reply.status(404).send({ ok: false, message: 'Solution not found' });
      }

      return { ok: true };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });

  /**
   * @title 升级 Solution
   * @description 从指定源升级已安装的 Solution
   */
  app.post('/solutions/:name/upgrade', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const body = z.object({ sourceUrl: z.string() }).safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ ok: false, issues: body.error.issues });
      }

      const service = getService();
      const solution = await service.upgrade(name, body.data.sourceUrl);

      if (!solution) {
        return reply.status(404).send({ ok: false, message: 'Solution not found' });
      }

      return { ok: true, data: solution };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });

  /**
   * @title 搜索 Solution
   * @description 根据条件搜索 Solution
   */
  app.get('/solutions/search/query', async (request, reply) => {
    try {
      const query = SearchSolutionSchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ ok: false, issues: query.error.issues });
      }

      const service = getService();
      const solutions = await service.search(query.data);

      return { ok: true, data: solutions };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });
}
