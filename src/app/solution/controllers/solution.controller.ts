import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { SolutionService } from '../services/solution.service';
import {
  type CreateSolutionRequest,
  type UpdateSolutionRequest,
  type ListSolutionsQuery,
  type SearchRunnerSolutionsRequest,
  type BatchSolutionIdsRequest,
  type BatchSolutionAssociationsRequest,
  type InstallSolutionRequest,
  type UninstallSolutionRequest,
  type PurchaseSolutionRequest,
} from '../types/solution.types';

type AuthedReq = Request & { user?: { id?: string; tenantId?: string } };

/**
 * 解析 Solution 操作用户 ID; Hook 调用下取 context.principalId, 缺省 'system'。
 * @keyword-cn 解析用户ID
 * @keyword-en resolve-solution-user-id
 */
export function resolveSolutionUserId(context?: HookInvocationContext): string {
  const principalId = context?.principalId;
  return typeof principalId === 'string' && principalId.trim()
    ? principalId.trim()
    : 'system';
}

/**
 * @title Solution Controller
 * @description Solution 管理 HTTP 控制器, CRUD/列表/标签/Runner 等接口; hook 声明已迁到 SolutionHookController,
 *              此处仅保留 HTTP 路由, 与 @CheckAbility 共生。
 * @keywords-cn Solution控制器, HTTP路由, CASL鉴权
 * @keywords-en solution-controller, http-route, casl-auth
 * @keyword-en solution-controller, http-route, casl-auth
 */
@Controller('solutions')
export class SolutionController {
  constructor(private readonly solutionService: SolutionService) {}

