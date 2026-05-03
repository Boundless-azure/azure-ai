import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { TodoEntity } from '../entities/todo.entity';
import { TodoFollowupEntity } from '../entities/todo-followup.entity';
import { TodoFollowupCommentEntity } from '../entities/todo-followup-comment.entity';
import {
  QueryTodoDto,
  CreateTodoDto,
  UpdateTodoDto,
  CreateFollowupDto,
  CreateCommentDto,
  UpdateFollowupDto,
} from '../types/todo.types';
import { TodoStatus } from '../enums/todo.enums';
import {
  DataPermissionService,
  DataPermissionContextService,
} from '@core/data-permission';
import { AbilityService } from '@/app/identity/services/ability.service';
import { PermissionDefinitionType } from '@/app/identity/enums/permission.enums';
import type { JwtPayload } from '@/core/auth/types/auth.types';

/**
 * @title 待办事项服务
 * @description 提供待办的列表、获取、创建、更新、删除以及跟进记录和评论管理能力。
 *              数据权限走新范式 :: 调 dataPermission.applyTo(DtoClass, payload, ctx) 校验,
 *              通过后 service 自由组装查询条件 (含 OR / 复合条件)。
 *              ctx 由 ability service 拿当前 principal 的 (subject, action) 列表填充, 按 permissionType 分组。
 * @keywords-cn 待办服务, 列表, 更新, 删除, 跟进, 评论, applyTo, 新范式
 * @keywords-en todo-service, list, update, delete, followup, comment, apply-to, new-paradigm
 */
