import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ConversationSegmentService } from '../services/segment.service';

/**
 * @title 会话分段控制器
 * @description 提供按天维度的消息索引与分段的增删改查接口（不修改原始消息记录）
 * @keywords-cn 分段控制器, 天维度, 组合引用, 增删改查
 * @keywords-en segment-controller, day-dimension, composition, CRUD
 */
@Controller('conversation')
export class SegmentController {
  constructor(private readonly segmentService: ConversationSegmentService) {}

  /**
   * 获取会话的天维度索引（每天消息条数）
   * @route GET /conversation/sessions/:sessionId/days
   */
  @Get('sessions/:sessionId/days')
  async getDayIndex(@Param('sessionId') sessionId: string) {
    return await this.segmentService.getDayIndex(sessionId);
  }

  /**
   * 获取指定天的消息列表（用于分段选择）
   * @route GET /conversation/sessions/:sessionId/days/:day/messages
   */
  @Get('sessions/:sessionId/days/:day/messages')
  async getDayMessages(
    @Param('sessionId') sessionId: string,
    @Param('day') day: string,
  ) {
    return await this.segmentService.getDayMessages(sessionId, day);
  }

  /**
   * 获取指定天的分段列表
   * @route GET /conversation/sessions/:sessionId/days/:day/segments
   */
  @Get('sessions/:sessionId/days/:day/segments')
  async listSegments(
    @Param('sessionId') sessionId: string,
    @Param('day') day: string,
  ) {
    return await this.segmentService.listSegments(sessionId, day);
  }

  /**
   * 创建分段（仅组合消息引用，不修改记录）
   * @route POST /conversation/sessions/:sessionId/days/:day/segments
   */
  @Post('sessions/:sessionId/days/:day/segments')
  async createSegment(
    @Param('sessionId') sessionId: string,
    @Param('day') day: string,
    @Body()
    payload: { name: string; description?: string; messageIds: string[] },
  ) {
    return await this.segmentService.createSegment(sessionId, day, payload);
  }

  /**
   * 更新分段（改名、说明或消息集合）
   * @route PATCH /conversation/sessions/:sessionId/days/:day/segments/:segmentId
   */
  @Patch('sessions/:sessionId/days/:day/segments/:segmentId')
  async updateSegment(
    @Param('segmentId') segmentId: string,
    @Body()
    payload: { name?: string; description?: string; messageIds?: string[] },
  ) {
    return await this.segmentService.updateSegment(segmentId, payload);
  }

  /**
   * 删除分段（软删除）
   * @route DELETE /conversation/sessions/:sessionId/days/:day/segments/:segmentId
   */
  @Delete('sessions/:sessionId/days/:day/segments/:segmentId')
  async deleteSegment(@Param('segmentId') segmentId: string) {
    await this.segmentService.deleteSegment(segmentId);
    return { success: true };
  }

  /**
   * 获取分段详情
   * @route GET /conversation/sessions/:sessionId/segments/:segmentId
   */
  @Get('sessions/:sessionId/segments/:segmentId')
  async getSegment(@Param('segmentId') segmentId: string) {
    return await this.segmentService.getSegment(segmentId);
  }

  /**
   * 根据天反查会话列表（当日存在消息的 sessionId 及条数）
   * @route GET /conversation/days/:day/sessions
   */
  @Get('days/:day/sessions')
  async getSessionsByDay(@Param('day') day: string) {
    return await this.segmentService.getSessionsByDay(day);
  }

  /**
   * 跨会话：按天列出所有分段
   * @route GET /conversation/days/:day/segments
   */
  @Get('days/:day/segments')
  async listSegmentsByDay(@Param('day') day: string) {
    return await this.segmentService.listSegmentsByDay(day);
  }
}
