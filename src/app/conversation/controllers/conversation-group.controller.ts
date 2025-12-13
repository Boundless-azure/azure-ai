import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatDayGroupEntity } from '@core/ai/entities/chat-day-group.entity';
import { ChatConversationGroupEntity } from '@core/ai/entities/chat-conversation-group.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { RoundSummaryEntity } from '@core/ai/entities/round-summary.entity';
import { LGCheckpointEntity } from '@core/langgraph/checkpoint/entities/lg-checkpoint.entity';
import { LGWriteEntity } from '@core/langgraph/checkpoint/entities/lg-write.entity';
import { ContextService } from '@core/ai';

/**
 * @title 会话对话组控制器
 * @description 提供对话组的增删改查，以及根据组ID获取 `summary_table` 摘要。
 * @keywords-cn 对话组, 增删改查, 日期筛选, 摘要, summary_table
 * @keywords-en conversation-group, CRUD, date-filter, summaries, summary_table
 */
@Controller('conversation/groups')
export class ConversationGroupController {
  constructor(
    @InjectRepository(ChatDayGroupEntity)
    private readonly dayGroupRepo: Repository<ChatDayGroupEntity>,
    @InjectRepository(ChatConversationGroupEntity)
    private readonly convGroupRepo: Repository<ChatConversationGroupEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    @InjectRepository(RoundSummaryEntity)
    private readonly summaryRepo: Repository<RoundSummaryEntity>,
    @InjectRepository(LGCheckpointEntity)
    private readonly lgCheckpointRepo: Repository<LGCheckpointEntity>,
    @InjectRepository(LGWriteEntity)
    private readonly lgWriteRepo: Repository<LGWriteEntity>,
    private readonly contextService: ContextService,
  ) {}

  /**
   * @title 列出对话组
   * @description 根据 `date`（YYYY-MM-DD）或 `dayGroupId` 进行筛选，返回匹配的对话组列表。
   * @keywords-cn 列表, 日期筛选, dayGroupId
   * @keywords-en list, filter-by-date, day-group-id
   */
  @Get()
  async listGroups(
    @Query('date') date?: string,
    @Query('dayGroupId') dayGroupId?: string,
  ): Promise<
    Array<{
      id: string;
      dayGroupId: string;
      title: string | null;
      chatClientId: string | null;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    let dgId = dayGroupId;
    if (!dgId && date) {
      const dg = await this.dayGroupRepo.findOne({
        where: { date, isDelete: false },
      });
      dgId = dg?.id;
    }
    const where = dgId
      ? { dayGroupId: dgId, isDelete: false }
      : { isDelete: false };
    const rows = await this.convGroupRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return rows.map((g) => ({
      id: g.id,
      dayGroupId: g.dayGroupId,
      title: g.title,
      chatClientId: g.chatClientId,
      active: g.active,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }));
  }

  /**
   * @title 获取对话组详情
   * @description 返回单个对话组的基础信息与会话数量。
   * @keywords-cn 详情, 会话数量
   * @keywords-en detail, session-count
   */
  @Get(':groupId')
  async getGroup(@Param('groupId') groupId: string): Promise<{
    id: string;
    dayGroupId: string;
    title: string | null;
    chatClientId: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    sessionCount: number;
  } | null> {
    const g = await this.convGroupRepo.findOne({
      where: { id: groupId, isDelete: false },
    });
    if (!g) return null;
    const sessionCount = await this.sessionRepo.count({
      where: { conversationGroupId: groupId, isDelete: false },
    });
    return {
      id: g.id,
      dayGroupId: g.dayGroupId,
      title: g.title,
      chatClientId: g.chatClientId,
      active: g.active,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      sessionCount,
    };
  }

  /**
   * @title 创建对话组
   * @description 传入 `date` 或 `dayGroupId` 创建对话组；可选 `title` 和 `chatClientId`。
   * @keywords-cn 创建, 对话组, 日期
   * @keywords-en create, conversation-group, date
   */
  @Post()
  async createGroup(
    @Body()
    payload: {
      date?: string;
      dayGroupId?: string;
      title?: string | null;
      chatClientId?: string | null;
    },
  ): Promise<{ id: string; dayGroupId: string }> {
    let dgId = payload.dayGroupId ?? '';
    if (!dgId && payload.date) {
      const dg = await this.dayGroupRepo.findOne({
        where: { date: payload.date, isDelete: false },
      });
      if (dg) dgId = dg.id;
      else {
        const created = await this.dayGroupRepo.save(
          this.dayGroupRepo.create({
            date: payload.date,
            title: null,
            isDelete: false,
          }),
        );
        dgId = created.id;
      }
    }
    if (!dgId) {
      throw new Error('Either date or dayGroupId must be provided');
    }
    const entity = this.convGroupRepo.create({
      dayGroupId: dgId,
      title: payload.title ?? null,
      chatClientId: payload.chatClientId ?? null,
      active: true,
      isDelete: false,
    });
    const saved = await this.convGroupRepo.save(entity);
    return { id: saved.id, dayGroupId: saved.dayGroupId };
  }