@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepo: Repository<TodoEntity>,
    @InjectRepository(TodoFollowupEntity)
    private readonly followupRepo: Repository<TodoFollowupEntity>,
    @InjectRepository(TodoFollowupCommentEntity)
    private readonly commentRepo: Repository<TodoFollowupCommentEntity>,
    private readonly dataPermission: DataPermissionService,
    private readonly dataPermissionContext: DataPermissionContextService,
    private readonly abilityService: AbilityService,
  ) {}

  /**
   * 构建数据权限 context :: 拿 principal 在 data 与 management 类型下的 (subject, action) 列表
   * @keyword-en build-data-permission-context
   */
  private async buildDpContext(principal?: JwtPayload) {
    const principalId = principal?.id ?? '';
    const [dataPerms, mgmtPerms] = principalId
      ? await Promise.all([
          this.abilityService.listPermissionsByType(
            principalId,
            PermissionDefinitionType.Data,
          ),
          this.abilityService.listPermissionsByType(
            principalId,
            PermissionDefinitionType.Management,
          ),
        ])
      : [[], []];
    return this.dataPermissionContext.build({
      principalId: principal?.id,
      attributes: { principalType: principal?.type },
      dataPermissions: dataPerms,
      managementPermissions: mgmtPerms,
    });
  }

  /**
   * @title 获取待办列表
   * @description 支持按状态、跟进人、发起人过滤; 数据权限通过 applyTo 校验
   */
  async list(
    query: QueryTodoDto,
    principal?: JwtPayload,
  ): Promise<TodoEntity[]> {
    const ctx = await this.buildDpContext(principal);
    // 校验通过返原 payload, 否则抛 DataPermissionError (含 errorMsg)
    await this.dataPermission.applyTo(QueryTodoDto, query, ctx);

    const where: Record<string, unknown> = { isDelete: false };
    if (query.status) where['status'] = query.status;
    if (query.initiatorId) where['initiatorId'] = query.initiatorId;
    if (query.followerId) where['followerIds'] = query.followerId;
    if (query.q) where['title'] = query.q;

    return await this.todoRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  /**
   * @title 获取待办详情
   */
  async get(id: string): Promise<TodoEntity | null> {
    return await this.todoRepo.findOne({ where: { id, isDelete: false } });
  }

  /**
   * @title 创建待办
   */
  async create(
    dto: CreateTodoDto,
    principal?: JwtPayload,
  ): Promise<TodoEntity> {
    const ctx = await this.buildDpContext(principal);
    await this.dataPermission.applyTo(CreateTodoDto, dto, ctx);

    const payload: DeepPartial<TodoEntity> = {
      initiatorId: dto.initiatorId,
      title: dto.title,
      description: dto.description ?? null,
      content: dto.content ?? null,
      followerIds: dto.followerIds ?? (principal?.id ? [principal.id] : null),
      statusColor: dto.statusColor ?? null,
      status: dto.status ?? TodoStatus.Pending,
      active: true,
    };
    const entity = this.todoRepo.create(payload);
    return await this.todoRepo.save(entity);
  }

  /**
   * @title 更新待办
   */
  async update(
    id: string,
    dto: UpdateTodoDto,
    principal?: JwtPayload,
  ): Promise<TodoEntity> {
    const ctx = await this.buildDpContext(principal);
    await this.dataPermission.applyTo(UpdateTodoDto, dto, ctx);

    const entity = await this.todoRepo.findOneOrFail({ where: { id } });
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.content !== undefined) entity.content = dto.content;
    if (dto.followerIds !== undefined) entity.followerIds = dto.followerIds;
    if (dto.statusColor !== undefined) entity.statusColor = dto.statusColor;
    if (dto.status !== undefined) entity.status = dto.status;
    return await this.todoRepo.save(entity);
  }

  /**
   * @title 删除待办
   */
  async delete(id: string): Promise<void> {
    const entity = await this.todoRepo.findOneOrFail({ where: { id } });
    entity.isDelete = true;
    await this.todoRepo.save(entity);
  }

  // ==================== 跟进记录管理 ====================

  /**
   * @title 创建跟进记录
   */
  async createFollowup(
    todoId: string,
    dto: CreateFollowupDto,
    userId: string,
  ): Promise<TodoFollowupEntity> {
    const followup = this.followupRepo.create({
      id: uuidv7(),
      todoId,
      followerId: dto.followerId,
      followerName: dto.followerName,
      followerAvatar: dto.followerAvatar ?? null,
      status: dto.status,
      content: dto.content ?? null,
      createdUser: userId,
      updateUser: userId,
      channelId: userId,
    });
    return await this.followupRepo.save(followup);
  }

  /**
   * @title 获取待办的跟进记录列表
   */
  async listFollowups(todoId: string): Promise<TodoFollowupEntity[]> {
    return await this.followupRepo.find({
      where: { todoId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * @title 删除跟进记录
   */
  async deleteFollowup(id: string): Promise<void> {
    const entity = await this.followupRepo.findOneOrFail({ where: { id } });
    await this.followupRepo.remove(entity);
  }

  /**
   * @title 更新跟进记录
   * @description 更新跟进人、状态、内容等信息
   */
  async updateFollowup(
    id: string,
    dto: UpdateFollowupDto,
    userId: string,
  ): Promise<TodoFollowupEntity> {
    const entity = await this.followupRepo.findOneOrFail({ where: { id } });
    if (dto.followerId !== undefined) entity.followerId = dto.followerId;
    if (dto.followerName !== undefined) entity.followerName = dto.followerName;
    if (dto.followerAvatar !== undefined)
      entity.followerAvatar = dto.followerAvatar;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.content !== undefined) entity.content = dto.content;
    entity.updateUser = userId;
    return await this.followupRepo.save(entity);
  }

  // ==================== 评论管理 ====================

  /**
   * @title 创建评论
   */
  async createComment(
    followupId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<TodoFollowupCommentEntity> {
    const comment = this.commentRepo.create({
      id: uuidv7(),
      followupId,
      userId: dto.userId,
      userName: dto.userName,
      userAvatar: dto.userAvatar ?? null,
      content: dto.content,
      createdUser: userId,
      updateUser: userId,
      channelId: userId,
    });
    return await this.commentRepo.save(comment);
  }

  /**
   * @title 获取跟进记录的评论列表
   */
  async listComments(followupId: string): Promise<TodoFollowupCommentEntity[]> {
    return await this.commentRepo.find({
      where: { followupId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * @title 删除评论
   */
  async deleteComment(id: string): Promise<void> {
    const entity = await this.commentRepo.findOneOrFail({ where: { id } });
    await this.commentRepo.remove(entity);
  }
}
