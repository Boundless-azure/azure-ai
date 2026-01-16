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
import { In, Repository, FindOptionsWhere } from 'typeorm';
import { ChatDayGroupEntity } from '@core/ai/entities/chat-day-group.entity';
import { ChatConversationGroupEntity } from '@core/ai/entities/chat-conversation-group.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { RoundSummaryEntity } from '@core/ai/entities/round-summary.entity';
import { LGCheckpointEntity } from '@core/langgraph/checkpoint/entities/lg-checkpoint.entity';
import { LGWriteEntity } from '@core/langgraph/checkpoint/entities/lg-write.entity';
import { ContextService } from '@core/ai';
import { AbilityService } from '@/app/identity/services/ability.service';
import { PluginEntity } from '@core/plugin/entities/plugin.entity';
import { ConversationService } from '../services/conversation.service';
import { MembershipEntity } from '@/app/identity/entities/membership.entity';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';

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
    @InjectRepository(PluginEntity)
    private readonly pluginRepo: Repository<PluginEntity>,
    @InjectRepository(MembershipEntity)
    private readonly membershipRepo: Repository<MembershipEntity>,
    private readonly abilityService: AbilityService,
    private readonly contextService: ContextService,
  ) {}

  /**
   * @title 列出对话组
   * @description 根据 `date`（YYYY-MM-DD）或 `dayGroupId` 进行筛选，返回匹配的对话组列表。
   * @keywords-cn 列表, 日期筛选, dayGroupId
   * @keywords-en list, filter-by-date, day-group-id
   */
  @Get()
  @CheckAbility('read', 'thread')
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
  @CheckAbility('read', 'thread')
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
  @CheckAbility('create', 'thread')
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
  @CheckAbility('update', 'thread')
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
  @CheckAbility('delete', 'thread')
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
  @CheckAbility('read', 'thread')
  async listSummariesByGroup(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ): Promise<{
    groupId: string;
    report: {
      summary: string;
      todos: Array<{ id: string; title: string; completed: boolean }>;
      plugins: Array<{ id: string; name: string; icon: string; count: number }>;
    };
  }> {
    // 1. Get Date info
    const group = await this.convGroupRepo.findOne({
      where: { id: groupId },
    });
    let dateStr = '';
    if (group && group.dayGroupId) {
      const dayGroup = await this.dayGroupRepo.findOne({
        where: { id: group.dayGroupId },
      });
      if (dayGroup) dateStr = dayGroup.date;
    }

    // 2. Get Summaries
    const sessions = await this.sessionRepo.find({
      where: { conversationGroupId: groupId, isDelete: false },
    });
    const sessionIds = sessions.map((s) => s.sessionId);

    let summaryText = '';
    if (sessionIds.length > 0) {
      const lim = limit ? Math.max(1, parseInt(limit)) : 100;
      const rows = await this.summaryRepo.find({
        where: { sessionId: In(sessionIds), isDelete: false },
        order: { createdAt: 'DESC', roundNumber: 'DESC' },
        take: lim,
      });
      // Simple concatenation for now
      summaryText = rows
        .map((r) => r.summaryContent)
        .filter((s) => s)
        .join('\n');
    }
    if (!summaryText) summaryText = '暂无对话摘要';

    // 3. Get Todos
    let todos: Array<{ id: string; title: string; completed: boolean }> = [];
    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      todos = [];
    }

    // 4. Get Plugins (Placeholder)
    const plugins: Array<{
      id: string;
      name: string;
      icon: string;
      count: number;
    }> = [];

    return {
      groupId,
      report: {
        summary: summaryText,
        todos,
        plugins,
      },
    };
  }

  /**
   * @title 获取对话组的可读历史
   * @description 基于后端持久化的消息表（由 LangGraph Checkpoint 写入），返回最近窗口的消息列表；支持包含系统消息与限制条数。
   * @keywords-cn 对话组, 历史, 窗口, 系统消息
   * @keywords-en conversation-group, history, window, system-message
   */
  @Get(':groupId/history')
  @CheckAbility('read', 'thread')
  async listGroupHistory(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
    @Query('includeSystem') includeSystem?: string,
    @Query('principalId') principalId?: string,
  ): Promise<{
    groupId: string;
    items: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>;
  }> {
    if (principalId) {
      const g = await this.convGroupRepo.findOne({
        where: { id: groupId, isDelete: false },
      });
      if (!g) {
        return { groupId, items: [] };
      }
      const ability: {
        can: (
          action: string,
          subject: string,
          ctx?: Record<string, unknown>,
        ) => boolean;
        cannot: (
          action: string,
          subject: string,
          ctx?: Record<string, unknown>,
        ) => boolean;
        rules: Array<{
          subject: string;
          action: string;
          conditions?: Record<string, unknown>;
        }>;
      } = await this.abilityService.buildForPrincipal(principalId);
      const adminLike = ability.can('read', 'thread');
      if (!adminLike) {
        const allowed = Array.isArray(g.participants)
          ? g.participants.some(
              (p) => typeof p.id === 'string' && p.id === principalId,
            )
          : false;
        if (!allowed) return { groupId, items: [] };
      }
    }
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

/**
 * @title 会话线程控制器
 * @description 提供不再以天为单位的微信式线程列表与管理：置顶AI助手、系统通知、待办通知、群组与私聊。
 * @keywords-cn 线程, 列表, 置顶, AI参与, 筛选
 * @keywords-en threads, list, pinned, ai-involved, filter
 */
@Controller('conversation/threads')
export class ConversationThreadController {
  constructor(
    @InjectRepository(ChatDayGroupEntity)
    private readonly dayGroupRepo: Repository<ChatDayGroupEntity>,
    @InjectRepository(ChatConversationGroupEntity)
    private readonly convGroupRepo: Repository<ChatConversationGroupEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    @InjectRepository(MembershipEntity)
    private readonly membershipRepo: Repository<MembershipEntity>,
    private readonly conversationService: ConversationService,
    private readonly contextService: ContextService,
    private readonly abilityService: AbilityService,
  ) {}

  /**
   * @title 线程列表
   * @description 支持按类型、是否AI参与、是否置顶与关键字搜索筛选；返回置顶优先、最近更新倒序。
   * @keywords-cn 列表, 筛选, 类型, 置顶, AI参与
   * @keywords-en list, filter, type, pinned, ai
   */
  @Get()
  @CheckAbility('read', 'thread')
  async listThreads(
    @Query('type') type?: 'assistant' | 'system' | 'todo' | 'group' | 'dm',
    @Query('ai') ai?: string,
    @Query('pinned') pinned?: string,
    @Query('q') q?: string,
    @Query('principalId') principalId?: string,
  ): Promise<
    Array<{
      id: string;
      title: string | null;
      chatClientId: string | null;
      threadType: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
      isPinned: boolean;
      isAiInvolved: boolean;
      members?: string[];
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const where: FindOptionsWhere<ChatConversationGroupEntity> = {
      isDelete: false,
    };
    if (type) where.threadType = type;
    if (ai) {
      const v = ['1', 'true', 'yes', 'on'].includes(ai.toLowerCase());
      where.isAiInvolved = v;
    }
    if (pinned) {
      const v = ['1', 'true', 'yes', 'on'].includes(pinned.toLowerCase());
      where.isPinned = v;
    }
    const rows = await this.convGroupRepo.find({
      where,
      order: { isPinned: 'DESC', updatedAt: 'DESC' },
    });

    // 权限过滤：若传入 principalId，按 AbilityService 规则进行过滤
    let filtered = rows;
    if (principalId) {
      const ability = await this.abilityService.buildForPrincipal(principalId);
      const adminLike = ability.can('read', 'thread');
      if (!adminLike) {
        filtered = rows.filter((g) => {
          if (!Array.isArray(g.participants)) return false;
          return g.participants.some(
            (p) => typeof p.id === 'string' && p.id === principalId,
          );
        });
      }
    }

    const mapped = filtered
      .filter((r) =>
        q && q.length
          ? (r.title ?? '').toLowerCase().includes(q.toLowerCase()) ||
            (r.chatClientId ?? '').toLowerCase().includes(q.toLowerCase())
          : true,
      )
      .map((g) => ({
        id: g.id,
        title: g.title,
        chatClientId: g.chatClientId,
        threadType: g.threadType,
        isPinned: g.isPinned,
        isAiInvolved: g.isAiInvolved,
        members: Array.isArray(g.participants)
          ? g.participants
              .map((p) => {
                const name = typeof p.name === 'string' ? p.name : '';
                const id = typeof p.id === 'string' ? p.id : '';
                return name || id || undefined;
              })
              .filter((x): x is string => typeof x === 'string' && x.length > 0)
          : undefined,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      }));
    return mapped;
  }

  /**
   * @title 创建线程
   * @description 不要求日期；内部自动创建当日 dayGroup 以兼容旧结构。
   * @keywords-cn 创建, 线程, 兼容
   * @keywords-en create, thread, compatible
   */
  @Post()
  @CheckAbility('create', 'thread')
  async createThread(
    @Body()
    payload: {
      title?: string | null;
      chatClientId?: string | null;
      threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
      isPinned?: boolean;
      isAiInvolved?: boolean;
    },
  ): Promise<{ id: string }> {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dg = await this.dayGroupRepo.findOne({
      where: { date, isDelete: false },
    });
    const dayGroupId = dg
      ? dg.id
      : (
          await this.dayGroupRepo.save(
            this.dayGroupRepo.create({ date, title: null, isDelete: false }),
          )
        ).id;
    const saved = await this.contextService.createConversationGroup(
      dayGroupId,
      payload.chatClientId ?? undefined,
      'system',
      undefined,
      payload.threadType ?? 'group',
      payload.isAiInvolved ?? payload.threadType === 'assistant',
    );
    if (typeof payload.title === 'string') {
      await this.contextService.updateConversationGroupTitle(
        saved.id,
        payload.title,
      );
    }
    if (payload.isPinned !== undefined) {
      await this.convGroupRepo.update(
        { id: saved.id },
        { isPinned: !!payload.isPinned },
      );
    }
    return { id: saved.id };
  }

  /**
   * @title 更新线程
   * @description 可更新标题、置顶、AI参与、类型与激活态。
   * @keywords-cn 更新, 标题, 置顶, AI参与, 类型
   * @keywords-en update, title, pinned, ai, type
   */
  @Put(':threadId')
  @CheckAbility('update', 'thread')
  async updateThread(
    @Param('threadId') threadId: string,
    @Body()
    payload: {
      title?: string | null;
      isPinned?: boolean;
      isAiInvolved?: boolean;
      threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
      active?: boolean;
      participants?: Array<{ id: string; name?: string }> | string[];
    },
  ): Promise<{ success: true }> {
    const update: Partial<ChatConversationGroupEntity> = {};
    if (payload.title !== undefined) update.title = payload.title;
    if (payload.isPinned !== undefined) update.isPinned = !!payload.isPinned;
    if (payload.isAiInvolved !== undefined)
      update.isAiInvolved = !!payload.isAiInvolved;
    if (payload.threadType !== undefined)
      update.threadType = payload.threadType;
    if (payload.active !== undefined) update.active = !!payload.active;
    if (payload.participants !== undefined) {
      const src = payload.participants;
      const normalized: Array<{
        id: string;
        name?: string;
        principalType?:
          | 'user_enterprise'
          | 'user_consumer'
          | 'official_account'
          | 'agent'
          | 'system';
        tenantId?: string;
      }> = Array.isArray(src)
        ? src.map(
            (
              v,
            ): {
              id: string;
              name?: string;
              principalType?:
                | 'user_enterprise'
                | 'user_consumer'
                | 'official_account'
                | 'agent'
                | 'system';
              tenantId?: string;
            } => {
              if (typeof v === 'string') {
                return { id: v, name: v };
              }
              if (typeof v === 'object' && v !== null) {
                const obj = v as {
                  id?: unknown;
                  name?: unknown;
                  principalType?: unknown;
                  tenantId?: unknown;
                };
                const idVal = obj.id;
                const nameVal = obj.name;
                const ptVal = obj.principalType;
                const tnVal = obj.tenantId;
                const id =
                  typeof idVal === 'string'
                    ? idVal
                    : typeof nameVal === 'string'
                      ? nameVal
                      : '';
                const name = typeof nameVal === 'string' ? nameVal : id;
                const principalType =
                  typeof ptVal === 'string' ? (ptVal as any) : undefined;
                const tenantId = typeof tnVal === 'string' ? tnVal : undefined;
                return { id, name, principalType, tenantId };
              }
              const s = String(v ?? '');
              return { id: s, name: s };
            },
          )
        : [];
      update.participants = normalized;
    }
    await this.convGroupRepo.update({ id: threadId }, update);
    return { success: true };
  }

  /**
   * @title 在线程内发送消息
   * @description 向指定线程（对话组）发送一条用户消息：若不存在会话则创建并绑定到该组，随后调用对话服务返回助手回复。
   * @keywords-cn 线程消息, 发送消息, 会话复用, 组绑定, AI回复
   * @keywords-en thread-message, send, session-reuse, group-link, ai-reply
   */
  @Post(':threadId/messages')
  @CheckAbility('read', 'thread')
  async postThreadMessage(
    @Param('threadId') threadId: string,
    @Body()
    payload: {
      content: string;
      sessionId?: string;
      modelId?: string;
      systemPrompt?: string;
      chatClientId?: string;
      principalId?: string;
    },
  ): Promise<{
    sessionId: string;
    message: string;
    model: string;
    tokensUsed?: { prompt: number; completion: number; total: number };
  }> {
    if (payload.principalId) {
      const g0 = await this.convGroupRepo.findOne({
        where: { id: threadId, isDelete: false },
      });
      if (!g0) throw new Error('Thread not found');
      const ability = await this.abilityService.buildForPrincipal(
        payload.principalId,
      );
      const adminLike = ability.can('read', 'thread');
      if (!adminLike) {
        const allowed = Array.isArray(g0.participants)
          ? g0.participants.some(
              (p) => typeof p.id === 'string' && p.id === payload.principalId,
            )
          : false;
        if (!allowed) throw new Error('Permission denied');
      }
    }
    const group = await this.convGroupRepo.findOne({
      where: { id: threadId, isDelete: false },
    });
    if (!group) {
      throw new Error('Thread not found');
    }

    let sessionId = payload.sessionId;
    if (sessionId) {
      const existing = await this.sessionRepo.findOne({
        where: { sessionId, isDelete: false },
      });
      if (!existing) {
        const ctx = await this.contextService.createContext(
          sessionId,
          payload.systemPrompt,
          'system',
        );
        sessionId = ctx.sessionId;
      }
      const boundGroupId =
        await this.contextService.getConversationGroupIdForSession(sessionId);
      if (!boundGroupId) {
        await this.contextService.linkSessionToGroup(sessionId, threadId);
      }
    } else {
      const latest = await this.sessionRepo.findOne({
        where: { conversationGroupId: threadId, active: true, isDelete: false },
        order: { updatedAt: 'DESC' },
      });
      if (latest) {
        sessionId = latest.sessionId;
      } else {
        const ctx = await this.contextService.createContext(
          undefined,
          payload.systemPrompt,
          'system',
        );
        sessionId = ctx.sessionId;
        await this.contextService.linkSessionToGroup(sessionId, threadId);
      }
    }

    const chatReq = {
      message: payload.content,
      sessionId,
      modelId: payload.modelId,
      systemPrompt: payload.systemPrompt,
      chatClientId: payload.chatClientId ?? group.chatClientId ?? '',
    } as const;

    return await this.conversationService.chat(chatReq);
  }
}
