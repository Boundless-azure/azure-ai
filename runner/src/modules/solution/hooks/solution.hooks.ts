import { z } from 'zod';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerSolutionService } from '../services/solution.service';

/**
 * @title Runner Solution Hook 注册
 * @description 把 Runner 本地 Solution 能力暴露成 hook (runner.app.solution.list / .get / .search),
 *              供 SaaS 通过双向 RPC 跨进程聚合多 Runner 的真实数据。
 * @keywords-cn solution-hook注册, 跨进程聚合, runner本地数据
 * @keywords-en solution-hook-register, cross-process-aggregate, runner-local-data
 */
const ListPayloadSchema = z
  .object({
    source: z.enum(['self_developed', 'marketplace']).optional(),
  })
  .optional();

const GetPayloadSchema = z.object({ name: z.string().min(1) });

const DeletePayloadSchema = z.object({ name: z.string().min(1) });

const SearchPayloadSchema = z.object({
  q: z.string().optional(),
  source: z.enum(['self_developed', 'marketplace']).optional(),
  include: z.enum(['app', 'unit', 'workflow', 'agent']).optional(),
});

/**
 * @title 注册 Solution 相关 hook
 * @description 在 Runner HookBus 上注册 list / get / search 三个公开 hook。
 *              重复挂载安全 (基于 name + pluginName 去重检查)。
 * @keyword-en register-solution-hooks
 */
export function registerSolutionHooks(
  hookBus: RunnerHookBusService,
  mongoClient: RunnerMongoClient,
): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));
  const getService = (): RunnerSolutionService | null => {
    const db = mongoClient.getDb();
    if (!db) return null;
    return new RunnerSolutionService(db);
  };

  if (!existing.has('runner.app.solution.list')) {
    hookBus.register(
      'runner.app.solution.list',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: { items: [] } };
        }
        const all = await svc.list();
        const payload = (event.payload ?? {}) as { source?: string };
        const filtered = payload?.source
          ? all.filter((s) => s.source === payload.source)
          : all;
        return { status: 'success', data: { items: filtered } };
      },
      {
        description: '列出当前 Runner 上已安装的 Solution',
        tags: ['solution', 'runner-local'],
        pluginName: 'runner-solution',
        payloadSchema: ListPayloadSchema,
      },
    );
  }

  if (!existing.has('runner.app.solution.get')) {
    hookBus.register(
      'runner.app.solution.get',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: null };
        }
        const payload = event.payload as { name: string };
        const item = await svc.getByName(payload.name);
        return { status: 'success', data: item };
      },
      {
        description: '获取当前 Runner 上指定名称 Solution 的详情',
        tags: ['solution', 'runner-local'],
        pluginName: 'runner-solution',
        payloadSchema: GetPayloadSchema,
      },
    );
  }

  if (!existing.has('runner.app.solution.delete')) {
    hookBus.register(
      'runner.app.solution.delete',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: { deleted: false } };
        }
        const payload = event.payload as { name: string };
        const deleted = await svc.delete(payload.name);
        return { status: 'success', data: { deleted } };
      },
      {
        description: '从当前 Runner 卸载指定名称的 Solution (物理删除目录 + Mongo)',
        tags: ['solution', 'runner-local'],
        pluginName: 'runner-solution',
        payloadSchema: DeletePayloadSchema,
      },
    );
  }

  if (!existing.has('runner.app.solution.search')) {
    hookBus.register(
      'runner.app.solution.search',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: { items: [] } };
        }
        const payload = (event.payload ?? {}) as {
          q?: string;
          source?: 'self_developed' | 'marketplace';
          include?: 'app' | 'unit' | 'workflow' | 'agent';
        };
        const items = await svc.search(payload);
        return { status: 'success', data: { items } };
      },
      {
        description: '在当前 Runner 上按 q / source / include 搜索 Solution',
        tags: ['solution', 'runner-local'],
        pluginName: 'runner-solution',
        payloadSchema: SearchPayloadSchema,
      },
    );
  }
}
