import { Injectable, BadRequestException } from '@nestjs/common';
import { ContextService } from '../../ai/services/context.service';
import type { ChatMessage } from '../../ai/types';
import type { FunctionCallServiceContract } from '../types/service.types';
import { ContextWindowKeywordFunctionDescription } from '../descriptions/context/window.keyword';
import { z } from 'zod';
import { tool } from 'langchain';

/**
 * @title Context Function Service
 * @desc 提供与上下文检索相关的函数调用实现，支持关键词滑动窗口。
 * @keywords-cn 上下文函数, 关键词, 滑动窗口, 会话, 非系统消息
 * @keywords-en context-function, keywords, sliding-window, session, non-system
 */
@Injectable()
export class ContextFunctionService implements FunctionCallServiceContract {
  constructor(private readonly contextService: ContextService) {}

  /**
   * @title 根据关键词获取滑动窗口上下文
   * @desc 返回符合条件的消息数组（JSON-only）。当提供 sessionId 时仅在该会话内检索；否则按用户范围（runtime.userId）跨会话检索。
   * @param args.sessionId 会话唯一标识（可选；系统注入）
   * @param args.keywords 关键词数组（必填）
   * @param args.limit 窗口大小上限（必填；系统强制限制）
   * @param args.includeSystem 是否包含系统消息（可选；默认 false）
   * @param args.matchMode 关键词匹配模式：any（至少命中一个）或 all（必须全部命中），默认 any
   * @param runtime.userId 用户唯一标识（当未提供 sessionId 时必填，用于限定检索范围）
   * @returns 匹配后的消息数组（JSON-only）
   * @keywords-cn 关键词检索, 滑动窗口, 上下文消息, 会话范围, 用户范围
   * @keywords-en keyword-retrieval, sliding-window, context-messages, session-scope, user-scope
   */
  async getKeywordWindow(
    args: {
      sessionId?: string;
      keywords: string[];
      limit: number;
      includeSystem?: boolean;
      matchMode?: 'any' | 'all';
    },
    runtime?: { userId: string },
  ): Promise<ChatMessage[]> {
    const {
      sessionId,
      keywords,
      limit,
      includeSystem = false,
      matchMode = 'any',
    } = args;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      throw new BadRequestException('keywords 不能为空');
    }
    if (typeof limit !== 'number' || limit <= 0) {
      throw new BadRequestException('limit 必须为正数');
    }

    if (sessionId) {
      return this.contextService.getKeywordContext(
        sessionId,
        keywords,
        includeSystem,
        limit,
        matchMode,
      );
    }

    if (!runtime?.userId) {
      throw new BadRequestException(
        '当未提供 sessionId 时必须提供 runtime.userId 用于限定检索范围',
      );
    }

    return this.contextService.getKeywordContextByUser(
      runtime.userId,
      keywords,
      includeSystem,
      limit,
      matchMode,
    );
  }

  /**
   * 提供标准化的函数句柄：context_window_keyword
   */
  getHandle() {
    const schema: any = z.object({
      sessionId: z.string().optional(),
      keywords: z.array(z.string().min(1)).min(1, 'keywords 不能为空'),
      limit: z.number().positive('limit 必须为正数'),
      includeSystem: z.boolean().optional(),
      matchMode: z.enum(['any', 'all']).optional(),
    });

    return tool(
      async ({
        sessionId,
        keywords,
        limit,
        includeSystem,
        matchMode,
      }: {
        sessionId?: string;
        keywords: string[];
        limit: number;
        includeSystem?: boolean;
        matchMode?: 'any' | 'all';
      }) =>
        this.getKeywordWindow({
          sessionId,
          keywords,
          limit,
          includeSystem,
          matchMode,
        }),
      {
        name: ContextWindowKeywordFunctionDescription.name,
        description: ContextWindowKeywordFunctionDescription.description,
        schema,
      },
    );
  }
}
