import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { SolutionEntity } from '../entities/solution.entity';
import { SolutionPurchaseEntity } from '../entities/solution-purchase.entity';
import {
  CreateSolutionRequest,
  UpdateSolutionRequest,
  ListSolutionsQuery,
  SolutionResponse,
  PaginatedSolutionsResponse,
  TagResponse,
  SolutionPurchaseResponse,
  SearchRunnerSolutionsRequest,
  SolutionSearchItem,
  SolutionDetailResponse,
  SolutionAppListItem,
  SolutionUnitListItem,
} from '../types/solution.types';
import {
  PluginStatus,
  SolutionSource,
  SolutionInclude,
} from '../enums/solution.enums';
import { RunnerService } from '@/app/runner/services/runner.service';
import { RunnerHookRpcService } from '@/app/runner/services/runner-hook-rpc.service';
import { RunnerStatus } from '@/app/runner/enums/runner.enums';

/**
 * @title Solution Service
 * @description Solution 管理服务: CRUD 走本地表; 列表/详情通过 RunnerHookRpc 跨进程聚合
 *              所有 mounted Runner 上 runner.app.solution.list 的真实数据,
 *              不再依赖 mock。市场/购买相关接口暂保留占位 (前端"开发中")。
 * @keywords-cn Solution服务, 跨Runner聚合, hook调度, 真实数据
 * @keywords-en solution-service, cross-runner-aggregate, hook-dispatch, real-data
 * @keyword-en solution-service, cross-runner-aggregate, hook-dispatch, real-data
 */
@Injectable()
export class SolutionService {
  private readonly logger = new Logger(SolutionService.name);

  constructor(
    @InjectRepository(SolutionEntity)
    private readonly solutionRepo: Repository<SolutionEntity>,
    @InjectRepository(SolutionPurchaseEntity)
    private readonly purchaseRepo: Repository<SolutionPurchaseEntity>,
    private readonly runnerService: RunnerService,
    private readonly runnerHookRpc: RunnerHookRpcService,
  ) {}

  /**
   * @title 创建 Solution
   * @description 创建新 Solution
   * @keyword-en create-solution
   */
  async create(
    userId: string,
    data: CreateSolutionRequest,
  ): Promise<SolutionEntity> {
    const solution = this.solutionRepo.create({
      id: uuidv7(),
      runnerIds: data.runnerIds ?? null,
      tenantId: null,
      name: data.name,
      version: data.version,
      summary: data.summary ?? null,
      description: data.description ?? null,
      iconUrl: data.iconUrl ?? null,
      tags: data.tags ?? null,
      authorName: data.authorName ?? null,
      authorId: userId,
      markdownContent: data.markdownContent ?? null,
      pluginDir: data.pluginDir ?? null,
      installCount: 0,
      rating: 0,
      status: PluginStatus.ACTIVE,
      isPublished: data.isPublished ?? false,
      isInstalled: false,
      source: data.source ?? SolutionSource.SELF_DEVELOPED,
      location: data.location ?? null,
      images: data.images ?? null,
      includes: data.includes ?? null,
      createdUser: userId,
      updateUser: userId,
      channelId: userId,
    });

    return await this.solutionRepo.save(solution);
  }

  /**
   * @title 获取 Solution 详情
   * @description 根据 ID 获取 Solution 详情 (本地表)
   * @keyword-en get-solution-by-id
   */
  async getById(id: string): Promise<SolutionEntity> {
    const solution = await this.solutionRepo.findOne({
      where: { id, isDelete: false },
    });
    if (!solution) {
      throw new NotFoundException('Solution not found');
    }
    return solution;
  }

