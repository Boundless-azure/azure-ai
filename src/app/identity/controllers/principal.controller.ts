import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { PrincipalService } from '../services/principal.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import type {
  QueryPrincipalDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
} from '../types/identity.types';

/**
 * @title Principal 控制器
 * @description 统一主体的增删改查接口。
 * @keywords-cn 主体控制器, 用户, 官方账号
 * @keywords-en principal-controller, user, official
 */
@Controller('identity/principals')
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  @Get()
  @CheckAbility('read', 'principal')
  async list(@Query() query: QueryPrincipalDto) {
    return await this.principalService.list(query);
  }

  @Post()
  @CheckAbility('create', 'principal')
  async create(@Body() dto: CreatePrincipalDto) {
    return await this.principalService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'principal')
  async update(@Param('id') id: string, @Body() dto: UpdatePrincipalDto) {
    await this.principalService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'principal')
  async delete(@Param('id') id: string) {
    await this.principalService.delete(id);
    return { success: true } as const;
  }
}
