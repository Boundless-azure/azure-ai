import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { SolutionService } from '../services/solution.service';
import {
  CreateSolutionSchema,
  UpdateSolutionSchema,
  ListSolutionsQuerySchema,
  SearchRunnerSolutionsSchema,
  BatchSolutionIdsSchema,
  BatchSolutionAssociationsSchema,
  type CreateSolutionRequest,
  type ListSolutionsQuery,
  type SearchRunnerSolutionsRequest,
  type BatchSolutionIdsRequest,
  type BatchSolutionAssociationsRequest,
} from '../types/solution.types';
import { resolveSolutionUserId } from './solution.controller';

/** 单对象 hook payload: id 平铺进对象 (id+body → { id, ...body }) */
const idField = z.object({ id: z.string() });
const installInput = z.object({ runnerIds: z.array(z.string()).min(1) });
const uninstallInput = z.object({ runnerIds: z.array(z.string()).min(1) });
const purchaseInput = z.object({
  solutionId: z.string(),
  solutionName: z.string(),
  solutionVersion: z.string(),
});

/** id+body 平铺 schema */
const UpdateSolutionHookSchema = idField.merge(UpdateSolutionSchema);
const InstallSolutionHookSchema = idField.merge(installInput);
const UninstallSolutionHookSchema = idField.merge(uninstallInput);

