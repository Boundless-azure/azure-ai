import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
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
    .regex(/^[a-zA-Z0-9_.-]{1,128}$/)
    .describe(
      '数据键名 :: 字母 / 数字 / 下划线 / 短横 / 点 (1-128 字符)。推荐分层语义命名, 例如 entity.principal.admin / knowledge.book.todo_skill / progress.todo.demo',
    ),
  value: z.unknown().describe('数据值，将被 JSON 序列化存储'),
  title: z
    .string()
    .min(8)
    .max(255)
    .describe(
      '⚠ 必填 + 高质量 :: title 是你下次 sessionData.list 时**唯一**的判断依据 (list 不返 value, 只返 key + title)。' +
        '必须写成"描述性长标题", 让你下次一眼能判断这条记忆是干什么的。' +
        '反例 :: "memo" / "记录" / "数据" — 全是废 title, 列表里根本认不出来。' +
        '正例 :: "membershipList 调用配方 :: payload 必须包 input{} 不能裸字段" / "SaaS 系统 Hook 总览 :: identity 模块支持的过滤维度速记" / "查用户角色的两步路径 :: membershipList → roleList 按 code 配对"。',
    ),
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
  @CheckAbility('update', 'session')
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
  @CheckAbility('read', 'session')
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
      '列出当前会话所有持久化数据的轻量元数据 (key + title + 更新时间 + 大小, **不含 value**)。' +
        '返回字段 :: { count, listing }; listing 是分行 markdown 文本, 直接读它即可。' +
        '凭 title 判断哪条命中 → 调 sessionData.get(key) 取完整 value。' +
        '任何查询任务起手都应先调一次此 hook (体积小, 后期记忆增多也可控)。',
    payloadSchema: listSchema,
  })
  @CheckAbility('read', 'session')
  async handleList(event: HookEvent<ListPayload>): Promise<HookResult> {
    const { sessionId } = event.payload;
    try {
      const items = await this.service.list(sessionId);
      return {
        status: HookResultStatus.Success,
        data: {
          count: items.length,
          listing: renderListing(items),
        },
      };
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
  @CheckAbility('delete', 'session')
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

/**
 * 把 list 结果渲染为分行 markdown 列表, LLM 阅读友好。
 * 输出形态 ::
 *   共 N 条记忆 (header + 复用规则)
 *   - `<key>` :: <title>  (MM-DD, NB)
 *   - ...
 * 不返 value :: 命中后调 sessionData.get(key) 取完整 value, 避免 list 输出随记忆增多撑大。
 * @keyword-en render-listing markdown-friendly
 */
function renderListing(
  items: Array<{
    key: string;
    title: string | null;
    updatedAt: Date;
    sizeBytes: number;
  }>,
): string {
  if (items.length === 0) {
    return [
      '本会话还没有任何 session_data 记忆。',
      '完成查询/读章节/失败-成功修正后, 调 sessionData.save({ sessionId, key, value, title }) 沉淀。',
      'title 必须是描述性长标题 (>= 8 字符), list 时凭它判断哪条命中。',
    ].join('\n');
  }

  const header = [
    `共 ${items.length} 条记忆。**命中 title 即视作已查询, 不要再跑同主题 hook**; 需要详情调 sessionData.get({ key }) 取完整 value。`,
    '',
  ];

  const lines = items.map((it) => {
    const date = it.updatedAt.toISOString().slice(5, 10); // MM-DD
    const title = it.title ?? '(⚠ 无 title — 这条记忆下次自己也认不出, 建议覆盖 save 补一个描述性标题)';
    return `- \`${it.key}\` :: ${title}  (${date}, ${it.sizeBytes}B)`;
  });

  return [...header, ...lines].join('\n');
}
