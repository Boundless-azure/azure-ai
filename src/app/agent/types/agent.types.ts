import { IsOptional, IsString, Length, IsObject } from 'class-validator';
import { IsArray } from 'class-validator';

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

/**
 * @title 更新Agent向量请求
 * @description 可选传入 ID 列表；若未提供则全量更新。
 * @keywords-cn 向量更新请求, ID列表, 全量更新
 * @keywords-en embeddings-update-request, id-list, full-update
 */
export class UpdateEmbeddingsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}
