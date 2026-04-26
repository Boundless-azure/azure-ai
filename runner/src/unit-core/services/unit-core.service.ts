import { join } from 'node:path';
import type { RunnerHookBusService } from '../../modules/hookbus/services/hookbus.service';
import type { RunnerDbService } from '../../modules/runner-db/services/runner-db.service';
import type { RunnerMongoClient } from '../../modules/mongo/mongo.client';
import { UnitLoaderService } from './unit-loader.service';
import { UnitRegistryService } from './unit-registry.service';
import type {
  UnitExecutionContext,
  UnitHookRecord,
  UnitSource,
} from '../types/unit.types';

/**
 * @title Unit Core 服务
 * @description 管理 unit hook 描述、运行时加载与 HookBus 转发。
 * @keywords-cn UnitCore, Hook管理, 热加载
 * @keywords-en unit-core, hook-management, hot-reload
 */
export class UnitCoreService {
  private readonly loader = new UnitLoaderService();
  private readonly registry: UnitRegistryService;
  private readonly hooks = new Map<string, UnitHookRecord>();
  private readonly sources = new Map<string, UnitSource>();

  constructor(
    private readonly options: {
      workspacePath: string;
      systemUnitPath: string;
      runnerDbName: string;
      mongoClient: RunnerMongoClient;
    },
  ) {
    this.registry = new UnitRegistryService(options.workspacePath, options.systemUnitPath);
  }

  /**
   * @title 初始化 Unit Core
   * @description 扫描 unit 目录并装载 hook 描述清单。
   * @keywords-cn Unit初始化, Hook扫描, 描述清单
   * @keywords-en unit-init, hook-scan, descriptor-list
   */
  async init(): Promise<void> {
    this.hooks.clear();
    this.sources.clear();
    const sources = this.registry.scanUnits();
    for (const source of sources) {
      const module = await this.loader.loadHookModule(source);
      if (!module) continue;
      this.sources.set(source.unitName, source);
      for (const hook of module.hooks) {
        this.hooks.set(hook.name, {
          unitName: source.unitName,
          hookName: hook.name,
          description: hook.description,
          keywordsCn: module.unit.keywordsCn,
          keywordsEn: module.unit.keywordsEn,
          payloadSchema: hook.payloadSchema,
          source: source.source,
        });
      }
    }
  }

  /**
   * @title 获取 Hook 列表
   * @description 返回当前已加载的 Hook 描述记录。
   * @keywords-cn Hook列表, 描述记录, UnitCore
   * @keywords-en hook-list, descriptor-records, unit-core
   */
  listHooks(): UnitHookRecord[] {
    return Array.from(this.hooks.values());
  }

  /**
   * @title 检索 Hook
   * @description 根据关键词过滤 Hook 描述。
   * @keywords-cn Hook检索, 关键词过滤, 能力查询
   * @keywords-en hook-search, keyword-filter, capability-search
   */
  searchHooks(keyword: string): UnitHookRecord[] {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return this.listHooks();
    return this.listHooks().filter((item) => {
      const base = `${item.hookName} ${item.description}`.toLowerCase();
      const cn = (item.keywordsCn ?? []).join(' ').toLowerCase();
      const en = (item.keywordsEn ?? []).join(' ').toLowerCase();
      return base.includes(needle) || cn.includes(needle) || en.includes(needle);
    });
  }

  /**
   * @title 热更新单个 Hook
   * @description 清理缓存并重新加载指定 Hook 所属 unit core。
   * @keywords-cn 热更新, Hook加载, 清理缓存
   * @keywords-en hot-reload, hook-load, cache-clear
   */
  async reloadHook(hookName: string): Promise<boolean> {
    const record = this.hooks.get(hookName);
    if (!record) return false;
    const source = this.sources.get(record.unitName);
    if (!source) return false;
    await this.loader.loadCoreModule(source, { hot: true });
    return true;
  }

  /**
   * @title Hook 执行入口
   * @description 动态加载 unit.core 并执行对应 handler。
   * @keywords-cn Hook执行, 动态加载, UnitCore
   * @keywords-en hook-execute, dynamic-load, unit-core
   */
  async executeHook<TPayload, TResult>(
    hookName: string,
    payload: TPayload,
    options?: { hot?: boolean },
  ): Promise<TResult> {
    const record = this.hooks.get(hookName);
    if (!record) {
      throw new Error(`hook not found: ${hookName}`);
    }
    const source = this.sources.get(record.unitName);
    if (!source) {
      throw new Error(`unit not found: ${record.unitName}`);
    }
    if (record.payloadSchema) {
      const parsed = record.payloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(`invalid hook payload: ${parsed.error.message}`);
      }
    }
    const module = await this.loader.loadCoreModule(source, options);
    if (!module) {
      throw new Error(`unit core not found: ${record.unitName}`);
    }
    const handler = module.handlers[hookName];
    if (!handler) {
      throw new Error(`handler not found: ${hookName}`);
    }
    const ctx: UnitExecutionContext = {
      workspacePath: this.options.workspacePath,
      runnerDbName: this.options.runnerDbName,
      invokeHook: async (name, hookPayload, hookOptions) =>
        await this.executeHook(name, hookPayload, hookOptions),
      mongo: {
        getDb: (dbName) => this.options.mongoClient.getDb(dbName),
      },
    };
    return (await handler(ctx, payload)) as TResult;
  }

  /**
   * @title 注册 HookBus 转发
   * @description 将 unit hook 描述注册到 Runner HookBus。
   * @keywords-cn HookBus注册, Hook转发, UnitCore
   * @keywords-en hookbus-register, hook-proxy, unit-core
   */
  registerToHookBus(hookBus: RunnerHookBusService): void {
    for (const hook of this.hooks.values()) {
      hookBus.register(
        hook.hookName,
        async (event) => {
          try {
            const data = await this.executeHook(hook.hookName, event.payload, { hot: true });
            return { status: 'success', data };
          } catch (error) {
            return {
              status: 'error',
              error: error instanceof Error ? error.message : 'hook failed',
            };
          }
        },
        {
          pluginName: 'unit-core',
          tags: [hook.unitName, hook.source],
          description: hook.description,
          methodRef: `unit:${hook.unitName}:${hook.hookName}`,
          payloadSchema: hook.payloadSchema,
        },
      );
    }
  }

  /**
   * @title 持久化 Hook 清单
   * @description 将当前 hook 能力写入 runner 管理库。
   * @keywords-cn Hook清单, 持久化, Runner库
   * @keywords-en hook-catalog, persistence, runner-db
   */
  async persistHooks(dbService: RunnerDbService): Promise<void> {
    const now = new Date();
    await dbService.upsertCapabilities(
      this.listHooks().map((hook) => ({
        capabilityId: `${hook.unitName}:${hook.hookName}`,
        unitName: hook.unitName,
        hookName: hook.hookName,
        description: hook.description,
        keywordsCn: hook.keywordsCn,
        keywordsEn: hook.keywordsEn,
        source: hook.source,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  /**
   * @title 获取 system-unit 路径
   * @description 计算 system-unit 在 src 或 dist 下的路径。
   * @keywords-cn system-unit路径, 目录选择, UnitCore
   * @keywords-en system-unit-path, directory-select, unit-core
   */
  static resolveSystemUnitPath(basePath: string): string {
    const srcPath = join(basePath, 'src', 'unit-core', 'system-unit');
    const distPath = join(basePath, 'dist', 'unit-core', 'system-unit');
    try {
      return require('node:fs').existsSync(srcPath) ? srcPath : distPath;
    } catch {
      return srcPath;
    }
  }
}
