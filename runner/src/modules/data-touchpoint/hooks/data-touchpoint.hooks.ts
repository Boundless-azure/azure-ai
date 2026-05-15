import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerDataTouchpointService } from '../services/data-touchpoint.service';
import type { RunnerTouchpointTriggerService } from '../services/touchpoint-trigger.service';
import {
  CreateDataTouchpointSchema,
  DeleteDataTouchpointSchema,
  ListDataTouchpointSchema,
  TriggerTouchpointSchema,
  UpdateDataTouchpointSchema,
  type CreateDataTouchpointInput,
  type DeleteDataTouchpointInput,
  type ListDataTouchpointInput,
  type TriggerTouchpointInput,
  type UpdateDataTouchpointInput,
} from '../types/data-touchpoint.types';

/**
 * @title Runner 数据触点 Hook 注册
 * @description 把数据触点元数据 CRUD 暴露为 hook (runner.app.dataTouchpoint.{create,update,delete,list}),供 SaaS / 业务代码 / 后续触发器调用。
 * @keywords-cn 数据触点hook注册, 元数据CRUD, 主动推送
 * @keywords-en data-touchpoint-hook-register, metadata-crud, proactive-push
 */
const HOOK_TAGS = ['data-touchpoint', 'runner-local'];
const PLUGIN_NAME = 'runner-data-touchpoint';

/**
 * 在 Runner HookBus 上注册数据触点 5 个 hook (create / update / delete / list / trigger)
 * - 重复挂载安全 (基于 name 去重)
 * - mongo 未连接 create/update/delete 返回 error, list 返回空
 * - trigger 需 triggerService 已 start; 未传入 triggerService 时该 hook 不注册
 * @keyword-en register-data-touchpoint-hooks
 */
export function registerDataTouchpointHooks(
  hookBus: RunnerHookBusService,
  mongoClient: RunnerMongoClient,
  triggerService?: RunnerTouchpointTriggerService,
): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));
  const getService = (): RunnerDataTouchpointService | null => {
    const db = mongoClient.getDb();
    if (!db) return null;
    return new RunnerDataTouchpointService(db);
  };

  if (!existing.has('runner.app.dataTouchpoint.create')) {
    hookBus.register(
      'runner.app.dataTouchpoint.create',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'error', error: 'mongo not connected' };
        }
        const payload = event.payload as CreateDataTouchpointInput;
        const created = await svc.create(payload);
        // 联动加载胶水 schedule 元数据并注册到 BullMQ Repeatable
        if (triggerService) {
          await triggerService
            .reloadSchedule(created)
            .catch((e: unknown) => {
              // 加载失败不影响 create 成功 (元数据已落库)
              // eslint-disable-next-line no-console
              console.warn(
                `[touchpoint] reloadSchedule failed for ${created._id}:`,
                e instanceof Error ? e.message : e,
              );
            });
        }
        return { status: 'success', data: created };
      },
      {
        description: '创建数据触点元数据 + 联动加载 schedule',
        tags: HOOK_TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: CreateDataTouchpointSchema,
      },
    );
  }

  if (!existing.has('runner.app.dataTouchpoint.update')) {
    hookBus.register(
      'runner.app.dataTouchpoint.update',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'error', error: 'mongo not connected' };
        }
        const payload = event.payload as UpdateDataTouchpointInput;
        const updated = await svc.update(payload);
        // 联动重载 schedule (胶水文件可能改了 / enabled 状态变了 / 元数据变了)
        if (updated && triggerService) {
          await triggerService
            .reloadSchedule(updated)
            .catch((e: unknown) => {
              // eslint-disable-next-line no-console
              console.warn(
                `[touchpoint] reloadSchedule failed for ${updated._id}:`,
                e instanceof Error ? e.message : e,
              );
            });
        }
        return { status: 'success', data: updated };
      },
      {
        description: '更新数据触点元数据 (id 必填) + 联动重载 schedule',
        tags: HOOK_TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: UpdateDataTouchpointSchema,
      },
    );
  }

  if (!existing.has('runner.app.dataTouchpoint.delete')) {
    hookBus.register(
      'runner.app.dataTouchpoint.delete',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'error', error: 'mongo not connected' };
        }
        const payload = event.payload as DeleteDataTouchpointInput;
        const deleted = await svc.delete(payload.id);
        // 联动清理触点状态 + schedule (双 store 都尝试, 冗余删无副作用)
        if (deleted && triggerService) {
          await Promise.all([
            triggerService.removeState(payload.id).catch(() => undefined),
            triggerService.removeSchedule(payload.id).catch(() => undefined),
          ]);
        }
        return { status: 'success', data: { deleted } };
      },
      {
        description:
          '删除数据触点元数据 + 联动清理触点状态 (mongo + redis) + 运行历史 + 移除 schedule (物理胶水代码由调用方清理)',
        tags: HOOK_TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: DeleteDataTouchpointSchema,
      },
    );
  }

  if (!existing.has('runner.app.dataTouchpoint.list')) {
    hookBus.register(
      'runner.app.dataTouchpoint.list',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: { items: [] } };
        }
        const payload = (event.payload ?? {}) as ListDataTouchpointInput;
        const items = await svc.list(payload);
        return { status: 'success', data: { items } };
      },
      {
        description:
          '列出数据触点 (可按 solutionId / bindSessionId / source / enabled 过滤)',
        tags: HOOK_TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: ListDataTouchpointSchema,
      },
    );
  }

  if (triggerService && !existing.has('runner.app.dataTouchpoint.trigger')) {
    hookBus.register(
      'runner.app.dataTouchpoint.trigger',
      async (event) => {
        const payload = event.payload as TriggerTouchpointInput;
        const { jobId } = await triggerService.trigger(payload);
        return { status: 'success', data: { jobId, queued: true } };
      },
      {
        description:
          '触发数据触点: 按 sources (单字符串或数组) 异步派发到队列, 命中触点逐个加载执行胶水代码 (同时订阅多 source 的触点自然去重仅跑一次, 胶水 ctx 拿 matchedSources/payloadsBySource); 可选 solutionId 限定范围',
        tags: HOOK_TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: TriggerTouchpointSchema,
      },
    );
  }
}
