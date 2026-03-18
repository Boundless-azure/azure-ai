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
import { TodoService } from '../services/todo.service';
import { TodoEntity } from '../entities/todo.entity';
import {
  CreateTodoDto,
  QueryTodoDto,
  UpdateTodoDto,
} from '../types/todo.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { CurrentPrincipal } from '@/core/auth/decorators/current-principal.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';

/**
 * @title 待办事项控制器
 * @description 提供待办的查询、创建、更新与删除接口。
 * @keywords-cn 待办控制器, 查询, 创建, 更新, 删除
 * @keywords-en todo-controller, query, create, update, delete
 */
@Controller('todo')
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Get()
  @CheckAbility('read', 'todo')
  @HookLifecycle({
    hook: 'onTodoList',
    description: '待办列表查询',
    payloadDto: QueryTodoDto,
    payloadSource: 'query',
  })
  async list(
    @Query() query: QueryTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity[]> {
    return await this.service.list(query, principal);
  }

  @Get(':id')
  @CheckAbility('read', 'todo')
  @HookLifecycle({
    hook: 'onTodoGet',
    description: '待办详情查询',
    payloadSource: 'params',
  })
  async get(@Param('id') id: string): Promise<TodoEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  @CheckAbility('create', 'todo')
  @HookLifecycle({
    hook: 'onTodoCreate',
    description: '待办创建',
    payloadDto: CreateTodoDto,
    payloadSource: 'body',
  })
  async create(
    @Body() dto: CreateTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity> {
    return await this.service.create(dto, principal);
  }

  @Put(':id')
  @CheckAbility('update', 'todo')
  @HookLifecycle({
    hook: 'onTodoUpdate',
    description: '待办更新',
    payloadDto: UpdateTodoDto,
    payloadSource: 'body',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity> {
    return await this.service.update(id, dto, principal);
  }

  @Delete(':id')
  @CheckAbility('delete', 'todo')
  @HookLifecycle({
    hook: 'onTodoDelete',
    description: '待办删除',
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}
