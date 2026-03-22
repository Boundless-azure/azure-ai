import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsObject,
} from 'class-validator';
import { TodoStatus } from '../enums/todo.enums';
import { BindDataPermissionNode } from '@core/data-permission/decorators/data-permission-node.decorator';

/**
 * @title 待办创建请求
 * @description 创建待办事项所需的字段。
 * @keywords-cn 待办创建, DTO
 * @keywords-en todo-create, dto
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

  @BindDataPermissionNode('todo:create-only-myself')
  dataPermissionNodeCreateOnlyMyself(): string {
    return 'todo:create-only-myself';
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

  @BindDataPermissionNode('todo:update-only-myself')
  dataPermissionNodeUpdateOnlyMyself(): string {
    return 'todo:update-only-myself';
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

  @BindDataPermissionNode('todo:read-only-myself')
  dataPermissionNodeReadOnlyMyself(): string {
    return 'todo:read-only-myself';
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
