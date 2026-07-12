import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerDbService } from '../../runner-db/services/runner-db.service';
import { RunnerAppTagService } from '../services/app-tag.service';
import {
  EnsureAppTagPayloadSchema,
  EnsureManyPayloadSchema,
  GetAppTagListPayloadSchema,
  SearchAppTagsPayloadSchema,
} from '../types/app-tag.types';

const PLUGIN_NAME = 'runner-app-tag';
const TAGS = ['code-agent', 'app-tag', 'runner-local'];

/**
 * @title 注册 app 标签 hook
 * @description 在 Runner HookBus 上注册 runner.app.appTag.{getList,ensure,search} 三个业务 hook,
 *   把每个 app 目录顶层 tags.json 的标签数组暴露给 code-agent 的并发代码节点。ensure 服务端幂等去重 +
 *   进程内 appId 串行化, 抗全并发写竞态。requiredAbility 复用 solution subject。重复挂载安全。
 * @keyword-cn 标签hook注册, 业务hook
 * @keyword-en app-tag-hook-register, business-hook
 */
export function registerAppTagHooks(
  hookBus: RunnerHookBusService,
  runnerDb: RunnerDbService,
  workspacePath: string,
): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));
  const svc = new RunnerAppTagService(runnerDb, workspacePath);

  if (!existing.has('runner.app.appTag.getList')) {
    hookBus.register(
      'runner.app.appTag.getList',
      async (event) => {
        try {
          const payload = GetAppTagListPayloadSchema.parse(event.payload ?? {});
          const keywords = await svc.getList(payload.appId);
          return { status: 'success', data: { keywords } };
        } catch (error) {
          return {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      {
        description:
          '读取某 app 目录顶层 tags.json 的维度化关键词词表 { 维度: [词] } (按 appId)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: GetAppTagListPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.appTag.ensure')) {
    hookBus.register(
      'runner.app.appTag.ensure',
      async (event) => {
        try {
          const payload = EnsureAppTagPayloadSchema.parse(event.payload ?? {});
          const result = await svc.ensure(payload);
          return { status: 'success', data: result };
        } catch (error) {
          return {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      {
        description:
          '幂等新增一个维度化关键词 { appId, dimension?, keyword } (维度归一 + 去重, 原子抗并发)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: EnsureAppTagPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.appTag.ensureMany')) {
    hookBus.register(
      'runner.app.appTag.ensureMany',
      async (event) => {
        try {
          const payload = EnsureManyPayloadSchema.parse(event.payload ?? {});
          const result = await svc.ensureMany(payload);
          return { status: 'success', data: result };
        } catch (error) {
          return {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      {
        description:
          '批量把收集的 @keyword 关键词同步进 tags.json (归一化去重, 只加缺的, 原子)',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: EnsureManyPayloadSchema,
        requiredAbility: { action: 'create', subject: 'solution' },
      },
    );
  }

  if (!existing.has('runner.app.appTag.search')) {
    hookBus.register(
      'runner.app.appTag.search',
      async (event) => {
        try {
          const payload = SearchAppTagsPayloadSchema.parse(event.payload ?? {});
          const keywords = await svc.search(payload);
          return { status: 'success', data: { keywords } };
        } catch (error) {
          return {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      {
        description: '在某 app 词表内按 query 跨维度搜索, 回命中的 { 维度: [词] }',
        tags: TAGS,
        pluginName: PLUGIN_NAME,
        payloadSchema: SearchAppTagsPayloadSchema,
        requiredAbility: { action: 'read', subject: 'solution' },
      },
    );
  }
}
