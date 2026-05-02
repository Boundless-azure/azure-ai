import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
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
 */
@Injectable()
export class SolutionService {
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
   */
  async list(query: ListSolutionsQuery): Promise<PaginatedSolutionsResponse> {
    const { page, pageSize, tag, q, source, runnerId } = query;
    const aggregated = await this.aggregateFromRunners(runnerId);

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
   * @title 列出市场 Solution (占位)
   * @description 市场功能"开发中", 直接返回空分页, 不再访问 mock。
   *              前端 marketplace tab 已切到占位卡片, 此处保留是为了 API 兼容性。
   * @keyword-en list-marketplace-placeholder
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
            payload: { name: synthetic.name },
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
   * @title 跨 Runner 聚合 Solution
   * @description 拿全部 mounted Runner, 并行 callHook(runner.app.solution.list),
   *              错误/离线 Runner 软跳过, 命中即合并。同名 Solution 以最新 version 为准, 累加 runnerIds。
   *              runnerId 过滤可仅查单台。
   * @keywords-cn 跨runner聚合, 并行调度, 软错跳过, 同名合并
   * @keywords-en cross-runner-aggregate, parallel-dispatch, soft-skip, name-merge
   */
  private async aggregateFromRunners(
    runnerId?: string,
  ): Promise<SolutionResponse[]> {
    const allRunners = await this.runnerService.list({});
    const onlineRunners = allRunners.filter(
      (r) => r.status === RunnerStatus.Mounted && (!runnerId || r.id === runnerId),
    );
    if (onlineRunners.length === 0) return [];

    const replies = await Promise.all(
      onlineRunners.map((r) =>
        this.runnerHookRpc.callHook(r.id, {
          hookName: 'runner.app.solution.list',
          payload: {},
        }),
      ),
    );

    const merged = new Map<string, SolutionResponse>();
    onlineRunners.forEach((runner, idx) => {
      const reply = replies[idx];
      if (!reply || (reply.errorMsg ?? []).length > 0) return;
      const items = this.extractSolutionItems(reply.result);
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
  private extractSolutionItems(rawResult: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(rawResult)) return [];
    const first = rawResult[0] as { data?: { items?: unknown } } | undefined;
    const items = first?.data?.items;
    if (!Array.isArray(items)) return [];
    return items as Array<Record<string, unknown>>;
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
    const name = String(raw.name ?? 'unknown');
    const version = String(raw.version ?? '0.0.0');
    const sourceVal = raw.source === 'marketplace'
      ? SolutionSource.MARKETPLACE
      : SolutionSource.SELF_DEVELOPED;
    const includes = Array.isArray(raw.includes)
      ? (raw.includes.filter((v) =>
          ['app', 'unit', 'workflow', 'agent'].includes(String(v)),
        ) as SolutionInclude[])
      : [];
    const installedAt = typeof raw.installedAt === 'string'
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
}
