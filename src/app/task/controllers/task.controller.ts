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
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { TaskEntity } from '../entities/task.entity';
import { TaskService } from '../services/task.service';
import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from '../types/task.types';

/**
 * @title 任务 Hook payload schema
 * @description 任务模块 HookRoute 的输入参数形状定义。
 * @keywords-cn 任务Hook, payloadSchema, 输入定义
 * @keywords-en task-hook, payload-schema, input-shape
 */
const onTaskListInput = z.object({
  sessionId: z.string().optional(),
  pmId: z.string().optional(),
  assigneeId: z.string().optional(),
  q: z.string().optional(),
});

const onTaskIdParamInput = z.object({ id: z.string() });

const onTaskCreateInput = z.object({
  title: z.string(),
  description: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  pmId: z.string().optional(),
  folderPath: z.string().optional(),
  sessionId: z.string().optional(),
});

const onTaskUpdateInput = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).nullable().optional(),
  milestone: z.string().nullable().optional(),
  pmId: z.string().nullable().optional(),
  folderPath: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

/**
 * @title 任务控制器
 * @description 提供任务的 REST 与 Hook 入口。
 * @keywords-cn 任务控制器, 任务接口, Hook入口
 * @keywords-en task-controller, task-api, hook-entry
 */
@HookController({ pluginName: 'task', tags: ['task'] })
@Controller('task')
export class TaskController {
  /**
   * @title 构造函数
   * @description 注入任务服务。
   * @keyword-en task-controller-constructor
   */
  constructor(private readonly service: TaskService) {}

  @Get()
  @CheckAbility('read', 'task')
  @HookRoute({
    hook: 'saas.app.task.list',
    description: '任务列表查询',
    args: [onTaskListInput],
    metadata: { tags: ['list', 'query'] },
  })
  async list(@Query() query: QueryTaskDto): Promise<TaskEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'task')
  @HookRoute({
    hook: 'saas.app.task.get',
    description: '任务详情查询',
    args: [onTaskIdParamInput.shape.id],
    metadata: { tags: ['detail', 'query'] },
  })
  async get(@Param('id') id: string): Promise<TaskEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  @CheckAbility('create', 'task')
  @HookRoute({
    hook: 'saas.app.task.create',
    description: '任务创建',
    args: [onTaskCreateInput],
    metadata: { tags: ['create', 'write'] },
  })
  async create(@Body() dto: CreateTaskDto): Promise<TaskEntity> {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'task')
  @HookRoute({
    hook: 'saas.app.task.update',
    description: '任务更新',
    args: [onTaskIdParamInput.shape.id, onTaskUpdateInput],
    metadata: { tags: ['update', 'write'] },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'task')
  @HookRoute({
    hook: 'saas.app.task.delete',
    description: '任务删除',
    args: [onTaskIdParamInput.shape.id],
    metadata: { tags: ['delete', 'write'] },
  })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}
