import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { ChatSessionMemberEntity } from '@core/ai/entities/chat-session-member.entity';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import { AgentEntity } from '@/app/agent/entities/agent.entity';
import { AgentRuntimeService } from '@core/agent-runtime/services/agent-runtime.service';
import { ChatMessageType, ChatSessionType } from '@core/ai/enums/chat.enums';
import type { ChatMessage } from '@core/ai/types';
import { ImSessionService } from './im-session.service';
import { ImGateway } from '../controllers/im.gateway';
import type {
  SendMessageDto,
  ImMessageInfo,
  GetMessagesDto,
  MentionInfo,
  HasNewResponse,
  ImMessageListResponse,
} from '../types/im.types';

export interface ImMessageSavedPayload {
  sessionId: string;
  messageId: string;
  senderId: string;
  recipientIds: string[];
}

/**
 * @title IM 消息服务
 * @description 管理 IM 消息的发送、获取历史、@mention 检测和 AI 触发。
 * @keywords-cn IM, 消息, 发送, 历史, @提及, AI
 * @keywords-en im, message, send, history, mention, ai
 */
@Injectable()
export class ImMessageService {
  private readonly logger = new Logger(ImMessageService.name);

  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    @InjectRepository(ChatSessionMemberEntity)
    private readonly memberRepo: Repository<ChatSessionMemberEntity>,
    @InjectRepository(PrincipalEntity)
    private readonly principalRepo: Repository<PrincipalEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @Inject(forwardRef(() => ImSessionService))
    private readonly sessionService: ImSessionService,
    @Inject(forwardRef(() => ImGateway))
    private readonly imGateway: ImGateway,
    private readonly agentRuntimeService: AgentRuntimeService,
  ) {}

  /**
   * 发送消息
   * @param senderId 发送者 principal_id
   * @param dto 消息内容
   */
  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
    options?: {
      role?: 'system' | 'user' | 'assistant';
      skipAgentTrigger?: boolean;
    },
  ): Promise<ImMessageInfo> {
    // 验证会话存在
    const session = await this.sessionRepo.findOne({
      where: [
        { id: dto.sessionId, isDelete: false, active: true },
        { sessionId: dto.sessionId, isDelete: false, active: true },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${dto.sessionId}`);
    }

    // 验证发送者是会话成员
    const isMember = await this.sessionService.isMember(session.id, senderId);
    if (!isMember) {
      throw new NotFoundException(`User is not a member of this session`);
    }

    // 创建消息
    const message = this.messageRepo.create({
      sessionId: session.sessionId,
      senderId,
      content: dto.content,
      messageType: dto.messageType ?? ChatMessageType.Text,
      replyToId: dto.replyToId ?? null,
      attachments: dto.attachments ?? null,
      isAnnouncement: false,
      isEdited: false,
      isDelete: false,
      // 向后兼容字段
      role: options?.role ?? 'user',
    });

    const saved = await this.messageRepo.save(message);

    // 获取发送者信息
    const sender = await this.principalRepo.findOne({
      where: { id: senderId },
    });

    const messageInfo: ImMessageInfo = {
      id: saved.id,
      sessionId: session.sessionId,
      senderId,
      senderName: sender?.displayName,
      messageType: saved.messageType,
      content: saved.content,
      replyToId: saved.replyToId,
      attachments: saved.attachments,
      isEdited: saved.isEdited,
      isAnnouncement: saved.isAnnouncement,
      createdAt: saved.createdAt,
    };

    await this.notifyMessageSaved(session.id, {
      sessionId: session.sessionId,
      messageId: saved.id,
      senderId,
    });

    // === AI 触发逻辑 ===
    if (!options?.skipAgentTrigger) {
      console.log('ai 触发了');
      await this.checkAndTriggerAgent(session, senderId, saved, dto.content);
    }

    return messageInfo;
  }

  /**
   * 发布群公告（本质为一条带 isAnnouncement 标识的文本消息）
   */
  async sendAnnouncement(
    ownerId: string,
    args: { sessionId: string; content: string },
  ): Promise<ImMessageInfo> {
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
        'Announcements are only supported in group',
      );
    }

    await this.sessionService.ensureOwner(session.id, ownerId);

    const rawContent = (args.content || '').trim();
    if (!rawContent) {
      throw new BadRequestException('Announcement content is empty');
    }

    const content = rawContent.startsWith('@所有人')
      ? rawContent
      : `@所有人 ${rawContent}`;

    const message = this.messageRepo.create({
      sessionId: session.sessionId,
      senderId: ownerId,
      content,
      messageType: ChatMessageType.Text,
      replyToId: null,
      attachments: null,
      isAnnouncement: true,
      isEdited: false,
      isDelete: false,
      role: 'user',
    });
    const saved = await this.messageRepo.save(message);

    const sender = await this.principalRepo.findOne({ where: { id: ownerId } });
    const info: ImMessageInfo = {
      id: saved.id,
      sessionId: session.sessionId,
      senderId: saved.senderId,
      senderName: sender?.displayName,
      messageType: saved.messageType,
      content: saved.content,
      replyToId: saved.replyToId,
      attachments: saved.attachments,
      isEdited: saved.isEdited,
      isAnnouncement: saved.isAnnouncement,
      createdAt: saved.createdAt,
    };

    await this.notifyMessageSaved(session.id, {
      sessionId: session.sessionId,
      messageId: saved.id,
      senderId: ownerId,
    });

    return info;
  }

  /**
   * 获取群公告列表
   */
  async getAnnouncements(args: {
    sessionId: string;
    principalId: string;
    limit?: number;
  }): Promise<{ items: ImMessageInfo[]; total: number }> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: args.sessionId, isDelete: false },
        { sessionId: args.sessionId, isDelete: false },
      ],
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${args.sessionId}`);
    }

    const isMember = await this.sessionService.isMember(
      session.id,
      args.principalId,
    );
    if (!isMember) {
      throw new NotFoundException('User is not a member of this session');
    }

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const baseQb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: session.sessionId })
      .andWhere('m.is_delete = false')
      .andWhere('m.is_announcement = true');

    const total = await baseQb.getCount();

    const messages = await baseQb
      .orderBy('m.created_at', 'DESC')
      .limit(limit)
      .getMany();

    const senderIds = [
      ...new Set(messages.map((m) => m.senderId).filter(Boolean)),
    ] as string[];
    const senders = senderIds.length
      ? await this.principalRepo
          .createQueryBuilder('p')
          .where('p.id IN (:...ids)', { ids: senderIds })
          .getMany()
      : [];
    const senderMap = new Map(senders.map((s) => [s.id, s.displayName]));

    const items: ImMessageInfo[] = messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      senderId: m.senderId,
      senderName: m.senderId ? senderMap.get(m.senderId) : undefined,
      messageType: m.messageType,
      content: m.content,
      replyToId: m.replyToId,
      attachments: m.attachments,
      isEdited: m.isEdited,
      isAnnouncement: m.isAnnouncement,
      createdAt: m.createdAt,
    }));

    return { items, total };
  }

  /**
   * 删除群公告标识（不删除消息）
   */
  async unsetAnnouncement(args: {
    sessionId: string;
    ownerId: string;
    messageId: string;
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

    await this.sessionService.ensureOwner(session.id, args.ownerId);

    const msg = await this.messageRepo.findOne({
      where: { id: args.messageId, isDelete: false },
    });
    if (!msg || msg.sessionId !== session.sessionId) {
      throw new NotFoundException('Announcement message not found');
    }

    if (!msg.isAnnouncement) return;

    await this.messageRepo.update(msg.id, { isAnnouncement: false });
  }

  private async notifyMessageSaved(
    sessionPk: string,
    payload: { sessionId: string; messageId: string; senderId: string },
  ): Promise<void> {
    const members = await this.memberRepo.find({
      where: { sessionId: sessionPk, isDelete: false },
    });
    const recipientIds = members.map((m) => m.principalId);
    this.imGateway.broadcastNewMessageBeacon(recipientIds, {
      sessionId: payload.sessionId,
      lastMessageId: payload.messageId,
    });

    for (const m of members) {
      if (m.principalId === payload.senderId) continue;
      this.imGateway.broadcastUserNotify(m.principalId, {
        sessionId: payload.sessionId,
      });
    }
  }

  /**
   * 获取消息历史
   */
  async getMessages(
    sessionId: string,
    dto: GetMessagesDto,
    principalId?: string,
  ): Promise<ImMessageListResponse> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const limit = Math.min(dto.limit ?? 50, 100);
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: session.sessionId })
      .andWhere('m.is_delete = false');

    const cursorId = dto.last_message_id;
    const beforeId = dto.before;

    if (cursorId) {
      qb.andWhere('m.id > :cursorId', { cursorId })
        .orderBy('m.id', 'ASC')
        .limit(limit);
    } else if (beforeId) {
      qb.andWhere('m.id < :beforeId', { beforeId })
        .orderBy('m.id', 'DESC')
        .limit(limit);
    } else {
      qb.orderBy('m.id', 'DESC').limit(limit);
    }

    const messages = await qb.getMany();

    // 获取发送者信息
    const senderIds = [
      ...new Set(messages.map((m) => m.senderId).filter(Boolean)),
    ] as string[];
    const senders = senderIds.length
      ? await this.principalRepo
          .createQueryBuilder('p')
          .where('p.id IN (:...ids)', { ids: senderIds })
          .getMany()
      : [];
    const senderMap = new Map(senders.map((s) => [s.id, s.displayName]));

    const ordered = cursorId ? messages : messages.reverse();

    const items = ordered.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      senderId: m.senderId,
      senderName: m.senderId ? senderMap.get(m.senderId) : undefined,
      messageType: m.messageType,
      content: m.content,
      replyToId: m.replyToId,
      attachments: m.attachments,
      isEdited: m.isEdited,
      isAnnouncement: m.isAnnouncement,
      createdAt: m.createdAt,
    }));

    const last = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: session.sessionId })
      .andWhere('m.is_delete = false')
      .orderBy('m.id', 'DESC')
      .limit(1)
      .getOne();
    if (principalId && items.length > 0) {
      const latestMessage = items[items.length - 1];
      await this.updateReadReceipt(session.id, principalId, latestMessage.id);
    }

    return { items, cursor: last?.id ?? null };
  }

  /**
   * 检查指定时间之后是否有新消息
   */
  async hasNew(sessionId: string, sinceIso: string): Promise<HasNewResponse> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const sinceDate = new Date(sinceIso);
    if (Number.isNaN(sinceDate.getTime())) {
      throw new BadRequestException('Invalid since timestamp');
    }

    const count = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: session.sessionId })
      .andWhere('m.is_delete = false')
      .andWhere('m.created_at > :since', { since: sinceDate })
      .getCount();

    let lastMessageAt: Date | undefined;
    if (count > 0) {
      const last = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: session.sessionId })
        .andWhere('m.is_delete = false')
        .andWhere('m.created_at > :since', { since: sinceDate })
        .orderBy('m.created_at', 'DESC')
        .limit(1)
        .getOne();
      lastMessageAt = last?.createdAt;
    }

    return { hasNew: count > 0, count, lastMessageAt };
  }

  /**
   * 检测并触发 AI 响应
   */
  private async checkAndTriggerAgent(
    session: ChatSessionEntity,
    senderId: string,
    message: ChatMessageEntity,
    content: string,
  ): Promise<void> {
    // 1. 检测 @agent 提及
    const mentions = await this.extractMentions(content);
    for (const mention of mentions) {
      this.logger.log(
        `Triggering AI response for @mention: ${mention.agentPrincipalId}`,
      );
      await this.generateAgentReplyAndSave({
        sessionId: session.sessionId,
        agentPrincipalId: mention.agentPrincipalId,
        triggerMessageId: message.id,
        userContent: content,
      });
    }

    // 2. 私聊 Agent 检测
    if (session.type === ChatSessionType.Private && mentions.length === 0) {
      const otherMemberId = await this.sessionService.getOtherMember(
        session.id,
        senderId,
      );

      if (otherMemberId) {
        const isAgent = await this.isAgentPrincipal(otherMemberId);
        if (isAgent) {
          this.logger.log(
            `Triggering AI response for private chat with agent: ${otherMemberId}`,
          );
          await this.generateAgentReplyAndSave({
            sessionId: session.sessionId,
            agentPrincipalId: otherMemberId,
            triggerMessageId: message.id,
            userContent: content,
          });
        }
      }
    }
  }

  private async generateAgentReplyAndSave(payload: {
    sessionId: string;
    agentPrincipalId: string;
    triggerMessageId: string;
    userContent: string;
  }): Promise<void> {
    const agent = await this.agentRepo.findOne({
      where: {
        principalId: payload.agentPrincipalId,
        active: true,
        isDelete: false,
      },
    });
    if (!agent) {
      throw new BadRequestException('未找到可用Agent配置');
    }
    const baseMessages = await this.buildAgentDialogueMessages({
      sessionId: payload.sessionId,
      agentPrincipalId: payload.agentPrincipalId,
    });
    const fallbackMessage: ChatMessage = {
      role: 'user',
      content: payload.userContent,
    };
    const messages = baseMessages.length > 0 ? baseMessages : [fallbackMessage];
    const gen = this.agentRuntimeService.startDialogue(
      agent.codeDir,
      messages,
      {
        aiModelIds: Array.isArray(agent.aiModelIds) ? agent.aiModelIds : [],
      },
    ) as AsyncGenerator<unknown>;

    let fullContent = '';
    for await (const ev of gen) {
      if (typeof ev === 'string') {
        fullContent += ev;
        continue;
      }
      if (this.isEventRecord(ev) && ev.type === 'token') {
        fullContent += ev.data?.text ?? '';
        continue;
      }
      if (this.isEventRecord(ev) && ev.type === 'error') {
        const err = typeof ev.error === 'string' ? ev.error : 'agent error';
        this.logger.warn(`Agent dialogue error: ${err}`);
      }
    }

    const trimmed = fullContent.trim();
    if (!trimmed) return;

    await this.sendMessage(
      payload.agentPrincipalId,
      {
        sessionId: payload.sessionId,
        content: trimmed,
      },
      { role: 'assistant', skipAgentTrigger: true },
    );
  }

  /**
   * 提取 @mention
   * 格式支持: @[agent名称](principal_id) 或 @agent_code_dir
   */
  private async extractMentions(content: string): Promise<MentionInfo[]> {
    const mentions: MentionInfo[] = [];

    // 匹配 @[名称](id) 格式
    const linkPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      const principalId = match[2];
      const isAgent = await this.isAgentPrincipal(principalId);
      if (isAgent) {
        mentions.push({
          agentPrincipalId: principalId,
          mentionText: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // TODO: 支持 @agent_nickname 格式的简单提及

    return mentions;
  }

  /**
   * 检查 principal 是否为 Agent
   */
  private async isAgentPrincipal(principalId: string): Promise<boolean> {
    const agent = await this.agentRepo.findOne({
      where: { principalId, isDelete: false },
    });
    return !!agent;
  }

  private isEventRecord(
    ev: unknown,
  ): ev is { type?: string; data?: { text?: string }; error?: string } {
    return typeof ev === 'object' && ev !== null && 'type' in ev;
  }

  private async buildAgentDialogueMessages(args: {
    sessionId: string;
    agentPrincipalId: string;
  }): Promise<ChatMessage[]> {
    const raw = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: args.sessionId })
      .andWhere('m.is_delete = false')
      .orderBy('m.created_at', 'DESC')
      .limit(20)
      .getMany();
    const ordered = raw.reverse();
    return ordered.map((msg) => {
      const role =
        msg.messageType === ChatMessageType.System
          ? 'system'
          : msg.senderId === args.agentPrincipalId
            ? 'assistant'
            : 'user';
      return {
        role,
        content: msg.content,
        timestamp: msg.createdAt,
      };
    });
  }

  /**
   * 更新已读状态
   */
  async updateReadReceipt(
    sessionId: string,
    principalId: string,
    messageId: string,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });

    if (!session) return;

    await this.memberRepo.update(
      { sessionId: session.id, principalId },
      {
        lastReadAt: new Date(),
        lastReadMessageId: messageId,
      },
    );
  }
}