  /**
   * @title 更新 Solution
   * @description 更新 Solution 信息
   * @keyword-en update-solution
   */
  async update(
    id: string,
    userId: string,
    data: UpdateSolutionRequest,
  ): Promise<SolutionEntity> {
    const solution = await this.getById(id);

    if (data.summary !== undefined) solution.summary = data.summary;
    if (data.description !== undefined) solution.description = data.description;
    if (data.iconUrl !== undefined) solution.iconUrl = data.iconUrl;
    if (data.tags !== undefined) solution.tags = data.tags;
    if (data.markdownContent !== undefined)
      solution.markdownContent = data.markdownContent;
    if (data.status !== undefined) solution.status = data.status;
    if (data.isPublished !== undefined) solution.isPublished = data.isPublished;
    if (data.source !== undefined) solution.source = data.source;
    if (data.location !== undefined) solution.location = data.location;
    if (data.images !== undefined) solution.images = data.images;
    if (data.includes !== undefined) solution.includes = data.includes;

    solution.updateUser = userId;
    return await this.solutionRepo.save(solution);
  }

  /**
   * @title 删除 Solution
   * @description 软删除 Solution
   * @keyword-en delete-solution
   */
  async delete(id: string): Promise<void> {
    const solution = await this.getById(id);
    solution.isDelete = true;
    solution.deletedAt = new Date();
    await this.solutionRepo.save(solution);
  }

