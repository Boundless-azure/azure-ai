import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * @title 会话扩展数据实体
 * @description 存储与会话关联的扩展数据：WebMCP 连接/Schema、AI 自管理 session_data、call_hook 调用日志。
 * @keywords-cn 会话数据, WebMCP, Schema, 连接, AI会话数据, 调用日志
 * @keywords-en session-data, webmcp, schema, connection, ai-session, call-log
 */
export enum SessionDataType {
  WebmcpSchema = 'webmcp_schema',
  WebmcpConn = 'webmcp_conn',
  AiSession = 'ai_session',
  /**
   * AI call_hook 调用日志 (硬记录, 仅成功项, FIFO 上限 50 条)
   * - dataKey :: uuid (call log 没有业务 key, 用 uuid 防冲突)
   * - dataTitle :: `<hookName原文> :: <payload-摘要>` (查询命中靠它)
   * - dataVal :: JSON { hookName, target, runnerId?, payload, result, ts }
   * - 不进 enrichWithSessionRecall, LLM 主动 callHistory.query 才看见
   */
  AiCallLog = 'ai_call_log',
}

@Entity('chat_sessions_data')
@Index(['forSessionId'])
@Index(['forSessionId', 'dataType'])
@Index(['forSessionId', 'dataType', 'dataKey'])
export class ChatSessionDataEntity extends BaseAuditedEntity {
  /**
   * 数据类型枚举
   * - webmcp_schema：MCP 页面 Schema 注册信息
   * - webmcp_conn：MCP Socket.IO 连接句柄 ID
   * - ai_session：AI 自管理的会话级 key-value 数据
   */
  @Column({
    name: 'data_type',
    type: 'enum',
    enum: SessionDataType,
  })
  dataType!: SessionDataType;

  /** 数据值（JSON 字符串） */
  @Column({ name: 'data_val', type: 'text' })
  dataVal!: string;

  /** 关联的会话 ID（chat_sessions.session_id） */
  @Column({ name: 'for_session_id', type: 'varchar', length: 100 })
  forSessionId!: string;

  /**
   * 数据键名（仅 ai_session 类型使用）
   * 作为 key-value 存储的 key 标识
   */
  @Column({ name: 'data_key', type: 'varchar', length: 255, nullable: true })
  dataKey?: string;

  /**
   * 数据标题（仅 ai_session 类型使用）
   * AI 自定义的描述性标题，用于 list 时快速识别数据用途
   */
  @Column({ name: 'data_title', type: 'varchar', length: 255, nullable: true })
  dataTitle?: string;
}
