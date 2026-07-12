import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { TaskEntity } from '../entities/task.entity';
import { TaskService } from '../services/task.service';
import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from '../types/task.types';

/** 单对象 hook payload: id 平铺进对象 (id+body → { id, ...body }) */
const idField = z.object({ id: z.string() });

const TaskListHookSchema = z.object({
  sessionId: z.string().optional(),
  pmId: z.string().optional(),
  assigneeId: z.string().optional(),
  q: z.string().optional(),
});

const TaskCreateHookSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  pmId: z.string().optional(),
  folderPath: z.string().optional(),
  sessionId: z.string().optional(),
});

const TaskUpdateBodyHookSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).nullable().optional(),
  milestone: z.string().nullable().optional(),
  pmId: z.string().nullable().optional(),
  folderPath: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

const TaskUpdateHookSchema = idField.merge(TaskUpdateBodyHookSchema);

/**
 * @title Task Hook Controller
 * @description task 模块的 hook 声明层 (单对象 payload); 从 TaskController 迁出, HTTP 与 hook 解耦。
 *   每个 hook 直接调 TaskService, id+body 在 payload 内平铺。
 * @keywords-cn 任务Hook声明, 单对象payload
 * @keywords-en task-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'task', tags: ['task'] })
export class TaskHookController {
  private readonly logger = new Logger(TaskHookController.name);

  constructor(private readonly service: TaskService) {}

  /**
   * 任务列表查询 (按 sessionId/pmId/assigneeId/q 过滤)。
   * @keyword-cn 任务列表, 任务查询
   * @keyword-en list-tasks, task-query
   */
  @HookRoute({
    hook: 'saas.app.task.list',
    description: '任务列表查询',
    args: [TaskListHookSchema],
    metadata: { tags: ['list', 'query'] },
  })
  @CheckAbility('read', 'task')
  async list(
    payload: z.infer<typeof TaskListHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TaskEntity[]> {
    return await this.service.list(payload as QueryTaskDto);
  }

  /**
   * 任务详情查询。
   * @keyword-cn 任务详情, 读取
   * @keyword-en get-task, read-detail
   */
  @HookRoute({
    hook: 'saas.app.task.get',
    description: '任务详情查询',
    args: [idField],
    metadata: { tags: ['detail', 'query'] },
  })
  @CheckAbility('read', 'task')
  async get(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TaskEntity | null> {
    return await this.service.get(payload.id);
  }

  /**
   * 任务创建。
   * @keyword-cn 任务创建, 写入
   * @keyword-en create-task, task-write
   */
  @HookRoute({
    hook: 'saas.app.task.create',
    description: '任务创建',
    args: [TaskCreateHookSchema],
    metadata: { tags: ['create', 'write'] },
  })
  @CheckAbility('create', 'task')
  async create(
    payload: z.infer<typeof TaskCreateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TaskEntity> {
    return await this.service.create(payload as CreateTaskDto);
  }

  /**
   * 任务更新 (id+body 平铺)。
   * @keyword-cn 任务更新, 改写
   * @keyword-en update-task, task-write
   */
  @HookRoute({
    hook: 'saas.app.task.update',
    description: '任务更新',
    args: [TaskUpdateHookSchema],
    metadata: { tags: ['update', 'write'] },
  })
  @CheckAbility('update', 'task')
  async update(
    payload: z.infer<typeof TaskUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<TaskEntity> {
    const { id, ...body } = payload;
    return await this.service.update(id, body as UpdateTaskDto);
  }

  /**
   * 任务删除 (软删除)。
   * @keyword-cn 任务删除, 软删
   * @keyword-en delete-task, soft-delete
   */
  @HookRoute({
    hook: 'saas.app.task.delete',
    description: '任务删除',
    args: [idField],
    metadata: { tags: ['delete', 'write'] },
  })
  @CheckAbility('delete', 'task')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ ok: boolean }> {
    await this.service.delete(payload.id);
    return { ok: true };
  }
}
