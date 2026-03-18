import { IsOptional, IsString, Length, IsBoolean } from 'class-validator';

/**
 * @title 应用子单元创建请求
 * @description 创建 app-unit 所需字段：归属 appId、名称与可选描述/版本，会话可选关联。
 * @keywords-cn app-unit创建, DTO, 子模块, unit
 * @keywords-en app-unit-create, dto, submodule, unit
 */
export class CreateAppUnitDto {
  @IsOptional()
  @IsString()
  @Length(1, 36)
  runnerId?: string;

  @IsString()
  @Length(1, 100)
  sessionId!: string;

  @IsString()
  @Length(1, 36)
  appId!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  version?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * @title 应用子单元更新请求
 * @description 更新 app-unit 可变字段：描述/版本/启用状态/会话关联。
 * @keywords-cn app-unit更新, DTO, 启用, 描述
 * @keywords-en app-unit-update, dto, active, description
 */
export class UpdateAppUnitDto {
  @IsOptional()
  @IsString()
  @Length(1, 36)
  runnerId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  version?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * @title 应用子单元查询参数
 * @description 支持按 appId 与 sessionId 过滤。
 * @keywords-cn app-unit查询, 过滤, appId, sessionId
 * @keywords-en app-unit-query, filter, appId, sessionId
 */
export class QueryAppUnitDto {
  @IsOptional()
  @IsString()
  @Length(1, 36)
  runnerId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 36)
  appId?: string;
}
