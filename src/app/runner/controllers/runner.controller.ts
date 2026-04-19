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

/**
 * @title Runner 控制器
 * @description 提供 Runner 的增删改查接口与密钥初始化返回。
 * @keywords-cn Runner控制器, 增删改查, 密钥返回
 * @keywords-en runner-controller, crud, key-return
 */
@Controller('runner')
export class RunnerController {
  constructor(
    private readonly service: RunnerService,
    private readonly gateway: RunnerGateway,
  ) {}

  @Get()
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

  @Get(':id')
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
