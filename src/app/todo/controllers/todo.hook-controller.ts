import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
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
import { resolveTodoPrincipal } from './todo.controller';

/**
 * @title Todo Hook payload schema (input 形状, SSOT)
 * @description hook-controller 每个 hook 只收单对象 payload; id 平铺进对象 (scalar-id → { id }, id+body → { id, ...body })。
 *              args schema 写入 metadata.payloadSchema 供 invoker 校验和 LLM 派生 JSON Schema。
 * @keywords-cn TodoHook, payloadSchema, input, 单对象payload
 * @keywords-en todo-hook, payload-schema, input, single-object-payload
 */
const todoStatusSchema = z.enum([
  TodoStatus.Pending,
  TodoStatus.InProgress,
  TodoStatus.Failed,
  TodoStatus.WaitingAcceptance,
  TodoStatus.Completed,
]);

const idField = z.object({ id: z.string() });

const TodoListInput = z.object({
  sessionId: z.string().optional(),
  taskId: z.string().optional(),
  status: todoStatusSchema.optional(),
  followerId: z.string().optional(),
  initiatorId: z.string().optional(),
  q: z.string().optional(),
});

const TodoCountInput = z.object({
  status: todoStatusSchema.optional().describe('按状态过滤; 不传返回全部'),
  sessionId: z.string().optional().describe('按关联会话 ID 过滤; 不传返回全局'),
  taskId: z.string().optional().describe('按所属任务 ID 过滤; 不传返回全部'),
});

const TodoCreateInput = z.object({
  initiatorId: z.string(),
  sessionId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  followerId: z.string().optional(),
  statusColor: z.string().optional(),
  status: todoStatusSchema.optional(),
});

const TodoUpdateInput = z.object({
  sessionId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  followerId: z.string().nullable().optional(),
  statusColor: z.string().optional(),
  status: todoStatusSchema.optional(),
});

const FollowupCreateInput = z.object({
  followerId: z.string(),
  followerName: z.string(),
  followerAvatar: z.string().optional(),
  content: z.string().optional(),
});

const FollowupUpdateInput = z.object({
  followerId: z.string().optional(),
  followerName: z.string().optional(),
  followerAvatar: z.string().optional(),
  content: z.string().optional(),
});

const CommentCreateInput = z.object({
  userId: z.string(),
  userName: z.string(),
  userAvatar: z.string().optional(),
  content: z.string(),
});

/** id + body 平铺单对象 schema */
const TodoUpdateHookSchema = idField.merge(TodoUpdateInput);
const FollowupCreateHookSchema = idField.merge(FollowupCreateInput);
const FollowupUpdateHookSchema = idField.merge(FollowupUpdateInput);
const CommentCreateHookSchema = idField.merge(CommentCreateInput);

