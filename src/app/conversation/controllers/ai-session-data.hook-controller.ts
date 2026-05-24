import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type {
  HookInvocationContext,
  HookResult,
} from '@/core/hookbus/types/hook.types';
import { AiSessionDataService } from '../services/ai-session-data.service';
import type { SessionDataListItem } from '../services/ai-session-data.service';

/**
 * @title AI Session Data Hook payload schema (SSOT)
 * @description Zod schema 作为单一来源: LLM JSON Schema 派生 + 运行时校验 + type 派生。
 * @keywords-cn session-data-hook, payloadSchema, SSOT, zod-infer
 * @keywords-en session-data-hook, payload-schema, ssot, zod-infer
 */
/**
 * sessionId 字段统一描述 :: LLM 调用时**留空即可**, 服务端自动从 invocationContext.extras.sessionId 取当前会话.
 * 仅在跨会话场景 (例如管理工具) 才显式传值.
 * @keyword-en session-id-optional-from-ctx
 */
const sessionIdField = z
  .string()
  .optional()
  .describe(
    '目标会话 ID (LLM 留空即可, 服务端从 ctx.extras.sessionId 自动补当前会话; 仅跨会话场景显式传)',
  );

const saveSchema = z.object({
  sessionId: sessionIdField,
  key: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]{1,128}$/)
    .describe(
      '数据键名 :: 字母 / 数字 / 下划线 / 短横 / 点 (1-128 字符)。' +
        '第一段决定 category: ' +
        '`handbook.*` (系统 seed 的必读手册, 按 agent 身份隔离) / ' +
        '`directive.*` (本会话强约束) / `preference.*` (本会话偏好) / `recipe.*` (显式多步配方) / 其他归 general. ' +
        '实体锚点请查 callHistory 成功记录, 知识请重新读知识源, 不要复制到 session_data。',
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
        '正例 :: "本会话删除前必须先确认" / "本会话默认使用中文回答" / "查用户角色的两步路径 :: membershipList → roleList 按 code 配对"。',
    ),
});

const getSchema = z.object({
  sessionId: sessionIdField,
  key: z.string().describe('数据键名'),
});

const listSchema = z.object({
  sessionId: sessionIdField,
});

const deleteSchema = z.object({
  sessionId: sessionIdField,
  key: z.string().describe('数据键名'),
});

type SavePayload = z.infer<typeof saveSchema>;
type GetPayload = z.infer<typeof getSchema>;
type ListPayload = z.infer<typeof listSchema>;
type DeletePayload = z.infer<typeof deleteSchema>;

/**
 * @title AI Session Data Hook 处理器
 * @description 提供 AI 自管理会话级 session_data 的 CRUD 能力。
 *              list 按 category 分组渲染, handbook 段严格按 ctx.principalId 过滤
 *              (LLM 永远拿不到不属于自己 agent 身份的手册).
 * @keywords-cn session-data, hook, 保存, 获取, 列表, 删除, 分组, 必读
 * @keywords-en session-data-hook, save, get, list, delete, grouped, must-read
 */
@Injectable()
@HookController({
  pluginName: 'ai-session-data',
  tags: ['conversation', 'session-data'],
})
export class AiSessionDataHookController {
  private readonly logger = new Logger(AiSessionDataHookController.name);

  constructor(private readonly service: AiSessionDataService) {}

  // ----------------------------------------------------------------
  // saas.app.conversation.sessionData.save — 保存/更新 session data
  // ----------------------------------------------------------------

