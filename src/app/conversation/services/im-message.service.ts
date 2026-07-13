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
import { SYSTEM_NOTIFIER_ID } from '@/app/identity/constants/system-principals';
import { AgentEntity } from '@/app/agent/entities/agent.entity';
import { AgentRuntimeService } from '@core/agent-runtime/services/agent-runtime.service';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { ChatMessageType, ChatSessionType } from '@core/ai/enums/chat.enums';
import type { ChatMessage } from '@core/ai/types';
import { ImSessionService } from './im-session.service';
import { ImGateway } from '../controllers/im.gateway';
import { SessionHandbookSeederService } from './session-handbook-seeder.service';
import {
  CURRENT_SESSION_LAZY_GUARD_MARKDOWN,
  CurrentSessionService,
  type CurrentSessionGuardResult,
} from './current-session.service';
import {
  ChatSessionSmartService,
  type ChatSessionSmartContextDigest,
} from './chat-session-smart.service';
import { SessionLockService } from './session-lock.service';
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

const LLM_GUIDANCE_ENVELOPE_VERSION = 3;
const INIT_TIP_FIRST_MUST = 'init_tip_first';

/**
 * 从未知对象读取 boolean 字段。
 * @keyword-en read-boolean-field
 */
function readBooleanPath(value: unknown, key: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return (value as Record<string, unknown>)[key] === true;
}

/**
 * 取两个 UUIDv7 消息 ID 中时间更靠后的一个。
 * @keyword-en later-message-id
 */
