import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RunnerService } from '../services/runner.service';
import { RunnerGateway } from './runner.gateway';
import {
  CreateRunnerDto,
  QueryRunnerDto,
  RunnerCreateResult,
  RunnerView,
  UpdateRunnerDto,
} from '../types/runner.types';
import { RunnerStatus } from '../enums/runner.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';

/**
 * @title Runner 控制器
 * @description 提供 Runner 的增删改查接口与密钥初始化返回 (纯 HTTP; hook 声明见 runner.hook-controller.ts)。
 * @keywords-cn Runner控制器, 增删改查, 密钥返回
 * @keywords-en runner-controller, crud, key-return
 */
@Controller('runner')
export class RunnerController {
  constructor(
    private readonly service: RunnerService,
    private readonly gateway: RunnerGateway,
  ) {}

  /**
   * Hook: saas.app.runner.list
   * 列出当前 SaaS 已知的全部 runner; LLM 在用 search_hook/get_hook_tag/get_hook_info/call_hook 走 target=runner
   * 之前必须先调本 hook 拿到真实 runnerId, 否则 runnerId 无从知晓。
   * 返回的 status 字段:
   *   - mounted = 在线注册 (有 socket 连接, 可立即派发 hook 调用)
   *   - offline = 注册过但当前断开
   * @keyword-en list-runners, runner-discovery-for-llm
   */
  @Get()
  @CheckAbility('read', 'runner')
  async list(@Query() query: QueryRunnerDto): Promise<RunnerView[]> {
    const runners = await this.service.list(query);
    // 数据库状态为 Mounted 时，通过 gateway 二次确认离线则更新数据库
    for (const runner of runners) {
      if (runner.status === RunnerStatus.Mounted) {
        if (!this.gateway.isRunnerOnline(runner.id)) {
          await this.service.markStatus(runner.id, RunnerStatus.Offline);
          runner.status = RunnerStatus.Offline;
        }
      }
    }
    return runners;
  }

  /**
   * Hook: saas.app.runner.get
   * 取单个 runner 详情; 用于核对某个 runnerId 是否合法且在线。
   * @keyword-en get-runner
   */
  @Get(':id')
  @CheckAbility('read', 'runner')
  async get(@Param('id') id: string): Promise<RunnerView | null> {
    const runner = await this.service.get(id);
    if (!runner) return null;
    // 数据库状态为 Mounted 时，通过 gateway 二次确认离线则更新数据库
    if (runner.status === RunnerStatus.Mounted) {
      if (!this.gateway.isRunnerOnline(id)) {
        await this.service.markStatus(id, RunnerStatus.Offline);
        runner.status = RunnerStatus.Offline;
      }
    }
    return runner;
  }

  @Post()
  async create(@Body() dto: CreateRunnerDto): Promise<RunnerCreateResult> {
    return await this.service.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRunnerDto,
  ): Promise<RunnerView> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}
