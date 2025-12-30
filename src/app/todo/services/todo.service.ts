import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { TodoEntity } from '../entities/todo.entity';
import {
  QueryTodoDto,
  CreateTodoDto,
  UpdateTodoDto,
} from '../types/todo.types';
import { TodoStatus } from '../enums/todo.enums';

/**
 * @title 待办事项服务
 * @description 提供待办的列表、获取、创建、更新与删除（软删除）能力。
 * @keywords-cn 待办服务, 列表, 更新, 删除
 * @keywords-en todo-service, list, update, delete
 */
@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly repo: Repository<TodoEntity>,
  ) {}

  async list(query: QueryTodoDto): Promise<TodoEntity[]> {
    const where: Record<string, unknown> = { isDelete: false };
    if (query.status) where['status'] = query.status;
    if (query.recipientId) where['recipientId'] = query.recipientId;
    if (query.pluginId) where['pluginId'] = query.pluginId;
    return await this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async get(id: string): Promise<TodoEntity | null> {
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async create(dto: CreateTodoDto): Promise<TodoEntity> {
    const payload: DeepPartial<TodoEntity> = {
      initiatorId: dto.initiatorId,
      title: dto.title,
      pluginId: dto.pluginId ?? null,
      description: dto.description ?? null,
      action: dto.action ?? null,
      recipientId: dto.recipientId,
      status: dto.status ?? TodoStatus.Unread,
      receipt: null,
      active: true,
    };
    const entity = this.repo.create(payload);
    return await this.repo.save(entity);
  }

  async update(id: string, dto: UpdateTodoDto): Promise<TodoEntity> {
    const entity = await this.repo.findOneOrFail({ where: { id } });
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.action !== undefined) entity.action = dto.action;
    if (dto.receipt !== undefined) entity.receipt = dto.receipt;
    return await this.repo.save(entity);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.repo.findOneOrFail({ where: { id } });
    entity.isDelete = true;
    await this.repo.save(entity);
  }
}