  /**
   * @title 创建 Solution
   * @keyword-en create-solution
   */
  @Post()
  @CheckAbility('create', 'solution')
  async create(@Body() body: CreateSolutionRequest, @Req() req: AuthedReq) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.create(userId, body);
    return { success: true, data: solution };
  }

  /**
   * @title Search runner solutions
   * @description Search solutions on one or more mounted runners.
   * @keyword-en runner-solution-search, batch-runner
   * @keyword-cn Runner方案搜索, 批量Runner
   */
  @Post('runner/search')
  @CheckAbility('read', 'solution')
  async searchRunnerSolutions(@Body() body: SearchRunnerSolutionsRequest) {
    const items = await this.solutionService.searchRunnerSolutions(body);
    return { success: true, data: { items } };
  }

  /**
   * @title Get batch solution details
   * @description Get details for one or more solutions by id.
   * @keyword-en batch-solution-detail, app-unit-detail
   * @keyword-cn 批量Solution详情, 应用单元详情
   */
  @Post('details/batch')
  @CheckAbility('read', 'solution')
  async getBatchDetails(@Body() body: BatchSolutionIdsRequest) {
    const items = await this.solutionService.getDetailsByIds(body.ids);
    return { success: true, data: { items } };
  }

  /**
   * @title List solution apps
   * @description List apps associated with one or more solutions.
   * @keyword-en solution-app-list, batch-solution-association
   * @keyword-cn Solution应用列表, 批量Solution关联
   */
  @Post('apps/list')
  @CheckAbility('read', 'solution')
  async listSolutionApps(@Body() body: BatchSolutionAssociationsRequest) {
    const items = await this.solutionService.listAppsBySolutionIds(
      body.solutionIds,
    );
    return { success: true, data: { items } };
  }

  /**
   * @title List solution units
   * @description List units associated with one or more solutions.
   * @keyword-en solution-unit-list, batch-solution-association
   * @keyword-cn Solution单元列表, 批量Solution关联
   */
  @Post('units/list')
  @CheckAbility('read', 'solution')
  async listSolutionUnits(@Body() body: BatchSolutionAssociationsRequest) {
    const items = await this.solutionService.listUnitsBySolutionIds(
      body.solutionIds,
    );
    return { success: true, data: { items } };
  }

  /**
   * @title Get solution
   * @description Get one local Solution entity by id.
   * @keyword-en get-solution
   * @keyword-cn Solution详情
   */
  @Get(':id')
  @CheckAbility('read', 'solution')
  async getById(@Param('id') id: string) {
    const solution = await this.solutionService.getById(id);
    return { success: true, data: solution };
  }

  /**
   * @title 更新 Solution
   * @keyword-en update-solution
   */
  @Put(':id')
  @CheckAbility('update', 'solution')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSolutionRequest,
    @Req() req: AuthedReq,
  ) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.update(id, userId, body);
    return { success: true, data: solution };
  }

  /**
   * @title 删除 Solution
   * @keyword-en delete-solution
   */
  @Delete(':id')
  @CheckAbility('delete', 'solution')
  async delete(@Param('id') id: string) {
    await this.solutionService.delete(id);
    return { success: true };
  }

  /**
   * @title 列出 Solution (跨 Runner 聚合)
   * @description 不再选 Runner; 后端拉所有 mounted Runner 并行调度 hook, 合并真实数据。
   * @keyword-en list-solutions
   */
  @Get()
  @CheckAbility('read', 'solution')
  async list(@Query() query: ListSolutionsQuery) {
    const result = await this.solutionService.list(query);
    return { success: true, data: result };
  }

  /**
   * @title 列出解决方案市场 (占位)
   * @description 市场暂关闭, 接口保留; 前端已切到"开发中"占位卡片。
   * @keyword-en list-marketplace
   */
  @Get('marketplace/list')
  @CheckAbility('read', 'solution')
  listMarketplace(@Query() query: ListSolutionsQuery) {
    const result = this.solutionService.listMarketplace(query);
    return { success: true, data: result };
  }

  /**
   * @title 安装 Solution
   * @keyword-en install-solution
   */
  @Post(':id/install')
  @CheckAbility('install', 'solution')
  async install(
    @Param('id') id: string,
    @Body() body: InstallSolutionRequest,
    @Req() req: AuthedReq,
  ) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.install(
      id,
      body.runnerIds,
      userId,
    );
    return { success: true, data: solution };
  }

  /**
   * @title 卸载 Solution
   * @keyword-en uninstall-solution
   */
  @Delete(':id/install')
  @CheckAbility('uninstall', 'solution')
  async uninstall(
    @Param('id') id: string,
    @Body() body: UninstallSolutionRequest,
    @Req() req: AuthedReq,
  ) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.uninstall(
      id,
      body.runnerIds,
      userId,
    );
    return { success: true, data: solution };
  }

  /**
   * @title 获取购买记录 (占位)
   * @keyword-en get-purchases
   */
  @Get('purchases/list')
  @CheckAbility('read', 'solution')
  getPurchases(@Req() req: AuthedReq) {
    const userId = req.user?.id ?? 'system';
    const purchases = this.solutionService.getPurchases(userId);
    return { success: true, data: purchases };
  }

  /**
   * @title 购买 Solution
   * @keyword-en purchase-solution
   */
  @Post('purchase')
  @CheckAbility('purchase', 'solution')
  async purchase(@Body() body: PurchaseSolutionRequest, @Req() req: AuthedReq) {
    const userId = req.user?.id ?? 'system';
    const purchase = await this.solutionService.purchase(
      userId,
      body.solutionId,
      body.solutionName,
      body.solutionVersion,
    );
    return { success: true, data: purchase };
  }

  /**
   * @title 获取所有 Runner
   * @description 前端展示用 (alias / online 状态)
   * @keyword-en get-runners
   */
  @Get('runners')
  @CheckAbility('read', 'runner')
  async getRunners() {
    const runners = await this.solutionService.getRunners();
    return { success: true, data: runners };
  }

  /**
   * @title 获取所有标签
   * @description 从聚合后的 Solution 列表统计 tag 频次榜
   * @keyword-en get-tags
   */
  @Get('tags/list')
  @CheckAbility('read', 'solution')
  async getTags() {
    const tags = await this.solutionService.getTags();
    return { success: true, data: tags };
  }
}