  /**
   * 保存或更新一条 session data 记录, ownerPrincipalId 自动从 ctx 取
   * @keyword-en hook-session-data-save
   */
  @HookRoute({
    hook: 'saas.app.conversation.sessionData.save',
    description:
      '保存或更新当前会话的一条持久化数据。key 为唯一标识，value 任意 JSON，title 必填。同 key 会覆盖旧值。' +
      'key 第一段决定 category :: handbook (系统必读手册, 按 agent 身份隔离) / directive / preference / recipe / 其他归 general. ' +
      'sessionId 留空 → 服务端从 ctx 自动补当前会话 (LLM 用法). ' +
      'ownerPrincipalId 自动来自 ctx.principalId, **handbook 类只会被同 principal 看到**. ' +
      '仅在用户明确表达本会话偏好/约束或显式要求保存配方时写入; 实体锚点走 callHistory, 知识走知识库, 不做对话后自动沉淀。',
    args: [saveSchema],
    metadata: { tags: ['session-data', 'conversation'] },
  })
  @CheckAbility('update', 'session')
  async handleSave(
    payload: SavePayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const { key, value, title } = payload;
    const sessionId = resolveSessionId({ payload, context });
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error:
          'sessionId 缺失: 请确保调用上下文 ctx.extras.sessionId 已注入, 或显式传 payload.sessionId',
      };
    }
    try {
      // owner :: 优先 ctx.principalId; 系统 seed 时由 caller 在 ctx 设好
      const ownerPrincipalId = context?.principalId;
      await this.service.save(sessionId, key, value, title, ownerPrincipalId);
      return {
        status: HookResultStatus.Success,
        data: { saved: true, key, title: title ?? null },
      };
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
  @HookRoute({
    hook: 'saas.app.conversation.sessionData.get',
    description:
      '获取当前会话指定 key 的持久化数据 (含完整 value)。返回 { key, title, value, category, updatedAt }。' +
      'sessionId 留空 → 服务端从 ctx 自动补 (LLM 用法). ' +
      '**handbook.* 系列 = 必读技能手册, 起手协议要求逐条 get 取全文**, 不读必犯低级错. ' +
      'directive.* / preference.* 是本会话约束与偏好; 其他 category 命中 title 才 get.',
    args: [getSchema],
    metadata: { tags: ['session-data', 'conversation'] },
  })
  @CheckAbility('read', 'session')
  async handleGet(
    payload: GetPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const { key } = payload;
    const sessionId = resolveSessionId({ payload, context });
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error:
          'sessionId 缺失: 请确保调用上下文 ctx.extras.sessionId 已注入, 或显式传 payload.sessionId',
      };
    }
    try {
      const data = await this.service.get(sessionId, key);
      if (!data) {
        return {
          status: HookResultStatus.Error,
          error: `key "${key}" not found`,
        };
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
   * 列出当前会话所有 session data 的 key / title / 更新时间 / 大小 (按 category 分组)
   * handbook 段按当前 ctx.principalId 严格过滤 (群聊隔离)
   * @keyword-en hook-session-data-list
   */
  @HookRoute({
    hook: 'saas.app.conversation.sessionData.list',
    description:
      '列出当前会话所有持久化数据的轻量元数据 (key + title + 更新时间 + 大小, **不含 value**), ' +
      '按 category 分组渲染 (handbook / directive / preference / recipe / legacy / general)。' +
      '返回字段 :: { count, listing }; listing 是分段 markdown 文本, 直接读它即可。' +
      '⚠ **handbook 段下每条都是必读技能手册**, 起手协议要求**逐条** sessionData.get 取全文, 不读必犯低级错。' +
      'directive/preference 段是本会话约束与偏好; 其他段命中 title 后 get 取详情。' +
      'handbook 段按当前 agent 身份自动过滤, 你看到的就是你该读的 (群聊场景多 agent 互不可见)。' +
      'sessionId 留空 → 服务端从 ctx 自动补 (LLM 用法).',
    args: [listSchema],
    metadata: { tags: ['session-data', 'conversation'] },
  })
  @CheckAbility('read', 'session')
  async handleList(
    payload: ListPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const sessionId = resolveSessionId({ payload, context });
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error:
          'sessionId 缺失: 请确保调用上下文 ctx.extras.sessionId 已注入, 或显式传 payload.sessionId',
      };
    }
    try {
      // handbookOwner :: ctx.principalId 兜底, 系统/HTTP 调用(无 principalId)则不过滤
      const handbookOwnerPrincipalId = context?.principalId;
      const items = await this.service.list(sessionId, {
        handbookOwnerPrincipalId,
      });
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
  @HookRoute({
    hook: 'saas.app.conversation.sessionData.delete',
    description: '删除当前会话指定 key 的持久化数据。',
    args: [deleteSchema],
    metadata: { tags: ['session-data', 'conversation'] },
  })
  @CheckAbility('delete', 'session')
  async handleDelete(
    payload: DeletePayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const { key } = payload;
    const sessionId = resolveSessionId({ payload, context });
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error:
          'sessionId 缺失: 请确保调用上下文 ctx.extras.sessionId 已注入, 或显式传 payload.sessionId',
      };
    }
    try {
      const deleted = await this.service.delete(sessionId, key);
      if (!deleted) {
        return {
          status: HookResultStatus.Error,
          error: `key "${key}" not found`,
        };
      }
      return { status: HookResultStatus.Success, data: { deleted: true, key } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }
}

/**
 * 取 sessionId :: 优先 payload, 缺失时从 invocationContext.extras.sessionId 兜底
 *  - LLM 调用时 payload 留空, 服务端从 ctx 自动取当前会话 (LLM 不需要知道 sessionId)
 *  - 跨会话场景或 HTTP 显式管理时, payload 主动传值
 * @keyword-en resolve-session-id-from-ctx
 */
function resolveSessionId(event: {
  payload: { sessionId?: string };
  context?: { extras?: Record<string, unknown> };
}): string | null {
  const fromPayload = event.payload?.sessionId?.trim();
  if (fromPayload) return fromPayload;
  const fromCtx = event.context?.extras?.sessionId;
  if (typeof fromCtx === 'string' && fromCtx.trim()) return fromCtx.trim();
  return null;
}

/**
 * 渲染顺序 :: handbook 永远第一(必读高亮), 其他按固定顺序便于 LLM 形成稳定预期
 * @keyword-en category-render-order
 */
const CATEGORY_ORDER = [
  'handbook',
  'directive',
  'preference',
  'recipe',
  'knowledge',
  'hook',
  'entity',
  'general',
];

const CATEGORY_HEADER: Record<string, string> = {
  handbook:
    '## ⚠ handbook (必读, 起手协议要求**逐条** sessionData.get 取全文; 这是按你当前 agent 身份过滤的技能手册)',
  directive: '## directive (本会话强约束; 命中 title 才 get)',
  preference: '## preference (本会话偏好; 命中 title 才 get)',
  recipe: '## recipe (显式多步配方; 命中 title 才 get)',
  knowledge: '## knowledge (旧分类: 知识请优先重新读知识源; 命中 title 才 get)',
  hook: '## hook (旧分类: hook 形态请优先查 callHistory/schema; 命中 title 才 get)',
  entity: '## entity (旧分类: 实体锚点请优先查 callHistory; 命中 title 才 get)',
  general: '## general (未归类会话数据)',
};

/**
 * 把 list 结果按 category 分组渲染为分段 markdown, LLM 阅读友好.
 * 必读段(handbook) 永远第一, 突出"起手必逐条 get"语义.
 * 各段空时整段省略 (避免无意义噪声).
 * @keyword-en render-listing grouped-by-category markdown-friendly
 */
function renderListing(items: SessionDataListItem[]): string {
  if (items.length === 0) {
    return [
      '本会话还没有任何 session_data 记忆。',
      '仅在用户明确表达本会话偏好/约束或显式要求保存配方时, 调 sessionData.save({ sessionId, key, value, title })。',
      'key 命名约定 :: handbook.* / directive.* / preference.* / recipe.* (第一段决定 category).',
      '实体锚点查 callHistory 成功记录; 知识内容重新读知识源; 不做对话后自动沉淀。',
      'title 必须是描述性长标题 (>= 8 字符), list 时凭它判断哪条命中。',
    ].join('\n');
  }

  // 按 category 分桶
  const buckets: Record<string, SessionDataListItem[]> = {};
  for (const it of items) {
    const cat: string = it.category;
    const bucket = buckets[cat] ?? [];
    bucket.push(it);
    buckets[cat] = bucket;
  }

  const parts: string[] = [
    `共 ${items.length} 条记忆 (按 category 分组; handbook 必读, directive/preference 是会话约束, 其他按 title 命中再 get)。`,
    '',
  ];

  for (const cat of CATEGORY_ORDER) {
    const list: SessionDataListItem[] = buckets[cat] ?? [];
    if (list.length === 0) continue;
    parts.push(CATEGORY_HEADER[cat]);
    for (const it of list) {
      const date = it.updatedAt.toISOString().slice(5, 10); // MM-DD
      const title =
        it.title ??
        '(⚠ 无 title — 这条记忆下次自己也认不出, 建议覆盖 save 补一个描述性标题)';
      parts.push(`- \`${it.key}\` :: ${title}  (${date}, ${it.sizeBytes}B)`);
    }
    parts.push('');
  }

  return parts.join('\n').trimEnd();
}
