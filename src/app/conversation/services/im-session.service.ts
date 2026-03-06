import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionMemberEntity } from '@core/ai/entities/chat-session-member.entity';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import { UserEntity } from '@/app/identity/entities/user.entity';
import { PrincipalType } from '@/app/identity/enums/principal.enums';
import {
  ChatSessionType,
  ChatMemberRole,
  ChatMessageType,
} from '@core/ai/enums/chat.enums';
import { InviteMembersDto } from '../types/im.types';
import type {
  CreateImSessionDto,
  UpdateImSessionDto,
  ImSessionSummary,
  ImSessionDetail,
  ImMemberInfo,
  AddMemberDto,
  InviteMembersResponse,
  ImSessionListResponse,
  GetSessionsDto,
} from '../types/im.types';
import { ImMessageService } from './im-message.service';

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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Inject(forwardRef(() => ImMessageService))
    private readonly imMessageService: ImMessageService,
  ) {}

  private resolveAvatarUrl(args: {
    principal: PrincipalEntity | undefined;
    user: UserEntity | undefined;
    defaultAvatarUrl: string;
  }): string | null {
    const isAgent = args.principal?.principalType === PrincipalType.Agent;

    const principalAvatar =
      typeof args.principal?.avatarUrl === 'string'
        ? args.principal.avatarUrl.trim()
        : '';
    if (principalAvatar) return principalAvatar;

    const userAvatar =
      typeof args.user?.avatarUrl === 'string'
        ? args.user.avatarUrl.trim()
        : '';
    if (userAvatar) return userAvatar;

    if (isAgent) return null;
    return args.defaultAvatarUrl;
  }

  /**
   * 创建会话
   * @param creatorId 创建者 principal_id
   * @param dto 创建请求
   */
  async createSession(
    creatorId: string,
    dto: CreateImSessionDto,
  ): Promise<ImSessionDetail> {
    if (dto.type === ChatSessionType.Private) {
      const ids = Array.isArray(dto.memberIds) ? dto.memberIds : [];
      const normalized = Array.from(
        new Set(
          ids
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
            .filter((x) => x !== creatorId),
        ),
      );

      if (normalized.length !== 1) {
        throw new BadRequestException(
          'Private session requires exactly 1 peer',
        );
      }

      const peerId = normalized[0];
      const reused = await this.findReusablePrivateSession(creatorId, peerId);
      if (reused) {
        return this.getSessionDetail(reused.id);
      }
    }

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

  private async findReusablePrivateSession(
    aId: string,
    bId: string,
  ): Promise<ChatSessionEntity | null> {
    const rows = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.session_id', 'session_id')
      .where('m.is_delete = false')
      .groupBy('m.session_id')
      .having('COUNT(*) = 2')
      .andHaving('SUM(CASE WHEN m.principal_id = :aId THEN 1 ELSE 0 END) = 1', {
        aId,
      })
      .andHaving('SUM(CASE WHEN m.principal_id = :bId THEN 1 ELSE 0 END) = 1', {
        bId,
      })
      .getRawMany<{ session_id?: string }>();

    const internalIds = rows
      .map((r) => (typeof r.session_id === 'string' ? r.session_id : ''))
      .filter((x) => x.length > 0);

    if (!internalIds.length) return null;

    return (
      (await this.sessionRepo
        .createQueryBuilder('s')
        .where('s.id IN (:...ids)', { ids: internalIds })
        .andWhere('s.is_delete = false')
        .andWhere('s.active = true')
        .andWhere('s.type = :t', { t: ChatSessionType.Private })
        .orderBy('s.updated_at', 'DESC')
        .getOne()) ?? null
    );
  }

  /**
   * 获取用户的会话列表
   * @param principalId 用户的 principal_id
   */
  async getUserSessions(
    principalId: string,
    dto?: GetSessionsDto,
  ): Promise<ImSessionListResponse> {
    const defaultAvatarUrl = '/static/system/avatars/default.svg';
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
      .addSelect('m.is_announcement', 'is_announcement')
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
      .addSelect('lm.is_announcement', 'lm_is_announcement')
      .addSelect('lm.content', 'lm_content')
      .addSelect('lm.created_at', 'lm_created_at')
      .orderBy('lm.created_at', 'DESC', 'NULLS LAST')
      .addOrderBy('lm.id', 'DESC')
      .limit(limit);

    if (cursorMessage) {
      qb.andWhere(
        '((lm.created_at > :cursorAt OR (lm.created_at = :cursorAt AND lm.id > :cursorId)) OR (lm.id IS NULL AND s.created_at > :cursorAt))',
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

    const pageLastMessageIds = rawList
      .map((r) => r?.['lm_id'])
      .filter((id): id is string => typeof id === 'string' && !!id);

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

    const userRows = memberPrincipalIds.length
      ? await this.userRepo.find({
          where: { principalId: In(memberPrincipalIds), isDelete: false },
        })
      : [];
    const userMap = new Map(userRows.map((u) => [u.principalId, u]));

    const membersBySessionInternalId = new Map<string, ImMemberInfo[]>();
    for (const m of allSessionMemberships) {
      const current = membersBySessionInternalId.get(m.sessionId) ?? [];
      const principal = principalMap.get(m.principalId);
      const user = userMap.get(m.principalId);
      current.push({
        principalId: m.principalId,
        displayName: principal?.displayName ?? 'Unknown',
        avatarUrl: this.resolveAvatarUrl({
          principal,
          user,
          defaultAvatarUrl,
        }),
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

      const members = membersBySessionInternalId.get(s.id) ?? [];

      let resolvedName: string | null = s.name;
      let resolvedAvatarUrl: string | null = s.avatarUrl;
      if (s.type === ChatSessionType.Private) {
        const other = members.find((m) => m.principalId !== principalId);
        const otherName = other?.displayName;
        const otherAvatar = other?.avatarUrl;
        const otherPrincipal = other?.principalId
          ? principalMap.get(other.principalId)
          : undefined;
        const isOtherAgent =
          otherPrincipal?.principalType === PrincipalType.Agent;
        const nameTrimmed =
          typeof resolvedName === 'string' ? resolvedName.trim() : '';
        if (!nameTrimmed && typeof otherName === 'string' && otherName.trim()) {
          resolvedName = otherName;
        }
        const avatarTrimmed =
          typeof resolvedAvatarUrl === 'string' ? resolvedAvatarUrl.trim() : '';
        if (
          !avatarTrimmed &&
          typeof otherAvatar === 'string' &&
          otherAvatar.trim()
        ) {
          resolvedAvatarUrl = otherAvatar;
        }
        if (!resolvedAvatarUrl || !resolvedAvatarUrl.trim()) {
          resolvedAvatarUrl = isOtherAgent ? null : defaultAvatarUrl;
        }
      }
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

      const lastIsAnnouncementValue = rawItem?.['lm_is_announcement'];
      const lastIsAnnouncement =
        typeof lastIsAnnouncementValue === 'boolean'
          ? lastIsAnnouncementValue
          : typeof lastIsAnnouncementValue === 'number'
            ? lastIsAnnouncementValue !== 0
            : lastIsAnnouncementValue === 't';

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
      if (member?.lastReadMessageId) {
        baseCountQb.andWhere('m.id > :readId', {
          readId: member.lastReadMessageId,
        });
      }
      unreadCount = await baseCountQb.getCount();

      results.push({
        id: s.id,
        sessionId: s.sessionId,
        name: resolvedName,
        type: s.type,
        avatarUrl: resolvedAvatarUrl,
        members,
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
                isAnnouncement: lastIsAnnouncement,
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

    const globalCursor = pageLastMessageIds.length
      ? pageLastMessageIds.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0]
      : (dto?.last_message_id ?? null);

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
    const defaultAvatarUrl = '/static/system/avatars/default.svg';
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) return [];

    const memberships = await this.memberRepo.find({
      where: { sessionId: session.id, isDelete: false },
    });

    const principalIds = memberships.map((m) => m.principalId);
    if (!principalIds.length) return [];

    const principals = await this.principalRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids: principalIds })
      .getMany();

    const principalMap = new Map(principals.map((p) => [p.id, p]));

    const userRows = await this.userRepo.find({
      where: { principalId: In(principalIds), isDelete: false },
    });
    const userMap = new Map(userRows.map((u) => [u.principalId, u]));

    return memberships.map((m) => ({
      principalId: m.principalId,
      displayName: principalMap.get(m.principalId)?.displayName ?? 'Unknown',
      avatarUrl: this.resolveAvatarUrl({
        principal: principalMap.get(m.principalId),
        user: userMap.get(m.principalId),
        defaultAvatarUrl,
      }),
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
    const user = await this.userRepo.findOne({
      where: { principalId: dto.principalId, isDelete: false },
    });
    const defaultAvatarUrl = '/static/system/avatars/default.svg';

    return {
      principalId: dto.principalId,
      displayName: principal?.displayName ?? 'Unknown',
      avatarUrl: this.resolveAvatarUrl({
        principal: principal ?? undefined,
        user: user ?? undefined,
        defaultAvatarUrl,
      }),
      role: dto.role ?? ChatMemberRole.Member,
      joinedAt: new Date(),
      lastReadAt: null,
    };
  }

  /**
   * 移除成员
   */
  async removeMember(sessionId: string, principalId: string): Promise<void> {
    await this.memberRepo.update(
      { sessionId, principalId },
      { isDelete: true },
    );
  }

  /**
   * 确认当前用户是群主
   */
  async ensureOwner(
    sessionInternalId: string,
    principalId: string,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionInternalId, isDelete: false },
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionInternalId}`);
    }

    const membership = await this.requireMembership(
      sessionInternalId,
      principalId,
    );
    const ok =
      membership.role === ChatMemberRole.Owner ||
      session.creatorId === principalId;
    if (!ok) {
      throw new ForbiddenException('Only owner can perform this action');
    }
  }

  /**
   * 更新会话信息（群名等）
   */
  async updateSession(
    sessionId: string,
    principalId: string,
    dto: UpdateImSessionDto,
  ): Promise<ImSessionDetail> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false, active: true },
        { sessionId, isDelete: false, active: true },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    await this.requireMembership(session.id, principalId);

    const nextName = typeof dto.name === 'string' ? dto.name.trim() : undefined;
    const nameChanged =
      typeof nextName === 'string' && nextName !== (session.name ?? '');

    if (
      nameChanged &&
      (session.type === ChatSessionType.Group ||
        session.type === ChatSessionType.Channel)
    ) {
      await this.ensureOwner(session.id, principalId);
    }

    const updatePayload: Partial<ChatSessionEntity> = {};
    if (typeof nextName === 'string') {
      updatePayload.name = nextName.length ? nextName : null;
    }
    if (typeof dto.description === 'string') {
      const d = dto.description.trim();
      updatePayload.description = d.length ? d : null;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.sessionRepo.update(session.id, updatePayload);
    }

    return this.getSessionDetail(session.id);
  }

  /**
   * 群主踢人（不删除历史消息，仅移除成员关系）
   */
  async kickMember(args: {
    sessionId: string;
    operatorId: string;
    targetPrincipalId: string;
  }): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: args.sessionId, isDelete: false, active: true },
        { sessionId: args.sessionId, isDelete: false, active: true },
      ],
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${args.sessionId}`);
    }

    if (session.type !== ChatSessionType.Group) {
      throw new BadRequestException('Kick is only supported in group');
    }

    await this.ensureOwner(session.id, args.operatorId);

    if (args.targetPrincipalId === args.operatorId) {
      throw new BadRequestException('Owner cannot kick self');
    }

    const targetMembership = await this.memberRepo.findOne({
      where: {
        sessionId: session.id,
        principalId: args.targetPrincipalId,
        isDelete: false,
      },
    });
    if (!targetMembership) {
      throw new NotFoundException('Target is not a member of this session');
    }
    if (targetMembership.role === ChatMemberRole.Owner) {
      throw new BadRequestException('Cannot kick owner');
    }

    await this.memberRepo.update(targetMembership.id, { isDelete: true });

    const principal = await this.principalRepo.findOne({
      where: { id: args.targetPrincipalId },
    });
    const displayName = principal?.displayName ?? '成员';

    await this.imMessageService.sendMessage(
      args.operatorId,
      {
        sessionId: session.sessionId,
        content: `已将 ${displayName} 移出群聊`,
        messageType: ChatMessageType.System,
      },
      { role: 'system', skipAgentTrigger: true },
    );
  }

  /**
   * 转移群主
   */
  async transferOwner(args: {
    sessionId: string;
    operatorId: string;
    newOwnerPrincipalId: string;
  }): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: args.sessionId, isDelete: false, active: true },
        { sessionId: args.sessionId, isDelete: false, active: true },
      ],
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${args.sessionId}`);
    }

    if (session.type !== ChatSessionType.Group) {
      throw new BadRequestException(
        'Transfer owner is only supported in group',
      );
    }

    await this.ensureOwner(session.id, args.operatorId);

    if (args.newOwnerPrincipalId === args.operatorId) return;

    const newOwnerMembership = await this.memberRepo.findOne({
      where: {
        sessionId: session.id,
        principalId: args.newOwnerPrincipalId,
        isDelete: false,
      },
    });
    if (!newOwnerMembership) {
      throw new NotFoundException('New owner is not a member of this session');
    }

    const memberships = await this.memberRepo.find({
      where: { sessionId: session.id, isDelete: false },
    });
    const ownerMembership = memberships.find(
      (m) =>
        m.role === ChatMemberRole.Owner || m.principalId === session.creatorId,
    );
    if (
      ownerMembership &&
      ownerMembership.principalId !== args.newOwnerPrincipalId
    ) {
      await this.memberRepo.update(ownerMembership.id, {
        role: ChatMemberRole.Member,
      });
    }
    await this.memberRepo.update(newOwnerMembership.id, {
      role: ChatMemberRole.Owner,
    });
    await this.sessionRepo.update(session.id, {
      creatorId: args.newOwnerPrincipalId,
    });

    const principal = await this.principalRepo.findOne({
      where: { id: args.newOwnerPrincipalId },
    });
    const displayName = principal?.displayName ?? '成员';

    await this.imMessageService.sendMessage(
      args.operatorId,
      {
        sessionId: session.sessionId,
        content: `群主已转让给 ${displayName}`,
        messageType: ChatMessageType.System,
      },
      { role: 'system', skipAgentTrigger: true },
    );
  }

  /**
   * 删除会话 (软删除)
   * @param sessionId 会话 UUID
   * @param principalId 操作人 principal_id
   */
  async deleteSession(sessionId: string, principalId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    if (session.type === ChatSessionType.Private) {
      throw new BadRequestException('Private session cannot be deleted');
    }

    const membership = await this.memberRepo.findOne({
      where: { sessionId: session.id, principalId, isDelete: false },
    });

    if (session.type === ChatSessionType.Group) {
      await this.ensureOwner(session.id, principalId);
    } else {
      const isPrivileged =
        session.creatorId === principalId ||
        membership?.role === ChatMemberRole.Owner ||
        membership?.role === ChatMemberRole.Admin;
      if (!isPrivileged) {
        throw new ForbiddenException('Not allowed to delete this session');
      }
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
   * 退出会话（对群聊/频道：软删除成员关系；对私聊：仅允许前端本地隐藏）
   */
  async leaveSession(sessionId: string, principalId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    if (session.type === ChatSessionType.Private) {
      return;
    }

    const membership = await this.memberRepo.findOne({
      where: { sessionId: session.id, principalId, isDelete: false },
    });
    if (!membership) {
      return;
    }

    const isOwner =
      membership.role === ChatMemberRole.Owner ||
      session.creatorId === principalId;

    if (isOwner && session.type === ChatSessionType.Group) {
      const remain = await this.memberRepo.find({
        where: { sessionId: session.id, isDelete: false },
      });
      const candidates = remain
        .filter((m) => m.principalId !== principalId)
        .sort((a, b) => {
          const at = a.joinedAt?.getTime() ?? 0;
          const bt = b.joinedAt?.getTime() ?? 0;
          return at - bt;
        });

      if (candidates.length > 0) {
        const newOwner = candidates[0];
        await this.memberRepo.update(newOwner.id, {
          role: ChatMemberRole.Owner,
        });
        await this.sessionRepo.update(session.id, {
          creatorId: newOwner.principalId,
        });

        const principal = await this.principalRepo.findOne({
          where: { id: newOwner.principalId },
        });
        const displayName = principal?.displayName ?? '成员';
        await this.imMessageService.sendMessage(
          principalId,
          {
            sessionId: session.sessionId,
            content: `群主已自动转让给 ${displayName}`,
            messageType: ChatMessageType.System,
          },
          { role: 'system', skipAgentTrigger: true },
        );
      } else {
        await this.sessionRepo.update(session.id, {
          isDelete: true,
          active: false,
        });
        await this.memberRepo.update(
          { sessionId: session.id },
          { isDelete: true },
        );
      }
    }

    await this.memberRepo.update(membership.id, { isDelete: true });
  }

  private buildDefaultGroupName(names: string[]): string {
    const cleaned = names.map((x) => x.trim()).filter(Boolean);
    const head = cleaned.slice(0, 3);
    if (head.length === 0) return '群聊';
    const prefix = head.join('、');
    const suffix = cleaned.length > 3 ? '...的群聊' : '的群聊';
    return `${prefix}${suffix}`;
  }

  private buildInviteSystemText(names: string[]): string {
    const cleaned = names.map((x) => x.trim()).filter(Boolean);
    const head = cleaned.slice(0, 3);
    const count = cleaned.length;
    if (count === 0) return '邀请加入了群聊';
    const prefix = head.join('、');
    const mid = count > 3 ? ' 等 ' : ' ';
    return `邀请了 ${prefix}${mid}${count} 人加入了群聊`;
  }

  private async sendInviteSystemMessage(args: {
    sessionId: string;
    inviterId: string;
    invitedNames: string[];
  }): Promise<string> {
    const systemText = this.buildInviteSystemText(args.invitedNames);
    await this.imMessageService.sendMessage(
      args.inviterId,
      {
        sessionId: args.sessionId,
        content: systemText,
        messageType: ChatMessageType.System,
      },
      { role: 'system', skipAgentTrigger: true },
    );
    return systemText;
  }

  private async requireMembership(
    sessionInternalId: string,
    principalId: string,
  ) {
    const membership = await this.memberRepo.findOne({
      where: { sessionId: sessionInternalId, principalId, isDelete: false },
    });
    if (!membership) {
      throw new NotFoundException('User is not a member of this session');
    }
    return membership;
  }

  private async requirePrivileged(
    session: ChatSessionEntity,
    principalId: string,
  ): Promise<void> {
    const membership = await this.requireMembership(session.id, principalId);
    const ok =
      session.creatorId === principalId ||
      membership.role === ChatMemberRole.Owner ||
      membership.role === ChatMemberRole.Admin;
    if (!ok) {
      throw new ForbiddenException('Not allowed to invite members');
    }
  }

  async inviteMembers(
    sessionId: string,
    inviterId: string,
    dto: InviteMembersDto,
  ): Promise<InviteMembersResponse> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false, active: true },
        { sessionId, isDelete: false, active: true },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    await this.requireMembership(session.id, inviterId);

    const ids = Array.isArray(dto.principalIds) ? dto.principalIds : [];
    const normalized = Array.from(
      new Set(
        ids
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter(Boolean)
          .filter((x) => x !== inviterId),
      ),
    );

    if (normalized.length === 0) {
      return { sessionId: session.sessionId, action: 'noop', addedCount: 0 };
    }

    if (session.type === ChatSessionType.Private) {
      const memberships = await this.memberRepo.find({
        where: { sessionId: session.id, isDelete: false },
      });
      const otherIds = memberships
        .map((m) => m.principalId)
        .filter((pid) => pid !== inviterId);

      const existingSet = new Set(otherIds);
      const toInvite = normalized.filter((id) => !existingSet.has(id));
      if (toInvite.length === 0) {
        return { sessionId: session.sessionId, action: 'noop', addedCount: 0 };
      }

      const finalMemberIds = Array.from(new Set([...otherIds, ...toInvite]));
      const principals = await this.principalRepo.find({
        where: { id: In(finalMemberIds) },
      });
      const principalMap = new Map(
        principals.map((p) => [p.id, p.displayName]),
      );
      const orderedNames = finalMemberIds.map(
        (id) => principalMap.get(id) || id,
      );

      const groupName = this.buildDefaultGroupName(orderedNames);
      const created = await this.createSession(inviterId, {
        type: ChatSessionType.Group,
        name: groupName,
        memberIds: finalMemberIds,
      });

      const invitedNames = finalMemberIds.map(
        (id) => principalMap.get(id) || id,
      );
      const systemText = await this.sendInviteSystemMessage({
        sessionId: created.sessionId,
        inviterId,
        invitedNames,
      });
      return {
        sessionId: created.sessionId,
        action: 'created_group',
        sessionName: groupName,
        addedCount: toInvite.length,
        systemText,
      };
    }

    await this.requirePrivileged(session, inviterId);

    const existingRelations = await this.memberRepo.find({
      where: { sessionId: session.id, principalId: In(normalized) },
    });
    const activeSet = new Set(
      existingRelations.filter((m) => !m.isDelete).map((m) => m.principalId),
    );
    const toAdd = normalized.filter((id) => !activeSet.has(id));

    if (toAdd.length === 0) {
      return { sessionId: session.sessionId, action: 'noop', addedCount: 0 };
    }

    for (const principalId of toAdd) {
      await this.addMemberInternal(
        session.id,
        principalId,
        ChatMemberRole.Member,
      );
    }

    const principals = await this.principalRepo.find({
      where: { id: In(toAdd) },
    });
    const principalMap = new Map(principals.map((p) => [p.id, p.displayName]));
    const invitedNames = toAdd.map((id) => principalMap.get(id) || id);

    const systemText = await this.sendInviteSystemMessage({
      sessionId: session.sessionId,
      inviterId,
      invitedNames,
    });

    return {
      sessionId: session.sessionId,
      action: 'added_to_session',
      addedCount: toAdd.length,
      systemText,
    };
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
