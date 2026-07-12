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
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { TaskEntity } from '../entities/task.entity';
import { TaskService } from '../services/task.service';
import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from '../types/task.types';

/**
 * @title 任务控制器
 * @description 提供任务的 REST 入口 (Hook 入口已迁至 TaskHookController)。
 * @keywords-cn 任务控制器, 任务接口
 * @keywords-en task-controller, task-api
 */
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
  async list(@Query() query: QueryTaskDto): Promise<TaskEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'task')
  async get(@Param('id') id: string): Promise<TaskEntity | null> {
    return await this.service.get(id);
  }

  @Post()
  @CheckAbility('create', 'task')
  async create(@Body() dto: CreateTaskDto): Promise<TaskEntity> {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'task')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'task')
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}
