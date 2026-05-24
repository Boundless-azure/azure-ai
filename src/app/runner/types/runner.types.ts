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

/**
 * @title Hook 调用协议外形
 * @description SaaS↔Runner WS 调用的标准协议体, 与 Runner 内部 HookResult 解耦。
 *              LLM 拿到的就是 { errorMsg, result, debugLog }, errorMsg 非空即软错。
 *              context 是与 payload 平行的运行时上下文 (token / principalId / traceId), 透传给 Runner。
 * @keywords-cn Hook协议, 调用外形, 软错误, 调试日志, 调用上下文
 * @keywords-en hook-protocol, call-envelope, soft-error, debug-log, invocation-context
 */
export interface HookInvocationContextWire {
  token?: string;
  principalId?: string;
  principalType?: string;
  source?: 'llm' | 'system' | 'http' | 'runner';
  traceId?: string;
  runnerId?: string;
  ts?: number;
  extras?: Record<string, unknown>;
}

export interface HookCallEnvelope {
  callId: string;
  hookName: string;
  payload?: unknown;
  /** 运行时上下文 (LLM 不可见, 由调用入口注入) */
  context?: HookInvocationContextWire;
  /** OTel sandbox tracer 开关 */
  debug?: boolean;
  /** Mongo 影子集合开关 */
  debugDb?: boolean;
}

export interface HookCallReply {
  errorMsg: string[];
  result: unknown;
  debugLog: unknown[];
}

export interface HookCallProgress {
  callIds: string[];
  ts: number;
}
