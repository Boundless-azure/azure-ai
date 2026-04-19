import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * @title 会话扩展数据实体
 * @description 存储与会话关联的 WebMCP 连接/Schema 等扩展数据。
 * @keywords-cn 会话数据, WebMCP, Schema, 连接
 * @keywords-en session-data, webmcp, schema, connection
 */
export enum SessionDataType {
  WebmcpSchema = 'webmcp_schema',
  WebmcpConn   = 'webmcp_conn',
}

@Entity('chat_sessions_data')
@Index(['forSessionId'])
@Index(['forSessionId', 'dataType'])
export class ChatSessionDataEntity extends BaseAuditedEntity {
  /**
   * 数据类型枚举
   * - webmcp_schema：MCP 页面 Schema 注册信息
   * - webmcp_conn：MCP Socket.IO 连接句柄 ID
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
}
