import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSegmentEntity } from '../entities/chat-segment.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import type {
  DayIndexResponse,
  DayMessagesResponse,
  DaySegmentsResponse,
  SegmentResponse,
  CreateSegmentRequest,
  UpdateSegmentRequest,
  DayKey,
} from '../types/segment.types';

/**
 * @title 会话分段服务
 * @description 提供按天维度的消息索引与分段的增删改查；分段仅是组合引用，不修改原始消息记录
 * @keywords-cn 分段服务, 天维度, 增删改查, 只读引用
 * @keywords-en segment-service, day-dimension, CRUD, reference-only
 */
@Injectable()
export class ConversationSegmentService {
  constructor(
    @InjectRepository(ChatSegmentEntity)
    private readonly segmentRepo: Repository<ChatSegmentEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
  ) {}

  /** 获取会话的天维度索引（当天消息条数） */
  async getDayIndex(sessionId: string): Promise<DayIndexResponse> {
    // 使用原生 SQL 进行分组统计（MySQL/SQLite/Postgres 均支持 date/strftime 变体，优先使用 DATE()）
    const rows: Array<{ day: string; count: number }> = await this.messageRepo
      .createQueryBuilder('m')
      .select('DATE(m.created_at)', 'day')
      .addSelect('COUNT(1)', 'count')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .groupBy('DATE(m.created_at)')
      .orderBy('DATE(m.created_at)', 'DESC')
      .getRawMany();

    return {
      sessionId,
      days: rows.map((r) => ({ day: r.day, count: Number(r.count) })),
    };
  }

  /** 获取指定天的消息列表（可用于前端渲染与分段选择） */
  async getDayMessages(
    sessionId: string,
    day: DayKey,
  ): Promise<DayMessagesResponse> {
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${day}T23:59:59.999Z`);
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .andWhere('m.created_at BETWEEN :start AND :end', { start, end })
      .orderBy('m.created_at', 'ASC')
      .getMany();
    return {
      sessionId,
      day,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      })),
    };
  }

  /** 列出指定天的分段 */
  async listSegments(
    sessionId: string,
    day: DayKey,
  ): Promise<DaySegmentsResponse> {
    const segments = await this.segmentRepo.find({
      where: { sessionId, day },
      order: { createdAt: 'DESC' },
    });
    return {
      sessionId,
      day,
      segments: segments.map((s) => this.toResponse(s)),
    };
  }

  /** 根据天反查当日存在消息的会话列表（含消息条数） */
  async getSessionsByDay(
    day: DayKey,
  ): Promise<import('../types/segment.types').DaySessionsResponse> {
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${day}T23:59:59.999Z`);
    const rows: Array<{ session_id: string; cnt: number }> =
      await this.messageRepo
        .createQueryBuilder('m')
        .select('m.session_id', 'session_id')
        .addSelect('COUNT(1)', 'cnt')
        .where('m.is_delete = 0')
        .andWhere('m.created_at BETWEEN :start AND :end', { start, end })
        .groupBy('m.session_id')
        .orderBy('cnt', 'DESC')
        .getRawMany();
    return {
      day,
      sessions: rows.map((r) => ({
        sessionId: r.session_id,
        count: Number(r.cnt),
      })),
    };
  }

  /** 创建分段（校验所选消息均属于该天） */
  async createSegment(
    sessionId: string,
    day: DayKey,
    payload: CreateSegmentRequest,
  ): Promise<SegmentResponse> {
    const ids = Array.isArray(payload.messageIds) ? payload.messageIds : [];
    if (!ids.length) throw new Error('messageIds 不能为空');
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${day}T23:59:59.999Z`);
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .andWhere('m.id IN (:...ids)', { ids })
      .andWhere('m.created_at BETWEEN :start AND :end', { start, end })
      .getMany();
    if (rows.length !== ids.length) {
      throw new Error('部分消息不属于该天或不存在');
    }
    const saved = await this.segmentRepo.save(
      this.segmentRepo.create({
        sessionId,
        day,
        name: payload.name,
        description: payload.description ?? null,
        messageIds: ids,
      }),
    );
    return this.toResponse(saved);
  }

  /** 更新分段（支持改名、说明与消息集合；同样校验消息归属该天） */
  async updateSegment(
    segmentId: string,
    payload: UpdateSegmentRequest,
  ): Promise<SegmentResponse> {
    const seg = await this.segmentRepo.findOne({ where: { id: segmentId } });
    if (!seg) throw new Error('分段不存在');
    let messageIds = seg.messageIds;
    if (payload.messageIds) {
      const ids = payload.messageIds;
      const start = new Date(`${seg.day}T00:00:00.000Z`);
      const end = new Date(`${seg.day}T23:59:59.999Z`);
      const rows = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: seg.sessionId })
        .andWhere('m.is_delete = 0')
        .andWhere('m.id IN (:...ids)', { ids })
        .andWhere('m.created_at BETWEEN :start AND :end', { start, end })
        .getMany();
      if (rows.length !== ids.length) {
        throw new Error('部分消息不属于该天或不存在');
      }
      messageIds = ids;
    }
    const updated = await this.segmentRepo.save({
      ...seg,
      name: payload.name ?? seg.name,
      description: payload.description ?? seg.description,
      messageIds,
    });
    return this.toResponse(updated);
  }

  /** 删除分段（软删除） */
  async deleteSegment(segmentId: string): Promise<void> {
    await this.segmentRepo.softDelete({ id: segmentId });
  }

  /** 获取分段详情 */
  async getSegment(segmentId: string): Promise<SegmentResponse | null> {
    const seg = await this.segmentRepo.findOne({ where: { id: segmentId } });
    return seg ? this.toResponse(seg) : null;
  }

  /** 跨会话：按天列出所有分段 */
  async listSegmentsByDay(day: DayKey): Promise<{
    day: DayKey;
    segments: SegmentResponse[];
  }> {
    const rows = await this.segmentRepo.find({
      where: { day },
      order: { createdAt: 'DESC' },
    });
    return { day, segments: rows.map((s) => this.toResponse(s)) };
  }

  private toResponse(seg: ChatSegmentEntity): SegmentResponse {
    return {
      id: seg.id,
      sessionId: seg.sessionId,
      day: seg.day,
      name: seg.name,
      description: seg.description ?? null,
      messageIds: seg.messageIds,
      createdAt: seg.createdAt,
      updatedAt: seg.updatedAt,
    };
  }
}
