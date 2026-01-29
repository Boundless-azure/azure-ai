import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionMemberEntity } from '@core/ai/entities/chat-session-member.entity';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import {
  ChatSessionType,
  ChatMemberRole,
  ChatMessageType,
} from '@core/ai/enums/chat.enums';
import type {
  CreateImSessionDto,
  ImSessionSummary,
  ImSessionDetail,
  ImMemberInfo,
  AddMemberDto,
  ImSessionListResponse,
  GetSessionsDto,
} from '../types/im.types';

/**
 * @title IM 会话服务
 * @description 管理 IM 会话的创建、成员管理、查询等。
 * @keywords-cn IM, 会话, 成员, 私聊, 群聊
 * @keywords-en im, session, member, private, group
 */
@Injectable()
export class ImSessionService {
  private readonly logger = new Logger(ImSessionService.name);

  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionMemberEntity)
    private readonly memberRepo: Repository<ChatSessionMemberEntity>,
    @InjectRepository(PrincipalEntity)
    private readonly principalRepo: Repository<PrincipalEntity>,
  ) {}

  /**
   * 创建会话
   * @param creatorId 创建者 principal_id
   * @param dto 创建请求
   */
  async createSession(
    creatorId: string,
    dto: CreateImSessionDto,
  ): Promise<ImSessionDetail> {
    const sessionId = randomUUID();

    // 创建会话实体
    const session = this.sessionRepo.create({
      sessionId,
      name: dto.name ?? null,
      type: dto.type,
      creatorId,
      avatarUrl: dto.avatarUrl ?? null,
      description: dto.description ?? null,
      active: true,
      isDelete: false,
    });
    await this.sessionRepo.save(session);

    // 添加创建者为 owner
    await this.addMemberInternal(session.id, creatorId, ChatMemberRole.Owner);

    // 添加其他成员
    if (dto.memberIds?.length) {
      for (const memberId of dto.memberIds) {
        await this.addMemberInternal(
          session.id,
          memberId,
          ChatMemberRole.Member,
        );
      }
    }

    return this.getSessionDetail(session.id);
  }

  /**
   * 获取用户的会话列表
   * @param principalId 用户的 principal_id
   */
  async getUserSessions(
    principalId: string,
    dto?: GetSessionsDto,
  ): Promise<ImSessionListResponse> {
    // 查询用户是成员的所有会话
    const memberships = await this.memberRepo.find({
      where: { principalId, isDelete: false },
    });
    const sessionIds = memberships.map((m) => m.sessionId);

    if (!sessionIds.length) return { items: [], cursor: null };

    const requestedLimit =
      typeof dto?.limit === 'number' && Number.isFinite(dto.limit)
        ? dto.limit
        : undefined;
    const hasCursor = typeof dto?.last_message_id === 'string';
    const limit = hasCursor
      ? Math.min(requestedLimit ?? 100, 200)
      : Math.min(requestedLimit ?? 30, 30);

    const cursorMessage = dto?.last_message_id
      ? await this.messageRepo.findOne({
          where: { id: dto.last_message_id, isDelete: false },
        })
      : null;

    const lastMessageSubquery = this.messageRepo
      .createQueryBuilder('m')
      .select('m.session_id', 'session_id')
      .addSelect('m.id', 'id')
      .addSelect('m.sender_id', 'sender_id')
      .addSelect('m.message_type', 'message_type')
      .addSelect('m.reply_to_id', 'reply_to_id')
      .addSelect('m.attachments', 'attachments')
      .addSelect('m.is_edited', 'is_edited')
      .addSelect('m.content', 'content')
      .addSelect('m.created_at', 'created_at')
      .addSelect(
        'ROW_NUMBER() OVER (PARTITION BY m.session_id ORDER BY m.created_at DESC, m.id DESC)',
        'rn',
      )
      .where('m.is_delete = false');

    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .where('s.id IN (:...ids)', { ids: sessionIds })
      .andWhere('s.is_delete = false')
      .andWhere('s.active = true')
      .leftJoin(
        `(${lastMessageSubquery.getQuery()})`,
        'lm',
        'lm.session_id = s.session_id AND lm.rn = 1',
      )
      .setParameters(lastMessageSubquery.getParameters())
      .addSelect('lm.id', 'lm_id')
      .addSelect('lm.sender_id', 'lm_sender_id')
      .addSelect('lm.message_type', 'lm_message_type')
      .addSelect('lm.reply_to_id', 'lm_reply_to_id')
      .addSelect('lm.attachments', 'lm_attachments')
      .addSelect('lm.is_edited', 'lm_is_edited')
      .addSelect('lm.content', 'lm_content')
      .addSelect('lm.created_at', 'lm_created_at')
      .orderBy('lm.created_at', 'DESC', 'NULLS LAST')
      .addOrderBy('lm.id', 'DESC')
      .limit(limit);

    if (cursorMessage) {
      qb.andWhere(
        '(lm.created_at > :cursorAt OR (lm.created_at = :cursorAt AND lm.id > :cursorId))',
        {
          cursorAt: cursorMessage.createdAt,
          cursorId: cursorMessage.id,
        },
      );
    }

    const { entities, raw } = await qb.getRawAndEntities();
    const rawList: Array<Record<string, unknown>> = Array.isArray(raw)
      ? raw
      : [];

    const sessionInternalIds = entities.map((s) => s.id);
    const allSessionMemberships = sessionInternalIds.length
      ? await this.memberRepo.find({
          where: { sessionId: In(sessionInternalIds), isDelete: false },
        })
      : [];
    const memberPrincipalIds = Array.from(
      new Set(allSessionMemberships.map((m) => m.principalId)),
    );
    const memberPrincipals = memberPrincipalIds.length
      ? await this.principalRepo
          .createQueryBuilder('p')
          .where('p.id IN (:...ids)', { ids: memberPrincipalIds })
          .getMany()
      : [];
    const principalMap = new Map(memberPrincipals.map((p) => [p.id, p]));
    const membersBySessionInternalId = new Map<string, ImMemberInfo[]>();
    for (const m of allSessionMemberships) {
      const current = membersBySessionInternalId.get(m.sessionId) ?? [];
      current.push({
        principalId: m.principalId,
        displayName: principalMap.get(m.principalId)?.displayName ?? 'Unknown',
        role: m.role,
        joinedAt: m.joinedAt,
        lastReadAt: m.lastReadAt,
      });
      membersBySessionInternalId.set(m.sessionId, current);
    }

    const membershipMap = new Map<string, ChatSessionMemberEntity>(
      memberships.map((m) => [m.sessionId + '_' + m.principalId, m]),
    );

    const results: ImSessionSummary[] = [];
    for (let idx = 0; idx < entities.length; idx++) {
      const s = entities[idx];
      const rawItem = rawList[idx];
      const lastMessageIdValue = rawItem?.['lm_id'];
      const lastMessageId =
        typeof lastMessageIdValue === 'string' ? lastMessageIdValue : null;

      const lastMessageSenderIdValue = rawItem?.['lm_sender_id'];
      const lastMessageSenderId =
        typeof lastMessageSenderIdValue === 'string'
          ? lastMessageSenderIdValue
          : null;

      const lastMessageTypeValue = rawItem?.['lm_message_type'];

      let lastMessageType: ChatMessageType | null = null;
      if (typeof lastMessageTypeValue === 'string') {
        switch (lastMessageTypeValue) {
          case 'text':
            lastMessageType = ChatMessageType.Text;
            break;
          case 'image':
            lastMessageType = ChatMessageType.Image;
            break;
          case 'file':
            lastMessageType = ChatMessageType.File;
            break;
          case 'system':
            lastMessageType = ChatMessageType.System;
            break;
        }
      }

      const lastReplyToIdValue = rawItem?.['lm_reply_to_id'];
      const lastReplyToId =
        typeof lastReplyToIdValue === 'string' ? lastReplyToIdValue : null;

      const lastIsEditedValue = rawItem?.['lm_is_edited'];
      const lastIsEdited =
        typeof lastIsEditedValue === 'boolean' ? lastIsEditedValue : false;

      const contentValue = rawItem?.['lm_content'];
      const content =
        typeof contentValue === 'string' ? contentValue : undefined;
      const createdAtValue = rawItem?.['lm_created_at'];
      const createdAt =
        createdAtValue instanceof Date
          ? createdAtValue
          : typeof createdAtValue === 'string' ||
              typeof createdAtValue === 'number'
            ? new Date(createdAtValue)
            : undefined;

      let unreadCount: number | undefined = undefined;
      const member = membershipMap.get(s.id + '_' + principalId);
      const baseCountQb = this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: s.sessionId })
        .andWhere('m.is_delete = false')
        .andWhere('(m.sender_id IS NULL OR m.sender_id <> :pid)', {
          pid: principalId,
        });
      const cursorId = dto?.last_message_id;
      if (cursorId) {
        baseCountQb.andWhere('m.id > :cursorId', { cursorId });
      }
      console.log('lastReadMessageId', member?.lastReadMessageId);
      if (member?.lastReadMessageId) {
        baseCountQb.andWhere('m.id > :readId', {
          readId: member.lastReadMessageId,
        });
      }
      console.log(baseCountQb.getSql());
      unreadCount = await baseCountQb.getCount();

      results.push({
        id: s.id,
        sessionId: s.sessionId,
        name: s.name,
        type: s.type,
        avatarUrl: s.avatarUrl,
        members: membersBySessionInternalId.get(s.id) ?? [],
        lastMessageId,
        memberLastMessageId: member?.lastReadMessageId ?? null,
        lastMessage:
          lastMessageId && createdAt
            ? {
                id: lastMessageId,
                sessionId: s.sessionId,
                senderId: lastMessageSenderId,
                messageType: lastMessageType ?? ChatMessageType.Text,
                content: typeof content === 'string' ? content : '',
                replyToId: lastReplyToId,
                attachments: null,
                isEdited: lastIsEdited,
                createdAt,
              }
            : null,
        lastMessageAt: createdAt ?? null,
        lastMessagePreview:
          typeof content === 'string' && content.length > 0
            ? content.substring(0, 100)
            : null,
        unreadCount,
        createdAt: s.createdAt,
      });
    }

    const readIds = memberships
      .map((m) => m.lastReadMessageId)
      .filter((id): id is string => typeof id === 'string' && !!id);
    const globalCursor = readIds.length
      ? readIds.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0]
      : null;

    return { items: results, cursor: globalCursor };
  }

  /**
   * 获取会话详情
   * @param sessionId 会话 UUID (id 或 sessionId)
   */
  async getSessionDetail(sessionId: string): Promise<ImSessionDetail> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const members = await this.getSessionMembers(session.id);

    const lastMessage = await this.messageRepo.findOne({
      where: { sessionId: session.sessionId, isDelete: false },
      order: { createdAt: 'DESC' },
    });

    const lastMessageContent = lastMessage?.content ?? null;
    const lastMessageAt = lastMessage?.createdAt ?? null;

    return {
      id: session.id,
      sessionId: session.sessionId,
      name: session.name,
      type: session.type,
      avatarUrl: session.avatarUrl,
      lastMessageAt,
      lastMessagePreview:
        typeof lastMessageContent === 'string' && lastMessageContent.length > 0
          ? lastMessageContent.substring(0, 100)
          : null,
      createdAt: session.createdAt,
      description: session.description,
      creatorId: session.creatorId,
      members,
    };
  }

  /**
   * 获取会话成员列表
   */
  async getSessionMembers(sessionId: string): Promise<ImMemberInfo[]> {
    const memberships = await this.memberRepo.find({
      where: { sessionId, isDelete: false },
    });

    const principalIds = memberships.map((m) => m.principalId);
    if (!principalIds.length) return [];

    const principals = await this.principalRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids: principalIds })
      .getMany();

    const principalMap = new Map(principals.map((p) => [p.id, p]));

    return memberships.map((m) => ({
      principalId: m.principalId,
      displayName: principalMap.get(m.principalId)?.displayName ?? 'Unknown',
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadAt: m.lastReadAt,
    }));
  }

  /**
   * 添加成员
   */
  async addMember(sessionId: string, dto: AddMemberDto): Promise<ImMemberInfo> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    await this.addMemberInternal(
      session.id,
      dto.principalId,
      dto.role ?? ChatMemberRole.Member,
    );

    const principal = await this.principalRepo.findOne({
      where: { id: dto.principalId },
    });

    return {
      principalId: dto.principalId,
      displayName: principal?.displayName ?? 'Unknown',
      role: dto.role ?? ChatMemberRole.Member,
      joinedAt: new Date(),
      lastReadAt: null,
    };
  }

  /**
   * 移除成员
   */
  async removeMember(sessionId: string, principalId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    await this.memberRepo.update(
      { sessionId: session.id, principalId },
      { isDelete: true },
    );
  }

  /**
   * 删除会话 (软删除)
   * @param sessionId 会话 UUID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    // 软删除会话
    await this.sessionRepo.update(session.id, {
      isDelete: true,
      active: false,
    });

    // 软删除所有成员关系
    await this.memberRepo.update({ sessionId: session.id }, { isDelete: true });

    this.logger.log(`Session deleted: ${sessionId}`);
  }

  /**
   * 检查用户是否为会话成员
   */
  async isMember(sessionId: string, principalId: string): Promise<boolean> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });
    if (!session) return false;
    const member = await this.memberRepo.findOne({
      where: { sessionId: session.id, principalId, isDelete: false },
    });
    return !!member;
  }

  /**
   * 获取私聊中的另一个成员
   */
  async getOtherMember(
    sessionId: string,
    currentPrincipalId: string,
  ): Promise<string | null> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session || session.type !== ChatSessionType.Private) {
      return null;
    }

    const members = await this.memberRepo.find({
      where: { sessionId: session.id, isDelete: false },
    });

    const other = members.find((m) => m.principalId !== currentPrincipalId);
    return other?.principalId ?? null;
  }

  /**
   * 内部方法：添加成员
   */
  private async addMemberInternal(
    sessionId: string,
    principalId: string,
    role: ChatMemberRole,
  ): Promise<void> {
    // 检查是否已存在
    const existing = await this.memberRepo.findOne({
      where: { sessionId, principalId },
    });

    if (existing) {
      if (existing.isDelete) {
        // 恢复已删除的成员
        await this.memberRepo.update(existing.id, {
          isDelete: false,
          role,
          joinedAt: new Date(),
        });
      }
      return;
    }

    const member = this.memberRepo.create({
      sessionId,
      principalId,
      role,
      joinedAt: new Date(),
      isDelete: false,
    });
    await this.memberRepo.save(member);
  }
}
