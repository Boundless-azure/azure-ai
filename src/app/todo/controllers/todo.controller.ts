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
  async list(@Query() query: QueryTodoDto): Promise<TodoEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'todo')
  async get(@Param('id') id: string): Promise<TodoEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  @CheckAbility('create', 'todo')
  async create(@Body() dto: CreateTodoDto): Promise<TodoEntity> {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'todo')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
  ): Promise<TodoEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'todo')
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}
