import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  IsObject,
} from 'class-validator';
import { TodoStatus } from '../enums/todo.enums';

/**
 * @title 待办创建请求
 * @description 创建待办事项所需的字段。
 * @keywords-cn 待办创建, DTO
 * @keywords-en todo-create, dto
 */
export class CreateTodoDto {
  @IsString()
  @Length(1, 36)
  initiatorId!: string;

  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 36)
  pluginId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  action?: Record<string, unknown>;

  @IsString()
  @Length(1, 36)
  recipientId!: string;

  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;
}

/**
 * @title 待办更新请求
 * @description 更新待办状态、说明、action 与回执结果。
 * @keywords-cn 待办更新, 状态, 回执
 * @keywords-en todo-update, status, receipt
 */
export class UpdateTodoDto {
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  action?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  receipt?: Record<string, unknown>;
}

/**
 * @title 待办查询参数
 * @description 支持按状态、接收人与插件过滤。
 * @keywords-cn 待办查询, 过滤, 状态
 * @keywords-en todo-query, filter, status
 */
export class QueryTodoDto {
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsOptional()
  @IsString()
  pluginId?: string;
}
