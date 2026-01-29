import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { PrincipalService } from '../services/principal.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import type {
  CreateUserDto,
  UpdateUserDto,
  QueryUsersDto,
} from '../types/identity.types';

/**
 * @title Users 控制器
 * @description 仅返回用户主体（企业/消费者）的列表接口。
 * @keywords-cn 用户列表, 企业用户, 消费者
 * @keywords-en users-controller, enterprise-user, consumer
 */
@Controller('identity/users')
export class UsersController {
  constructor(private readonly principalService: PrincipalService) {}

  @Get()
  @CheckAbility('read', 'principal')
  async list(@Query() query: QueryUsersDto) {
    return await this.principalService.listUsers(query);
  }

  @Post()
  @CheckAbility('create', 'principal')
  async create(@Body() dto: CreateUserDto) {
    return await this.principalService.createUser(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'principal')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    await this.principalService.updateUser(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'principal')
  async delete(@Param('id') id: string) {
    await this.principalService.deleteUser(id);
    return { success: true } as const;
  }
}
