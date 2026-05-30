import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';
import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from '../types/task.types';

/**
 * @title 任务服务
 * @description 提供任务的查询、创建、更新、删除能力。
 * @keywords-cn 任务服务, 查询, 创建, 更新, 删除
 * @keywords-en task-service, list, create, update, delete
 */
@Injectable()
export class TaskService {
  /**
   * @title 构造函数
   * @description 注入任务仓储。
   * @keyword-en task-service-constructor
   */
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  /**
   * @title 获取任务列表
   * @description 支持按会话、PM、关联人、关键字过滤。
   * @keyword-en task-list
   */
  async list(query: QueryTaskDto): Promise<TaskEntity[]> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .where('task.isDelete = :isDelete', { isDelete: false })
      .orderBy('task.createdAt', 'DESC');

    if (query.sessionId?.trim()) {
      qb.andWhere('task.sessionId = :sessionId', {
        sessionId: query.sessionId.trim(),
      });
    }
    if (query.pmId?.trim()) {
      qb.andWhere('task.pmId = :pmId', { pmId: query.pmId.trim() });
    }
    if (query.assigneeId?.trim()) {
      qb.andWhere('task.assigneeids::text LIKE :assigneeText', {
        assigneeText: `%"${query.assigneeId.trim()}"%`,
      });
    }
    if (query.q?.trim()) {
      qb.andWhere(
        `(
          LOWER(task.title) LIKE :q OR
          LOWER(COALESCE(task.description, '')) LIKE :q OR
          LOWER(COALESCE(task.milestone, '')) LIKE :q
        )`,
        { q: `%${query.q.trim().toLowerCase()}%` },
      );
    }

    return await qb.getMany();
  }

  /**
   * @title 获取任务详情
   * @description 按 ID 查询单个任务。
   * @keyword-en task-get
   */
  async get(id: string): Promise<TaskEntity | null> {
    return await this.taskRepo.findOne({ where: { id, isDelete: false } });
  }

  /**
   * @title 创建任务
   * @description 持久化新任务。
   * @keyword-en task-create
   */
  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    const entity = this.taskRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      assigneeIds: dto.assigneeIds ?? null,
      milestone: dto.milestone ?? null,
      pmId: dto.pmId ?? null,
      folderPath: dto.folderPath?.trim() || null,
      sessionId: dto.sessionId?.trim() || null,
      active: true,
    });
    return await this.taskRepo.save(entity);
  }

  /**
   * @title 更新任务
   * @description 修改任务的可变字段。
   * @keyword-en task-update
   */
  async update(id: string, dto: UpdateTaskDto): Promise<TaskEntity> {
    const entity = await this.taskRepo.findOneOrFail({
      where: { id, isDelete: false },
    });

    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.assigneeIds !== undefined) entity.assigneeIds = dto.assigneeIds;
    if (dto.milestone !== undefined) entity.milestone = dto.milestone;
    if (dto.pmId !== undefined) entity.pmId = dto.pmId;
    if (dto.folderPath !== undefined) {
      entity.folderPath = dto.folderPath?.trim() || null;
    }
    if (dto.sessionId !== undefined) {
      entity.sessionId = dto.sessionId?.trim() || null;
    }

    return await this.taskRepo.save(entity);
  }

  /**
   * @title 删除任务
   * @description 软删除任务。
   * @keyword-en task-delete
   */
  async delete(id: string): Promise<void> {
    const entity = await this.taskRepo.findOneOrFail({
      where: { id, isDelete: false },
    });
    entity.isDelete = true;
    await this.taskRepo.save(entity);
  }
}
