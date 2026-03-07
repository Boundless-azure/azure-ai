import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { TodoEntity } from '../entities/todo.entity';
import {
  QueryTodoDto,
  CreateTodoDto,
  UpdateTodoDto,
} from '../types/todo.types';
import { TodoStatus } from '../enums/todo.enums';
import {
  DataPermissionService,
  DataPermissionContextService,
} from '@core/data-permission';
import type { JwtPayload } from '@/core/auth/types/auth.types';

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
    private readonly dataPermission: DataPermissionService,
    private readonly dataPermissionContext: DataPermissionContextService,
  ) {}

  async list(
    query: QueryTodoDto,
    principal?: JwtPayload,
  ): Promise<TodoEntity[]> {
    const where: Record<string, unknown> = { isDelete: false };
    if (query.status) where['status'] = query.status;
    if (query.recipientId) where['recipientId'] = query.recipientId;
    if (query.pluginId) where['pluginId'] = query.pluginId;
    const context = this.dataPermissionContext.build({
      principalId: principal?.id,
      attributes: {
        principalType: principal?.type,
      },
    });
    const permission = await this.dataPermission.resolve(
      'todos',
      QueryTodoDto,
      context,
      {
        status: query.status,
        recipientId: query.recipientId,
        pluginId: query.pluginId,
      },
    );
    if (!permission.allow) {
      throw new ForbiddenException('todo list denied by data permission');
    }
    Object.assign(where, permission.where);
    return await this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async get(id: string): Promise<TodoEntity | null> {
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async create(
    dto: CreateTodoDto,
    principal?: JwtPayload,
  ): Promise<TodoEntity> {
    const context = this.dataPermissionContext.build({
      principalId: principal?.id,
      attributes: {
        principalType: principal?.type,
      },
    });
    const permission = await this.dataPermission.resolve(
      'todos',
      CreateTodoDto,
      context,
      {
        recipientId: dto.recipientId,
        initiatorId: dto.initiatorId,
      },
    );
    if (!permission.allow) {
      throw new ForbiddenException('todo create denied by data permission');
    }
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

  async update(
    id: string,
    dto: UpdateTodoDto,
    principal?: JwtPayload,
  ): Promise<TodoEntity> {
    const context = this.dataPermissionContext.build({
      principalId: principal?.id,
      attributes: {
        principalType: principal?.type,
      },
    });
    const permission = await this.dataPermission.resolve(
      'todos',
      UpdateTodoDto,
      context,
      {
        id,
      },
    );
    if (!permission.allow) {
      throw new ForbiddenException('todo update denied by data permission');
    }
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