/**
 * @title Todo Hook Controller
 * @description todo 模块的 hook 声明层 (单对象 payload); 从 TodoController 迁出, HTTP 与 hook 解耦。
 *              每个 hook 直接调 TodoService, principal 从 invocationContext 解析。
 * @keywords-cn 待办Hook声明, 单对象payload
 * @keywords-en todo-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'todo', tags: ['todo'] })
export class TodoHookController {
  constructor(private readonly service: TodoService) {}

  /**
   * 待办总数统计。
   * @keyword-cn 待办总数, 统计
   * @keyword-en todo-count, count-query
   */
  @HookRoute({
    hook: 'saas.app.todo.todoCount',
    description:
      '待办总数统计 :: 返回 { count: number }，支持按 status / sessionId / taskId 过滤',
    args: [TodoCountInput],
    metadata: { tags: ['count', 'query'] },
  })
  @CheckAbility('read', 'todo')
  async count(
    payload: z.infer<typeof TodoCountInput>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ count: number }> {
    return await this.service.count(payload);
  }

  /**
   * 待办列表查询。
   * @keyword-cn 待办列表, 查询
   * @keyword-en todo-list, list-query
   */
  @HookRoute({
    hook: 'saas.app.todo.list',
    description: '待办列表查询',
    args: [TodoListInput],
    metadata: { tags: ['list', 'query'] },
  })
  @CheckAbility('read', 'todo')
  async list(
    payload: QueryTodoDto,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<TodoEntity[]> {
    const principal = resolveTodoPrincipal(context);
    return await this.service.list(payload, principal);
  }

  /**
   * 待办详情查询。
   * @keyword-cn 待办详情, 查询
   * @keyword-en todo-detail, get-query
   */
  @HookRoute({
    hook: 'saas.app.todo.get',
    description: '待办详情查询',
    args: [idField],
    metadata: { tags: ['detail', 'query'] },
  })
  @CheckAbility('read', 'todo')
  async get(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TodoEntity | null> {
    return await this.service.get(payload.id);
  }

  /**
   * 待办创建。
   * @keyword-cn 待办创建
   * @keyword-en todo-create
   */
  @HookRoute({
    hook: 'saas.app.todo.create',
    description: '待办创建',
    args: [TodoCreateInput],
    metadata: { tags: ['create', 'write'] },
  })
  @CheckAbility('create', 'todo')
  async create(
    payload: CreateTodoDto,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<TodoEntity> {
    const principal = resolveTodoPrincipal(context);
    return await this.service.create(payload, principal);
  }

  /**
   * 待办更新。
   * @keyword-cn 待办更新
   * @keyword-en todo-update
   */
  @HookRoute({
    hook: 'saas.app.todo.update',
    description: '待办更新',
    args: [TodoUpdateHookSchema],
    metadata: { tags: ['update', 'write'] },
  })
  @CheckAbility('update', 'todo')
  async update(
    payload: z.infer<typeof TodoUpdateHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<TodoEntity> {
    const principal = resolveTodoPrincipal(context);
    const { id, ...body } = payload;
    return await this.service.update(id, body as UpdateTodoDto, principal);
  }

  /**
   * 待办删除。
   * @keyword-cn 待办删除
   * @keyword-en todo-delete
   */
  @HookRoute({
    hook: 'saas.app.todo.delete',
    description: '待办删除',
    args: [idField],
    metadata: { tags: ['delete', 'write'] },
  })
  @CheckAbility('delete', 'todo')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ ok: boolean }> {
    await this.service.delete(payload.id);
    return { ok: true };
  }

  // ==================== 跟进记录接口 ====================

  /**
   * 待办跟进记录创建。
   * @keyword-cn 跟进创建
   * @keyword-en followup-create
   */
  @HookRoute({
    hook: 'saas.app.todo.followup.create',
    description: '待办跟进记录创建',
    args: [FollowupCreateHookSchema],
    metadata: { tags: ['followup', 'create', 'write'] },
  })
  @CheckAbility('create', 'todo')
  async createFollowup(
    payload: z.infer<typeof FollowupCreateHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<TodoFollowupEntity> {
    const principal = resolveTodoPrincipal(context);
    const { id, ...body } = payload;
    return await this.service.createFollowup(
      id,
      body as CreateFollowupDto,
      principal?.id ?? 'system',
    );
  }

  /**
   * 待办跟进记录列表查询。
   * @keyword-cn 跟进列表
   * @keyword-en followup-list
   */
  @HookRoute({
    hook: 'saas.app.todo.followup.list',
    description: '待办跟进记录列表查询',
    args: [idField],
    metadata: { tags: ['followup', 'list', 'query'] },
  })
  @CheckAbility('read', 'todo')
  async listFollowups(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TodoFollowupEntity[]> {
    return await this.service.listFollowups(payload.id);
  }

  /**
   * 待办跟进记录删除。
   * @keyword-cn 跟进删除
   * @keyword-en followup-delete
   */
  @HookRoute({
    hook: 'saas.app.todo.followup.delete',
    description: '待办跟进记录删除',
    args: [idField],
    metadata: { tags: ['followup', 'delete', 'write'] },
  })
  @CheckAbility('delete', 'todo')
  async deleteFollowup(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ ok: boolean }> {
    await this.service.deleteFollowup(payload.id);
    return { ok: true };
  }

  /**
   * 待办跟进记录更新。
   * @keyword-cn 跟进更新
   * @keyword-en followup-update
   */
  @HookRoute({
    hook: 'saas.app.todo.followup.update',
    description: '待办跟进记录更新',
    args: [FollowupUpdateHookSchema],
    metadata: { tags: ['followup', 'update', 'write'] },
  })
  @CheckAbility('update', 'todo')
  async updateFollowup(
    payload: z.infer<typeof FollowupUpdateHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<TodoFollowupEntity> {
    const principal = resolveTodoPrincipal(context);
    const { id, ...body } = payload;
    return await this.service.updateFollowup(
      id,
      body as UpdateFollowupDto,
      principal?.id ?? 'system',
    );
  }

  // ==================== 评论接口 ====================

  /**
   * 待办跟进评论创建。
   * @keyword-cn 评论创建
   * @keyword-en comment-create
   */
  @HookRoute({
    hook: 'saas.app.todo.comment.create',
    description: '待办跟进评论创建',
    args: [CommentCreateHookSchema],
    metadata: { tags: ['comment', 'create', 'write'] },
  })
  @CheckAbility('create', 'todo')
  async createComment(
    payload: z.infer<typeof CommentCreateHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<TodoFollowupCommentEntity> {
    const principal = resolveTodoPrincipal(context);
    const { id, ...body } = payload;
    return await this.service.createComment(
      id,
      body as CreateCommentDto,
      principal?.id ?? 'system',
    );
  }

  /**
   * 待办跟进评论列表查询。
   * @keyword-cn 评论列表
   * @keyword-en comment-list
   */
  @HookRoute({
    hook: 'saas.app.todo.comment.list',
    description: '待办跟进评论列表查询',
    args: [idField],
    metadata: { tags: ['comment', 'list', 'query'] },
  })
  @CheckAbility('read', 'todo')
  async listComments(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TodoFollowupCommentEntity[]> {
    return await this.service.listComments(payload.id);
  }

  /**
   * 待办跟进评论删除。
   * @keyword-cn 评论删除
   * @keyword-en comment-delete
   */
  @HookRoute({
    hook: 'saas.app.todo.comment.delete',
    description: '待办跟进评论删除',
    args: [idField],
    metadata: { tags: ['comment', 'delete', 'write'] },
  })
  @CheckAbility('delete', 'todo')
  async deleteComment(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ ok: boolean }> {
    await this.service.deleteComment(payload.id);
    return { ok: true };
  }
}