  /**
   * @title 更新对话组
   * @description 可更新 `title`、`active`、`chatClientId`。
   * @keywords-cn 更新, 标题, 激活, 客户端
   * @keywords-en update, title, active, client
   */
  @Put(':groupId')
  async updateGroup(
    @Param('groupId') groupId: string,
    @Body()
    payload: {
      title?: string | null;
      active?: boolean;
      chatClientId?: string | null;
    },
  ): Promise<{ success: true }> {
    const update: Partial<ChatConversationGroupEntity> = {};
    if (payload.title !== undefined) update.title = payload.title;
    if (payload.active !== undefined) update.active = payload.active;
    if (payload.chatClientId !== undefined)
      update.chatClientId = payload.chatClientId;
    await this.convGroupRepo.update({ id: groupId }, update);
    return { success: true };
  }

  /**
   * @title 删除对话组
   * @description 软删除：标记 `is_delete` 并设置 `deleted_at`。
   * @keywords-cn 删除, 软删除
   * @keywords-en delete, soft-delete
   */
  @Delete(':groupId')
  async deleteGroup(
    @Param('groupId') groupId: string,
  ): Promise<{ success: true }> {
    await this.convGroupRepo.update({ id: groupId }, { isDelete: true });
    await this.convGroupRepo.softDelete({ id: groupId });
    return { success: true };
  }

  /**
   * @title 获取组对应的摘要信息
   * @description 根据组内的会话ID在 `summary_table` 中查询最近摘要；支持 `limit`。
   * @keywords-cn 摘要, 组摘要, summary_table
   * @keywords-en summaries, group-summaries, summary_table
   */
  @Get(':groupId/summaries')
  async listSummariesByGroup(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ): Promise<{
    groupId: string;
    items: Array<{
      sessionId: string;
      roundNumber: number;
      summaryContent: string;
      createdAt: string;
    }>;
  }> {
    const sessions = await this.sessionRepo.find({
      where: { conversationGroupId: groupId, isDelete: false },
    });
    const sessionIds = sessions.map((s) => s.sessionId);
    if (sessionIds.length === 0) return { groupId, items: [] };
    const lim = limit ? Math.max(1, parseInt(limit)) : 100;
    const rows = await this.summaryRepo.find({
      where: { sessionId: In(sessionIds), isDelete: false },
      order: { createdAt: 'DESC', roundNumber: 'DESC' },
      take: lim,
    });
    const items = rows.map((r) => ({
      sessionId: r.sessionId,
      roundNumber: r.roundNumber,
      summaryContent: r.summaryContent,
      createdAt: r.createdAt.toISOString(),
    }));
    return { groupId, items };
  }

