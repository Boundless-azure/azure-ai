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
  UpdateFollowupDto,
} from '../types/todo.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { CurrentPrincipal } from '@/core/auth/decorators/current-principal.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';

/**
 * 从 Hook 调用上下文解析 principal (JwtPayload 形状); Hook 链路下 principalId / principalType
 * 由 HookAuthMiddleware 校验后回填。无 principalId 时返回 undefined (交由 service 层兜底)。
 * @keyword-cn 解析待办主体, Hook上下文
 * @keyword-en resolve-todo-principal, hook-context
 */
export function resolveTodoPrincipal(
  context?: HookInvocationContext,
): JwtPayload | undefined {
  const id = context?.principalId?.trim();
  if (!id) return undefined;
  return {
    id,
    type: context?.principalType ?? 'user',
    tenantId: context?.extras?.tenantId as string | undefined,
  };
}

/**
 * @title 待办事项控制器
 * @description 提供待办的查询、创建、更新、删除以及跟进记录和评论管理接口。
 * @keywords-cn 待办控制器, 查询, 创建, 更新, 删除, 跟进, 评论
 * @keywords-en todo-controller, query, create, update, delete, followup, comment
 */
@Controller('todo')
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Get('count')
  @CheckAbility('read', 'todo')
  async count(
    @Query() query: { status?: string; sessionId?: string; taskId?: string },
  ): Promise<{ count: number }> {
    return await this.service.count(query);
  }

  @Get()
  @CheckAbility('read', 'todo')
  async list(
    @Query() query: QueryTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity[]> {
    return await this.service.list(query, principal);
  }

  @Get(':id')
  @CheckAbility('read', 'todo')
  async get(@Param('id') id: string): Promise<TodoEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  @CheckAbility('create', 'todo')
  async create(
    @Body() dto: CreateTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity> {
    return await this.service.create(dto, principal);
  }

  @Put(':id')
  @CheckAbility('update', 'todo')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity> {
    return await this.service.update(id, dto, principal);
  }

  @Delete(':id')
  @CheckAbility('delete', 'todo')
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
    return await this.service.createFollowup(
      id,
      dto,
      principal?.id ?? 'system',
    );
  }

  @Get(':id/followups')
  @CheckAbility('read', 'todo')
  async listFollowups(@Param('id') id: string): Promise<TodoFollowupEntity[]> {
    return await this.service.listFollowups(id);
  }

  @Delete('followups/:followupId')
  @CheckAbility('delete', 'todo')
  async deleteFollowup(
    @Param('followupId') id: string,
  ): Promise<{ ok: boolean }> {
    await this.service.deleteFollowup(id);
    return { ok: true };
  }

  @Put('followups/:followupId')
  @CheckAbility('update', 'todo')
  async updateFollowup(
    @Param('followupId') id: string,
    @Body() dto: UpdateFollowupDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoFollowupEntity> {
    return await this.service.updateFollowup(
      id,
      dto,
      principal?.id ?? 'system',
    );
  }

  // ==================== 评论接口 ====================

  @Post('followups/:followupId/comments')
  @CheckAbility('create', 'todo')
  async createComment(
    @Param('followupId') followupId: string,
    @Body() dto: CreateCommentDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoFollowupCommentEntity> {
    return await this.service.createComment(
      followupId,
      dto,
      principal?.id ?? 'system',
    );
  }

  @Get('followups/:followupId/comments')
  @CheckAbility('read', 'todo')
  async listComments(
    @Param('followupId') followupId: string,
  ): Promise<TodoFollowupCommentEntity[]> {
    return await this.service.listComments(followupId);
  }

  @Delete('comments/:commentId')
  @CheckAbility('delete', 'todo')
  async deleteComment(
    @Param('commentId') id: string,
  ): Promise<{ ok: boolean }> {
    await this.service.deleteComment(id);
    return { ok: true };
  }
}
