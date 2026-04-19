import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  ChatSessionDataEntity,
  SessionDataType,
} from '@core/ai/entities/chat-session-data.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';

/**
 * @title WebMCP 会话数据服务
 * @description 管理 WebMCP 连接记录与 Schema 注册数据的持久化，
 *              供 WebMCP Gateway 与 Hooks 使用。
 * @keywords-cn WebMCP, 连接, Schema, 会话数据
 * @keywords-en webmcp-session-data, conn, schema, session
 */
@Injectable()
export class WebMcpSessionDataService {
  private readonly logger = new Logger(WebMcpSessionDataService.name);

  constructor(
    @InjectRepository(ChatSessionDataEntity)
    private readonly dataRepo: Repository<ChatSessionDataEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
  ) {}

  /**
   * 验证 session_id 是否存在
   * @keyword-en validate-session
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const count = await this.sessionRepo.count({ where: { sessionId } });
    return count > 0;
  }

  /**
   * 写入连接句柄（webmcp_conn），每次连接写一条新记录
   * @keyword-en upsert-conn
   */
  async saveConn(sessionId: string, socketId: string): Promise<void> {
    const entity = this.dataRepo.create({
      id: uuidv7(),
      dataType: SessionDataType.WebmcpConn,
      dataVal: socketId,
      forSessionId: sessionId,
    });
    await this.dataRepo.save(entity);
    this.logger.debug(`[webmcp] conn saved session=${sessionId} socket=${socketId}`);
  }

  /**
   * 写入或更新 Schema（webmcp_schema），同一 session 只保留最新一条
   * @keyword-en upsert-schema
   */
  async saveSchema(sessionId: string, schema: unknown): Promise<void> {
    // 软删除旧 schema 记录
    await this.dataRepo
      .createQueryBuilder()
      .update(ChatSessionDataEntity)
      .set({ isDelete: true })
      .where('for_session_id = :sessionId AND data_type = :type AND is_delete = false', {
        sessionId,
        type: SessionDataType.WebmcpSchema,
      })
      .execute();

    const entity = this.dataRepo.create({
      id: uuidv7(),
      dataType: SessionDataType.WebmcpSchema,
      dataVal: JSON.stringify(schema),
      forSessionId: sessionId,
    });
    await this.dataRepo.save(entity);
    this.logger.debug(`[webmcp] schema saved session=${sessionId}`);
  }

  /**
   * 获取最新的连接句柄
   * @keyword-en get-latest-conn
   */
  async getLatestConn(sessionId: string): Promise<string | null> {
    const row = await this.dataRepo.findOne({
      where: { forSessionId: sessionId, dataType: SessionDataType.WebmcpConn, isDelete: false },
      order: { createdAt: 'DESC' },
    });
    return row?.dataVal ?? null;
  }

  /**
   * 获取最新的 Schema
   * @keyword-en get-latest-schema
   */
  async getLatestSchema(sessionId: string): Promise<unknown | null> {
    const row = await this.dataRepo.findOne({
      where: { forSessionId: sessionId, dataType: SessionDataType.WebmcpSchema, isDelete: false },
      order: { createdAt: 'DESC' },
    });
    if (!row) return null;
    try { return JSON.parse(row.dataVal); } catch { return null; }
  }

  /**
   * 获取连接状态（是否存在活跃 conn 记录）
   * @keyword-en get-conn-status
   */
  async getConnStatus(sessionId: string): Promise<{ connected: boolean; socketId: string | null }> {
    const socketId = await this.getLatestConn(sessionId);
    return { connected: socketId !== null, socketId };
  }
}
