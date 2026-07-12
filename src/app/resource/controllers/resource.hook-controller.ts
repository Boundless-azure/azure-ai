import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { ResourceService } from '../services/resource.service';

/**
 * Hook payload schema (SSOT) — currentSession 仅接受分页 + 过滤参数, sessionId 强制由 ctx 注入。
 * @keyword-en resource-current-session-payload, ctx-driven-session
 */
const currentSessionInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量, 默认 20, 上限 100'),
  offset: z.number().int().min(0).optional().describe('分页偏移, 默认 0'),
  category: z
    .enum(['image', 'video', 'document', 'audio', 'archive', 'code', 'other'])
    .optional()
    .describe('按资源类别过滤; 留空表示不过滤'),
  q: z.string().optional().describe('按文件名子串过滤 (大小写不敏感)'),
});

/**
 * @title 资源 Hook Controller
 * @description resource 模块的 hook 声明层 (单对象 payload); 从 ResourceController 迁出, HTTP 与 hook 解耦。
 *   sessionId 由 invocationContext.extras.sessionId 强制注入, LLM 无法跨会话查询。
 * @keywords-cn 资源Hook声明, 单对象payload, 当前会话资源
 * @keywords-en resource-hook-controller, single-object-payload, current-session-resources
 */
@Injectable()
@HookController({ pluginName: 'resource', tags: ['resource', 'file'] })
export class ResourceHookController {
  constructor(private readonly service: ResourceService) {}

  /**
   * Hook only: saas.app.resource.currentSession
   * 列出当前聊天会话已上传的资源 (按 createdAt DESC 排序, 分页)。
   * sessionId 由 invocationContext.extras.sessionId 强制注入, LLM 无法跨会话查询。
   *
   * @keyword-cn 当前会话资源, 列表分页
   * @keyword-en current-session-resources, paged-list
   */
  @HookRoute({
    hook: 'saas.app.resource.currentSession',
    description:
      '列出"当前聊天会话"已上传的资源, 按上传时间倒序分页。' +
      'sessionId 由系统从当前对话上下文自动注入, LLM 无法跨会话查询。' +
      '返回 items[].id 即 resourceId, 可作为 saas.app.storage.createNode 的 resourceId 入参。',
    args: [currentSessionInput],
  })
  @CheckAbility('read', 'resource')
  async currentSessionResources(
    payload: z.infer<typeof currentSessionInput>,
    _principal: unknown,
    context?: HookInvocationContext,
  ): Promise<{
    items: Array<{
      resourceId: string;
      name: string;
      path: string;
      category: string;
      mimeType: string | null;
      fileSize: string;
      createdAt: Date;
    }>;
    total: number;
    hasMore: boolean;
    limit: number;
    offset: number;
  }> {
    const sessionId =
      typeof context?.extras?.sessionId === 'string'
        ? context.extras.sessionId
        : null;
    if (!sessionId) {
      throw new BadRequestException(
        'saas.app.resource.currentSession 只能在聊天会话上下文中调用 (extras.sessionId 缺失); 如需跨会话查询请走 HTTP GET /resources?sessionId=...',
      );
    }
    const page = await this.service.listPaged({
      sessionId,
      limit: payload.limit,
      offset: payload.offset,
      category: payload.category,
      q: payload.q,
    });
    return {
      items: page.items.map((item) => ({
        resourceId: item.id,
        name: item.originalName,
        path: item.path,
        category: item.category,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        createdAt: item.createdAt,
      })),
      total: page.total,
      hasMore: page.hasMore,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