  /**
   * @title 列出 Solution (跨 Runner 聚合)
   * @description 拉取全部 mounted Runner, 并行调用 runner.app.solution.list hook,
   *              把每个 Runner 的本地结果合并去重后做内存分页/筛选。
   *              没有 runner 在线则返回空, 不再走 mock。
   * @keywords-cn 列出solution, 跨runner聚合, hook调度, 内存分页
   * @keywords-en list-solutions, cross-runner-aggregate, hook-dispatch, in-memory-pagination
   * @keyword-en list-solutions, cross-runner-aggregate, hook-dispatch, in-memory-pagination
   */
  async list(query: ListSolutionsQuery): Promise<PaginatedSolutionsResponse> {
    const { page, pageSize, tag, q, source, runnerId, runnerIds } = query;
    const aggregated = await this.aggregateFromRunners(runnerId, runnerIds);

    let filtered = aggregated;
    if (source !== undefined) {
      filtered = filtered.filter((s) => s.source === source);
    }
    if (tag) {
      filtered = filtered.filter((s) => s.tags?.includes(tag));
    }
    if (q) {
      const lowerQ = q.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQ) ||
          s.summary?.toLowerCase().includes(lowerQ) ||
          s.description?.toLowerCase().includes(lowerQ),
      );
    }

    const total = filtered.length;
    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * @title Search runner solutions
   * @description Searches mounted runners for solutions and returns id/name/summary records.
   * @keyword-en runner-solution-search, batch-runner
   * @keyword-cn Runner方案搜索, 批量Runner
   */
  async searchRunnerSolutions(
    query: SearchRunnerSolutionsRequest,
  ): Promise<SolutionSearchItem[]> {
    const runners = await this.getOnlineRunners(
      this.mergeRunnerIds(query.runnerId, query.runnerIds),
    );
    if (runners.length === 0) return [];
    const payload = {
      ...(query.q ? { q: query.q } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.include ? { include: query.include } : {}),
    };
    const hookName =
      query.q || query.source || query.include
        ? 'runner.app.solution.search'
        : 'runner.app.solution.list';
    const replies = await Promise.all(
      runners.map((runner) =>
        this.runnerHookRpc.callHook(runner.id, {
          hookName,
          payload: [payload],
        }),
      ),
    );
    return runners.flatMap((runner, index) => {
      const reply = replies[index];
      if (!reply || (reply.errorMsg ?? []).length > 0) return [];
      return this.extractSolutionItems(reply.result).map((raw) =>
        this.normalizeRunnerSolutionSearchItem(raw, runner.id),
      );
    });
  }

  /**
   * @title Get batch solution details
   * @description Resolves one or more solution ids into runner details with apps and units.
   * @keyword-en batch-solution-detail, app-unit-detail
   * @keyword-cn 批量Solution详情, 应用单元详情
   */
  async getDetailsByIds(ids: string[]): Promise<SolutionDetailResponse[]> {
    const refs = this.splitSolutionRefs(ids);
    const runners = await this.getOnlineRunners(
      refs.rawIds.length > 0 ? undefined : Array.from(refs.runnerIds),
    );
    if (runners.length === 0) return [];

    const tasks = runners.flatMap((runner) => {
      const names = Array.from(refs.namesByRunner.get(runner.id) ?? []);
      const rawTasks = refs.rawIds.map((solutionId) => ({
        runnerId: runner.id,
        payload: { solutionId },
      }));
      const nameTasks = names.map((name) => ({
        runnerId: runner.id,
        payload: { name },
      }));
      return [...rawTasks, ...nameTasks];
    });

    const replies = await Promise.all(
      tasks.map((task) =>
        this.runnerHookRpc.callHook(task.runnerId, {
          hookName: 'runner.app.solution.get',
          payload: [task.payload],
        }),
      ),
    );

    return replies.flatMap((reply, index) => {
      if (!reply || (reply.errorMsg ?? []).length > 0) return [];
      const raw = this.extractHookData(reply.result);
      if (!raw) return [];
      return [this.normalizeRunnerSolutionDetail(raw, tasks[index].runnerId)];
    });
  }

  /**
   * @title List solution apps
   * @description Lists apps associated with one or more solution ids.
   * @keyword-en solution-app-list, batch-solution-association
   * @keyword-cn Solution应用列表, 批量Solution关联
   */
  async listAppsBySolutionIds(
    solutionIds: string[],
  ): Promise<SolutionAppListItem[]> {
    return this.listAssociationsBySolutionIds(
      solutionIds,
      'runner.app.solution.listApps',
      (raw, runnerId) => this.normalizeRunnerApp(raw, runnerId),
    );
  }

  /**
   * @title List solution units
   * @description Lists units associated with one or more solution ids.
   * @keyword-en solution-unit-list, batch-solution-association
   * @keyword-cn Solution单元列表, 批量Solution关联
   */
  async listUnitsBySolutionIds(
    solutionIds: string[],
  ): Promise<SolutionUnitListItem[]> {
    return this.listAssociationsBySolutionIds(
      solutionIds,
      'runner.app.solution.listUnits',
      (raw, runnerId) => this.normalizeRunnerUnit(raw, runnerId),
    );
  }

  /**
   * @title List marketplace placeholder
   * @description Returns an empty page while marketplace is disabled.
   * @keyword-en list-marketplace-placeholder
   * @keyword-cn 市场占位
   */
  listMarketplace(query: ListSolutionsQuery): PaginatedSolutionsResponse {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 0,
    };
  }

  /**
   * @title 安装 Solution
   * @description 把市场 Solution 落到指定 Runner (当前实现仅写本地 SolutionEntity 的 runnerIds, 真正的物理安装走 Runner hook)。
   * @keyword-en install-solution
   */
  async install(
    id: string,
    runnerIds: string[],
    userId: string,
  ): Promise<SolutionEntity> {
    const solution = await this.getById(id);
    const existing = new Set(solution.runnerIds ?? []);
    for (const r of runnerIds) existing.add(r);
    solution.runnerIds = Array.from(existing);
    solution.isInstalled = solution.runnerIds.length > 0;
    solution.updateUser = userId;
    return await this.solutionRepo.save(solution);
  }

  /**
   * @title 卸载 Solution
   * @description 两种 id 形态 :: 真实 SolutionEntity.id (uuidv7) 走本地表更新 runnerIds;
   *              聚合得到的合成 id (`<runnerId>::<name>@<version>`) 走 runner.app.solution.delete hook,
   *              在每个 runnerId 对应 Runner 上物理卸载。任一 Runner 软错不打断其他 Runner 调用。
   * @keywords-cn 卸载solution, 双形态id, 跨进程派发
   * @keywords-en uninstall-solution, dual-id-shape, cross-process-dispatch
   * @keyword-en uninstall-solution, dual-id-shape, cross-process-dispatch
   */
  async uninstall(
    id: string,
    runnerIds: string[],
    userId: string,
  ): Promise<{ ok: boolean; failed: string[] }> {
    const synthetic = this.parseSyntheticId(id);
    if (synthetic) {
      const failed: string[] = [];
      await Promise.all(
        runnerIds.map(async (runnerId) => {
          const reply = await this.runnerHookRpc.callHook(runnerId, {
            hookName: 'runner.app.solution.delete',
            payload: [{ name: synthetic.name }],
          });
          if ((reply.errorMsg ?? []).length > 0) failed.push(runnerId);
        }),
      );
      return { ok: failed.length === 0, failed };
    }
    const solution = await this.getById(id);
    const removeSet = new Set(runnerIds);
    solution.runnerIds = (solution.runnerIds ?? []).filter(
      (r) => !removeSet.has(r),
    );
    solution.isInstalled = solution.runnerIds.length > 0;
    solution.updateUser = userId;
    await this.solutionRepo.save(solution);
    return { ok: true, failed: [] };
  }

  /**
   * @title 解析合成 id
   * @description 聚合得到的 id 形如 `<runnerId>::<name>@<version>`, 失败返回 null。
   * @keyword-en parse-synthetic-id
   */
  private parseSyntheticId(
    id: string,
  ): { runnerId: string; name: string; version: string } | null {
    const sep = id.indexOf('::');
    if (sep < 0) return null;
    const runnerId = id.slice(0, sep);
    const rest = id.slice(sep + 2);
    const at = rest.lastIndexOf('@');
    if (at < 0) return null;
    return {
      runnerId,
      name: rest.slice(0, at),
      version: rest.slice(at + 1),
    };
  }

  /**
   * @title 获取所有标签
   * @description 从聚合后的 Solution 列表中统计 tag 频次榜
   * @keyword-en get-tags
   */
  async getTags(): Promise<TagResponse[]> {
    const aggregated = await this.aggregateFromRunners();
    const counter = new Map<string, number>();
    for (const item of aggregated) {
      for (const t of item.tags ?? []) {
        counter.set(t, (counter.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * @title 获取所有 Runner
   * @description 返回当前用户可见的 Runner 列表 (alias / status), 服务前端展示。
   * @keyword-en get-runners
   */
  async getRunners(): Promise<{ id: string; alias: string; status: string }[]> {
    const list = await this.runnerService.list({});
    return list.map((r) => ({
      id: r.id,
      alias: r.alias,
      status: r.status === RunnerStatus.Mounted ? 'online' : 'offline',
    }));
  }

  /**
   * @title 获取购买记录 (占位)
   * @description "我的购买"功能"开发中", 返回空数组。
   * @keyword-en get-purchases-placeholder
   */
  getPurchases(_userId: string): SolutionPurchaseResponse[] {
    return [];
  }

  /**
   * @title 购买 Solution
   * @description 落购买记录 (前端入口暂关闭, 仅留 API)。
   * @keyword-en purchase-solution
   */
  async purchase(
    userId: string,
    solutionId: string,
    solutionName: string,
    solutionVersion: string,
  ): Promise<SolutionPurchaseEntity> {
    const purchase = this.purchaseRepo.create({
      id: uuidv7(),
      userId,
      solutionId,
      solutionName,
      solutionVersion,
      runnerId: null,
      source: SolutionSource.MARKETPLACE,
      purchasedAt: new Date(),
      createdUser: userId,
      updateUser: userId,
      channelId: userId,
    });

    return await this.purchaseRepo.save(purchase);
  }

  /**
   * @title List association records by solution ids
   * @description Calls a runner association hook in batch and normalizes each returned item.
   * @keyword-en batch-association-hook, runner-solution-association
   * @keyword-cn 批量关联Hook, Runner方案关联
   */
  private async listAssociationsBySolutionIds<T>(
    solutionIds: string[],
    hookName: 'runner.app.solution.listApps' | 'runner.app.solution.listUnits',
    normalize: (raw: Record<string, unknown>, runnerId: string) => T,
  ): Promise<T[]> {
    const refs = this.splitSolutionRefs(solutionIds);
    const runners = await this.getOnlineRunners(
      refs.rawIds.length > 0 ? undefined : Array.from(refs.runnerIds),
    );
    if (runners.length === 0) return [];
    const tasks = runners
      .map((runner) => {
        const payload = this.buildAssociationPayload(refs, runner.id);
        if (!payload) return null;
        return { runnerId: runner.id, payload };
      })
      .filter(
        (
          task,
        ): task is { runnerId: string; payload: Record<string, string[]> } =>
          task !== null,
      );

    const replies = await Promise.all(
      tasks.map((task) =>
        this.runnerHookRpc.callHook(task.runnerId, {
          hookName,
          payload: [task.payload],
        }),
      ),
    );

    return replies.flatMap((reply, index) => {
      if (!reply || (reply.errorMsg ?? []).length > 0) return [];
      return this.extractSolutionItems(reply.result).map((raw) =>
        normalize(raw, tasks[index].runnerId),
      );
    });
  }

  /**
   * @title Get online runners
   * @description Filters mounted runners, optionally constrained by runner ids.
   * @keyword-en online-runner-filter, batch-runner
   * @keyword-cn 在线Runner过滤, 批量Runner
   */
  private async getOnlineRunners(
    runnerIds?: string[],
  ): Promise<Array<{ id: string; alias: string; status: RunnerStatus }>> {
    const allowed = new Set((runnerIds ?? []).filter(Boolean));
    const allRunners = await this.runnerService.list({});
    return allRunners.filter(
      (runner) =>
        runner.status === RunnerStatus.Mounted &&
        (allowed.size === 0 || allowed.has(runner.id)),
    );
  }

  /**
   * @title Merge runner ids
   * @description Merges singular and plural runner id inputs into a unique list.
   * @keyword-en merge-runner-ids, batch-runner
   * @keyword-cn 合并Runner标识, 批量Runner
   */
  private mergeRunnerIds(
    runnerId?: string,
    runnerIds?: string[],
  ): string[] | undefined {
    const merged = Array.from(
      new Set([...(runnerId ? [runnerId] : []), ...(runnerIds ?? [])]),
    ).filter(Boolean);
    return merged.length > 0 ? merged : undefined;
  }

  /**
   * @title Split solution refs
   * @description Separates raw solution ids from synthetic runner/name ids.
   * @keyword-en split-solution-refs, synthetic-solution-id
   * @keyword-cn 拆分Solution引用, 合成Solution标识
   */
  private splitSolutionRefs(ids: string[]): {
    rawIds: string[];
    runnerIds: Set<string>;
    namesByRunner: Map<string, Set<string>>;
  } {
    const rawIds: string[] = [];
    const runnerIds = new Set<string>();
    const namesByRunner = new Map<string, Set<string>>();
    for (const id of ids) {
      const synthetic = this.parseSyntheticId(id);
      if (!synthetic) {
        rawIds.push(id);
        continue;
      }
      runnerIds.add(synthetic.runnerId);
      const names = namesByRunner.get(synthetic.runnerId) ?? new Set<string>();
      names.add(synthetic.name);
      namesByRunner.set(synthetic.runnerId, names);
    }
    return { rawIds: Array.from(new Set(rawIds)), runnerIds, namesByRunner };
  }

  /**
   * @title Build association payload
   * @description Builds one runner payload from raw ids and synthetic names.
   * @keyword-en association-payload, solution-id-list
   * @keyword-cn 关联Payload, Solution标识列表
   */
  private buildAssociationPayload(
    refs: {
      rawIds: string[];
      namesByRunner: Map<string, Set<string>>;
    },
    runnerId: string,
  ): Record<string, string[]> | null {
    const names = Array.from(refs.namesByRunner.get(runnerId) ?? []);
    if (refs.rawIds.length === 0 && names.length === 0) return null;
    return {
      ...(refs.rawIds.length > 0 ? { solutionIds: refs.rawIds } : {}),
      ...(names.length > 0 ? { names } : {}),
    };
  }

  /**
   * @title Aggregate from runners
   * @description Calls runner.app.solution.list across mounted runners and merges same-name results.
   * @keyword-en cross-runner-aggregate, batch-runner
   * @keyword-cn 跨Runner聚合, 批量Runner
   */
  private async aggregateFromRunners(
    runnerId?: string,
    runnerIds?: string[],
  ): Promise<SolutionResponse[]> {
    const onlineRunners = await this.getOnlineRunners(
      this.mergeRunnerIds(runnerId, runnerIds),
    );
    if (onlineRunners.length === 0) {
      // ① 空的最常见原因: 没有 DB status=mounted 的 runner (getOnlineRunners 只认 DB 状态, 不做 socket 二次核验)
      const all = await this.runnerService.list({});
      this.logger.warn(
        `[solution.list] 无在线(mounted) runner → 返回空. ` +
          `DB 共 ${all.length} 台: ${
            all
              .map((r) => `${r.alias ?? r.id}=${r.status}`)
              .join(', ') || '(无 runner)'
          }`,
      );
      return [];
    }

    const replies = await Promise.all(
      onlineRunners.map((r) =>
        this.runnerHookRpc.callHook(r.id, {
          hookName: 'runner.app.solution.list',
          payload: [{}],
        }),
      ),
    );

    const merged = new Map<string, SolutionResponse>();
    onlineRunners.forEach((runner, idx) => {
      const reply = replies[idx];
      // ②/③ 逐台暴露: 报错被吞 / 该 runner 无 solution, 都在这里打出真因
      if (!reply || (reply.errorMsg ?? []).length > 0) {
        this.logger.warn(
          `[solution.list] runner ${runner.alias ?? runner.id} 调 runner.app.solution.list 失败, 跳过 → ` +
            `errorMsg=${JSON.stringify(reply?.errorMsg ?? ['no-reply'])}`,
        );
        return;
      }
      const items = this.extractSolutionItems(reply.result);
      if (items.length === 0) {
        // 0 时把 runner 回包原样打出: 区分「runner 真返 0」vs「回包形状对不上 extractHookData 被误判 0」
        this.logger.warn(
          `[solution.list] runner ${runner.alias ?? runner.id} extract 出 0 个; ` +
            `RAW reply.result=${JSON.stringify(reply.result)?.slice(0, 800)}`,
        );
      }
      this.logger.log(
        `[solution.list] runner ${runner.alias ?? runner.id} 返回 ${items.length} 个 solution`,
      );
      for (const raw of items) {
        const normalized = this.normalizeRunnerSolution(raw, runner.id);
        const key = `${normalized.name}@${normalized.version}`;
        const existing = merged.get(key);
        if (existing) {
          const runnerIdSet = new Set([
            ...existing.runnerIds,
            ...normalized.runnerIds,
          ]);
          existing.runnerIds = Array.from(runnerIdSet);
        } else {
          merged.set(key, normalized);
        }
      }
    });

    return Array.from(merged.values());
  }

  /**
   * @title 提取 hook reply 中的 solution 列表
   * @description Runner hook 返回 `{ items: [...] }`, 但被 RunnerHookRpc 包成 `result: HookResult[]`,
   *              需要先取 [0].data.items。任何异常形状都软返空数组。
   * @keyword-en extract-solution-items
   */
  private extractSolutionItems(
    rawResult: unknown,
  ): Array<Record<string, unknown>> {
    const data = this.extractHookData(rawResult);
    const items = data?.items;
    if (!Array.isArray(items)) return [];
    return items as Array<Record<string, unknown>>;
  }

  /**
   * @title Extract hook data
   * @description 从 RunnerHookRpc reply 取第一个 handler 的 data 对象。
   *   RunnerHookRpc.adaptResults 已把每个 HookResult.data 摊平进 reply.result 数组
   *   (reply.result = [data, ...]), 所以 result[0] 本身即 data 对象, 不再有 .data 包一层。
   *   兼容旧式 [{status,data}] 包装: 若 result[0] 同时带 status+data 才回退取 .data。
   * @keyword-en extract-hook-data, runner-hook-reply
   * @keyword-cn 提取Hook数据, RunnerHook响应
   */
  private extractHookData(rawResult: unknown): Record<string, unknown> | null {
    if (!Array.isArray(rawResult)) return null;
    const first = rawResult[0];
    if (!first || typeof first !== 'object') return null;
    const rec = first as Record<string, unknown>;
    // 旧式 HookResult 包装 { status, data }: 仅当两者都在才回退, 避免误伤本身含 data 字段的业务对象
    if (rec.status !== undefined && rec.data !== undefined && typeof rec.data === 'object') {
      return rec.data as Record<string, unknown>;
    }
    return rec;
  }

  /**
   * @title 把 Runner 端 SolutionInfo 标准化成 SaaS 端 SolutionResponse 形状
   * @description Runner 侧 SolutionInfo 字段较少, 这里补齐 SaaS 列表展示需要的扩展字段
   *              (id / runnerIds / 默认评分 / 安装次数等)。
   * @keyword-en normalize-runner-solution
   */
  private normalizeRunnerSolution(
    raw: Record<string, unknown>,
    runnerId: string,
  ): SolutionResponse {
    const name = typeof raw.name === 'string' ? raw.name : 'unknown';
    const version = typeof raw.version === 'string' ? raw.version : '0.0.0';
    const sourceVal =
      raw.source === 'marketplace'
        ? SolutionSource.MARKETPLACE
        : SolutionSource.SELF_DEVELOPED;
    const includes = Array.isArray(raw.includes)
      ? (raw.includes.filter((v) =>
          ['app', 'unit', 'workflow', 'agent', 'view'].includes(String(v)),
        ) as SolutionInclude[])
      : [];
    const installedAt =
      typeof raw.installedAt === 'string'
        ? new Date(raw.installedAt)
        : new Date();
    return {
      id: `${runnerId}::${name}@${version}`,
      runnerIds: [runnerId],
      tenantId: null,
      name,
      version,
      summary: typeof raw.summary === 'string' ? raw.summary : null,
      description: typeof raw.description === 'string' ? raw.description : null,
      iconUrl: null,
      tags: null,
      authorName: null,
      authorId: null,
      markdownContent: null,
      pluginDir: null,
      installCount: 0,
      rating: 0,
      status: PluginStatus.ACTIVE,
      isPublished: false,
      isInstalled: true,
      isInitialized: Boolean(raw.isInitialized),
      source: sourceVal,
      location: typeof raw.location === 'string' ? raw.location : null,
      images: Array.isArray(raw.images)
        ? raw.images.filter((v): v is string => typeof v === 'string')
        : null,
      includes,
      createdAt: installedAt,
      updatedAt: installedAt,
    };
  }

  /**
   * @title Normalize runner solution search item
   * @description Converts runner solution metadata into the SaaS search item shape.
   * @keyword-en normalize-solution-search, runner-solution-search
   * @keyword-cn Solution搜索标准化, Runner方案搜索
   */
  private normalizeRunnerSolutionSearchItem(
    raw: Record<string, unknown>,
    runnerId: string,
  ): SolutionSearchItem {
    const base = this.normalizeRunnerSolution(raw, runnerId);
    return {
      id: base.id,
      runnerId,
      solutionId: this.readString(raw, 'solutionId') ?? base.id,
      name: base.name,
      version: base.version,
      summary: base.summary,
    };
  }

  /**
   * @title Normalize runner solution detail
   * @description Converts runner detail metadata into the SaaS detail response shape.
   * @keyword-en normalize-solution-detail, app-unit-detail
   * @keyword-cn Solution详情标准化, 应用单元详情
   */
  private normalizeRunnerSolutionDetail(
    raw: Record<string, unknown>,
    runnerId: string,
  ): SolutionDetailResponse {
    const base = this.normalizeRunnerSolution(raw, runnerId);
    const solutionId = this.readString(raw, 'solutionId') ?? base.id;
    const apps = Array.isArray(raw.apps)
      ? raw.apps
          .filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === 'object'),
          )
          .map((item) =>
            this.normalizeRunnerApp(item, runnerId, solutionId, base.name),
          )
      : [];
    const units = Array.isArray(raw.units)
      ? raw.units
          .filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === 'object'),
          )
          .map((item) =>
            this.normalizeRunnerUnit(item, runnerId, solutionId, base.name),
          )
      : [];
    return { ...base, runnerId, solutionId, apps, units };
  }

  /**
   * @title Normalize runner app
   * @description Converts runner app association payload into a SaaS app list item.
   * @keyword-en normalize-solution-app, app-association
   * @keyword-cn Solution应用标准化, 应用关联
   */
  private normalizeRunnerApp(
    raw: Record<string, unknown>,
    runnerId: string,
    fallbackSolutionId?: string,
    fallbackSolutionName?: string,
  ): SolutionAppListItem {
    const solutionId =
      this.readString(raw, 'solutionId') ?? fallbackSolutionId ?? '';
    const solutionName =
      this.readString(raw, 'solutionName') ?? fallbackSolutionName ?? '';
    const appId =
      this.readString(raw, 'appId') ??
      `${solutionId}::${this.readString(raw, 'name') ?? 'app'}`;
    return {
      id: `${runnerId}::${solutionId}::app::${appId}`,
      runnerId,
      solutionId,
      solutionName,
      appId,
      name: this.readString(raw, 'name') ?? 'unknown',
      version: this.readString(raw, 'version') ?? '0.0.0',
      description: this.readString(raw, 'description') ?? '',
      status: this.readString(raw, 'status') ?? 'unknown',
      isInitialized: Boolean(raw.isInitialized),
      ...(this.readString(raw, 'location')
        ? { location: this.readString(raw, 'location') }
        : {}),
    };
  }

  /**
   * @title Normalize runner unit
   * @description Converts runner unit association payload into a SaaS unit list item.
   * @keyword-en normalize-solution-unit, unit-association
   * @keyword-cn Solution单元标准化, 单元关联
   */
  private normalizeRunnerUnit(
    raw: Record<string, unknown>,
    runnerId: string,
    fallbackSolutionId?: string,
    fallbackSolutionName?: string,
  ): SolutionUnitListItem {
    const solutionId =
      this.readString(raw, 'solutionId') ?? fallbackSolutionId ?? '';
    const solutionName =
      this.readString(raw, 'solutionName') ?? fallbackSolutionName ?? '';
    const unitId =
      this.readString(raw, 'unitId') ??
      `${solutionId}::${this.readString(raw, 'unitName') ?? 'unit'}`;
    return {
      id: `${runnerId}::${solutionId}::unit::${unitId}`,
      runnerId,
      solutionId,
      solutionName,
      unitId,
      unitName: this.readString(raw, 'unitName') ?? 'unknown',
      source: this.readString(raw, 'source') ?? 'unknown',
      sourcePath: this.readString(raw, 'sourcePath') ?? '',
    };
  }

  /**
   * @title Read string field
   * @description Safely reads a string property from an unknown record.
   * @keyword-en read-string-field, payload-normalize
   * @keyword-cn 读取字符串字段, Payload标准化
   */
  private readString(
    raw: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = raw[key];
    return typeof value === 'string' ? value : undefined;
  }
}
