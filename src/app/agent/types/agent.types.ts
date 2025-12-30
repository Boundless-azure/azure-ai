import { IsOptional, IsString, Length, IsObject } from 'class-validator';

/**
 * @title Agent 更新请求
 * @description 仅允许更新拟人昵称与用途说明。
 * @keywords-cn Agent更新, 昵称, 用途说明, DTO
 * @keywords-en agent-update, nickname, purpose, dto
 */
export class UpdateAgentDto {
  @IsString()
  @Length(1, 100)
  nickname!: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}

/**
 * @title Agent 查询参数
 * @description 支持按关键字与对话组过滤。
 * @keywords-cn Agent查询, 关键字过滤, 对话组
 * @keywords-en agent-query, keyword, conversation-group
 */
export class QueryAgentDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  conversationGroupId?: string;
}

/**
 * @title 执行Agent 更新请求
 * @description 允许更新节点状态、最新返回信息与上下文关联。
 * @keywords-cn 执行Agent更新, 节点状态, 最新返回, 上下文
 * @keywords-en agent-execution-update, node-status, latest-response, context
 */
export class UpdateExecutionDto {
  @IsOptional()
  @IsObject()
  nodeStatus?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  latestResponse?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Length(1, 36)
  contextMessageId?: string;
}

/**
 * @title 执行Agent 查询参数
 * @description 支持按 agentId 与 contextMessageId 过滤。
 * @keywords-cn 执行Agent查询, 过滤, agentId, contextMessageId
 * @keywords-en agent-execution-query, filter, agentId, contextMessageId
 */
export class QueryExecutionDto {
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  contextMessageId?: string;
}
