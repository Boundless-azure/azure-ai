import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ImSessionService } from '../services/im-session.service';
import { ImMessageService } from '../services/im-message.service';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type {
  ImSessionDetail,
  ImMemberInfo,
  ImMessageInfo,
  HasNewResponse,
  ImSessionListResponse,
  ImMessageListResponse,
} from '../types/im.types';
import {
  CreateImSessionDto,
  AddMemberDto,
  SendMessageDto,
  GetMessagesDto,
  GetHasNewDto,
  GetSessionsDto,
} from '../types/im.types';

/**
 * @title IM 控制器
 * @description IM 会话和消息的 REST API。
 * @keywords-cn IM, 会话, 消息, REST, API
 * @keywords-en im, session, message, rest, api
 */
@Controller('im')
export class ImController {
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
   * 删除会话
   * @route DELETE /im/sessions/:id
   */
  @Delete('sessions/:id')
  @CheckAbility('delete', 'session')
  async deleteSession(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.sessionService.deleteSession(id);
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
   * 移除成员
   * @route DELETE /im/sessions/:id/members/:principalId
   */
  @Delete('sessions/:id/members/:principalId')
  @CheckAbility('update', 'session')
  async removeMember(
    @Param('id') id: string,
    @Param('principalId') principalId: string,
  ): Promise<{ success: boolean }> {
    await this.sessionService.removeMember(id, principalId);
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
}