function laterMessageId(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * 判断消息 ID 是否晚于给定游标; 游标为空时默认通过。
 * @keyword-en message-id-after
 */
function isMessageIdAfter(
  id: string,
  cursor: string | null | undefined,
): boolean {
  return !cursor || id > cursor;
}

interface LlmGuidanceEnvelope {
  v: number;
  kind: 'im.user';
  text: string;
  task: LlmGuidanceTask;
  mode: {
    proactive: true;
    reply: 'send_msg';
  };
  must: string[];
  refs: string[];
  currentSessionGuard: LlmCurrentSessionGuard;
  currentSessionRetry?: LlmCurrentSessionRetry;
}

interface LlmGuidanceTask {
  type:
    | 'chat'
    | 'contextual_followup'
    | 'capability_answer'
    | 'platform_read'
    | 'platform_write'
    | 'previous_result_action';
  domain: string;
  intent: string;
}

interface LlmCurrentSessionGuard {
  required: true;
  tool: 'call_hook';
  hookName: 'saas.app.conversation.initTip';
  payload: '{needKnowledge,needHook,reason?}';
  reason: string;
  rule: string;
}

interface LlmCurrentSessionRetry {
  required: true;
  severity: 'strict';
  attempt: 2;
  reasons: string[];
  failedBecause: string;
  previousDecision: {
    declaredInitTip: CurrentSessionGuardResult['declaredInitTip'];
    inferredInitTip: CurrentSessionGuardResult['inferredInitTip'];
    completed: {
      didInitTip: boolean;
      didEvidenceHook: boolean;
      didPendingAction: boolean;
      didPendingActionDelivery: boolean;
    };
    pendingAction: CurrentSessionGuardResult['pendingAction'];
    successfulHookNames: string[];
  };
  requiredReferences: string[];
  hookName: 'saas.app.conversation.initTip';
  payload: '{needKnowledge,needHook,reason}';
  must: string[];
  successCriteria: string[];
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
    @Inject(forwardRef(() => AgentRuntimeService))
    private readonly agentRuntimeService: AgentRuntimeService,
    private readonly handbookSeeder: SessionHandbookSeederService,
    private readonly currentSession: CurrentSessionService,
    private readonly smartService: ChatSessionSmartService,
    private readonly sessionLock: SessionLockService,
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
      /**
       * 该队列从入队到清空期间所有触发 trigger 的用户消息 id
       *  - scheduleAgentTrigger 入口 add
       *  - runAgentLocked finally 队列清空时 clear
       *  - 用于客户端 join session room 时重放 (前端刷新后能恢复 awaiting emoji)
       * @keyword-en awaiting-message-ids
       */
      awaitingMessageIds: Set<string>;
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
      state = {
        running: false,
        pending: null,
        debounceTimer: null,
        awaitingMessageIds: new Set(),
      };
      this.agentTriggerQueue.set(key, state);
    }

    // 记录到 awaitingMessageIds, 供 client 重连/刷新时重放
    state.awaitingMessageIds.add(payload.triggerMessageId);

    // 广播待响应队列入队 :: 前端挂"AI 已识别"emoji + 等待语
    // 同一队列生命周期内可能多次 add (防抖窗口 / pending 期间), 都推 (前端 entry 已存在则只 add msgId, phrase 不变)
    this.imGateway.broadcastAiAwaitingAdd(payload.sessionId, {
      agentPrincipalId: payload.agentPrincipalId,
      triggerMessageId: payload.triggerMessageId,
    });

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
   * 客户端 join session room 时重放当前 awaiting 状态 :: 用于前端刷新后恢复"AI 已识别"emoji
   *  - 扫 agentTriggerQueue 找该 sessionId 下所有 entry
   *  - 返回每个 (agentPrincipalId, triggerMessageIds[]) 让 ImGateway 单 client emit
   *  - 队列空时返回 []
   * @keyword-en replay-awaiting-on-join
   */
  public replayAwaitingForSession(sessionId: string): Array<{
    agentPrincipalId: string;
    triggerMessageIds: string[];
  }> {
    const result: Array<{
      agentPrincipalId: string;
      triggerMessageIds: string[];
    }> = [];
    for (const [key, state] of this.agentTriggerQueue.entries()) {
      const colonIdx = key.indexOf(':');
      if (colonIdx < 0) continue;
      const sid = key.slice(0, colonIdx);
      const agentPrincipalId = key.slice(colonIdx + 1);
      if (sid !== sessionId) continue;
      if (!agentPrincipalId) continue;
      if (state.awaitingMessageIds.size === 0) continue;
      result.push({
        agentPrincipalId,
        triggerMessageIds: [...state.awaitingMessageIds],
      });
    }
    return result;
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
      // 兜底: 防抖到点但 pending 空 (理论上不应发生), 也要广播 end 让前端清状态
      const [sessionId, agentPrincipalId] = key.split(':');
      this.agentTriggerQueue.delete(key);
      if (sessionId && agentPrincipalId) {
        this.imGateway.broadcastAiAwaitingEnd(sessionId, {
          agentPrincipalId,
        });
      }
      return;
    }
    const next = state.pending;
    state.pending = null;
    this.logger.log(`[agent-queue] ${key} debounce fired — running pending`);
    void this.runAgentLocked(key, next);
  }

  /**
   * 加锁执行 LLM，结束后若有 pending 则启动 5s 防抖定时器。
   *   两层锁: 外层 (session, agent) 队列保证同 agent 串行 (这里); 内层 SessionLockService
   *   再按 sessionId 串行, 让"同 session 不同 agent + smart 压缩"也串行, 避免读到半压缩态。
   * @keyword-en run-agent-locked sequential-queue session-lock-outer
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
      await this.sessionLock.runExclusive(
        payload.sessionId,
        `agent-run:${payload.agentPrincipalId}`,
        () => this.generateAgentReplyAndSave(payload),
      );
    } catch (e) {
      this.logger.error(`[agent-queue] error: ${key}`, e);
    } finally {
      state.running = false;
      this.logger.log(`[agent-queue] done: ${key}`);
      if (state.pending) {
        // 执行期间积压的 pending → 立即执行（reply 已落库，DB 下界查询可正确取到）
        // 此时不广播 end, 因为队列还没空, 前端 entry 保持 (复用同一个等待语)
        const next = state.pending;
        state.pending = null;
        this.logger.log(
          `[agent-queue] ${key} has pending — running immediately`,
        );
        void this.runAgentLocked(key, next);
      } else {
        // 队列彻底空 → 广播 end, 前端清掉该队列下所有 awaiting 标记 + 等待语
        const [sessionId, agentPrincipalId] = key.split(':');
        this.agentTriggerQueue.delete(key);
        if (sessionId && agentPrincipalId) {
          this.imGateway.broadcastAiAwaitingEnd(sessionId, {
            agentPrincipalId,
          });
        }
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
      messageType?: 'text' | 'notification';
      /** 客户端 IP; 仅 HTTP user 入口注入, agent 主动 sendMsg 不带 */
      senderIp?: string;
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

    // 验证发送者是会话成员 (SYSTEM_NOTIFIER 跨群共享, 跳过成员校验; 仅服务端隐藏通知场景使用)
    if (senderId !== SYSTEM_NOTIFIER_ID) {
      const isMember = await this.sessionService.isMember(session.id, senderId);
      if (!isMember) {
        throw new NotFoundException(`User is not a member of this session`);
      }
    }

    // 提取 @mention 信息，存入 metadata（不依赖 content 解析，群聊过滤和通知均从此处读取）
    // dto.mentions 显式传入时优先 (服务端隐藏通知场景, 1.8.4 命门修复) — 绕过 content 解析的 displayName 依赖
    const mentions =
      dto.mentions && dto.mentions.length > 0
        ? dto.mentions
        : await this.extractMentions(dto.content);

    // 严格 mention 成员校验 (opt-in, 数据触点 notifier 等需要纠错机制的场景传 strictMention=true);
    //  - 默认 false 静默允许 mention 退群成员 (人工 @ / agent 自主发消息)
    //  - true 时任一 mention 不是会话成员 → throw NotFoundException, 错误 message 含具体 principalId 方便上游 parse 纠错
    //  - SYSTEM_NOTIFIER 跨群共享, 跳过校验 (跟 sender 校验对称)
    //  - 批量 query: filterExistingMembers 一次拉所有 mentions 的成员关系, 避免 N+1
    if (dto.strictMention === true && mentions.length > 0) {
      const toCheck = mentions
        .map((m) => m.principalId)
        .filter((id) => id !== SYSTEM_NOTIFIER_ID);
      if (toCheck.length > 0) {
        const existingSet = await this.sessionService.filterExistingMembers(
          session.id,
          toCheck,
        );
        const missing = toCheck.find((id) => !existingSet.has(id));
        if (missing) {
          throw new NotFoundException(
            `Mention target is not a member of this session: principalId=${missing} sessionId=${dto.sessionId}`,
          );
        }
      }
    }

    const agentTargetIds = await this.resolveAgentTargetIds(
      session,
      senderId,
      mentions,
    );
    // envelope (v3) 已弃用 :: user message 直发原话, init_tip suggestions + examples 承担引导
    const metadata = this.buildMessageMetadata({
      mentions,
      llmContent: null,
      llmTargetAgentIds: agentTargetIds,
      senderIp: options?.senderIp,
    });

    // 创建消息
    const resolvedMessageType =
      options?.messageType === 'notification'
        ? ChatMessageType.Notification
        : (dto.messageType ?? ChatMessageType.Text);
    const message = this.messageRepo.create({
      sessionId: session.sessionId,
      senderId,
      content: dto.content,
      messageType: resolvedMessageType,
      replyToId: dto.replyToId ?? null,
      attachments: dto.attachments ?? null,
      metadata,
      isAnnouncement: false,
      isEdited: false,
      isDelete: false,
      // 向后兼容字段: notification 用 assistant 兼容
      role:
        options?.messageType === 'notification'
          ? 'assistant'
          : (options?.role ?? 'user'),
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
    this.smartService.scheduleAnalyze(session.sessionId, {
      agentPrincipalId: agentTargetIds[0] ?? null,
    });

    // === AI 触发逻辑 ===
    if (!options?.skipAgentTrigger) {
      if (dto.mentions && dto.mentions.length > 0) {
        // explicit mentions 路径 (1.8.4 命门修复): 直接调度 mention 中的 agent, 跳过 content @ 解析
        for (const m of dto.mentions) {
          if (await this.isAgentPrincipal(m.principalId)) {
            this.logger.log(
              `Scheduling AI for explicit mention: ${m.principalId}`,
            );
            this.scheduleAgentTrigger({
              sessionId: session.sessionId,
              agentPrincipalId: m.principalId,
              triggerMessageId: saved.id,
              userContent: dto.content,
            });
          }
        }
      } else {
        await this.checkAndTriggerAgent(session, senderId, saved, dto.content);
      }
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
    this.smartService.scheduleAnalyze(session.sessionId);

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
      // 透出 Hook 组件冻结快照，供前端回看时显示生成当时数据（不下发其它内部 metadata）
      const snaps = m.metadata?.hookSnapshots as
        | Record<string, { data: unknown; ts: number; traceId?: string }>
        | undefined;
      if (snaps && Object.keys(snaps).length > 0) {
        item.hookSnapshots = snaps;
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
   * 执行主动对话模式的一轮 LLM 请求, 结束后验证是否有 assistant 消息产生。
   * 若 LLM 没通过 call_hook(saas.app.conversation.sendMsg) 发消息, 则把流式收集到的文本直接当回复发出去 (前提: 该轮没发过)。
   * lazy guard 命中时自动重试一次; 第二次仍失败才落固定提示。
   * @keyword-en run-proactive-dialogue collect-fallback lazy-retry
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
    retryAttempt = 0,
  ): Promise<void> {
    const startedAt = new Date();
    const tag =
      retryAttempt > 0 ? `[proactive-retry:${retryAttempt}]` : '[proactive]';

    this.logger.log(
      `${tag} start — session=${payload.sessionId} agent=${payload.agentPrincipalId} msgs=${messages.length} trigger="${payload.userContent?.slice(0, 60)}"`,
    );

    // 广播 AI 正在输入状态
    this.imGateway.broadcastTyping(
      payload.sessionId,
      payload.agentPrincipalId,
      true,
    );

    const invocationContext = await this.buildAgentInvocationContext(payload, {
      isProactive: true,
    });
    this.currentSession.beginTurn(payload.sessionId, payload.agentPrincipalId);
    const inferredNeed = this.currentSession.inferInitTipFromMessages(messages);
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
        invocationContext,
        agentContext: this.buildAgentRuntimeContext(agent, invocationContext),
        // checkpoint 会话记忆 :: thread = sessionId:agentPrincipalId
        sessionId: payload.sessionId,
      },
    ) as AsyncGenerator<unknown>;

    // 同时收集 LLM 文本输出, 供兜底回复使用
    //  - token  :: LLM 最终回复 (优先, 兜底首选)
    //  - reasoning :: Claude thinking 模式 / o1 等推理模型产出 (LLM 走思考分支没出 token 时退化用)
    //  - eventStats :: 统计所有事件类型 count, 兜底失败时一起 log, 方便排查"为什么没 text" (例如 LLM 只调了 tool 没生成 final / 模型真沉默)
    let collectedText = '';
    let reasoningText = '';
    const eventStats: Record<string, number> = {};
    try {
      for await (const ev of gen) {
        if (typeof ev === 'string') {
          collectedText += ev;
          eventStats.string = (eventStats.string ?? 0) + 1;
        } else if (this.isEventRecord(ev)) {
          const evType = typeof ev.type === 'string' ? ev.type : 'unknown';
          eventStats[evType] = (eventStats[evType] ?? 0) + 1;
          if (ev.type === 'token') {
            collectedText += (ev.data as { text?: string })?.text ?? '';
          } else if (ev.type === 'reasoning') {
            reasoningText += (ev.data as { text?: string })?.text ?? '';
          } else if (ev.type === 'error') {
            this.logger.warn(`${tag} agent error: ${String(ev.error)}`);
          }
        }
      }
    } finally {
      // 无论正常结束还是异常, 始终清除输入状态
      this.imGateway.broadcastTyping(
        payload.sessionId,
        payload.agentPrincipalId,
        false,
      );
    }

    // call_hook 是完整 await 的同步调用, generator 结束前 DB 必然已落库
    const elapsed = Date.now() - startedAt.getTime();
    const guard = this.currentSession.evaluateToolGuard(
      payload.sessionId,
      payload.agentPrincipalId,
      inferredNeed,
    );
    const hasReply = await this.hasReplyToMessage(
      payload.sessionId,
      payload.agentPrincipalId,
      payload.triggerMessageId,
    );

    if (guard.lazy && retryAttempt < 1) {
      await this.persistLazyRetryNudgeToTriggerMessage(
        payload.triggerMessageId,
        guard,
      );
      if (hasReply) {
        await this.discardLatestReplyForLazyRetry(
          payload.sessionId,
          payload.agentPrincipalId,
          payload.triggerMessageId,
          guard,
        );
      }
      this.logger.warn(
        `${tag} lazy guard hit, retrying once (reasons=${guard.reasons.join(',')})`,
      );
      const retryMessages = await this.buildAgentDialogueMessages(payload);
      await this.runProactiveDialogue(
        agent,
        payload,
        this.withLazyRetryNudge(retryMessages, guard),
        retryAttempt + 1,
      );
      return;
    }

    if (guard.lazy && hasReply) {
      const replaced = await this.replaceLatestReplyWithLazyGuard(
        payload.sessionId,
        payload.agentPrincipalId,
        payload.triggerMessageId,
        guard,
      );
      if (replaced) {
        this.logger.warn(
          `${tag} lazy guard replaced reply (${elapsed}ms, reasons=${guard.reasons.join(',')})`,
        );
        return;
      }
    }

    if (hasReply) {
      this.logger.log(`${tag} done — reply confirmed (${elapsed}ms)`);
      return;
    }

    // 没通过 saas.app.conversation.sendMsg 发消息 → 兜底, 优先级:
    //  - 1. collectedText (token 累加): LLM 没调 sendMsg 但生成了 final text
    //  - 2. reasoningText (reasoning 累加): Claude thinking / o1 等推理模型只产 reasoning 没出 token, 退化拿思考过程
    //  - 3. emergency fallback: 真完全沉默 (模型异常 / 超时 / 提前终止 generator) — log 含 eventStats 详细统计便于排查
    const text = collectedText.trim();
    const reasoning = reasoningText.trim();
    const isEmergency = !text && !reasoning && !guard.lazy;
    const content = guard.lazy
      ? CURRENT_SESSION_LAZY_GUARD_MARKDOWN
      : text
        ? text
        : reasoning
          ? reasoning
          : '抱歉, 暂未能完成响应, 请稍后重试或换一种方式提问。';
    const source = guard.lazy
      ? 'lazy-guard'
      : text
        ? 'token'
        : reasoning
          ? 'reasoning'
          : 'emergency';
    const statsStr = JSON.stringify(eventStats);
    if (isEmergency) {
      this.logger.warn(
        `${tag} NO reply, NO text/reasoning collected — sending emergency fallback (${elapsed}ms, events=${statsStr})`,
      );
    } else {
      this.logger.warn(
        `${tag} NO sendMsg call, falling back to ${source} (${content.length} chars, ${elapsed}ms, events=${statsStr})`,
      );
    }
    try {
      await this.sendMessage(
        payload.agentPrincipalId.trim(),
        {
          sessionId: payload.sessionId,
          content,
          replyToId: payload.triggerMessageId,
        },
        { role: 'assistant', skipAgentTrigger: true },
      );
    } catch (err) {
      this.logger.error(`${tag} fallback send failed: ${String(err)}`);
    }
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
   * 把最近一条 agent 回复替换为 lazy guard 标签, 让前端按固定 markdown tag 本地化渲染。
   * @keyword-en replace-lazy-guard-reply markdown-tag i18n
   */
  private async replaceLatestReplyWithLazyGuard(
    sessionId: string,
    agentPrincipalId: string,
    triggerMessageId: string,
    guard: CurrentSessionGuardResult,
  ): Promise<boolean> {
    const msg = await this.messageRepo.findOne({
      where: {
        sessionId,
        senderId: agentPrincipalId,
        replyToId: triggerMessageId,
        isDelete: false,
      },
      order: { createdAt: 'DESC' },
    });
    if (!msg) return false;

    msg.content = CURRENT_SESSION_LAZY_GUARD_MARKDOWN;
    msg.metadata = {
      ...(msg.metadata ?? {}),
      lazyGuard: {
        reasons: guard.reasons,
        didInitTip: guard.didInitTip,
        didEvidenceHook: guard.didEvidenceHook,
        didPendingAction: guard.didPendingAction,
        didPendingActionDelivery: guard.didPendingActionDelivery,
        declaredInitTip: guard.declaredInitTip,
        inferredInitTip: guard.inferredInitTip,
      },
    };
    msg.isEdited = true;
    msg.editedAt = new Date();
    await this.messageRepo.save(msg);
    this.imGateway.broadcastNewMessageBeacon([], {
      sessionId,
      lastMessageId: msg.id,
    });
    return true;
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

    // === 起手前 seed 必读手册到 session_data ::
    // 由 SessionHandbookSeederService 统一处理:
    //  - 默认手册 (handbook.saas_system_hook) :: 所有 agent 都种
    //  - 主动对话手册 (handbook.conversation_hook) :: proactiveChatEnabled 才种
    // ownerPrincipalId 强制为该 agent, list 渲染时 handbook 段按身份过滤, 群聊多 agent 互不可见对方手册.
    await this.handbookSeeder.ensureForAgent(
      payload.sessionId,
      agent,
      payload.agentPrincipalId,
    );

    // === 主动对话模式 ===
    // proactiveChatEnabled 时 LLM 通过 call_hook('saas.app.conversation.sendMsg', ...) 自行决定何时发消息;
    // 没发的情况下 runProactiveDialogue 会用流式收集的文本兜底发; lazy guard 命中时最多自动重试一次.
    if (agent.proactiveChatEnabled !== false) {
      await this.runProactiveDialogue(agent, payload, messages);
      return;
    }

    await this.runNormalDialogue(agent, payload, messages);
  }

  /**
   * 普通模式执行一轮 LLM, lazy guard 命中时自动重试一次。
   * @keyword-en run-normal-dialogue lazy-retry
   */
  private async runNormalDialogue(
    agent: import('@/app/agent/entities/agent.entity').AgentEntity,
    payload: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
      userContent: string;
    },
    messages: ChatMessage[],
    retryAttempt = 0,
  ): Promise<void> {
    const invocationContext = await this.buildAgentInvocationContext(payload);
    this.currentSession.beginTurn(payload.sessionId, payload.agentPrincipalId);
    const inferredNeed = this.currentSession.inferInitTipFromMessages(messages);
    const gen = this.agentRuntimeService.startDialogue(
      agent.codeDir,
      messages,
      {
        aiModelIds: Array.isArray(agent.aiModelIds) ? agent.aiModelIds : [],
        invocationContext,
        agentContext: this.buildAgentRuntimeContext(agent, invocationContext),
        // checkpoint 会话记忆 :: thread = sessionId:agentPrincipalId
        sessionId: payload.sessionId,
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

    const guard = this.currentSession.evaluateToolGuard(
      payload.sessionId,
      payload.agentPrincipalId,
      inferredNeed,
    );
    if (guard.lazy && retryAttempt < 1) {
      await this.persistLazyRetryNudgeToTriggerMessage(
        payload.triggerMessageId,
        guard,
      );
      this.logger.warn(
        `[normal-retry:${retryAttempt + 1}] lazy guard hit, retrying once (reasons=${guard.reasons.join(',')})`,
      );
      const retryMessages = await this.buildAgentDialogueMessages(payload);
      await this.runNormalDialogue(
        agent,
        payload,
        this.withLazyRetryNudge(retryMessages, guard),
        retryAttempt + 1,
      );
      return;
    }
    const trimmed = guard.lazy
      ? CURRENT_SESSION_LAZY_GUARD_MARKDOWN
      : fullContent.trim();
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
   * 给 lazy retry 追加强提示; DB meta 是主来源, 这里兜底修补当前内存 messages。
   * @keyword-en lazy-retry-nudge current-session-guard
   */
  private withLazyRetryNudge(
    messages: ChatMessage[],
    guard: CurrentSessionGuardResult,
  ): ChatMessage[] {
    const retry = this.buildLazyRetryNudge(guard);
    const block = this.renderLazyRetryNudgeBlock(retry);
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg?.role !== 'user') continue;
      if (
        msg.content.includes('[current_session_retry]') ||
        msg.content.includes('"currentSessionRetry"')
      ) {
        return messages;
      }
      return messages.map((it, index) =>
        index === i
          ? {
              ...it,
              content: this.mergeLazyRetryNudgeIntoContent(
                it.content,
                retry,
                block,
              ),
            }
          : it,
      );
    }
    return messages;
  }

  /**
   * 把 retry nudge 写入 JSON envelope; 非 JSON 文本才追加标记块。
   * @keyword-en merge-lazy-retry-nudge json-envelope
   */
  private mergeLazyRetryNudgeIntoContent(
    content: string,
    retry: LlmCurrentSessionRetry,
    block: string,
  ): string {
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return `${content}\n\n${block}`;
      }
      return JSON.stringify({
        ...(parsed as Record<string, unknown>),
        currentSessionRetry: retry,
      });
    } catch {
      return `${content}\n\n${block}`;
    }
  }

  /**
   * 构建第二次尝试使用的强 currentSessionRetry JSON; 保底机制只查 init_tip + evidence hook 两条.
   * @keyword-en build-lazy-retry-nudge, minimal-fallback-retry
   */
  private buildLazyRetryNudge(
    guard: CurrentSessionGuardResult,
  ): LlmCurrentSessionRetry {
    const requiredReferences: string[] = [];
    const missedInitTip = guard.reasons.includes('missing_init_tip');
    const missedEvidence = guard.reasons.includes('missing_evidence_hook');
    if (missedInitTip) {
      requiredReferences.push(
        'init_tip: call saas.app.conversation.initTip first this turn with honest needKnowledge/needHook. For pure chat use [{needKnowledge:false, needHook:false, reason:"chat"}], then call sendMsg. Read suggestions from the response before deciding next hook.',
      );
    }
    if (missedEvidence) {
      if (guard.didPendingAction && !guard.didPendingActionDelivery) {
        requiredReferences.push(
          'pending_action_delivery: setPendingAction already recorded; now call saas.app.conversation.sendMsg to ask pendingAction.question or missingFields.',
        );
      } else {
        requiredReferences.push(
          'evidence_hook: call any non-currentSession non-sendMsg business hook (or saas.app.knowledge.* / sessionData.get / callHistory.query) to back up your answer. If required args are missing, setPendingAction(stage=missing_args) + sendMsg the question. If no capability exists, setPendingAction(stage=not_found) + sendMsg the limitation.',
        );
      }
    }
    if (requiredReferences.length === 0) {
      requiredReferences.push(
        'Use the first decision below to complete the missing guard step before replying.',
      );
    }
    const failedBecause = missedInitTip
      ? 'Previous attempt did not call initTip. This is the mandatory turn-init step even when the answer is pure chat.'
      : guard.didPendingAction && !guard.didPendingActionDelivery
        ? 'Previous attempt stored a pendingAction but did not deliver the required follow-up question through sendMsg.'
        : 'Previous attempt did not record any evidence hook, knowledge read, or pendingAction; the reply is unbacked.';
    return {
      required: true,
      severity: 'strict',
      attempt: 2,
      reasons: guard.reasons,
      failedBecause,
      previousDecision: {
        declaredInitTip: guard.declaredInitTip,
        inferredInitTip: guard.inferredInitTip,
        completed: {
          didInitTip: guard.didInitTip,
          didEvidenceHook: guard.didEvidenceHook,
          didPendingAction: guard.didPendingAction,
          didPendingActionDelivery: guard.didPendingActionDelivery,
        },
        pendingAction: guard.pendingAction,
        successfulHookNames: guard.successfulHookNames,
      },
      requiredReferences,
      hookName: 'saas.app.conversation.initTip',
      payload: '{needKnowledge,needHook,reason}',
      must: [
        'DO THIS FIRST: call call_hook with call="saas.app.conversation.initTip" and payload {needKnowledge,needHook,reason} (single object) before any final text or sendMsg.',
        'Read the suggestions in the response (callHistoryHints / handbookInventory / activeDirectives / suggestedChain / tipNote). Use them to choose the next hook freely — they are advisory, not forced.',
        'If this is pure chat, use payload {needKnowledge:false,needHook:false,reason:"chat"}, then call saas.app.conversation.sendMsg.',
        'initTip only declares state; it never substitutes for evidence. If needHook=true, call a real business/knowledge hook, or setPendingAction (missing_args/not_found) + sendMsg.',
        'Do not return final text directly in proactive mode — only sendMsg reaches the user.',
      ],
      successCriteria: [
        'initTip is called with honest true/false flags and suggestions are read.',
        'When needHook=true, a real evidence hook is recorded, OR pendingAction(missing_args/not_found) + sendMsg is delivered.',
        'A visible reply is delivered through saas.app.conversation.sendMsg.',
      ],
    };
  }

  /**
   * 把 lazy retry JSON 持久化到触发消息 meta, 让后续读取历史时重新拼入 envelope。
   * @keyword-en persist-lazy-retry-nudge metadata-envelope
   */
  private async persistLazyRetryNudgeToTriggerMessage(
    triggerMessageId: string,
    guard: CurrentSessionGuardResult,
  ): Promise<LlmCurrentSessionRetry> {
    const retry = this.buildLazyRetryNudge(guard);
    const msg = await this.messageRepo.findOne({
      where: { id: triggerMessageId, isDelete: false },
    });
    if (!msg) return retry;
    msg.metadata = {
      ...(msg.metadata ?? {}),
      currentSessionRetry: retry,
    };
    await this.messageRepo.save(msg);
    return retry;
  }

  /**
   * 渲染非 JSON 消息使用的 current_session_retry 文本块。
   * @keyword-en render-lazy-retry-nudge
   */
  private renderLazyRetryNudgeBlock(retry: LlmCurrentSessionRetry): string {
    return [
      '[current_session_retry]',
      `failed: ${retry.reasons.join(',')}`,
      retry.failedBecause,
      `must call: ${retry.hookName} ${retry.payload}`,
      `previousDecision: ${JSON.stringify(retry.previousDecision)}`,
      'requiredReferences:',
      ...retry.requiredReferences.map((it) => `- ${it}`),
      ...retry.must.map((it) => `- ${it}`),
      '[/current_session_retry]',
    ].join('\n');
  }

  /**
   * 从消息 meta 读取 currentSessionRetry 并拼回 LLM envelope。
   * @keyword-en merge-metadata-lazy-retry
   */
  private mergeMetadataLazyRetryNudge(content: string, value: unknown): string {
    const retry = this.readLazyRetryNudge(value);
    if (!retry) return content;
    return this.mergeLazyRetryNudgeIntoContent(
      content,
      retry,
      this.renderLazyRetryNudgeBlock(retry),
    );
  }

  /**
   * 校验并读取 meta 中持久化的 currentSessionRetry JSON。
   * @keyword-en read-lazy-retry-nudge
   */
  private readLazyRetryNudge(value: unknown): LlmCurrentSessionRetry | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Partial<LlmCurrentSessionRetry>;
    if (
      record.required !== true ||
      record.severity !== 'strict' ||
      record.attempt !== 2 ||
      record.hookName !== 'saas.app.conversation.initTip' ||
      record.payload !== '{needKnowledge,needHook,reason}' ||
      !Array.isArray(record.reasons) ||
      !Array.isArray(record.requiredReferences) ||
      !Array.isArray(record.must) ||
      !Array.isArray(record.successCriteria)
    ) {
      return null;
    }
    return {
      required: true,
      severity: 'strict',
      attempt: 2,
      reasons: record.reasons.filter(
        (it): it is string => typeof it === 'string',
      ),
      failedBecause:
        typeof record.failedBecause === 'string'
          ? record.failedBecause
          : 'Previous attempt failed the currentSession guard.',
      previousDecision: this.readLazyRetryPreviousDecision(
        record.previousDecision,
      ),
      requiredReferences: record.requiredReferences.filter(
        (it): it is string => typeof it === 'string',
      ),
      hookName: 'saas.app.conversation.initTip',
      payload: '{needKnowledge,needHook,reason}',
      must: record.must.filter((it): it is string => typeof it === 'string'),
      successCriteria: record.successCriteria.filter(
        (it): it is string => typeof it === 'string',
      ),
    };
  }

  /**
   * 校验并读取 retry meta 中的第一次 currentSession 判定快照。
   * @keyword-en read-lazy-retry-previous-decision
   */
  private readLazyRetryPreviousDecision(
    value: unknown,
  ): LlmCurrentSessionRetry['previousDecision'] {
    const fallback: LlmCurrentSessionRetry['previousDecision'] = {
      declaredInitTip: null,
      inferredInitTip: {
        needKnowledge: false,
        needHook: false,
        reason: 'unknown',
      },
      completed: {
        didInitTip: false,
        didEvidenceHook: false,
        didPendingAction: false,
        didPendingActionDelivery: false,
      },
      pendingAction: null,
      successfulHookNames: [],
    };
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fallback;
    }
    const record = value as Record<string, unknown>;
    return {
      declaredInitTip: this.readInitTipSnapshot(record.declaredInitTip),
      inferredInitTip:
        this.readInitTipSnapshot(record.inferredInitTip) ??
        fallback.inferredInitTip,
      completed: {
        didInitTip: readBooleanPath(record.completed, 'didInitTip'),
        didEvidenceHook: readBooleanPath(record.completed, 'didEvidenceHook'),
        didPendingAction: readBooleanPath(record.completed, 'didPendingAction'),
        didPendingActionDelivery: readBooleanPath(
          record.completed,
          'didPendingActionDelivery',
        ),
      },
      pendingAction: this.readLazyRetryPendingAction(record.pendingAction),
      successfulHookNames: Array.isArray(record.successfulHookNames)
        ? record.successfulHookNames.filter(
            (it): it is string => typeof it === 'string',
          )
        : [],
    };
  }

  /**
   * 读取 retry meta 中的 pendingAction 快照。
   * @keyword-en read-lazy-retry-pending-action
   */
  private readLazyRetryPendingAction(
    value: unknown,
  ): CurrentSessionGuardResult['pendingAction'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const stage = record.stage;
    if (
      stage !== 'missing_args' &&
      stage !== 'ready' &&
      stage !== 'not_found'
    ) {
      return null;
    }
    const missingFields = Array.isArray(record.missingFields)
      ? record.missingFields.filter(
          (it): it is string => typeof it === 'string',
        )
      : [];
    const collectedFields =
      record.collectedFields &&
      typeof record.collectedFields === 'object' &&
      !Array.isArray(record.collectedFields)
        ? (record.collectedFields as Record<string, unknown>)
        : {};
    return {
      stage,
      missingFields,
      collectedFields,
      ...(typeof record.hookName === 'string'
        ? { hookName: record.hookName }
        : {}),
      ...(typeof record.domain === 'string' ? { domain: record.domain } : {}),
      ...(typeof record.action === 'string' ? { action: record.action } : {}),
      ...(typeof record.question === 'string'
        ? { question: record.question }
        : {}),
      ...(typeof record.reason === 'string' ? { reason: record.reason } : {}),
    };
  }

  /**
   * 读取 initTip 快照对象。
   * @keyword-en read-need-some-think-snapshot
   */
  private readInitTipSnapshot(
    value: unknown,
  ): CurrentSessionGuardResult['declaredInitTip'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.needKnowledge !== 'boolean' ||
      typeof record.needHook !== 'boolean'
    ) {
      return null;
    }
    return {
      needKnowledge: record.needKnowledge,
      needHook: record.needHook,
      ...(typeof record.reason === 'string' ? { reason: record.reason } : {}),
    };
  }

  /**
   * lazy retry 前软删第一次无效回复, 避免重试成功后出现两条回复。
   * @keyword-en discard-lazy-retry-reply soft-delete
   */
  private async discardLatestReplyForLazyRetry(
    sessionId: string,
    agentPrincipalId: string,
    triggerMessageId: string,
    guard: CurrentSessionGuardResult,
  ): Promise<boolean> {
    const msg = await this.messageRepo.findOne({
      where: {
        sessionId,
        senderId: agentPrincipalId,
        replyToId: triggerMessageId,
        isDelete: false,
      },
      order: { createdAt: 'DESC' },
    });
    if (!msg) return false;
    msg.isDelete = true;
    msg.metadata = {
      ...(msg.metadata ?? {}),
      lazyRetryDiscarded: {
        reasons: guard.reasons,
        discardedAt: new Date().toISOString(),
      },
    };
    await this.messageRepo.save(msg);
    this.imGateway.broadcastNewMessageBeacon([], {
      sessionId,
      lastMessageId: msg.id,
    });
    return true;
  }

  /**
   * 构建 Agent 调用 Hook 的运行时上下文; 鉴权主体以 Agent 为准, 业务租户以当前触发用户为准。
   * @keyword-en build-agent-hook-invocation-context
   */
  private async buildAgentInvocationContext(
    payload: {
      sessionId: string;
      agentPrincipalId: string;
      triggerMessageId: string;
    },
    opts?: { isProactive?: boolean },
  ): Promise<HookInvocationContext> {
    const triggerMessage = await this.messageRepo.findOne({
      where: {
        id: payload.triggerMessageId,
        sessionId: payload.sessionId,
        isDelete: false,
      },
      select: ['id', 'senderId'],
    });
    const senderPrincipal =
      triggerMessage?.senderId &&
      triggerMessage.senderId !== payload.agentPrincipalId
        ? await this.principalRepo.findOne({
            where: { id: triggerMessage.senderId, isDelete: false },
            select: ['id', 'tenantId'],
          })
        : null;
    const agentPrincipal = await this.principalRepo.findOne({
      where: { id: payload.agentPrincipalId, isDelete: false },
      select: ['id', 'principalType', 'tenantId'],
    });
    const tenantId =
      senderPrincipal?.tenantId ?? agentPrincipal?.tenantId ?? null;
    const tenantSource = senderPrincipal?.tenantId
      ? 'sender'
      : agentPrincipal?.tenantId
        ? 'agent'
        : 'none';
    const principalType = 'agent';
    this.logger.log(
      `[agent-hook-context] session=${payload.sessionId} agent=${payload.agentPrincipalId} ` +
        `agentDbType=${agentPrincipal?.principalType ?? 'null'} principalType=${principalType} ` +
        `agentTenant=${agentPrincipal?.tenantId ?? 'null'} trigger=${payload.triggerMessageId} ` +
        `sender=${triggerMessage?.senderId ?? 'null'} senderTenant=${senderPrincipal?.tenantId ?? 'null'} ` +
        `resolvedTenant=${tenantId ?? 'null'} tenantSource=${tenantSource}`,
    );
    return {
      principalId: payload.agentPrincipalId,
      principalType,
      source: 'llm',
      extras: {
        sessionId: payload.sessionId,
        triggerMessageId: payload.triggerMessageId,
        ...(tenantId ? { tenantId } : {}),
        ...(opts?.isProactive ? { isProactive: true } : {}),
      },
    };
  }

  /**
   * 构建 AgentRuntime 前置上下文; 只作为 LLM 认知信息, 鉴权仍由 invocationContext.principalId 决定。
   * @keyword-en build-agent-runtime-context
   */
  private buildAgentRuntimeContext(
    agent: AgentEntity,
    invocationContext: HookInvocationContext,
  ): {
    agentId: string;
    agentPrincipalId: string;
    nickname: string;
    purpose: string | null;
    tenantId: string | null;
  } {
    const tenantId =
      typeof invocationContext.extras?.tenantId === 'string'
        ? invocationContext.extras.tenantId
        : null;
    return {
      agentId: agent.id,
      agentPrincipalId:
        agent.principalId ?? invocationContext.principalId ?? agent.id,
      nickname: agent.nickname,
      purpose: agent.purpose ?? null,
      tenantId,
    };
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
      .where('a.nickname = :nickname', { nickname })
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
   * @keyword-en build-agent-dialogue-messages, context-reorder, pending-db-bound, group-chat-filter, smart-context
   */
  private async buildAgentDialogueMessages(args: {
    sessionId: string;
    agentPrincipalId: string;
    /** 本轮触发消息 ID @keyword-en trigger-message-id */
    triggerMessageId: string;
  }): Promise<ChatMessage[]> {
    const context: ChatMessage[] = [];
    const smartDigest = await this.smartService.getContextDigest(
      args.sessionId,
      args.triggerMessageId,
    );
    if (smartDigest.items.length > 0) {
      context.push(this.toSmartDigestMessage(args.sessionId, smartDigest));
    }

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
    const smartCoveredUntilMessageId = smartDigest.coveredUntilMessageId;

    if (prevTriggerMessageId) {
      // 1. 历史消息：已经进入 smart 的段只保留摘要索引, 未收录尾巴保留原消息
      const historyQb = this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: args.sessionId })
        .andWhere('m.is_delete = false')
        .andWhere('m.id <= :upper', { upper: prevTriggerMessageId })
        .orderBy('m.id', 'DESC')
        .limit(18);
      if (smartCoveredUntilMessageId) {
        historyQb.andWhere('m.id > :smartCovered', {
          smartCovered: smartCoveredUntilMessageId,
        });
      }
      const historyRows = await historyQb.getMany();
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
      if (
        lastAgentMsg &&
        isMessageIdAfter(lastAgentMsg.id, smartCoveredUntilMessageId)
      ) {
        context.push(
          this.toDialogueMessage(lastAgentMsg, args.agentPrincipalId),
        );
      }
    }

    // 3. pending：prevTriggerMessageId（不含）到 triggerMessageId（含）之间的消息
    const pendingLowerBound = laterMessageId(
      prevTriggerMessageId,
      smartCoveredUntilMessageId,
    );
    const pendingQb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: args.sessionId })
      .andWhere('m.is_delete = false')
      .andWhere('m.sender_id != :aid', { aid: args.agentPrincipalId })
      .andWhere('m.message_type != :sys', { sys: ChatMessageType.System })
      .andWhere('m.id <= :to', { to: args.triggerMessageId });

    if (pendingLowerBound) {
      pendingQb.andWhere('m.id > :from', { from: pendingLowerBound });
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
      context.push(this.toDialogueMessage(row, args.agentPrincipalId));
    }

    return context;
  }

  /**
   * 把 smart 历史摘要索引转换为 LLM 可见的系统上下文消息。
   * @keyword-cn smart上下文, 历史摘要, 上下文压缩
   * @keyword-en smart-context-message, history-summary, context-compression
   */
  private toSmartDigestMessage(
    sessionId: string,
    digest: ChatSessionSmartContextDigest,
  ): ChatMessage {
    return {
      role: 'assistant',
      timestamp: new Date(),
      content: [
        '[conversation_smart_history]',
        JSON.stringify({
          sessionId,
          purpose:
            'Historical messages already compacted into smart segments. Treat this as an index, not as the current user request.',
          instruction:
            'Use items as [{smartId,keywords,summary}]. If details are needed, call saas.app.conversation.smartMessages with {sessionId,smartIds:[smartId]}. If omittedOlderSmartCount>0 or no item matches, call smartSearch by keywords first, then smartMessages. Do not ask the user to repeat before using these tools.',
          coveredUntilMessageId: digest.coveredUntilMessageId,
          omittedOlderSmartCount: digest.omittedCount,
          items: digest.items.map((item) => ({
            smartId: item.smartId,
            keywords: item.keywords,
            summary: item.summary,
            startMessageId: item.startMessageId,
            endMessageId: item.endMessageId,
            messageCount: item.messageCount,
            analyzedAt: item.analyzedAt,
          })),
        }),
        '[/conversation_smart_history]',
      ].join('\n'),
    };
  }

  /**
   * 将消息实体映射为对话消息。
   *
   * 附件透出策略 (LLM 可见):
   *   - msg.attachments 非空时, 在 content 末尾追加 <im_attachments>...</im_attachments> 块
   *   - 仅暴露 resourceId / name / type / size, 不暴露签名 URL (URL 是浏览器渲染用)
   *   - LLM 拿 resourceId 后可直接调 saas.app.storage.createNode 入库,
   *     或调 saas.app.resource.currentSession 查全量会话文件 (含历史)
   *   - assistant 自己发的消息也带 attachments, 但通常无 resourceId; 透出仅供 LLM 回忆
   *
   * envelope (v3) 已弃用; 不再读 metadata.llmContent
   * @keyword-en to-dialogue-message, attachments-llm-visible, resource-id
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

    const attachmentBlock = this.buildAttachmentBlockForLlm(msg.attachments);
    const content = attachmentBlock
      ? `${msg.content}\n${attachmentBlock}`
      : msg.content;

    return {
      role,
      content,
      timestamp: msg.createdAt,
    };
  }

  /**
   * 把消息附件序列化成 LLM 可见的结构化标签, 只透出 resourceId / name / type / size。
   * 返回空串表示没有附件或附件都缺 resourceId (旧消息) — 不污染 prompt。
   * @keyword-en build-attachment-block-for-llm, resource-id-injection
   */
  private buildAttachmentBlockForLlm(
    attachments: ChatMessageEntity['attachments'],
  ): string {
    if (!attachments || attachments.length === 0) return '';
    const lines: string[] = [];
    for (const att of attachments) {
      const rid = att.resourceId?.trim();
      if (!rid) continue; // 历史无 resourceId 数据, 跳过 (旧 markdown 链接已在 content 里)
      const name = att.name ?? '';
      const type = att.type ?? 'file';
      const size = typeof att.size === 'number' ? att.size : '';
      lines.push(
        `- resourceId="${rid}" name="${name}" type="${type}" size="${size}"`,
      );
    }
    if (lines.length === 0) return '';
    return [
      '<im_attachments>',
      '本条消息包含以下用户上传的文件 (resourceId 已可用, 可直接传入 saas.app.storage.createNode 等 hook):',
      ...lines,
      '</im_attachments>',
    ].join('\n');
  }

  /**
   * 解析一条消息是否面向 agent :: 群聊看 mentions, 私聊看另一名成员是否 agent。
   * @keyword-en resolve-agent-target-ids
   */
  private async resolveAgentTargetIds(
    session: ChatSessionEntity,
    senderId: string,
    mentions: MentionInfo[],
  ): Promise<string[]> {
    const ids = new Set<string>();
    for (const mention of mentions) {
      if (await this.isAgentPrincipal(mention.principalId)) {
        ids.add(mention.principalId);
      }
    }
    if (session.type === ChatSessionType.Private) {
      const otherMemberId = await this.sessionService.getOtherMember(
        session.id,
        senderId,
      );
      if (otherMemberId && (await this.isAgentPrincipal(otherMemberId))) {
        ids.add(otherMemberId);
      }
    }
    return [...ids];
  }

  /**
   * 构建仅供 LLM 读取的结构化消息正文 :: 前端仍展示原 content。
   * @keyword-cn 结构化提示, 隐藏正文, 工具引导
   * @keyword-en structured-llm-guidance, hidden-content, tool-guidance
   */
  private withStructuredLlmGuidance(content: string): string {
    const task = this.buildGuidanceTask(content);
    const envelope: LlmGuidanceEnvelope = {
      v: LLM_GUIDANCE_ENVELOPE_VERSION,
      kind: 'im.user',
      text: content,
      task,
      mode: {
        proactive: true,
        reply: 'send_msg',
      },
      must: this.buildGuidanceMustCodes(task),
      refs: this.buildGuidanceRefs(task),
      currentSessionGuard: this.buildCurrentSessionGuardRequirement(task),
    };
    return JSON.stringify(envelope);
  }

  /**
   * 判断旧版 guard 是否需要压缩为当前短结构。
   * @keyword-cn 当前会话判定, 缓存稳定, 结构压缩
   * @keyword-en current-session-guard, cache-stability, compact-shape
   */
  private hasCompactCurrentSessionGuard(
    guard: unknown,
  ): guard is LlmCurrentSessionGuard {
    if (!guard || typeof guard !== 'object' || Array.isArray(guard)) {
      return false;
    }
    const record = guard as Record<string, unknown>;
    return (
      record.required === true &&
      record.tool === 'call_hook' &&
      record.hookName === 'saas.app.conversation.initTip' &&
      typeof record.payload === 'string' &&
      typeof record.reason === 'string' &&
      typeof record.rule === 'string'
    );
  }

  /**
   * 给旧版 llmContent 幂等补齐 currentSessionGuard, 保持历史 user envelope 与新消息同形。
   * @keyword-cn 结构化提示, 缓存稳定, 当前会话判定
   * @keyword-en structured-guidance, cache-stability, current-session-guard
   */
  private ensureStructuredLlmGuidanceGuard(
    content: string,
    fallbackContent: string,
  ): string {
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return this.withStructuredLlmGuidance(fallbackContent);
      }
      const envelope = parsed as Partial<LlmGuidanceEnvelope>;
      const task =
        envelope.task &&
        typeof envelope.task === 'object' &&
        typeof envelope.task.type === 'string'
          ? envelope.task
          : this.buildGuidanceTask(fallbackContent);
      const envelopeMust = Array.isArray(envelope.must)
        ? envelope.must.filter((it): it is string => typeof it === 'string')
        : [];
      const hadCurrentSessionMust = envelopeMust.includes(INIT_TIP_FIRST_MUST);
      const must = this.ensureCurrentSessionMustCode(
        envelopeMust.length > 0
          ? envelopeMust
          : this.buildGuidanceMustCodes(task),
      );
      if (
        this.hasCompactCurrentSessionGuard(envelope.currentSessionGuard) &&
        hadCurrentSessionMust
      ) {
        return content;
      }
      return JSON.stringify({
        ...envelope,
        must,
        currentSessionGuard: this.buildCurrentSessionGuardRequirement(task),
      });
    } catch {
      return this.withStructuredLlmGuidance(fallbackContent);
    }
  }

  /**
   * 构建每轮强制调用 initTip 的 user envelope 字段。
   * @keyword-cn 当前会话判定, 工具强制, 结构化提示
   * @keyword-en current-session-guard, mandatory-tool, structured-guidance
   */
  private buildCurrentSessionGuardRequirement(
    task: LlmGuidanceTask,
  ): LlmCurrentSessionGuard {
    return {
      required: true,
      tool: 'call_hook',
      hookName: 'saas.app.conversation.initTip',
      payload: '{needKnowledge,needHook,reason?}',
      reason: task.type,
      rule: 'FIRST tool call every turn. Pure chat => false,false then sendMsg. needHook + missing args => currentSession.setPendingAction(missing_args) then sendMsg question; ready => business hook.',
    };
  }

  /**
   * 从用户原文推导轻量任务标签, 只做路由提示, 不替代工具校验。
   * @keyword-cn 任务标签, 结构化提示, 意图识别
   * @keyword-en guidance-task, structured-guidance, intent-detect
   */
  /**
   * 确保 v3 user envelope 的 must 列表显式包含 initTip 首步。
   * @keyword-cn 当前会话判定, 强制步骤
   * @keyword-en current-session-must, mandatory-tool
   */
  private ensureCurrentSessionMustCode(codes: string[]): string[] {
    const normalized = codes.filter((it) => typeof it === 'string' && it);
    if (normalized.includes(INIT_TIP_FIRST_MUST)) {
      return [...new Set(normalized)];
    }
    const insertAt = normalized.includes('use_system_prompt') ? 1 : 0;
    normalized.splice(insertAt, 0, INIT_TIP_FIRST_MUST);
    return [...new Set(normalized)];
  }

  /**
   * 从用户原文推导轻量任务标签, 只做路由提示, 不替代工具校验。
   * @keyword-cn 任务标签, 结构化提示, 意图识别
   * @keyword-en guidance-task, structured-guidance, intent-detect
   */
  private buildGuidanceTask(content: string): LlmGuidanceTask {
    const normalized = content.trim().toLowerCase();
    const domain = this.resolveGuidanceDomain(normalized);
    const intent = this.resolveGuidanceIntent(normalized);
    if (this.isPreviousResultReference(normalized)) {
      return { type: 'previous_result_action', domain, intent };
    }
    if (this.isContextualFollowup(normalized)) {
      return { type: 'contextual_followup', domain, intent: 'continue' };
    }
    if (intent === 'capability') {
      return {
        type: 'capability_answer',
        domain: domain === 'unknown' ? 'agent.capability' : domain,
        intent: 'explain',
      };
    }
    if (
      ['create', 'delete', 'update', 'restore', 'upload', 'save'].includes(
        intent,
      )
    ) {
      return { type: 'platform_write', domain, intent };
    }
    if (this.isCapabilityOrActionTask(content)) {
      return { type: 'platform_read', domain, intent };
    }
    return { type: 'chat', domain: 'general', intent: 'chat' };
  }

  /**
   * 把任务标签转换为 envelope must 字段的行为代号; ID 自解释, base prompt 不再附字典.
   * @keyword-cn 行为代号, 结构化提示, 工具规划
   * @keyword-en must-codes, structured-guidance, tool-planning
   */
  private buildGuidanceMustCodes(task: LlmGuidanceTask): string[] {
    const codes = ['use_system_prompt', 'send_msg'];
    if (task.type === 'chat') return this.ensureCurrentSessionMustCode(codes);
    codes.push('resolve_context', 'resolve_terms_by_knowledge');
    if (
      task.type === 'previous_result_action' ||
      task.type === 'contextual_followup'
    ) {
      codes.push('previous_result_lookup');
    }
    if (
      task.type === 'capability_answer' ||
      task.type === 'platform_read' ||
      task.type === 'platform_write'
    ) {
      codes.push(
        'call_history_first',
        'unknown_discovery_order',
        'verify_capability',
        'no_memory_answer',
      );
    }
    return this.ensureCurrentSessionMustCode(codes);
  }

  /**
   * 把任务标签转换为 envelope refs 字段的提示锚点; 与 examples 配合体现, base prompt 不再附字典.
   * @keyword-cn 提示锚点, 结构化提示, envelope
   * @keyword-en envelope-refs, structured-guidance, anchor-hints
   */
  private buildGuidanceRefs(task: LlmGuidanceTask): string[] {
    const refs = ['input', 'proactive', 'response'];
    if (task.type !== 'chat') {
      refs.push('discovery', 'knowledge', 'semantics', 'tools');
    }
    if (
      task.type === 'capability_answer' ||
      task.type === 'platform_read' ||
      task.type === 'platform_write'
    ) {
      refs.push('answer');
    }
    return refs;
  }

  /**
   * 识别用户请求所指向的平台业务域。
   * @keyword-cn 业务域, 意图识别, 结构化提示
   * @keyword-en guidance-domain, intent-detect, structured-guidance
   */
  private resolveGuidanceDomain(normalized: string): string {
    if (/(待办|todo|任务)/.test(normalized)) return 'todo';
    if (/(用户|user)/.test(normalized)) return 'identity.user';
    if (/(主体|principal)/.test(normalized)) return 'identity.principal';
    if (/(组织|organization|org)/.test(normalized)) {
      return 'identity.organization';
    }
    if (/(角色|role)/.test(normalized)) return 'identity.role';
    if (/(权限|permission|rbac)/.test(normalized)) {
      return 'identity.permission';
    }
    if (/(文件|资源|目录|file|folder|storage|resource)/.test(normalized)) {
      return 'storage.file';
    }
    if (/(solution|应用|能力包)/.test(normalized)) return 'solution';
    if (/(runner|运行器)/.test(normalized)) return 'runner';
    if (/(知识|knowledge|手册|handbook)/.test(normalized)) return 'knowledge';
    if (/(hook|工具|tool)/.test(normalized)) return 'hook';
    if (/(会话|对话|历史|conversation|history)/.test(normalized)) {
      return 'conversation';
    }
    if (/(时间|时区|time|timezone)/.test(normalized)) return 'time';
    return 'unknown';
  }

  /**
   * 识别用户请求的动作意图。
   * @keyword-cn 动作意图, 意图识别, 结构化提示
   * @keyword-en guidance-intent, intent-detect, structured-guidance
   */
  private resolveGuidanceIntent(normalized: string): string {
    if (
      /(你能干嘛|你能做什么|你会什么|你有什么能力|你有哪些能力|你可以做什么|你支持什么)/.test(
        normalized,
      )
    ) {
      return 'capability';
    }
    if (/(几个|多少|数量|总数|count)/.test(normalized)) return 'count';
    if (/(删除|删掉|移除|delete|remove)/.test(normalized)) return 'delete';
    if (/(恢复|还原|restore)/.test(normalized)) return 'restore';
    if (/(创建|新建|添加|新增|create|add)/.test(normalized)) {
      return 'create';
    }
    if (/(修改|改成|更新|编辑|update|edit)/.test(normalized)) return 'update';
    if (/(上传|upload)/.test(normalized)) return 'upload';
    if (/(保存|save)/.test(normalized)) return 'save';
    if (
      /(列出|列表|有哪些|看看|查看|查询|搜索|现在有|当前有|list|search|show)/.test(
        normalized,
      )
    ) {
      return 'list';
    }
    if (
      /(为什么|怎么|如何|是什么|具体|介绍|explain|why|how)/.test(normalized)
    ) {
      return 'explain';
    }
    return 'read';
  }

  /**
   * 判断用户是否引用了上一轮或工具结果。
   * @keyword-cn 上下文引用, 历史结果, 意图识别
   * @keyword-en previous-result, context-reference, intent-detect
   */
  private isPreviousResultReference(normalized: string): boolean {
    return /(刚刚|刚才|上一条|上一个|之前|那个结果|这个结果|那条数据|这条数据|previous|last|just now|that data|that result)/.test(
      normalized,
    );
  }

  /**
   * 判断用户短答是否依赖前文语境继续执行。
   * @keyword-cn 语境续接, 短答, 意图识别
   * @keyword-en contextual-followup, short-reply, intent-detect
   */
  private isContextualFollowup(normalized: string): boolean {
    return /^(好|好的|可以|行|嗯|对|是的|当然|当然了|就这个|就它|继续|不用|不要|算了|yes|ok|sure|continue)$/i.test(
      normalized,
    );
  }

  /**
   * 判断用户是否在询问或尝试调用 Agent / 系统能力。
   * @keyword-en is-capability-or-action-task
   */
  private isCapabilityOrActionTask(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    if (!normalized) return false;
    return [
      '你能干嘛',
      '你能做什么',
      '你会什么',
      '你有什么能力',
      '你有哪些能力',
      '你可以做什么',
      '你支持什么',
      '帮我',
      '给我',
      '查一下',
      '查询',
      '搜索',
      '创建',
      '新建',
      '修改',
      '更新',
      '删除',
      '上传',
      '下载',
      '保存',
      '读取',
      '管理',
      '授权',
      '权限',
      '用户',
      '员工',
      '成员',
      '主体',
      '角色',
      '组织',
      '文件',
      '资源',
      '待办',
      '提醒',
      '应用',
      'todo',
      'runner',
      'solution',
      'hook',
      '知识库',
      '会话',
      '历史',
      '手册',
      '刚刚',
      '刚才',
      '上一条',
      '上一个',
      '那条数据',
      '那个结果',
      '这条数据',
      '这个结果',
      '前面那个',
      '能干嘛',
      '能做啥',
      'what can you do',
      'what are your capabilities',
      'what can this agent do',
      'what can the system do',
      'your capabilities',
      'capabilities',
      'help me',
      'can you',
      'please create',
      'please update',
      'please delete',
      'search',
      'query',
      'create',
      'update',
      'delete',
      'upload',
      'download',
      'save',
      'read',
      'manage',
      'permission',
      'role',
      'organization',
      'file',
      'resource',
      'knowledge',
      'manual',
      'just now',
      'previous result',
      'last result',
      'that data',
      'that record',
      'that item',
      'the previous',
    ].some((keyword) => normalized.includes(keyword));
  }

  /**
   * 构建消息 metadata :: mentions 用于通知/群聊过滤, llmContent 仅供 Agent 上下文读取。
   * @keyword-en build-message-metadata
   */
  private buildMessageMetadata(args: {
    mentions: MentionInfo[];
    llmContent: string | null;
    llmTargetAgentIds: string[];
    senderIp?: string;
  }): Record<string, unknown> | null {
    const metadata: Record<string, unknown> = {};

    if (args.mentions.length > 0) {
      metadata.mentions = args.mentions.map((m) => ({
        principalId: m.principalId,
      }));
    }

    if (args.llmContent) {
      metadata.llmContent = args.llmContent;
      metadata.llmGuidanceEnvelopeVersion = LLM_GUIDANCE_ENVELOPE_VERSION;
      metadata.llmTargetAgentIds = args.llmTargetAgentIds;
    }

    if (args.senderIp) {
      metadata.senderIp = args.senderIp;
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
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
