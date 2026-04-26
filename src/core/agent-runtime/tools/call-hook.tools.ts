import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import z from 'zod';
import type { HookBusService } from '@/core/hookbus/services/hook.bus.service';
import type { RunnerHookRpcService } from '@/app/runner/services/runner-hook-rpc.service';
import type { HookCallReply } from '@/app/runner/types/runner.types';
import type {
  HookInvocationContext,
  HookRegistration,
} from '@/core/hookbus/types/hook.types';

/** 工具层共用 logger, 所有 hook tool 调用都打印 name / target / runnerId / payload / duration / err 计数 */
const toolLogger = new Logger('LlmHookTool');

/** 把 payload / 任意值序列化并截断, 避免日志爆炸 */
function preview(value: unknown, max = 240): string {
  let str: string;
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    str = String(value);
  }
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}…(+${str.length - max})` : str;
}

/** 形成 target:runnerId 标识 */
function targetTag(target: string, runnerId?: string): string {
  return runnerId ? `${target}:${runnerId}` : target;
}

/** 统计软错和成功项数量 */
function countReply(reply: HookCallReply): { ok: number; err: number } {
  const err = reply.errorMsg?.length ?? 0;
  const result = reply.result;
  const ok = Array.isArray(result)
    ? result.length
    : result === null || result === undefined
      ? 0
      : 1;
  return { ok, err };
}

/**
 * @title LLM Hook 工具集 (call_hook + call_hook_async + search_hook + get_hook_tag + get_hook_info)
 * @description 全部走 target 路由 (saas / runner), runner 必填 runnerId; 任何路径都是软错返回, 不抛。
 *              所有工具的 invocationContext (token / principalId / traceId) 由 AgentRuntime 闭包注入,
 *              LLM schema 完全不暴露, 保证 LLM 不可见不可改 token。
 *              批量统一通过数组形参 (tags / hookNames / runnerIds) 实现, 不再单独声明 batch 工具。
 * @keywords-cn LLM工具, Hook调用, 路由分发, 上下文闭包, 元工具, 软错误
 * @keywords-en llm-tools, hook-call, target-routing, ctx-closure, meta-tools, soft-error
 */

const SAAS = 'saas' as const;
const RUNNER = 'runner' as const;
/** search_hook / get_hook_info 默认/上限页大小 */
const DEFAULT_PAGE_SIZE = 100;
/** get_hook_tag 上限: tag 是发现链路起点, 一次拿全景, 硬上限 400 */
const TAG_PAGE_LIMIT = 400;

const hookCallSchema = z.object({
  hookName: z.string().describe('要调用的 hook 名称'),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('传给 handler 的业务参数对象'),
  target: z
    .enum([SAAS, RUNNER])
    .default(RUNNER)
    .describe('hook 归属端: saas=平台内置, runner=用户自托管 (默认 runner)'),
  runnerId: z
    .string()
    .optional()
    .describe('target=runner 必填; 指定要调用的 Runner'),
  debug: z
    .boolean()
    .optional()
    .describe('仅 runner: 启用 OTel sandbox tracer'),
  debugDb: z
    .boolean()
    .optional()
    .describe('仅 runner: 启用 Mongo 影子集合, 写操作不落主库'),
});
type HookCallInput = z.infer<typeof hookCallSchema>;

const searchHookSchema = z.object({
  target: z.enum([SAAS, RUNNER]).default(RUNNER),
  runnerId: z.string().optional().describe('target=runner 必填'),
  tags: z
    .array(z.string())
    .optional()
    .describe('按 tag 过滤, 任一命中即返回; 不传则全量'),
  pluginName: z.string().optional(),
  cursor: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(DEFAULT_PAGE_SIZE).optional(),
});
type SearchHookInput = z.infer<typeof searchHookSchema>;

const getHookTagSchema = z.object({
  target: z.enum([SAAS, RUNNER]).default(RUNNER),
  runnerId: z.string().optional().describe('target=runner 必填'),
  pluginName: z.string().optional(),
  cursor: z.number().int().nonnegative().optional(),
  limit: z
    .number()
    .int()
    .positive()
    .max(TAG_PAGE_LIMIT)
    .optional()
    .describe(`默认 ${TAG_PAGE_LIMIT}, 一次性拿全景以便 LLM 决策; 上限 ${TAG_PAGE_LIMIT}`),
});
type GetHookTagInput = z.infer<typeof getHookTagSchema>;

const getHookInfoSchema = z.object({
  target: z.enum([SAAS, RUNNER]).default(RUNNER),
  runnerId: z.string().optional().describe('target=runner 必填'),
  hookNames: z
    .array(z.string())
    .optional()
    .describe('要获取的 hook 名称数组, 不传则返回全部 (建议指定以减少回包)'),
});
type GetHookInfoInput = z.infer<typeof getHookInfoSchema>;

/** 调用上下文取值器 (AgentRuntime 闭包注入, LLM 不可见) */
export type InvocationContextProvider = () => HookInvocationContext;

/** 软错快捷构造 */
function softError(code: string): HookCallReply {
  return { errorMsg: [code], result: null, debugLog: [] };
}

/**
 * 把 SaaS HookBus 的 HookResult[] 适配成 { errorMsg, result, debugLog } 外形
 * @keyword-en adapt-saas-result
 */
async function dispatchSaasHook(
  hookBus: HookBusService,
  ctx: HookInvocationContext,
  input: { hookName: string; payload?: unknown },
): Promise<HookCallReply> {
  try {
    const results = await hookBus.emit({
      name: input.hookName,
      payload: input.payload ?? {},
      context: ctx,
    });
    const errorMsg: string[] = [];
    const data: unknown[] = [];
    for (const r of results as Array<{ status?: string; data?: unknown; error?: string }>) {
      if (r?.status === 'error' || r?.error) {
        errorMsg.push(r.error ?? 'hook-error');
      } else {
        data.push(r?.data);
      }
    }
    return { errorMsg, result: data, debugLog: [] };
  } catch (e) {
    return softError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * 路由一次 hook 调用到 saas 或 runner
 * @keyword-en dispatch-call
 */
async function dispatchOne(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  ctx: HookInvocationContext,
  input: HookCallInput,
): Promise<HookCallReply> {
  if (input.target === SAAS) {
    return await dispatchSaasHook(hookBus, ctx, input);
  }
  if (!input.runnerId) {
    return softError('runnerId-required');
  }
  return await hookRpc.callHook(input.runnerId, {
    hookName: input.hookName,
    payload: input.payload,
    context: ctx,
    debug: input.debug,
    debugDb: input.debugDb,
  });
}

/**
 * SaaS 侧本地走 registry, 投影成与 runner meta hook 同形的列表
 * @keyword-en project-saas-registrations
 */
function projectSaasRegistrations(regs: HookRegistration[]): Array<{
  name: string;
  tags: string[];
  description: string | null;
  pluginName: string | null;
}> {
  const seen = new Set<string>();
  const list: Array<{
    name: string;
    tags: string[];
    description: string | null;
    pluginName: string | null;
  }> = [];
  for (const item of regs) {
    const key = `${item.name}::${item.metadata?.pluginName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      name: item.name,
      tags: item.metadata?.tags ?? [],
      description: item.metadata?.description ?? null,
      pluginName: item.metadata?.pluginName ?? null,
    });
  }
  return list;
}

