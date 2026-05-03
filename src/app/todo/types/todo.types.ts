import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';
import { TodoStatus } from '../enums/todo.enums';
import {
  DataPermissionNode,
  type DataPermissionNodeArgs,
} from '@core/data-permission';

/**
 * @title 待办创建请求
 * @description 创建待办事项所需的字段, 含数据权限节点声明 (新范式: 静态方法 = handler)。
 * @keywords-cn 待办创建, DTO, 数据权限节点
 * @keywords-en todo-create, dto, data-permission-node
 */
export class CreateTodoDto {
  @IsString()
  initiatorId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  followerIds?: string[];

  @IsOptional()
  @IsString()
  statusColor?: string;

  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  /**
   * 数据权限节点 :: 创建 todo 时 initiatorId 必须等于当前登录用户
   * @keyword-en todo-create-only-myself
   */
  @DataPermissionNode({
    subject: 'todo',
    action: 'create-only-myself',
    weight: 30,
    errorMsg: 'initiatorId 必须等于当前登录用户 (只能创建自己的 todo)',
  })
  static createOnlyMyself({
    ctx,
    payload,
  }: DataPermissionNodeArgs<CreateTodoDto>): boolean | string {
    if (!ctx.principalId) {
      return '当前未登录, 无法识别 principalId';
    }
    return payload.initiatorId === ctx.principalId;
  }
}

/**
 * @title 待办更新请求
 * @description 更新待办名称、描述、内容、跟进人、状态等。
 * @keywords-cn 待办更新, 状态, 跟进人
 * @keywords-en todo-update, status, follower
 */
export class UpdateTodoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  followerIds?: string[];

  @IsOptional()
  @IsString()
  statusColor?: string;

  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  /**
   * 数据权限节点 :: 更新动作上 payload 不携带 owner 信息, 这里仅做 principal 存在性的硬保障,
   *                 真正的"只能改自己的" 限制在 service 层通过 (initiatorId = principalId) where 条件落实
   * @keyword-en todo-update-only-myself
   */
  @DataPermissionNode({
    subject: 'todo',
    action: 'update-only-myself',
    weight: 30,
    errorMsg: '当前未登录, 无法识别 principalId',
  })
  static updateOnlyMyself({
    ctx,
  }: DataPermissionNodeArgs<UpdateTodoDto>): boolean | string {
    return Boolean(ctx.principalId);
  }
}

/**
 * @title 待办查询参数
 * @description 支持按状态、跟进人ID过滤。
 * @keywords-cn 待办查询, 过滤, 状态
 * @keywords-en todo-query, filter, status
 */
export class QueryTodoDto {
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IsOptional()
  @IsString()
  followerId?: string;

  @IsOptional()
  @IsString()
  initiatorId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  /**
   * 数据权限节点 :: 查询时 query 中若指定 initiatorId / followerId, 必须是自己
   *                 不指定 → 表示"看自己的", service 层会自动补 principalId 作为 initiator/follower OR 条件
   *                 这里 handler 仅做一致性校验, payload 不被改写
   * @keyword-en todo-read-only-myself
   */
  @DataPermissionNode({
    subject: 'todo',
    action: 'read-only-myself',
    weight: 30,
    errorMsg: 'initiatorId / followerId 若指定必须等于当前登录用户',
  })
  static readOnlyMyself({
    ctx,
    payload,
  }: DataPermissionNodeArgs<QueryTodoDto>): boolean | string {
    if (!ctx.principalId) return '当前未登录, 无法识别 principalId';
    if (payload.initiatorId && payload.initiatorId !== ctx.principalId) {
      return `initiatorId 必须等于当前登录用户 (${ctx.principalId})`;
    }
    if (payload.followerId && payload.followerId !== ctx.principalId) {
      return `followerId 必须等于当前登录用户 (${ctx.principalId})`;
    }
    return true;
  }
}

/**
 * @title 跟进记录创建请求
 * @description 创建待办跟进记录。
 * @keywords-cn 跟进记录创建, DTO
 * @keywords-en followup-create, dto
 */
export class CreateFollowupDto {
  @IsString()
  followerId!: string;

  @IsString()
  followerName!: string;

  @IsOptional()
  @IsString()
  followerAvatar?: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  content?: string;
}

/**
 * @title 评论创建请求
 * @description 创建跟进记录评论。
 * @keywords-cn 评论创建, DTO
 * @keywords-en comment-create, dto
 */
export class CreateCommentDto {
  @IsString()
  userId!: string;

  @IsString()
  userName!: string;

  @IsOptional()
  @IsString()
  userAvatar?: string;

  @IsString()
  content!: string;
}

/**
 * @title 跟进记录更新请求
 * @description 更新跟进记录，主要是编辑跟进人、状态和内容。
 * @keywords-cn 跟进记录更新, DTO, 编辑跟进人
 * @keywords-en followup-update, dto, edit-follower
 */
export class UpdateFollowupDto {
  @IsOptional()
  @IsString()
  followerId?: string;

  @IsOptional()
  @IsString()
  followerName?: string;

  @IsOptional()
  @IsString()
  followerAvatar?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
