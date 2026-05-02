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
import { z } from 'zod';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import { SolutionService } from '../services/solution.service';
import {
  CreateSolutionSchema,
  UpdateSolutionSchema,
  ListSolutionsQuerySchema,
  CreateSolutionRequest,
  UpdateSolutionRequest,
  ListSolutionsQuery,
  InstallSolutionRequest,
  UninstallSolutionRequest,
  PurchaseSolutionRequest,
} from '../types/solution.types';

type AuthedReq = Request & { user?: { id?: string; tenantId?: string } };

const idParamInput = z.object({ id: z.string() });

const installInput = z.object({ runnerIds: z.array(z.string()).min(1) });
const uninstallInput = z.object({ runnerIds: z.array(z.string()).min(1) });
const purchaseInput = z.object({
  solutionId: z.string(),
  solutionName: z.string(),
  solutionVersion: z.string(),
});
const emptyInput = z.object({}).passthrough();

/**
 * @title Solution Controller
 * @description Solution 管理控制器, CRUD/列表/标签/Runner 等接口全部挂 @HookLifecycle,
 *              与 @CheckAbility 共生; HookLifecycleRegistrationService 自动把 ability 镜像进 hook 元数据,
 *              供 LLM 链路兜底鉴权。
 * @keywords-cn Solution控制器, Hook声明, CASL鉴权
 * @keywords-en solution-controller, hook-lifecycle, casl-auth
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
  @HookLifecycle({
    hook: 'saas.app.solution.create',
    description: 'Solution 创建',
    payloadSchema: CreateSolutionSchema,
    payloadSource: 'body',
  })
  async create(@Body() body: CreateSolutionRequest, @Req() req: AuthedReq) {
    const userId = req.user?.id ?? 'system';
    const solution = await this.solutionService.create(userId, body);
    return { success: true, data: solution };
  }

  /**
   * @title 获取 Solution 详情
   * @keyword-en get-solution
   */
  @Get(':id')
  @CheckAbility('read', 'solution')
  @HookLifecycle({
    hook: 'saas.app.solution.get',
    description: 'Solution 详情查询',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.update',
    description: 'Solution 更新',
    payloadSchema: UpdateSolutionSchema,
    payloadSource: 'body',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.delete',
    description: 'Solution 删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.list',
    description: 'Solution 跨 Runner 聚合列表',
    payloadSchema: ListSolutionsQuerySchema,
    payloadSource: 'query',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.marketplaceList',
    description: 'Solution 市场列表 (开发中, 暂返回空)',
    payloadSchema: ListSolutionsQuerySchema,
    payloadSource: 'query',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.install',
    description: 'Solution 安装到指定 Runner',
    payloadSchema: installInput,
    payloadSource: 'body',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.uninstall',
    description: 'Solution 从 Runner 卸载',
    payloadSchema: uninstallInput,
    payloadSource: 'body',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.purchasesList',
    description: '我的购买列表 (开发中, 暂返回空)',
    payloadSchema: emptyInput,
    payloadSource: 'query',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.purchase',
    description: 'Solution 购买记录',
    payloadSchema: purchaseInput,
    payloadSource: 'body',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.getRunners',
    description: '获取可用 Runner 列表',
    payloadSchema: emptyInput,
    payloadSource: 'query',
  })
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
  @HookLifecycle({
    hook: 'saas.app.solution.getTags',
    description: 'Solution 标签频次榜',
    payloadSchema: emptyInput,
    payloadSource: 'query',
  })
  async getTags() {
    const tags = await this.solutionService.getTags();
    return { success: true, data: tags };
  }
}