/* =========================================================================
 * 1) call_hook  ::  同步, 等结果
 * ========================================================================= */
/**
 * 构建 call_hook (同步) 工具
 * @keyword-en build-call-hook-tool
 */
export function buildCallHookTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
) {
  return tool(
    async (input: HookCallInput): Promise<string> => {
      const start = Date.now();
      const reply = await dispatchOne(hookBus, hookRpc, getCtx(), input);
      const duration = Date.now() - start;
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[call_hook] ${targetTag(input.target, input.runnerId)} ${input.hookName} ` +
          `payload=${preview(input.payload ?? {})} ok=${ok} err=${err} duration=${duration}ms` +
          (err > 0 ? ` errMsg=${preview(reply.errorMsg, 200)}` : ''),
      );
      return JSON.stringify(reply);
    },
    {
      name: 'call_hook',
      description:
        '同步调用 hook, 等待结果 (统一外形 { errorMsg, result, debugLog })。' +
        '默认 target=runner 经 WS 派发到指定 runnerId; target=saas 走平台 HookBus。' +
        'errorMsg 非空 = 软错, 据此调整重试。' +
        '【强约束】若 payload schema 未在已加载知识章节中看到, 调用前必须先 get_hook_info(hookNames=[...]) 拿到 JSON Schema 再写 payload。凭名字猜字段会软错回退、浪费一轮。',
      schema: hookCallSchema,
    },
  );
}

/* =========================================================================
 * 2) call_hook_async  ::  fire-and-forget
 * ========================================================================= */
/**
 * 构建 call_hook_async (fire-and-forget) 工具
 * @keyword-en build-call-hook-async-tool
 */
export function buildCallHookAsyncTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
) {
  return tool(
    (input: HookCallInput): string => {
      toolLogger.log(
        `[call_hook_async] ${targetTag(input.target, input.runnerId)} ${input.hookName} ` +
          `payload=${preview(input.payload ?? {})} (fire-and-forget)`,
      );
      void dispatchOne(hookBus, hookRpc, getCtx(), input).catch(
        () => undefined,
      );
      return JSON.stringify({
        queued: true,
        hookName: input.hookName,
        target: input.target,
      });
    },
    {
      name: 'call_hook_async',
      description:
        '异步触发 hook (fire-and-forget), 立即返回不等结果。适用于触发后台任务、不关心返回值。',
      schema: hookCallSchema,
    },
  );
}

/* =========================================================================
 * 3) search_hook  ::  发现 hook
 * ========================================================================= */
/**
 * 构建 search_hook 工具 (target 路由)
 * @keyword-en build-search-hook-tool
 */
export function buildSearchHookTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
) {
  return tool(
    async (input: SearchHookInput): Promise<string> => {
      const start = Date.now();
      const filterPreview = preview({
        tags: input.tags,
        pluginName: input.pluginName,
        cursor: input.cursor,
        limit: input.limit,
      });
      if (input.target === SAAS) {
        const all = projectSaasRegistrations(hookBus.listRegistrations()).filter(
          (item) => {
            const wantTags = (input.tags ?? []).filter(Boolean);
            if (
              wantTags.length > 0 &&
              !wantTags.some((t) => item.tags.includes(t))
            ) {
              return false;
            }
            if (input.pluginName && item.pluginName !== input.pluginName) {
              return false;
            }
            return true;
          },
        );
        const limit = Math.max(
          1,
          Math.min(input.limit ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
        );
        const cursor = Math.max(0, input.cursor ?? 0);
        const slice = all.slice(cursor, cursor + limit);
        const nextCursor =
          cursor + slice.length < all.length ? cursor + slice.length : null;
        toolLogger.log(
          `[search_hook] ${targetTag(input.target)} filter=${filterPreview} ` +
            `total=${all.length} returned=${slice.length} duration=${Date.now() - start}ms`,
        );
        return JSON.stringify({
          errorMsg: [],
          result: { items: slice, total: all.length, cursor, nextCursor },
          debugLog: [],
        });
      }
      if (!input.runnerId) {
        toolLogger.warn(`[search_hook] runner missing runnerId, soft error`);
        return JSON.stringify(softError('runnerId-required'));
      }
      const reply = await hookRpc.callHook(input.runnerId, {
        hookName: 'runner.system.hookbus.search',
        payload: {
          tags: input.tags,
          pluginName: input.pluginName,
          cursor: input.cursor,
          limit: input.limit,
        },
        context: getCtx(),
      });
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[search_hook] ${targetTag(input.target, input.runnerId)} filter=${filterPreview} ` +
          `ok=${ok} err=${err} duration=${Date.now() - start}ms` +
          (err > 0 ? ` errMsg=${preview(reply.errorMsg, 200)}` : ''),
      );
      return JSON.stringify(reply);
    },
    {
      name: 'search_hook',
      description:
        '搜索 hook 注册表, 默认每页 100 条, 通过 cursor 翻页。tags 任一命中即返回。' +
        'target=saas 直接走平台 HookBus; target=runner 必填 runnerId。',
      schema: searchHookSchema,
    },
  );
}

