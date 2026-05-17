import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Logger,
} from '@nestjs/common';
import { z } from 'zod';
import { ImSessionService } from '../services/im-session.service';
import { ImMessageService } from '../services/im-message.service';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookResult } from '@/core/hookbus/types/hook.types';
import type {
  ImSessionDetail,
  ImMemberInfo,
  ImMessageInfo,
  HasNewResponse,
  ImSessionListResponse,
  ImMessageListResponse,
  InviteMembersResponse,
  ImAnnouncementListResponse,
} from '../types/im.types';
import {
  CreateImSessionDto,
  UpdateImSessionDto,
  AddMemberDto,
  InviteMembersDto,
  SendMessageDto,
  GetMessagesDto,
  GetHasNewDto,
  GetSessionsDto,
  CreateAnnouncementDto,
  GetAnnouncementsDto,
  TransferOwnerDto,
} from '../types/im.types';

/**
 * @title saas.app.conversation.sendMsg payload schema (SSOT)
 * @description 主动发消息 hook 的参数 schema, 与 ImController 内 HookRoute 共用。
 * @keywords-cn 主动发消息, payloadSchema, SSOT
 * @keywords-en send-msg, payload-schema, ssot
 */
const sendMsgSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
  content: z.string().min(1).describe('消息正文, 必填非空'),
  senderPrincipalId: z.string().describe('发送者主体 ID, 必填'),
  replyToId: z
    .string()
    .optional()
    .describe('回复消息 ID, 可选; 同一 replyToId 最多回复 4 条'),
  messageType: z
    .enum(['text', 'notification'])
    .optional()
    .describe('消息类型, 默认 text; notification 为 AI 可见用户端隐藏的通知'),
  mentions: z
    .array(z.string())
    .optional()
    .describe(
      '显式 mention 的 principal ids; 提供时优先于 content 解析触发 agent 调度 + 写 metadata.mentions, 用于服务端隐藏通知场景 (数据触点 / 主动 AI 推送) 不依赖 displayName 也能可靠艾特 agent',
    ),
  strictMention: z
    .boolean()
    .optional()
    .describe(
      '严格 mention 成员校验: true 时任一 mention 的 principal 不是会话成员 → 整条 sendMsg throw (数据触点等需要纠错机制的场景必传); ' +
        '默认 false 静默允许 mention 已退群成员 (人工 @ / agent 自主发消息场景默认行为); SYSTEM_NOTIFIER 跨群跳过.',
    ),
});

type SendMsgPayload = z.infer<typeof sendMsgSchema>;

/**
 * @title IM 控制器
 * @description IM 会话和消息的 REST API, 同时声明主动发消息 Hook。
 * @keywords-cn IM, 会话, 消息, REST, API, Hook
 * @keywords-en im, session, message, rest, api, hook
 */
@HookController({ pluginName: 'im', tags: ['conversation', 'im', 'message'] })
@Controller('im')
export class ImController {
  private readonly logger = new Logger(ImController.name);

  constructor(
    private readonly sessionService: ImSessionService,
    private readonly messageService: ImMessageService,
  ) {}

  // ========== 会话管理 ==========