/**
 * @title Solution Hook Controller
 * @description solution 模块的 hook 声明层 (单对象 payload); 从 SolutionController 迁出, HTTP 与 hook 解耦。
 *   每个 hook 直接调 SolutionService, 用户从 invocationContext 解析。
 * @keywords-cn Solution Hook声明, 单对象payload
 * @keywords-en solution-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'solution', tags: ['solution'] })
export class SolutionHookController {
  constructor(private readonly solutionService: SolutionService) {}

  /**
   * 创建本地 Solution 记录。
   * @keyword-cn 创建Solution
   * @keyword-en create-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.create',
    description: 'Solution 创建',
    args: [CreateSolutionSchema],
  })
  @CheckAbility('create', 'solution')
  async create(
    payload: CreateSolutionRequest,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const userId = resolveSolutionUserId(context);
    const solution = await this.solutionService.create(userId, payload);
    return { success: true, data: solution };
  }

  /**
   * 搜索一个或多个 Runner 上的 Solution 摘要。
   * @keyword-cn Runner方案搜索, 批量Runner
   * @keyword-en runner-solution-search, batch-runner
   */
  @HookRoute({
    hook: 'saas.app.solution.searchRunner',
    description: 'Search runner solutions by runner ids',
    args: [SearchRunnerSolutionsSchema],
  })
  @CheckAbility('read', 'solution')
  async searchRunnerSolutions(
    payload: SearchRunnerSolutionsRequest,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const items = await this.solutionService.searchRunnerSolutions(payload);
    return { success: true, data: { items } };
  }

  /**
   * 批量获取 Solution 详情并包含 apps/units。
   * @keyword-cn 批量Solution详情, 应用单元详情
   * @keyword-en batch-solution-detail, app-unit-detail
   */
  @HookRoute({
    hook: 'saas.app.solution.getBatch',
    description: 'Get batch solution details with apps and units',
    args: [BatchSolutionIdsSchema],
  })
  @CheckAbility('read', 'solution')
  async getBatchDetails(
    payload: BatchSolutionIdsRequest,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const items = await this.solutionService.getDetailsByIds(payload.ids);
    return { success: true, data: { items } };
  }

  /**
   * 批量列出 Solution 关联应用。
   * @keyword-cn Solution应用列表, 批量Solution关联
   * @keyword-en solution-app-list, batch-solution-association
   */
  @HookRoute({
    hook: 'saas.app.solution.listApps',
    description: 'List apps for one or more solutions',
    args: [BatchSolutionAssociationsSchema],
  })
  @CheckAbility('read', 'solution')
  async listSolutionApps(
    payload: BatchSolutionAssociationsRequest,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const items = await this.solutionService.listAppsBySolutionIds(
      payload.solutionIds,
    );
    return { success: true, data: { items } };
  }

  /**
   * 批量列出 Solution 关联单元。
   * @keyword-cn Solution单元列表, 批量Solution关联
   * @keyword-en solution-unit-list, batch-solution-association
   */
  @HookRoute({
    hook: 'saas.app.solution.listUnits',
    description: 'List units for one or more solutions',
    args: [BatchSolutionAssociationsSchema],
  })
  @CheckAbility('read', 'solution')
  async listSolutionUnits(
    payload: BatchSolutionAssociationsRequest,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const items = await this.solutionService.listUnitsBySolutionIds(
      payload.solutionIds,
    );
    return { success: true, data: { items } };
  }

  /**
   * 获取本地 Solution 详情。
   * @keyword-cn Solution详情
   * @keyword-en get-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.get',
    description: 'Solution 详情查询',
    args: [idField],
  })
  @CheckAbility('read', 'solution')
  async getById(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const solution = await this.solutionService.getById(payload.id);
    return { success: true, data: solution };
  }

  /**
   * 更新本地 Solution 记录。
   * @keyword-cn Solution更新
   * @keyword-en update-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.update',
    description: 'Solution 更新',
    args: [UpdateSolutionHookSchema],
  })
  @CheckAbility('update', 'solution')
  async update(
    payload: z.infer<typeof UpdateSolutionHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const userId = resolveSolutionUserId(context);
    const { id, ...body } = payload;
    const solution = await this.solutionService.update(id, userId, body);
    return { success: true, data: solution };
  }

  /**
   * 软删除本地 Solution 记录。
   * @keyword-cn Solution删除
   * @keyword-en delete-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.delete',
    description: 'Solution 删除',
    args: [idField],
  })
  @CheckAbility('delete', 'solution')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    await this.solutionService.delete(payload.id);
    return { success: true };
  }

  /**
   * 跨 Runner 聚合 Solution 列表。
   * @keyword-cn Solution列表
   * @keyword-en list-solutions
   */
  @HookRoute({
    hook: 'saas.app.solution.list',
    description: 'Solution 跨 Runner 聚合列表',
    args: [ListSolutionsQuerySchema],
  })
  @CheckAbility('read', 'solution')
  async list(
    payload: ListSolutionsQuery,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const result = await this.solutionService.list(payload);
    return { success: true, data: result };
  }

  /**
   * 返回 marketplace 占位列表。
   * @keyword-cn 市场列表
   * @keyword-en list-marketplace
   */
  @HookRoute({
    hook: 'saas.app.solution.marketplaceList',
    description: 'Solution 市场列表 (开发中, 暂返回空)',
    args: [ListSolutionsQuerySchema],
  })
  @CheckAbility('read', 'solution')
  listMarketplace(
    payload: ListSolutionsQuery,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const result = this.solutionService.listMarketplace(payload);
    return { success: true, data: result };
  }

  /**
   * 记录 Solution 安装到指定 Runner。
   * @keyword-cn Solution安装
   * @keyword-en install-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.install',
    description: 'Solution 安装到指定 Runner',
    args: [InstallSolutionHookSchema],
  })
  @CheckAbility('install', 'solution')
  async install(
    payload: z.infer<typeof InstallSolutionHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const userId = resolveSolutionUserId(context);
    const { id, ...body } = payload;
    const solution = await this.solutionService.install(
      id,
      body.runnerIds,
      userId,
    );
    return { success: true, data: solution };
  }

  /**
   * 从指定 Runner 卸载 Solution。
   * @keyword-cn Solution卸载
   * @keyword-en uninstall-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.uninstall',
    description: 'Solution 从 Runner 卸载',
    args: [UninstallSolutionHookSchema],
  })
  @CheckAbility('uninstall', 'solution')
  async uninstall(
    payload: z.infer<typeof UninstallSolutionHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const userId = resolveSolutionUserId(context);
    const { id, ...body } = payload;
    const solution = await this.solutionService.uninstall(
      id,
      body.runnerIds,
      userId,
    );
    return { success: true, data: solution };
  }

  /**
   * 返回购买记录占位列表。
   * @keyword-cn 购买记录
   * @keyword-en get-purchases
   */
  @HookRoute({
    hook: 'saas.app.solution.purchasesList',
    description: '我的购买列表 (开发中, 暂返回空)',
    args: [],
  })
  @CheckAbility('read', 'solution')
  getPurchases(_principal: unknown, context?: HookInvocationContext) {
    const userId = resolveSolutionUserId(context);
    const purchases = this.solutionService.getPurchases(userId);
    return { success: true, data: purchases };
  }

  /**
   * 创建 Solution 购买记录。
   * @keyword-cn 购买Solution
   * @keyword-en purchase-solution
   */
  @HookRoute({
    hook: 'saas.app.solution.purchase',
    description: 'Solution 购买记录',
    args: [purchaseInput],
  })
  @CheckAbility('purchase', 'solution')
  async purchase(
    payload: z.infer<typeof purchaseInput>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const userId = resolveSolutionUserId(context);
    const purchase = await this.solutionService.purchase(
      userId,
      payload.solutionId,
      payload.solutionName,
      payload.solutionVersion,
    );
    return { success: true, data: purchase };
  }

  /**
   * 获取可用 Runner 列表。
   * @keyword-cn 获取Runner
   * @keyword-en get-runners
   */
  @HookRoute({
    hook: 'saas.app.solution.getRunners',
    description: '获取可用 Runner 列表',
    args: [],
  })
  @CheckAbility('read', 'runner')
  async getRunners(_principal: unknown, _context?: HookInvocationContext) {
    const runners = await this.solutionService.getRunners();
    return { success: true, data: runners };
  }

  /**
   * Solution 标签频次榜。
   * @keyword-cn 标签频次
   * @keyword-en get-tags
   */
  @HookRoute({
    hook: 'saas.app.solution.getTags',
    description: 'Solution 标签频次榜',
    args: [],
  })
  @CheckAbility('read', 'solution')
  async getTags(_principal: unknown, _context?: HookInvocationContext) {
    const tags = await this.solutionService.getTags();
    return { success: true, data: tags };
  }
}
