import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerCodeAgentPlanService } from '../services/code-agent-plan.service';
import {
  EnsurePlanPayloadSchema,
  GetSnapshotPayloadSchema,
  ListTodosPayloadSchema,
  SearchTasksPayloadSchema,
  UpsertTasksPayloadSchema,
  UpsertTodosPayloadSchema,
} from '../types/code-agent-plan.types';

const PLUGIN_NAME = 'runner-code-agent-plan';
const TAGS = ['code-agent', 'change-plan', 'runner-local'];

/**
 * @title 注册 code-agent 变更集存储 hook
 * @description 在 Runner HookBus 上注册 runner.app.codeAgentPlan.* 六个专有业务 hook,
 *   把变更集 (changePlan) 的持久化能力暴露给 SaaS code-agent 节点。这些 hook 内部走
 *   RunnerCodeAgentPlanService 直接读写 Mongo, 是底层 denyLlm mongo 写 hook 的合法业务出口。
 *   requiredAbility 复用 solution subject (与 code-agent 既有权限对齐)。重复挂载安全。
 * @keywords-cn 变更集hook注册, 专有业务hook
 * @keywords-en change-plan-hook-register, dedicated-business-hook
 * @keyword-cn 变更集hook注册, 专有业务hook
 * @keyword-en change-plan-hook-register, dedicated-business-hook
 */
export function registerCodeAgentPlanHooks(
  hookBus: RunnerHookBusService,
  mongoClient: RunnerMongoClient,
): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));
  const getService = (): RunnerCodeAgentPlanService | null => {
    const db = mongoClient.getDb();
    if (!db) return null;
    return new RunnerCodeAgentPlanService(db);
  };

  if (!existing.has('runner.app.codeAgentPlan.ensurePlan')) {
    hookBus.register(
      'runner.app.codeAgentPlan.ensurePlan',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'error', error: 'runner mongo is unavailable' };
        }
        const payload = EnsurePlanPayloadSchema.parse(event.payload ?? {});
        const plan = await svc.ensurePlan(payload);
        return { status: 'success', data: plan };
      },
      {
        description:
          '幂等创建/读取一个 code-agent 变更集计划元数据 (按 planId)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: EnsurePlanPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentPlan.upsertTasks')) {
    hookBus.register(
      'runner.app.codeAgentPlan.upsertTasks',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'error', error: 'runner mongo is unavailable' };
        }
        const payload = UpsertTasksPayloadSchema.parse(event.payload ?? {});
        const result = await svc.upsertTasks(payload);
        return { status: 'success', data: result };
      },
      {
        description:
          '批量 merge-upsert 变更任务节点 (文件 + hook 契约), 按 planId+taskId 作用域',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: UpsertTasksPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentPlan.searchTasks')) {
    hookBus.register(
      'runner.app.codeAgentPlan.searchTasks',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: { items: [] } };
        }
        const payload = SearchTasksPayloadSchema.parse(event.payload ?? {});
        const items = await svc.searchTasks(payload);
        return { status: 'success', data: { items } };
      },
      {
        description:
          '在某变更集计划内按 taskIds/routeId/hookName 局部搜索变更任务',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: SearchTasksPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentPlan.upsertTodos')) {
    hookBus.register(
      'runner.app.codeAgentPlan.upsertTodos',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'error', error: 'runner mongo is unavailable' };
        }
        const payload = UpsertTodosPayloadSchema.parse(event.payload ?? {});
        const result = await svc.upsertTodos(payload);
        return { status: 'success', data: result };
      },
      {
        description:
          '批量 merge-upsert 规划 todo (新增与改状态共用), 按 planId+todoId 作用域',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: UpsertTodosPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentPlan.listTodos')) {
    hookBus.register(
      'runner.app.codeAgentPlan.listTodos',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return { status: 'success', data: { items: [] } };
        }
        const payload = ListTodosPayloadSchema.parse(event.payload ?? {});
        const items = await svc.listTodos(payload);
        return { status: 'success', data: { items } };
      },
      {
        description: '按状态过滤列出某变更集计划的规划 todo, 驱动外循环',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: ListTodosPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.codeAgentPlan.getSnapshot')) {
    hookBus.register(
      'runner.app.codeAgentPlan.getSnapshot',
      async (event) => {
        const svc = getService();
        if (!svc) {
          return {
            status: 'success',
            data: { plan: null, totalTasks: 0, openTodos: 0, doneTodos: 0 },
          };
        }
        const payload = GetSnapshotPayloadSchema.parse(event.payload ?? {});
        const snapshot = await svc.getSnapshot(payload);
        return { status: 'success', data: snapshot };
      },
      {
        description: '读取变更集计划元数据 + 计数 (任务数/开放 todo 数), 供完成判定',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: GetSnapshotPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }
}