/* =========================================================================
 * 4) get_hook_tag  ::  tag 频次榜
 * ========================================================================= */
/**
 * 构建 get_hook_tag 工具 (target 路由)
 * @keyword-en build-get-hook-tag-tool
 */
export function buildGetHookTagTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
) {
  return tool(
    async (input: GetHookTagInput): Promise<string> => {
      const start = Date.now();
      const filterPreview = preview({
        pluginName: input.pluginName,
        cursor: input.cursor,
        limit: input.limit,
      });
      if (input.target === SAAS) {
        const projected = projectSaasRegistrations(hookBus.listRegistrations());
        const tagCount = new Map<string, number>();
        for (const item of projected) {
          if (input.pluginName && item.pluginName !== input.pluginName) continue;
          for (const t of item.tags) {
            tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
          }
        }
        const sorted = Array.from(tagCount.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
        const limit = Math.max(
          1,
          Math.min(input.limit ?? TAG_PAGE_LIMIT, TAG_PAGE_LIMIT),
        );
        const cursor = Math.max(0, input.cursor ?? 0);
        const slice = sorted.slice(cursor, cursor + limit);
        const nextCursor =
          cursor + slice.length < sorted.length ? cursor + slice.length : null;
        toolLogger.log(
          `[get_hook_tag] ${targetTag(input.target)} filter=${filterPreview} ` +
            `total=${sorted.length} returned=${slice.length} duration=${Date.now() - start}ms`,
        );
        return JSON.stringify({
          errorMsg: [],
          result: { items: slice, total: sorted.length, cursor, nextCursor },
          debugLog: [],
        });
      }
      if (!input.runnerId) {
        toolLogger.warn(`[get_hook_tag] runner missing runnerId, soft error`);
        return JSON.stringify(softError('runnerId-required'));
      }
      const reply = await hookRpc.callHook(input.runnerId, {
        hookName: 'runner.system.hookbus.getTag',
        payload: {
          pluginName: input.pluginName,
          cursor: input.cursor,
          limit: input.limit,
        },
        context: getCtx(),
      });
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[get_hook_tag] ${targetTag(input.target, input.runnerId)} filter=${filterPreview} ` +
          `ok=${ok} err=${err} duration=${Date.now() - start}ms` +
          (err > 0 ? ` errMsg=${preview(reply.errorMsg, 200)}` : ''),
      );
      return JSON.stringify(reply);
    },
    {
      name: 'get_hook_tag',
      description:
        `获取已注册 hook 的 tag 频次榜, 默认/上限 ${TAG_PAGE_LIMIT} 条 (一次拿全景便于决策); 超过用 cursor 翻页. ` +
        'target=saas 走平台; target=runner 必填 runnerId. ' +
        '推荐作为 hook 发现链路的起点 - 先看 tag 全景, 再据此 search_hook 缩范围.',
      schema: getHookTagSchema,
    },
  );
}

/* =========================================================================
 * 5) get_hook_info  ::  批量取 hook 描述+tags+payload schema
 * ========================================================================= */
/**
 * 构建 get_hook_info 工具 (target 路由)
 * @keyword-en build-get-hook-info-tool
 */
export function buildGetHookInfoTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
) {
  return tool(
    async (input: GetHookInfoInput): Promise<string> => {
      const start = Date.now();
      const askCount = input.hookNames?.length ?? 0;
      if (input.target === SAAS) {
        const want = new Set(input.hookNames ?? []);
        const all = hookBus.listRegistrations();
        const items: Array<{
          name: string;
          description: string | null;
          tags: string[];
          pluginName: string | null;
          payloadSchema: unknown | null;
        }> = [];
        for (const item of all) {
          if (want.size > 0 && !want.has(item.name)) continue;
          let schema: unknown = null;
          const zod = item.metadata?.payloadSchema;
          if (zod) {
            try {
              schema = z.toJSONSchema(zod);
            } catch {
              schema = null;
            }
          }
          items.push({
            name: item.name,
            description: item.metadata?.description ?? null,
            tags: item.metadata?.tags ?? [],
            pluginName: item.metadata?.pluginName ?? null,
            payloadSchema: schema,
          });
        }
        toolLogger.log(
          `[get_hook_info] ${targetTag(input.target)} ask=${askCount || 'all'} ` +
            `returned=${items.length} duration=${Date.now() - start}ms`,
        );
        return JSON.stringify({
          errorMsg: [],
          result: { items },
          debugLog: [],
        });
      }
      if (!input.runnerId) {
        toolLogger.warn(`[get_hook_info] runner missing runnerId, soft error`);
        return JSON.stringify(softError('runnerId-required'));
      }
      const reply = await hookRpc.callHook(input.runnerId, {
        hookName: 'runner.system.hookbus.getInfo',
        payload: { hookNames: input.hookNames },
        context: getCtx(),
      });
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[get_hook_info] ${targetTag(input.target, input.runnerId)} ask=${askCount || 'all'} ` +
          `ok=${ok} err=${err} duration=${Date.now() - start}ms` +
          (err > 0 ? ` errMsg=${preview(reply.errorMsg, 200)}` : ''),
      );
      return JSON.stringify(reply);
    },
    {
      name: 'get_hook_info',
      description:
        '批量获取 hook 的描述 / tags / payload JSON Schema (从 Zod 派生)。' +
        '调用 call_hook 前先用此工具确认参数结构, 减少 payload 错误。' +
        'target=saas 走平台; target=runner 必填 runnerId。',
      schema: getHookInfoSchema,
    },
  );
}
