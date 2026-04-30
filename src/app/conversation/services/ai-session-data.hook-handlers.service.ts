import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { AiSessionDataService } from './ai-session-data.service';

/**
 * @title AI Session Data Hook payload schema (SSOT)
 * @description Zod schema 作为单一来源: LLM JSON Schema 派生 + 运行时校验 + type 派生。
 * @keywords-cn session-data-hook, payloadSchema, SSOT, zod-infer
 * @keywords-en session-data-hook, payload-schema, ssot, zod-infer
 */
const saveSchema = z.object({
  sessionId: z.string().describe('目标会话 ID'),
  key: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,128}$/)
    .describe('数据键名，仅允许字母数字下划线短横线，1-128 字符'),
  value: z.unknown().describe('数据值，将被 JSON 序列化存储'),
  title: z.string().max(255).optional().describe('可选描述性标题，用于 list 时快速识别数据用途'),
});

const getSchema = z.object({
  sessionId: z.string().describe('目标会话 ID'),
  key: z.string().describe('数据键名'),
});

const listSchema = z.object({
  sessionId: z.string().describe('目标会话 ID'),
});

const deleteSchema = z.object({
  sessionId: z.string().describe('目标会话 ID'),
  key: z.string().describe('数据键名'),
});

type SavePayload = z.infer<typeof saveSchema>;
type GetPayload = z.infer<typeof getSchema>;
type ListPayload = z.infer<typeof listSchema>;
type DeletePayload = z.infer<typeof deleteSchema>;

/**
 * @title AI Session Data Hook 处理器
 * @description 提供 AI 自管理会话级 session_data 的 CRUD 能力。
 * @keywords-cn session-data, hook, 保存, 获取, 列表, 删除
 * @keywords-en session-data-hook, save, get, list, delete
 */
@Injectable()
export class AiSessionDataHookHandlersService {
  private readonly logger = new Logger(AiSessionDataHookHandlersService.name);

  constructor(private readonly service: AiSessionDataService) {}

  // ----------------------------------------------------------------
  // saas.app.conversation.sessionData.save — 保存/更新 session data
  // ----------------------------------------------------------------

  /**
   * 保存或更新一条 session data 记录
   * @keyword-en hook-session-data-save
   */
  @HookHandler('saas.app.conversation.sessionData.save', {
    pluginName: 'ai-session-data',
    tags: ['session-data', 'conversation'],
    description:
      '保存或更新当前会话的一条持久化数据。key 为唯一标识，value 任意 JSON，title 为可选描述。同 key 会覆盖旧值。每轮对话开始时已有数据自动注入 prompt，无需额外调用读取。',
    payloadSchema: saveSchema,
  })
  async handleSave(event: HookEvent<SavePayload>): Promise<HookResult> {
    const { sessionId, key, value, title } = event.payload;
    try {
      await this.service.save(sessionId, key, value, title);
      return { status: HookResultStatus.Success, data: { saved: true, key, title: title ?? null } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.sessionData.get — 获取单条 session data
  // ----------------------------------------------------------------

  /**
   * 获取指定 key 的 session data
   * @keyword-en hook-session-data-get
   */
  @HookHandler('saas.app.conversation.sessionData.get', {
    pluginName: 'ai-session-data',
    tags: ['session-data', 'conversation'],
    description:
      '获取当前会话指定 key 的持久化数据。返回 { key, title, value, updatedAt }。',
    payloadSchema: getSchema,
  })
  async handleGet(event: HookEvent<GetPayload>): Promise<HookResult> {
    const { sessionId, key } = event.payload;
    try {
      const data = await this.service.get(sessionId, key);
      if (!data) {
        return { status: HookResultStatus.Error, error: `key "${key}" not found` };
      }
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.sessionData.list — 列出所有 session data 概要
  // ----------------------------------------------------------------

  /**
   * 列出当前会话所有 session data 的 key / title / 更新时间 / 大小
   * @keyword-en hook-session-data-list
   */
  @HookHandler('saas.app.conversation.sessionData.list', {
    pluginName: 'ai-session-data',
    tags: ['session-data', 'conversation'],
    description:
      '列出当前会话所有持久化数据的概要（含 key / title / updatedAt / sizeBytes），不含 value 内容。AI 可通过 title 批量判断哪些数据需要使用。',
    payloadSchema: listSchema,
  })
  async handleList(event: HookEvent<ListPayload>): Promise<HookResult> {
    const { sessionId } = event.payload;
    try {
      const items = await this.service.list(sessionId);
      return { status: HookResultStatus.Success, data: { items } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.sessionData.delete — 删除单条 session data
  // ----------------------------------------------------------------

  /**
   * 删除指定 key 的 session data
   * @keyword-en hook-session-data-delete
   */
  @HookHandler('saas.app.conversation.sessionData.delete', {
    pluginName: 'ai-session-data',
    tags: ['session-data', 'conversation'],
    description:
      '删除当前会话指定 key 的持久化数据。',
    payloadSchema: deleteSchema,
  })
  async handleDelete(event: HookEvent<DeletePayload>): Promise<HookResult> {
    const { sessionId, key } = event.payload;
    try {
      const deleted = await this.service.delete(sessionId, key);
      if (!deleted) {
        return { status: HookResultStatus.Error, error: `key "${key}" not found` };
      }
      return { status: HookResultStatus.Success, data: { deleted: true, key } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }
}
