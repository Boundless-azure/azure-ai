import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * @title 任务创建请求
 * @description 创建任务所需的字段定义。
 * @keywords-cn 任务创建, DTO, 任务表单
 * @keywords-en task-create, dto, task-form
 */
export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  assigneeIds?: string[];

  @IsOptional()
  @IsString()
  milestone?: string;

  @IsOptional()
  @IsString()
  pmId?: string;

  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

/**
 * @title 任务更新请求
 * @description 更新任务基础信息与关联信息。
 * @keywords-cn 任务更新, DTO, 任务编辑
 * @keywords-en task-update, dto, task-edit
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  assigneeIds?: string[] | null;

  @IsOptional()
  @IsString()
  milestone?: string | null;

  @IsOptional()
  @IsString()
  pmId?: string | null;

  @IsOptional()
  @IsString()
  folderPath?: string | null;

  @IsOptional()
  @IsString()
  sessionId?: string | null;
}

/**
 * @title 任务查询参数
 * @description 支持按会话、PM、关联人和关键字过滤。
 * @keywords-cn 任务查询, 过滤, 会话, PM
 * @keywords-en task-query, filter, session, pm
 */
export class QueryTaskDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  pmId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
