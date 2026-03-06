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
import { AppUnitService } from '../services/app-unit.service';
import { AppUnitEntity } from '../entities/app-unit.entity';
import { CreateAppUnitDto, QueryAppUnitDto, UpdateAppUnitDto } from '../types';

/**
 * @title 应用子单元控制器
 * @description 提供 app-unit 的查询、创建、更新与删除接口。
 * @keywords-cn app-unit控制器, 子模块, 查询, 创建, 更新, 删除
 * @keywords-en app-unit-controller, submodule, query, create, update, delete
 */
@Controller('app-unit')
export class AppUnitController {
  constructor(private readonly service: AppUnitService) {}

  @Get()
  async list(@Query() query: QueryAppUnitDto): Promise<AppUnitEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<AppUnitEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  async create(@Body() dto: CreateAppUnitDto): Promise<AppUnitEntity> {
    return await this.service.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppUnitDto,
  ): Promise<AppUnitEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}