  /**
   * @title 获取对话组的可读历史
   * @description 基于后端持久化的消息表（由 LangGraph Checkpoint 写入），返回最近窗口的消息列表；支持包含系统消息与限制条数。
   * @keywords-cn 对话组, 历史, 窗口, 系统消息
   * @keywords-en conversation-group, history, window, system-message
   */
  @Get(':groupId/history')
  async listGroupHistory(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
    @Query('includeSystem') includeSystem?: string,
  ): Promise<{
    groupId: string;
    items: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>;
  }> {
    const n = limit ? Math.max(1, parseInt(limit)) : 100;
    const allowSys = includeSystem
      ? ['1', 'true', 'yes', 'on'].includes(includeSystem.toLowerCase())
      : true;
    const items: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }> = [];
    const takeCount = Math.max(n * 4, 200);
    const rows = await this.lgCheckpointRepo.find({
      where: {
        threadId: groupId,
        checkpointNs: In(['default', '']),
        isDelete: false,
      },
      order: { createdAt: 'ASC' },
      take: takeCount,
    });
    for (const row of rows) {
      const ck = JSON.parse(row.checkpointJson) as { ts?: string };
      const ckTs =
        typeof ck.ts === 'string' && ck.ts.length > 0
          ? ck.ts
          : new Date().toISOString();
      const writes = await this.lgWriteRepo.find({
        where: {
          threadId: groupId,
          checkpointNs: In(['default', '']),
          checkpointId: row.checkpointId,
          isDelete: false,
        },
        order: { idx: 'ASC' },
      });
      for (const w of writes) {
        const channel = String(w.channel ?? '');
        const lower = channel.toLowerCase();
        const value = this.decodeWrite(w.valueType, w.valueB64);
        if (Array.isArray(value) && value.length > 0) {
          for (const el of value as Array<unknown>) {
            const obj =
              typeof el === 'object' && el
                ? (el as Record<string, unknown>)
                : undefined;
            if (!obj) continue;
            const idArr = obj['id'];
            const typeStr = obj['type'] as string | undefined;
            const kwargs = obj['kwargs'] as Record<string, unknown> | undefined;
            const lastId =
              Array.isArray(idArr) && idArr.length > 0
                ? String(idArr[idArr.length - 1])
                : undefined;
            const kwcAny = kwargs?.['content'];
            let content: string | undefined = undefined;
            if (typeof kwcAny === 'string') {
              content = kwcAny;
            } else if (Array.isArray(kwcAny)) {
              const parts: string[] = [];
              for (const p of kwcAny) {
                if (typeof p === 'string') {
                  parts.push(p);
                } else if (typeof p === 'object' && p) {
                  const r = p as Record<string, unknown>;
                  const t = r['text'];
                  const c = r['content'];
                  if (typeof t === 'string') parts.push(t);
                  else if (typeof c === 'string') parts.push(c);
                }
              }
              if (parts.length > 0) content = parts.join('');
            }
            let role: 'system' | 'user' | 'assistant' | undefined = undefined;
            if (typeStr === 'constructor' && lastId) {
              if (lastId === 'HumanMessage') role = 'user';
              else if (lastId === 'AIMessage' || lastId === 'AIMessageChunk')
                role = 'assistant';
              else if (lastId === 'SystemMessage') role = 'system';
            }
            if (role && typeof content === 'string' && content.length > 0) {
              if (role === 'system' && !allowSys) continue;
              items.push({
                role,
                content,
                timestamp: ckTs,
                metadata: { channel },
              });
            }
          }
          continue;
        }
        if (
          lower === 'tool' ||
          lower === 'tools' ||
          lower.startsWith('tool_') ||
          lower.includes('function')
        ) {
          const obj =
            typeof value === 'object' && value
              ? (value as Record<string, unknown>)
              : undefined;
          const output = obj
            ? (obj['output'] as string | undefined) ||
              (obj['result'] as string | undefined)
            : undefined;
          const isEnd =
            lower.endsWith('tool_end') ||
            lower.includes('tool_end') ||
            lower.includes('tool_result');
          if (isEnd && typeof output === 'string' && output.trim().length > 0) {
            items.push({
              role: 'assistant',
              content: output,
              timestamp: ckTs,
              metadata: { channel },
            });
          }
          continue;
        }
        if (typeof value === 'object' && value) {
          const obj = value as Record<string, unknown>;
          const tRole =
            (obj['role'] as string | undefined) ||
            (obj['type'] as string | undefined)?.toLowerCase();
          const content =
            (obj['content'] as string | undefined) ||
            (obj['text'] as string | undefined) ||
            (obj['message'] as string | undefined);
          let role: 'system' | 'user' | 'assistant' | undefined = undefined;
          if (tRole === 'human') role = 'user';
          else if (tRole === 'ai') role = 'assistant';
          else if (tRole === 'system') role = 'system';
          else if (tRole === 'user' || tRole === 'assistant') role = tRole;
          if (role && typeof content === 'string' && content.length > 0) {
            if (role === 'system' && !allowSys) continue;
            items.push({
              role,
              content,
              timestamp: ckTs,
              metadata: { channel },
            });
          }
          continue;
        }
        if (typeof value === 'string' && value.length > 0) {
          const roleGuess: 'system' | 'user' | 'assistant' =
            lower.includes('user') || lower.includes('input')
              ? 'user'
              : lower.includes('system')
                ? 'system'
                : 'assistant';
          if (roleGuess === 'system' && !allowSys) continue;
          items.push({
            role: roleGuess,
            content: value,
            timestamp: ckTs,
            metadata: { channel },
          });
          continue;
        }
      }
      if (items.length >= n) break;
    }
    return { groupId, items: items.slice(-n) };
  }

  private decodeWrite(t: string, b64: string): unknown {
    if (t === 'json') {
      const str = Buffer.from(b64, 'base64').toString('utf8');
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    }
    return Buffer.from(b64, 'base64');
  }
}
