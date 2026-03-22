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
import { SolutionService } from '../services/solution.service';
import type {
  CreateSolutionRequest,
  UpdateSolutionRequest,
  ListSolutionsQuery,
  InstallSolutionRequest,
  UninstallSolutionRequest,
  PurchaseSolutionRequest,
} from '../types/solution.types';

type AuthedReq = Request & { user?: { id?: string; tenantId?: string } };

/**
 * @title Solution Controller
 * @description Solution 管理控制器，提供 Solution CRUD、市场和分页 API
 * @keywords-cn Solution控制器, Solution管理, Solution市场, 分页
 * @keywords-en solution-controller, solution-management, solution-marketplace, pagination
 */
@Controller('solutions')
export class SolutionController {
  constructor(private readonly solutionService: SolutionService) {}

  /**
   * @title 创建 Solution
   * @description 创建新 Solution
   */
  @Post()
  @CheckAbility('create', 'solution')
  async create(@Body() body: CreateSolutionRequest, @Req() req: AuthedReq) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.create(userId, body);
    return { success: true, data: solution };
  }

  /**
   * @title 获取 Solution 详情
   * @description 根据 ID 获取 Solution 详情
   */
  @Get(':id')
  @CheckAbility('read', 'solution')
  async getById(@Param('id') id: string) {
    const solution = await this.solutionService.getById(id);
    return { success: true, data: solution };
  }

  /**
   * @title 更新 Solution
   * @description 更新 Solution 信息
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
   * @description 软删除 Solution
   */
  @Delete(':id')
  @CheckAbility('delete', 'solution')
  async delete(@Param('id') id: string) {
    await this.solutionService.delete(id);
    return { success: true };
  }

  /**
   * @title 列出我的 Solutions
   * @description 分页查询当前租户的 Solution 列表
   */
  @Get()
  @CheckAbility('read', 'solution')
  async list(@Query() query: ListSolutionsQuery, @Req() req: AuthedReq) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? null;
    const result = await this.solutionService.list({
      ...query,
      isInstalled: query.isInstalled ?? (tenantId ? true : undefined),
    });
    return { success: true, data: result };
  }

  /**
   * @title 列出解决方案市场
   * @description 分页查询已发布的 Solution 列表
   */
  @Get('marketplace/list')
  async listMarketplace(@Query() query: ListSolutionsQuery) {
    const result = await this.solutionService.listMarketplace(query);
    return { success: true, data: result };
  }

  /**
   * @title 安装 Solution
   * @description 将市场 Solution 安装到指定 Runner 列表
   */
  @Post(':id/install')
  @CheckAbility('install', 'solution')
  async install(
    @Param('id') id: string,
    @Body() body: InstallSolutionRequest,
    @Req() req: AuthedReq,
  ) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.install(id, body.runnerIds, userId);
    return { success: true, data: solution };
  }

  /**
   * @title 卸载 Solution
   * @description 从指定 Runner 列表卸载 Solution
   */
  @Delete(':id/install')
  @CheckAbility('uninstall', 'solution')
  async uninstall(
    @Param('id') id: string,
    @Body() body: UninstallSolutionRequest,
    @Req() req: AuthedReq,
  ) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.uninstall(id, body.runnerIds, userId);
    return { success: true, data: solution };
  }

  /**
   * @title 获取购买记录
   * @description 获取当前用户的购买记录
   */
  @Get('purchases/list')
  async getPurchases(@Req() req: AuthedReq) {
    const userId = req.user?.id ?? 'system';
    const purchases = await this.solutionService.getPurchases(userId);
    return { success: true, data: purchases };
  }

  /**
   * @title 购买 Solution
   * @description 记录用户购买 Solution
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
   * @description 获取所有可用的 Runner 列表
   */
  @Get('runners')
  async getRunners() {
    const runners = await this.solutionService.getRunners();
    return { success: true, data: runners };
  }

  /**
   * @title 获取所有标签
   * @description 获取所有已发布 Solution 的标签及数量
   */
  @Get('tags/list')
  async getTags() {
    const tags = await this.solutionService.getTags();
    return { success: true, data: tags };
  }
}
