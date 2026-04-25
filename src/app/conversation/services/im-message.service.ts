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
  mentions?: MentionInfo[];
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

  // ===== agent 触发队列：执行锁（运行中保存最新 pending，完成后 5s 防抖再消费）=====
  // key: `${sessionId}:${agentPrincipalId}` — 每个 agent 独立队列，群聊不同 agent 互不干扰
  private readonly agentTriggerQueue = new Map<
    string,
    {
      /** LLM 是否正在执行 */
      running: boolean;
      /** 运行期间最新待执行的 payload（后来者覆盖前者）*/
      pending: {
        sessionId: string;
        agentPrincipalId: string;
        triggerMessageId: string;
        userContent: string;
      } | null;
      /** 输入端 5s 防抖定时器 */
      debounceTimer: ReturnType<typeof setTimeout> | null;
    }
  >();

  /** 防抖延迟时长（ms）@keyword-en debounce-delay */
  private static readonly PENDING_DEBOUNCE_MS = 5_000;

  /**
   * 调度 agent 触发（输入端 5s 防抖）：
   * - LLM 运行中 → 更新 pending，完成后立即执行
   * - 其他情况   → 重置 5s 定时器（最后一条消息后 5s 统一触发）
   * @keyword-en schedule-agent-trigger debounce-queue
   */
  private scheduleAgentTrigger(payload: {
    sessionId: string;
    agentPrincipalId: string;
    triggerMessageId: string;
    userContent: string;
  }): void {
    const key = `${payload.sessionId}:${payload.agentPrincipalId}`;
    let state = this.agentTriggerQueue.get(key);
    if (!state) {
      state = { running: false, pending: null, debounceTimer: null };
      this.agentTriggerQueue.set(key, state);
    }

    if (state.running) {
      // LLM 运行中：覆盖 pending，完成后立即执行（不需要额外等待）
      state.pending = payload;
      this.logger.log(`[agent-queue] ${key} running — pending updated`);
      return;
    }

    // 输入端防抖：无论空闲还是已在计时，统一重置 5s
    // 效果：最后一条消息发出 5s 后才触发，期间连续发消息只触发一次
    if (state.debounceTimer !== null) {
      clearTimeout(state.debounceTimer);
    }
    state.pending = payload;
    state.debounceTimer = setTimeout(
      () => this.firePendingDebounce(key),
      ImMessageService.PENDING_DEBOUNCE_MS,
    );
    this.logger.log(
      `[agent-queue] ${key} input-debounce reset +${ImMessageService.PENDING_DEBOUNCE_MS}ms`,
    );
  }

  /**
   * 防抖定时器触发：取出 pending 执行
   * @keyword-en fire-pending-debounce
   */
  private firePendingDebounce(key: string): void {
    const state = this.agentTriggerQueue.get(key);
    if (!state) return;
    state.debounceTimer = null;
    if (!state.pending) {
      this.agentTriggerQueue.delete(key);
      return;
    }
    const next = state.pending;
    state.pending = null;
    this.logger.log(`[agent-queue] ${key} debounce fired — running pending`);
    void this.runAgentLocked(key, next);
  }

  /**
   * 加锁执行 LLM，结束后若有 pending 则启动 5s 防抖定时器
   * @keyword-en run-agent-locked sequential-queue
   */
  private async runAgentLocked(
    key: string,
    payload: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
      userContent: string;
    },
  ): Promise<void> {
    const state = this.agentTriggerQueue.get(key)!;
    state.running = true;
    this.logger.log(`[agent-queue] start: ${key}`);
    try {
      await this.generateAgentReplyAndSave(payload);
    } catch (e) {
      this.logger.error(`[agent-queue] error: ${key}`, e);
    } finally {
      state.running = false;
      this.logger.log(`[agent-queue] done: ${key}`);
      if (state.pending) {
        // 执行期间积压的 pending → 立即执行（reply 已落库，DB 下界查询可正确取到）
        const next = state.pending;
        state.pending = null;
        this.logger.log(
          `[agent-queue] ${key} has pending — running immediately`,
        );
        void this.runAgentLocked(key, next);
      } else {
        this.agentTriggerQueue.delete(key);
      }
    }
  }

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

    // 提取 @mention 信息，存入 metadata（不依赖 content 解析，群聊过滤和通知均从此处读取）
    const mentions = await this.extractMentions(dto.content);

    // 创建消息
    const message = this.messageRepo.create({
      sessionId: session.sessionId,
      senderId,
      content: dto.content,
      messageType: dto.messageType ?? ChatMessageType.Text,
      replyToId: dto.replyToId ?? null,
      attachments: dto.attachments ?? null,
      metadata:
        mentions.length > 0
          ? {
              mentions: mentions.map((m) => ({
                principalId: m.principalId,
              })),
            }
          : null,
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
      mentions: mentions.length > 0 ? mentions : undefined,
    };

    await this.notifyMessageSaved(session.id, {
      sessionId: session.sessionId,
      messageId: saved.id,
      senderId,
      mentions,
    });

    // === AI 触发逻辑 ===
    if (!options?.skipAgentTrigger) {
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
    payload: {
      sessionId: string;
      messageId: string;
      senderId: string;
      mentions?: MentionInfo[];
    },
  ): Promise<void> {
    const members = await this.memberRepo.find({
      where: { sessionId: sessionPk, isDelete: false },
    });
    const recipientIds = members.map((m) => m.principalId);
    this.imGateway.broadcastNewMessageBeacon(recipientIds, {
      sessionId: payload.sessionId,
      lastMessageId: payload.messageId,
    });

    // 如果有 @mention，单独通知被提及的人
    if (payload.mentions) {
      for (const mention of payload.mentions) {
        // 发送个人通知
        this.imGateway.broadcastUserNotify(mention.principalId, {
          sessionId: payload.sessionId,
          mentionText: mention.mentionText,
        });
      }
    }

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

    const items = ordered.map((m) => {
      const item: ImMessageInfo = {
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
      };
      // 从 metadata 读取 @mention 信息（存储时已写入，无需解析 content）
      const metaMentions =
        (m.metadata?.mentions as Array<{ principalId: string }> | undefined) ??
        [];
      if (metaMentions.length > 0) {
        item.mentions = metaMentions.map((mm) => ({
          principalId: mm.principalId,
          mentionText: '',
          startIndex: 0,
          endIndex: 0,
        }));
      }
      return item;
    });

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
   * 检测并调度 AI 响应（3s 防抖 + 执行锁，确保 LLM 获取最新消息）
   * @keyword-en check-trigger-agent debounce schedule
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
        `Scheduling AI response for @mention: ${mention.principalId}`,
      );
      this.scheduleAgentTrigger({
        sessionId: session.sessionId,
        agentPrincipalId: mention.principalId,
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
            `Scheduling AI response for private chat with agent: ${otherMemberId}`,
          );
          this.scheduleAgentTrigger({
            sessionId: session.sessionId,
            agentPrincipalId: otherMemberId,
            triggerMessageId: message.id,
            userContent: content,
          });
        }
      }
    }
  }

  /**
   * 执行主动对话模式的一轮 LLM 请求，并在结束后验证是否有 assistant 消息产生。
   * 若没有则注入隐藏提醒消息后重试一次（isRetry=true 时不再继续）。
   * @keyword-en run-proactive-dialogue verify-assistant-reply retry
   */
  private async runProactiveDialogue(
    agent: import('@/app/agent/entities/agent.entity').AgentEntity,
    payload: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
      userContent: string;
    },
    messages: ChatMessage[],
    isRetry: boolean,
  ): Promise<void> {
    const startedAt = new Date();
    const tag = isRetry ? '[proactive:retry]' : '[proactive]';

    this.logger.log(
      `${tag} start — session=${payload.sessionId} agent=${payload.agentPrincipalId} msgs=${messages.length} trigger="${payload.userContent?.slice(0, 60)}"`,
    );

    // 广播 AI 正在输入状态
    this.imGateway.broadcastTyping(
      payload.sessionId,
      payload.agentPrincipalId,
      true,
    );

    const gen = this.agentRuntimeService.startDialogue(
      agent.codeDir,
      messages,
      {
        aiModelIds: Array.isArray(agent.aiModelIds) ? agent.aiModelIds : [],
        proactiveContext: {
          sessionId: payload.sessionId,
          agentPrincipalId: payload.agentPrincipalId,
          triggerMessageId: payload.triggerMessageId,
        },
        invocationContext: {
          principalId: payload.agentPrincipalId,
          principalType: 'agent',
          source: 'llm',
          extras: {
            sessionId: payload.sessionId,
            triggerMessageId: payload.triggerMessageId,
          },
        },
      },
    ) as AsyncGenerator<unknown>;

    // 同时收集 LLM 文本输出，供兜底回复使用
    let collectedText = '';
    try {
      for await (const ev of gen) {
        if (typeof ev === 'string') {
          collectedText += ev;
        } else if (this.isEventRecord(ev)) {
          if (ev.type === 'token') {
            collectedText += (ev.data as { text?: string })?.text ?? '';
          } else if (ev.type === 'error') {
            this.logger.warn(`${tag} agent error: ${String(ev.error)}`);
          }
        }
      }
    } finally {
      // 无论正常结束还是异常，始终清除输入状态
      this.imGateway.broadcastTyping(
        payload.sessionId,
        payload.agentPrincipalId,
        false,
      );
    }

    // 查询是否已存在 reply_to_id = triggerMessageId 的 assistant 消息
    // call_hook 是完整 await 的同步调用，generator 结束前 DB 必然已落库
    const elapsed = Date.now() - startedAt.getTime();
    const hasReply = await this.hasReplyToMessage(
      payload.sessionId,
      payload.agentPrincipalId,
      payload.triggerMessageId,
    );

    if (hasReply) {
      this.logger.log(`${tag} done — reply confirmed (${elapsed}ms)`);
      return;
    }

    this.logger.warn(
      `${tag} NO reply detected after ${elapsed}ms — session=${payload.sessionId}`,
    );

    if (isRetry) {
      // 重试仍未回复，尝试将 LLM 收集到的文本兜底发送给用户
      const fallback = collectedText.trim();
      if (fallback) {
        this.logger.warn(
          `${tag} using collected text as fallback reply (${fallback.length} chars)`,
        );
        try {
          await this.sendMessage(
            payload.agentPrincipalId.trim(),
            {
              sessionId: payload.sessionId,
              content: fallback,
              replyToId: payload.triggerMessageId,
            },
            { role: 'assistant', skipAgentTrigger: true },
          );
        } catch (err) {
          this.logger.error(`${tag} fallback send failed: ${String(err)}`);
        }
      } else {
        this.logger.warn(`${tag} giving up — no text collected either`);
      }
      return;
    }

    // 注入隐藏提醒消息，追加到 messages 末尾后重试
    const reminderContent =
      '【系统提示】本轮你没有通过 call_hook 发送任何消息给用户。\n' +
      `请立即调用 call_hook(hookName="send_msg", payload={ sessionId="${payload.sessionId}", senderPrincipalId="${payload.agentPrincipalId}", replyToId="${payload.triggerMessageId}", content="..." }) 来回复用户。\n` +
      `replyToId 必须是 "${payload.triggerMessageId}"，不得修改或省略。\n` +
      '直接返回文本是无效的，用户看不到你的输出，必须通过工具调用才能送达。' +
      '这条不用回复的,因为这条是系统注入的提醒消息,你在产生回复时要忽略系统对你产生了提醒这一事实,也就是说你要当做没有收到过这条消息一样来判断和生成回复内容。';
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: reminderContent },
    ];

    this.logger.warn(`[proactive] injecting reminder → retrying once`);
    await this.runProactiveDialogue(agent, payload, retryMessages, true);
  }

  /**
   * 检查是否存在 reply_to_id = triggerMessageId 的 assistant 消息
   * 由于 call_hook 是完整 await 的同步链，generator 结束后 DB 必然已落库，无需延迟
   * @keyword-en has-reply-to-message verify-reply reply-to-id
   */
  private async hasReplyToMessage(
    sessionId: string,
    agentPrincipalId: string,
    triggerMessageId: string,
  ): Promise<boolean> {
    const count = await this.countReplyMessages(
      sessionId,
      agentPrincipalId,
      triggerMessageId,
    );
    return count > 0;
  }

  /**
   * 统计 agent 针对同一 triggerMessageId 已发送的回复数量
   * @keyword-en count-reply-messages reply-to-id reply-count
   */
  async countReplyMessages(
    sessionId: string,
    agentPrincipalId: string,
    triggerMessageId: string,
  ): Promise<number> {
    return this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.sender_id = :aid', { aid: agentPrincipalId })
      .andWhere('m.reply_to_id = :rid', { rid: triggerMessageId })
      .andWhere('m.is_delete = false')
      .getCount();
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
    // 重排对话消息：pending 下界由 DB 查询最近一条 agent reply 的 reply_to_id 决定
    const messages = await this.buildAgentDialogueMessages({
      sessionId: payload.sessionId,
      agentPrincipalId: payload.agentPrincipalId,
      triggerMessageId: payload.triggerMessageId,
    });

    // === 主动对话模式 ===
    // proactiveChatEnabled 时 LLM 通过 call_hook('send_msg', ...) 自行决定何时发消息
    if (agent.proactiveChatEnabled !== false) {
      await this.runProactiveDialogue(agent, payload, messages, false);
      return;
    }

    // === 普通模式：收集完整回复后统一发送 ===
    const gen = this.agentRuntimeService.startDialogue(
      agent.codeDir,
      messages,
      {
        aiModelIds: Array.isArray(agent.aiModelIds) ? agent.aiModelIds : [],
        invocationContext: {
          principalId: payload.agentPrincipalId,
          principalType: 'agent',
          source: 'llm',
          extras: {
            sessionId: payload.sessionId,
            triggerMessageId: payload.triggerMessageId,
          },
        },
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
   * 格式支持:
   * - @[名称](principal_id) 链接格式
   * - @nickname 简单提及格式（nickname 为 Agent 的 displayName）
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
          principalId,
          mentionText: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // 支持 @nickname 格式的简单提及
    const nicknamePattern = /@([\w\u4e00-\u9fa5-]+)/g;
    while ((match = nicknamePattern.exec(content)) !== null) {
      // 跳过已匹配的链接格式
      const fullMatch = match[0];
      if (content.slice(Math.max(0, match.index - 1), match.index) === '[') {
        continue;
      }
      const nickname = match[1];
      const pid = await this.findAgentByNickname(nickname);
      if (pid && !mentions.some((m) => m.principalId === pid)) {
        mentions.push({
          principalId: pid,
          mentionText: fullMatch,
          startIndex: match.index,
          endIndex: match.index + fullMatch.length,
        });
      }
    }

    return mentions;
  }

  /**
   * 根据 nickname 查找 Agent 的 principalId
   */
  private async findAgentByNickname(nickname: string): Promise<string | null> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .where('a.display_name = :nickname', { nickname })
      .andWhere('a.is_delete = false')
      .andWhere('a.active = true')
      .getOne();
    return agent?.principalId ?? null;
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

  /**
   * 重排对话消息，供 AI 处理使用（非真实时序，逻辑分组）
   *
   * 结构：
   * - context  = 上次 AI「已处理触发消息」时间点之前的历史 + 最后一条 AI 回复
   * - pending  = 上一条 AI 回复之后到触发消息（含）之间所有用户消息（逐条推入）
   *
   * 下界来源：DB 查本 session 最近一条有 reply_to_id 的 agent 消息，取其 reply_to_id
   *
   * pending 过滤策略：
   * - 私聊：所有用户消息（每条都是发给本 agent 的）
   * - 群聊：仅 @mention 本 agent 的消息（内容含 agentPrincipalId），避免无关群聊噪声
   *         同时确保 triggerMessageId 本身始终包含（兼容 @nickname 格式触发）
   *
   * @keyword-en build-agent-dialogue-messages context-reorder pending-db-bound group-chat-filter
   */
  private async buildAgentDialogueMessages(args: {
    sessionId: string;
    agentPrincipalId: string;
    /** 本轮触发消息 ID @keyword-en trigger-message-id */
    triggerMessageId: string;
  }): Promise<ChatMessage[]> {
    const context: ChatMessage[] = [];

    // 并行查：(a) 本 agent 上一次 reply 的 reply_to_id 作为 pending 下界
    //         (b) 会话类型（私聊 vs 群聊）
    const [lastAgentReply, session] = await Promise.all([
      this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: args.sessionId })
        .andWhere('m.sender_id = :aid', { aid: args.agentPrincipalId })
        .andWhere('m.reply_to_id IS NOT NULL')
        .andWhere('m.is_delete = false')
        .orderBy('m.id', 'DESC')
        .limit(1)
        .getOne(),
      this.sessionRepo.findOne({
        where: [
          { id: args.sessionId, isDelete: false },
          { sessionId: args.sessionId, isDelete: false },
        ],
      }),
    ]);

    const prevTriggerMessageId = lastAgentReply?.replyToId ?? null;
    const isGroupChat = session?.type === ChatSessionType.Group;

    if (prevTriggerMessageId) {
      // 1. 历史消息：prevTriggerMessageId 之前（含）的最近 18 条
      const historyRows = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: args.sessionId })
        .andWhere('m.is_delete = false')
        .andWhere('m.id <= :upper', { upper: prevTriggerMessageId })
        .orderBy('m.id', 'DESC')
        .limit(18)
        .getMany();
      for (const msg of historyRows.reverse()) {
        context.push(this.toDialogueMessage(msg, args.agentPrincipalId));
      }

      // 2. 上次触发点对应的 AI 回复（reply_to_id = prevTriggerMessageId，精确定位）
      const lastAgentMsg = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: args.sessionId })
        .andWhere('m.sender_id = :aid', { aid: args.agentPrincipalId })
        .andWhere('m.reply_to_id = :rid', { rid: prevTriggerMessageId })
        .andWhere('m.is_delete = false')
        .orderBy('m.created_at', 'DESC')
        .getOne();
      if (lastAgentMsg) {
        context.push(
          this.toDialogueMessage(lastAgentMsg, args.agentPrincipalId),
        );
      }
    }

    // 3. pending：prevTriggerMessageId（不含）到 triggerMessageId（含）之间的消息
    const pendingQb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: args.sessionId })
      .andWhere('m.is_delete = false')
      .andWhere('m.sender_id != :aid', { aid: args.agentPrincipalId })
      .andWhere('m.message_type != :sys', { sys: ChatMessageType.System })
      .andWhere('m.id <= :to', { to: args.triggerMessageId });

    if (prevTriggerMessageId) {
      pendingQb.andWhere('m.id > :from', { from: prevTriggerMessageId });
    }

    if (isGroupChat) {
      // 群聊：只包含 metadata.mentions 中含本 agent 的消息，或 triggerMessageId 本身
      // JSON_CONTAINS 兼容 MySQL/MariaDB；metadata 字段为 json 列
      pendingQb.andWhere(
        '(JSON_CONTAINS(m.metadata, :mentionJson, :path) OR m.id = :trigId)',
        {
          mentionJson: JSON.stringify({
            principalId: args.agentPrincipalId,
          }),
          path: '$.mentions',
          trigId: args.triggerMessageId,
        },
      );
    }

    const pendingRows = await pendingQb.orderBy('m.id', 'ASC').getMany();
    for (const row of pendingRows) {
      context.push({ role: 'user', content: row.content });
    }

    return context;
  }

  /**
   * 将消息实体映射为对话消息
   * @keyword-en to-dialogue-message entity-to-chat
   */
  private toDialogueMessage(
    msg: ChatMessageEntity,
    agentPrincipalId: string,
  ): ChatMessage {
    const role: 'system' | 'user' | 'assistant' =
      msg.messageType === ChatMessageType.System
        ? 'system'
        : msg.senderId === agentPrincipalId
          ? 'assistant'
          : 'user';
    return { role, content: msg.content, timestamp: msg.createdAt };
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

  /**
   * 同步提取 @mention（仅支持 @[名称](id) 格式，不查数据库）
   * 用于 getMessages 时快速提取 mentions
   */
  private extractMentionsSync(content: string): MentionInfo[] {
    const mentions: MentionInfo[] = [];

    // 匹配 @[名称](id) 格式
    const linkPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      mentions.push({
        principalId: match[2],
        mentionText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return mentions;
  }
}