  /**
   * 创建会话
   * @route POST /im/sessions
   */
  @Post('sessions')
  @CheckAbility('create', 'session')
  async createSession(
    @Body() dto: CreateImSessionDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<ImSessionDetail> {
    const creatorId = req.user?.id ?? 'anonymous';
    return this.sessionService.createSession(creatorId, dto);
  }

  /**
   * 获取当前用户的会话列表
   * @route GET /im/sessions
   */
  @Get('sessions')
  @CheckAbility('read', 'session')
  async getSessions(
    @Req() req: { user?: { id?: string } },
    @Query() dto: GetSessionsDto,
  ): Promise<ImSessionListResponse> {
    const principalId = req.user?.id ?? 'anonymous';
    return this.sessionService.getUserSessions(principalId, dto);
  }

  /**
   * 获取会话详情
   * @route GET /im/sessions/:id
   */
  @Get('sessions/:id')
  @CheckAbility('read', 'session')
  async getSession(@Param('id') id: string): Promise<ImSessionDetail> {
    return this.sessionService.getSessionDetail(id);
  }

  /**
   * 更新会话（群名等）
   * @route PATCH /im/sessions/:id
   */
  @Patch('sessions/:id')
  @CheckAbility('update', 'session')
  async updateSession(
    @Param('id') id: string,
    @Body() dto: UpdateImSessionDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<ImSessionDetail> {
    const principalId = req.user?.id ?? 'anonymous';
    return this.sessionService.updateSession(id, principalId, dto);
  }

  /**
   * 删除会话
   * @route DELETE /im/sessions/:id
   */
  @Delete('sessions/:id')
  @CheckAbility('delete', 'session')
  async deleteSession(
    @Param('id') id: string,
    @Req() req: { user?: { id?: string } },
  ): Promise<{ success: boolean }> {
    const principalId = req.user?.id ?? 'anonymous';
    await this.sessionService.deleteSession(id, principalId);
    return { success: true };
  }

  /**
   * 退出会话（群聊/频道：移除当前用户成员关系；私聊：由前端本地隐藏）
   * @route DELETE /im/sessions/:id/leave
   */
  @Delete('sessions/:id/leave')
  @CheckAbility('update', 'session')
  async leaveSession(
    @Param('id') id: string,
    @Req() req: { user?: { id?: string } },
  ): Promise<{ success: boolean }> {
    const principalId = req.user?.id ?? 'anonymous';
    await this.sessionService.leaveSession(id, principalId);
    return { success: true };
  }

  /**
   * 获取会话成员列表
   * @route GET /im/sessions/:id/members
   */
  @Get('sessions/:id/members')
  @CheckAbility('read', 'session')
  async getMembers(@Param('id') id: string): Promise<ImMemberInfo[]> {
    return this.sessionService.getSessionMembers(id);
  }

  /**
   * 添加成员
   * @route POST /im/sessions/:id/members
   */
  @Post('sessions/:id/members')
  @CheckAbility('update', 'session')
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<ImMemberInfo> {
    return this.sessionService.addMember(id, dto);
  }

  /**
   * 邀请成员（群聊加人 / 私聊拉群）
   * @route POST /im/sessions/:id/invite
   */
  @Post('sessions/:id/invite')
  @CheckAbility('update', 'session')
  async inviteMembers(
    @Param('id') id: string,
    @Body() dto: InviteMembersDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<InviteMembersResponse> {
    const inviterId = req.user?.id ?? 'anonymous';
    return this.sessionService.inviteMembers(id, inviterId, dto);
  }

  /**
   * 移除成员
   * @route DELETE /im/sessions/:id/members/:principalId
   */
  @Delete('sessions/:id/members/:principalId')
  @CheckAbility('update', 'session')
  async removeMember(
    @Param('id') id: string,
    @Param('principalId') principalId: string,
    @Req() req: { user?: { id?: string } },
  ): Promise<{ success: boolean }> {
    const operatorId = req.user?.id ?? 'anonymous';
    await this.sessionService.kickMember({
      sessionId: id,
      operatorId,
      targetPrincipalId: principalId,
    });
    return { success: true };
  }

  /**
   * 转移群主
   * @route POST /im/sessions/:id/transfer-owner
   */
  @Post('sessions/:id/transfer-owner')
  @CheckAbility('update', 'session')
  async transferOwner(
    @Param('id') id: string,
    @Body() dto: TransferOwnerDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<{ success: boolean }> {
    const operatorId = req.user?.id ?? 'anonymous';
    await this.sessionService.transferOwner({
      sessionId: id,
      operatorId,
      newOwnerPrincipalId: dto.principalId,
    });
    return { success: true };
  }

  /**
   * 获取公告列表
   * @route GET /im/sessions/:id/announcements
   */
  @Get('sessions/:id/announcements')
  @CheckAbility('read', 'session')
  async getAnnouncements(
    @Param('id') id: string,
    @Query() dto: GetAnnouncementsDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<ImAnnouncementListResponse> {
    const principalId = req.user?.id ?? 'anonymous';
    const res = await this.messageService.getAnnouncements({
      sessionId: id,
      principalId,
      limit: dto.limit,
    });
    return res;
  }

  /**
   * 发布公告
   * @route POST /im/sessions/:id/announcements
   */
  @Post('sessions/:id/announcements')
  @CheckAbility('update', 'session')
  async createAnnouncement(
    @Param('id') id: string,
    @Body() dto: CreateAnnouncementDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<ImMessageInfo> {
    const principalId = req.user?.id ?? 'anonymous';
    return this.messageService.sendAnnouncement(principalId, {
      sessionId: id,
      content: dto.content,
    });
  }

  /**
   * 删除公告标识（不删除消息）
   * @route DELETE /im/sessions/:id/announcements/:messageId
   */
  @Delete('sessions/:id/announcements/:messageId')
  @CheckAbility('update', 'session')
  async deleteAnnouncement(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: { user?: { id?: string } },
  ): Promise<{ success: boolean }> {
    const principalId = req.user?.id ?? 'anonymous';
    await this.messageService.unsetAnnouncement({
      sessionId: id,
      ownerId: principalId,
      messageId,
    });
    return { success: true };
  }

  // ========== 消息管理 ==========

  /**
   * 获取消息历史
   * @route GET /im/sessions/:id/messages
   */
  @Get('sessions/:id/messages')
  @CheckAbility('read', 'session')
  async getMessages(
    @Param('id') id: string,
    @Query() dto: GetMessagesDto,
    @Req() req: { user?: { id?: string } },
  ): Promise<ImMessageListResponse> {
    const principalId = req.user?.id ?? 'anonymous';
    return this.messageService.getMessages(id, dto, principalId);
  }

  /**
   * 检查指定时间之后是否有新消息
   * @route GET /im/sessions/:id/messages/has-new
   */
  @Get('sessions/:id/messages/has-new')
  @CheckAbility('read', 'session')
  async hasNew(
    @Param('id') id: string,
    @Query() dto: GetHasNewDto,
  ): Promise<HasNewResponse> {
    return this.messageService.hasNew(id, dto.since);
  }

  /**
   * 发送消息 (REST API)
   * @route POST /im/sessions/:id/messages
   */
  @Post('sessions/:id/messages')
  @CheckAbility('create', 'message')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: Omit<SendMessageDto, 'sessionId'>,
    @Req() req: { user?: { id?: string } },
  ): Promise<ImMessageInfo> {
    const senderId = req.user?.id ?? 'anonymous';
    return this.messageService.sendMessage(senderId, {
      ...dto,
      sessionId: id,
    });
  }

  /**
   * 通过 HookBus 向指定 IM 会话发送消息。
   * @keyword-en send-msg-hook-controller
   */
  @HookRoute({
    hook: 'saas.app.conversation.sendMsg',
    description:
      '向 IM 会话发送消息。messageType=text 为普通消息, notification 为 AI 可见用户端隐藏的通知。',
    args: [sendMsgSchema],
    metadata: { tags: ['im', 'proactive', 'send'] },
  })
  @CheckAbility('create', 'message')
  async handleSendMsg(payload: SendMsgPayload): Promise<HookResult> {
    const {
      sessionId,
      content,
      senderPrincipalId,
      replyToId,
      messageType,
      mentions,
      strictMention,
    } = payload;

    if (replyToId) {
      const maxReplies = 4;
      const replyCount = await this.messageService.countReplyMessages(
        sessionId,
        senderPrincipalId,
        replyToId,
      );
      if (replyCount >= maxReplies) {
        this.logger.warn(
          `[sendMsg] reply limit reached (${replyCount}/${maxReplies}) session=${sessionId} replyTo=${replyToId}`,
        );
        return {
          status: HookResultStatus.Error,
          error: `已达到单条消息最大回复数量 ${maxReplies}，请勿继续发送。`,
        };
      }
    }

    try {
      const msg = await this.messageService.sendMessage(
        senderPrincipalId,
        {
          sessionId,
          content,
          replyToId,
          ...(mentions && mentions.length > 0
            ? {
                mentions: mentions.map((principalId) => ({
                  principalId,
                  mentionText: '',
                  startIndex: 0,
                  endIndex: 0,
                })),
              }
            : {}),
          ...(strictMention === true ? { strictMention: true } : {}),
        },
        {
          role: 'assistant',
          skipAgentTrigger: !mentions || mentions.length === 0 ? true : false,
          messageType: messageType,
        },
      );
      this.logger.debug(
        `[sendMsg] sent to session=${sessionId} by=${senderPrincipalId} type=${messageType ?? 'text'}`,
      );
      return {
        status: HookResultStatus.Success,
        data: { messageId: msg.id, sessionId },
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[sendMsg] failed session=${sessionId}: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }
}
