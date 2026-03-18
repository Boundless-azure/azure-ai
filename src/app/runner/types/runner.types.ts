import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { RunnerStatus } from '../enums/runner.enums';

/**
 * @title Runner 创建请求
 * @description 新增 Runner 时输入别名、描述与主体显示名。
 * @keywords-cn Runner创建, 别名, 主体显示名
 * @keywords-en runner-create, alias, principal-display-name
 */
export class CreateRunnerDto {
  @IsString()
  @Length(2, 120)
  alias!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  principalDisplayName?: string;
}

/**
 * @title Runner 更新请求
 * @description 更新 Runner 可变字段：别名、描述、启用状态。
 * @keywords-cn Runner更新, 别名, 描述, 启用状态
 * @keywords-en runner-update, alias, description, active
 */
export class UpdateRunnerDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  alias?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * @title Runner 查询参数
 * @description 支持按状态、主体与关键字过滤 Runner。
 * @keywords-cn Runner查询, 状态过滤, 主体过滤
 * @keywords-en runner-query, status-filter, principal-filter
 */
export class QueryRunnerDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: RunnerStatus;

  @IsOptional()
  @IsString()
  @Length(1, 36)
  principalId?: string;
}

/**
 * @title Runner 注册请求
 * @description Runner 客户端通过 runnerId 与 key 执行注册握手。
 * @keywords-cn Runner注册, 握手, 密钥校验
 * @keywords-en runner-register, handshake, key-verify
 */
export class RunnerRegisterDto {
  @IsOptional()
  @IsString()
  @Length(1, 36)
  runnerId?: string;

  @IsString()
  @Length(32, 128)
  key!: string;
}

export interface RunnerCreateResult {
  id: string;
  alias: string;
  principalId: string;
  description: string | null;
  status: RunnerStatus;
  active: boolean;
  runnerKey: string;
  lastSeenAt: Date | null;
}

export interface RunnerView {
  id: string;
  alias: string;
  principalId: string;
  description: string | null;
  status: RunnerStatus;
  active: boolean;
  runnerKey: string;
  lastSeenAt: Date | null;
}
