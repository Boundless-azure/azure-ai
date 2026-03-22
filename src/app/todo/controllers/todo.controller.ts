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
import { TodoFollowupEntity } from '../entities/todo-followup.entity';
import { TodoFollowupCommentEntity } from '../entities/todo-followup-comment.entity';
import {
  CreateTodoDto,
  QueryTodoDto,
  UpdateTodoDto,
  CreateFollowupDto,
  CreateCommentDto,
} from '../types/todo.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { CurrentPrincipal } from '@/core/auth/decorators/current-principal.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';

/**
 * @title 待办事项控制器
 * @description 提供待办的查询、创建、更新、删除以及跟进记录和评论管理接口。
 * @keywords-cn 待办控制器, 查询, 创建, 更新, 删除, 跟进, 评论
 * @keywords-en todo-controller, query, create, update, delete, followup, comment
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

  // ==================== 跟进记录接口 ====================

  @Post(':id/followups')
  @CheckAbility('create', 'todo')
  async createFollowup(
    @Param('id') id: string,
    @Body() dto: CreateFollowupDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoFollowupEntity> {
    return await this.service.createFollowup(id, dto, principal?.id ?? 'system');
  }

  @Get(':id/followups')
  @CheckAbility('read', 'todo')
  async listFollowups(@Param('id') id: string): Promise<TodoFollowupEntity[]> {
    return await this.service.listFollowups(id);
  }

  @Delete('followups/:followupId')
  @CheckAbility('delete', 'todo')
  async deleteFollowup(@Param('followupId') id: string): Promise<{ ok: boolean }> {
    await this.service.deleteFollowup(id);
    return { ok: true };
  }

  // ==================== 评论接口 ====================

  @Post('followups/:followupId/comments')
  @CheckAbility('create', 'todo')
  async createComment(
    @Param('followupId') followupId: string,
    @Body() dto: CreateCommentDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoFollowupCommentEntity> {
    return await this.service.createComment(followupId, dto, principal?.id ?? 'system');
  }

  @Get('followups/:followupId/comments')
  @CheckAbility('read', 'todo')
  async listComments(@Param('followupId') followupId: string): Promise<TodoFollowupCommentEntity[]> {
    return await this.service.listComments(followupId);
  }

  @Delete('comments/:commentId')
  @CheckAbility('delete', 'todo')
  async deleteComment(@Param('commentId') id: string): Promise<{ ok: boolean }> {
    await this.service.deleteComment(id);
    return { ok: true };
  }
}
