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
import {
  CreateRunnerDto,
  QueryRunnerDto,
  RunnerCreateResult,
  RunnerView,
  UpdateRunnerDto,
} from '../types/runner.types';

/**
 * @title Runner 控制器
 * @description 提供 Runner 的增删改查接口与密钥初始化返回。
 * @keywords-cn Runner控制器, 增删改查, 密钥返回
 * @keywords-en runner-controller, crud, key-return
 */
@Controller('runner')
export class RunnerController {
  constructor(private readonly service: RunnerService) {}

  @Get()
  async list(@Query() query: QueryRunnerDto): Promise<RunnerView[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<RunnerView | null> {
    return await this.service.get(id);
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
