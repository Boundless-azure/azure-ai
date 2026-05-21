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
import { z } from 'zod';
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
import { TodoStatus } from '../enums/todo.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { CurrentPrincipal } from '@/core/auth/decorators/current-principal.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';

/**
 * @title Todo Hook payload schema (input 形状, SSOT)
 * @description HookRoute 的 payload 统一是数组形参; 此处声明每个位置参数的 schema,
 *              hook-controller 将 args schema 写入 metadata.payloadSchema 供 invoker 校验和 LLM 派生 JSON Schema。
 * @keywords-cn TodoHook, payloadSchema, input, SSOT
 * @keywords-en todo-hook, payload-schema, input, ssot
 */
const todoStatusSchema = z.enum([
  TodoStatus.Pending,
  TodoStatus.InProgress,
  TodoStatus.Failed,
  TodoStatus.WaitingAcceptance,
  TodoStatus.Completed,
]);

const onTodoListInput = z.object({
  sessionId: z.string().optional(),
  status: todoStatusSchema.optional(),
  followerId: z.string().optional(),
  initiatorId: z.string().optional(),
  q: z.string().optional(),
});

const onTodoIdParamInput = z.object({ id: z.string() });

const onTodoCreateInput = z.object({
  initiatorId: z.string(),
  sessionId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  followerIds: z.array(z.string()).optional(),
  statusColor: z.string().optional(),
  status: todoStatusSchema.optional(),
});

const onTodoUpdateInput = z.object({
  sessionId: z.string().nullable().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  followerIds: z.array(z.string()).optional(),
  statusColor: z.string().optional(),
  status: todoStatusSchema.optional(),
});

const onFollowupCreateInput = z.object({
  followerId: z.string(),
  followerName: z.string(),
  followerAvatar: z.string().optional(),
  status: z.string(),
  content: z.string().optional(),
});

const onFollowupUpdateInput = z.object({
  followerId: z.string().optional(),
  followerName: z.string().optional(),
  followerAvatar: z.string().optional(),
  status: z.string().optional(),
  content: z.string().optional(),
});

const onCommentCreateInput = z.object({
  userId: z.string(),
  userName: z.string(),
  userAvatar: z.string().optional(),
  content: z.string(),
});

/**
 * @title 待办事项控制器
 * @description 提供待办的查询、创建、更新、删除以及跟进记录和评论管理接口。
 * @keywords-cn 待办控制器, 查询, 创建, 更新, 删除, 跟进, 评论
 * @keywords-en todo-controller, query, create, update, delete, followup, comment
 */
@HookController({ pluginName: 'todo', tags: ['todo'] })
@Controller('todo')
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Get()
  @CheckAbility('read', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.list',
    description: '待办列表查询',
    args: [onTodoListInput],
    metadata: { tags: ['list', 'query'] },
  })
  async list(
    @Query() query: QueryTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity[]> {
    return await this.service.list(query, principal);
  }

  @Get(':id')
  @CheckAbility('read', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.get',
    description: '待办详情查询',
    args: [onTodoIdParamInput.shape.id],
    metadata: { tags: ['detail', 'query'] },
  })
  async get(@Param('id') id: string): Promise<TodoEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  @CheckAbility('create', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.create',
    description: '待办创建',
    args: [onTodoCreateInput],
    metadata: { tags: ['create', 'write'] },
  })
  async create(
    @Body() dto: CreateTodoDto,
    @CurrentPrincipal() principal?: JwtPayload,
  ): Promise<TodoEntity> {
    return await this.service.create(dto, principal);
  }

  @Put(':id')
  @CheckAbility('update', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.update',
    description: '待办更新',
    args: [onTodoIdParamInput.shape.id, onTodoUpdateInput],
    metadata: { tags: ['update', 'write'] },
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
  @HookRoute({
    hook: 'saas.app.todo.delete',
    description: '待办删除',
    args: [onTodoIdParamInput.shape.id],
    metadata: { tags: ['delete', 'write'] },
  })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }

  // ==================== 跟进记录接口 ====================

  @Post(':id/followups')
  @CheckAbility('create', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.followup.create',
    description: '待办跟进记录创建',
    args: [onTodoIdParamInput.shape.id, onFollowupCreateInput],
    metadata: { tags: ['followup', 'create', 'write'] },
  })
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
  @HookRoute({
    hook: 'saas.app.todo.followup.list',
    description: '待办跟进记录列表查询',
    args: [onTodoIdParamInput.shape.id],
    metadata: { tags: ['followup', 'list', 'query'] },
  })
  async listFollowups(@Param('id') id: string): Promise<TodoFollowupEntity[]> {
    return await this.service.listFollowups(id);
  }

  @Delete('followups/:followupId')
  @CheckAbility('delete', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.followup.delete',
    description: '待办跟进记录删除',
    args: [onTodoIdParamInput.shape.id],
    metadata: { tags: ['followup', 'delete', 'write'] },
  })
  async deleteFollowup(
    @Param('followupId') id: string,
  ): Promise<{ ok: boolean }> {
    await this.service.deleteFollowup(id);
    return { ok: true };
  }

  @Put('followups/:followupId')
  @CheckAbility('update', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.followup.update',
    description: '待办跟进记录更新',
    args: [onTodoIdParamInput.shape.id, onFollowupUpdateInput],
    metadata: { tags: ['followup', 'update', 'write'] },
  })
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
  @HookRoute({
    hook: 'saas.app.todo.comment.create',
    description: '待办跟进评论创建',
    args: [onTodoIdParamInput.shape.id, onCommentCreateInput],
    metadata: { tags: ['comment', 'create', 'write'] },
  })
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
  @HookRoute({
    hook: 'saas.app.todo.comment.list',
    description: '待办跟进评论列表查询',
    args: [onTodoIdParamInput.shape.id],
    metadata: { tags: ['comment', 'list', 'query'] },
  })
  async listComments(
    @Param('followupId') followupId: string,
  ): Promise<TodoFollowupCommentEntity[]> {
    return await this.service.listComments(followupId);
  }

  @Delete('comments/:commentId')
  @CheckAbility('delete', 'todo')
  @HookRoute({
    hook: 'saas.app.todo.comment.delete',
    description: '待办跟进评论删除',
    args: [onTodoIdParamInput.shape.id],
    metadata: { tags: ['comment', 'delete', 'write'] },
  })
  async deleteComment(
    @Param('commentId') id: string,
  ): Promise<{ ok: boolean }> {
    await this.service.deleteComment(id);
    return { ok: true };
  }
}
