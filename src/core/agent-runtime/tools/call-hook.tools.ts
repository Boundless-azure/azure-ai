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
import {
  buildFailureKey,
  recordHookFailure,
  recordHookSuccess,
  FAILURE_HINT_THRESHOLD,
} from '@/core/agent-runtime/services/hook-failure-tracker';

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
 *              批量统一通过数组形参实现 (call_hook / call_hook_async 入参 calls 数组, search_hook / get_hook_info 入参 tags / hookNames 数组), 不再单独声明 batch 工具。
 * @keywords-cn LLM工具, Hook调用, 路由分发, 上下文闭包, 元工具, 软错误
 * @keywords-en llm-tools, hook-call, target-routing, ctx-closure, meta-tools, soft-error
 */

const SAAS = 'saas' as const;
const RUNNER = 'runner' as const;
/** search_hook / get_hook_info 默认/上限页大小 */
const DEFAULT_PAGE_SIZE = 100;
/** get_hook_tag 上限: tag 是发现链路起点, 一次拿全景, 硬上限 400 */
const TAG_PAGE_LIMIT = 400;

/** call_hook 批量上限 (一次最多并发派发 N 个 hook) */
const CALL_HOOK_BATCH_LIMIT = 20;

/**
 * runnerId 是 UUID 格式 (uuid v7), 不是 alias / 名字。
 * - 必须来自 saas.app.runner.list 返回的 items[].id 字段
 * - 不要传 alias (如 "测试Runner"), 不要传任何人类可读字符串
 * - schema 层强校验, 错格式直接 schema 拒绝, 避免派发到不存在 runner 拿 runner-offline 误导错
 * 复用在 hookCallEntrySchema / searchHookSchema / getHookTagSchema / getHookInfoSchema 的 runnerId 字段。
 * @keyword-en runner-id-regex-shared
 */
const RUNNER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 单次 hook 调用条目 (call_hook / call_hook_async 共用 entry)
 * @keyword-en hook-call-entry-schema
 */
const hookCallEntrySchema = z.object({
  hookName: z
    .string()
    .describe(
      '要调用的 hook 完整名 (platform.app.module.action 4 段, 例 saas.app.runner.list / runner.unitcore.terminal.exec); ' +
        '禁止短名 (如 terminal.exec, mongo.find), 也禁止 saas.app.<arbitrary> 编造; ' +
        '名称必须来自 search_hook / get_hook_info 返回的真实 hook',
    ),
  payload: z
    .array(z.unknown())
    .optional()
    .describe(
      '传给 hook 的位置参数数组。默认按方法形参展开: 单参传 [input], 多参传 [id, body]。无参数传 [] 或省略。',
    ),
  target: z
    .enum([SAAS, RUNNER])
    .default(SAAS)
    .describe(
      'hook 归属端: saas=平台内置 (默认), runner=用户自托管. hookName 以 saas./runner. 开头时工具层会自动按前缀归一化.',
    ),
  runnerId: z
    .string()
    .regex(
      RUNNER_ID_REGEX,
      'runnerId 必须是 UUID 格式 (saas.app.runner.list 返回的 items[].id), 不要传 alias / 名字',
    )
    .optional()
    .describe(
      'target=runner 必填; **必须是 saas.app.runner.list 返回的 items[].id (UUID 形如 019e5852-7ec2-7844-...), 不是 alias / 名字**',
    ),
  debug: z
    .boolean()
    .optional()
    .describe(
      '可选, 覆盖节点 defaultDebug 配置. 不传=跟随节点; true=强制启 OTel sandbox tracer 拿回 debugLog 排查; ' +
        'false=强制关. 常规调用不要传, 仅在 hook 反复失败、需要看 handler 内部日志诊断时显式 true.',
    ),
  debugDb: z
    .boolean()
    .optional()
    .describe('仅 runner: 启用 Mongo 影子集合, 写操作不落主库'),
});
type HookCallInput = z.infer<typeof hookCallEntrySchema>;

/**
 * call_hook / call_hook_async 批量入参; reasoning 强制思考已废除 (LLM 实测不填), 行为约束改由 init_tip 的 usageRules 承载.
 * @keyword-en call-hook-batch-schema, batch-calls
 */
const callHookSchema = z.object({
  calls: z
    .array(hookCallEntrySchema)
    .min(1)
    .max(CALL_HOOK_BATCH_LIMIT)
    .describe(
      `要调用的 hook 列表, 顺序与返回 results 对齐; 单调用传单元素数组, 批量上限 ${CALL_HOOK_BATCH_LIMIT}. ` +
        '不同 entry 可指向不同 target / runnerId, 派发并发执行, 一项软错不影响其他.',
    ),
});
type CallHookBatchInput = z.infer<typeof callHookSchema>;

/** 单条 hook 调用结果 (随 hookName 回带, 便于 LLM 对齐) */
interface HookCallResultEntry extends HookCallReply {
  hookName: string;
}

/**
 * 复用 runnerId schema, 给 searchHook / getHookTag / getHookInfo 用 (跟 hookCallEntrySchema 同语义)。
 * @keyword-en runner-id-schema, uuid-strict
 */
const runnerIdSchema = z
  .string()
  .regex(
    RUNNER_ID_REGEX,
    'runnerId 必须是 UUID 格式 (saas.app.runner.list 返回的 items[].id), 不要传 alias / 名字',
  )
  .optional()
  .describe(
    'target=runner 必填; **必须是 saas.app.runner.list 返回的 items[].id (UUID 形如 019e5852-7ec2-7844-...), 不是 alias 名字**',
  );

const searchHookSchema = z.object({
  target: z.enum([SAAS, RUNNER]).default(SAAS),
  runnerId: runnerIdSchema,
  tags: z
    .array(z.string())
    .optional()
    .describe('按 tag 过滤, 任一命中即返回; 不传则全量'),
  pluginName: z.string().optional(),
  cursor: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(DEFAULT_PAGE_SIZE).optional(),
  isWeb: z
    .boolean()
    .optional()
    .describe(
      '是否只搜索 Web Component Hook (isComponent=true); ' +
        'false (默认) = 只返回普通 hook (排除组件); ' +
        'true = 只返回 Web Component Hook. ' +
        '不传等同于 false。',
    ),
});
type SearchHookInput = z.infer<typeof searchHookSchema>;

const getHookTagSchema = z.object({
  target: z.enum([SAAS, RUNNER]).default(SAAS),
  runnerId: runnerIdSchema,
  pluginName: z.string().optional(),
  cursor: z.number().int().nonnegative().optional(),
  limit: z
    .number()
    .int()
    .positive()
    .max(TAG_PAGE_LIMIT)
    .optional()
    .describe(
      `默认 ${TAG_PAGE_LIMIT}, 一次性拿全景以便 LLM 决策; 上限 ${TAG_PAGE_LIMIT}`,
    ),
  isWeb: z
    .boolean()
    .optional()
    .describe(
      '是否只统计 Web Component Hook 的 tag (isComponent=true); ' +
        'false (默认) = 只统计普通 hook 的 tag (排除组件); ' +
        'true = 只统计 Web Component Hook 的 tag.',
    ),
});
type GetHookTagInput = z.infer<typeof getHookTagSchema>;

const getHookInfoSchema = z.object({
  target: z.enum([SAAS, RUNNER]).default(SAAS),
  runnerId: runnerIdSchema,
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
 * 根据标准 hookName 前缀推断真实目标端, 避免 LLM 省略/误填 target 导致 SaaS hook 被发到 runner。
 * @keyword-en infer-target-from-hook-name
 */
function inferTargetFromHookName(
  hookName: string,
): typeof SAAS | typeof RUNNER | null {
  if (hookName.startsWith('saas.')) return SAAS;
  if (hookName.startsWith('runner.')) return RUNNER;
  return null;
}

/**
 * 归一化单条 call_hook 输入; hookName 前缀优先于 target 字段。
 * @keyword-en normalize-hook-call-input
 */
function normalizeHookCallInput(entry: HookCallInput): HookCallInput {
  const inferredTarget = inferTargetFromHookName(entry.hookName);
  return inferredTarget ? { ...entry, target: inferredTarget } : entry;
}

/**
 * 为 hook-not-found 找最接近的真实 hook 名 (LLM 常漏段/记错名), 返回 did-you-mean 候选。
 * @keyword-cn Hook名建议, 拼写纠正
 * @keyword-en hook-name-suggest, did-you-mean
 */
function suggestHookNames(
  hookBus: HookBusService,
  wrongName: string,
  limit = 3,
): string[] {
  const wrong = wrongName.trim().toLowerCase();
  if (!wrong) return [];
  const wrongSegs = wrong.split('.').filter(Boolean);
  const wrongAction = wrongSegs[wrongSegs.length - 1] ?? '';
  const wrongPrefix = wrongSegs.slice(0, -1).join('.');
  const seen = new Set<string>();
  const scored: Array<{ name: string; score: number }> = [];
  for (const reg of hookBus.listRegistrations()) {
    if (seen.has(reg.name)) continue;
    seen.add(reg.name);
    scored.push({
      name: reg.name,
      score: scoreHookSimilarity(
        reg.name.toLowerCase(),
        wrongSegs,
        wrongAction,
        wrongPrefix,
      ),
    });
  }
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.name);
}

/**
 * 给候选 hook 名打相似度分: action 末段相同 / 共享段 / 前缀命中权重叠加。
 * @keyword-cn Hook名建议, 相似度评分
 * @keyword-en hook-name-suggest, similarity-score
 */
function scoreHookSimilarity(
  candidate: string,
  wrongSegs: string[],
  wrongAction: string,
  wrongPrefix: string,
): number {
  const candSegs = candidate.split('.').filter(Boolean);
  const candAction = candSegs[candSegs.length - 1] ?? '';
  let score = 0;
  // 末段 (action) 相同是最强信号: 典型错误是漏中间段
  // (saas.app.conversation.setPendingAction ← saas.app.conversation.currentSession.setPendingAction)
  if (wrongAction && candAction === wrongAction) score += 100;
  const candSet = new Set(candSegs);
  for (const seg of wrongSegs) {
    if (candSet.has(seg)) score += 10;
  }
  // 候选以猜错名的前缀开头 (漏尾段 / 中间插段场景)
  if (wrongPrefix && candidate.startsWith(wrongPrefix)) score += 30;
  return score;
}

/**
 * 把 SaaS HookBus 的 HookResult[] 适配成 { errorMsg, result, debugLog } 外形
 * @keyword-en adapt-saas-result
 */
async function dispatchSaasHook(
  hookBus: HookBusService,
  ctx: HookInvocationContext,
  input: { hookName: string; payload?: unknown; debug?: boolean },
): Promise<HookCallReply> {
  try {
    // ① fail-fast :: hook 名根本没注册 → 直接返回 errorMsg, 不让 LLM 误以为"存在但空"
    //   (无此挡板 invoker 会返回 [{status:'skipped'}], 经过下面循环会变成 result=[undefined], ok=1)
    const regs = hookBus.select(input.hookName);
    if (regs.length === 0) {
      const suggestions = suggestHookNames(hookBus, input.hookName);
      return softError(
        `hook-not-found:${input.hookName} :: This hook is not registered on saas. ` +
          (suggestions.length > 0
            ? `Did you mean: ${suggestions.join(' | ')} ? ` +
              'Use one of these exact full names (platform.app.module.action), do not shorten or drop segments. '
            : '') +
          '⚠ Correction order: call tool init_tip first to receive discoveryChains, ' +
          'then walk the hook chain (get_hook_tag → search_hook → get_hook_info → call_hook) to find the right hook. ' +
          'Do not guess hook names.',
      );
    }
    // debug 通过 context.extras.debug 透传给 invoker, 启 OTel sandbox; 不污染原 ctx
    const enrichedCtx: HookInvocationContext = input.debug
      ? { ...ctx, extras: { ...(ctx.extras ?? {}), debug: true } }
      : ctx;
    const results = await hookBus.emit({
      name: input.hookName,
      payload: input.payload ?? [],
      context: enrichedCtx,
    });
    const errorMsg: string[] = [];
    const data: unknown[] = [];
    const debugLog: unknown[] = [];
    for (const r of results as Array<{
      status?: string;
      data?: unknown;
      error?: string;
      debugLog?: unknown[];
    }>) {
      if (r?.status === 'error' || r?.error) {
        errorMsg.push(r.error ?? 'hook-error');
      } else if (r?.status === 'skipped') {
        // ② 兜底 :: 即使 select 通过, invoker 链路里所有 reg 都被 filter 跳过也要明确告知 LLM
        //   不能让 skipped 伪装成成功 (LLM 看见 ok=1 就会误判"hook 存在但空")
        errorMsg.push(
          `hook-skipped:${input.hookName} :: 命中的 handler 全部被中间件/filter 跳过, ` +
            'payload 或 filter 条件可能不对.',
        );
      } else {
        data.push(r?.data);
      }
      if (r?.debugLog && r.debugLog.length > 0) {
        debugLog.push(...r.debugLog);
      }
    }
    return { errorMsg, result: data, debugLog };
  } catch (e) {
    return softError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * 路由一次 hook 调用到 saas 或 runner
 *  - debug 三层优先级 :: input.debug (LLM 显式) > defaultDebug (节点配置 agent.desc.ts) > false (兜底)
 *  - 工厂闭包绑定 defaultDebug, 整个 graph 流稳定一致, 不跨轮次漂移
 * @keyword-en dispatch-call
 */
async function dispatchOne(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  ctx: HookInvocationContext,
  input: HookCallInput,
  defaultDebug: boolean,
): Promise<HookCallReply> {
  const normalized = normalizeHookCallInput(input);
  const debug = normalized.debug ?? defaultDebug;
  if (normalized.target === SAAS) {
    return await dispatchSaasHook(hookBus, ctx, {
      hookName: normalized.hookName,
      payload: normalized.payload,
      debug,
    });
  }
  if (!normalized.runnerId) {
    return softError('runnerId-required');
  }
  return await hookRpc.callHook(normalized.runnerId, {
    hookName: normalized.hookName,
    payload: normalized.payload ?? [],
    context: ctx,
    debug,
    debugDb: normalized.debugDb,
  });
}

/**
 * SaaS 侧本地走 registry, 投影成与 runner meta hook 同形的列表（含 isComponent）
 * @keyword-en project-saas-registrations
 */
function projectSaasRegistrations(regs: HookRegistration[]): Array<{
  name: string;
  tags: string[];
  description: string | null;
  pluginName: string | null;
  isComponent: boolean;
}> {
  const seen = new Set<string>();
  const list: Array<{
    name: string;
    tags: string[];
    description: string | null;
    pluginName: string | null;
    isComponent: boolean;
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
      isComponent: item.metadata?.isComponent === true,
    });
  }
  return list;
}

/* =========================================================================
 * 1) call_hook  ::  同步, 等结果
 * ========================================================================= */

/**
 * call_hook 完成后的副作用回调 :: 主对话 runtime 用它把成功项写入 callHistory.
 * @keyword-en call-hook-side-effects
 */
export interface CallHookSideEffects {
  onCallComplete?: (
    record: {
      hookName: string;
      target: 'saas' | 'runner';
      payload: unknown;
      result: unknown;
      errorMsg: string[];
      ts: number;
    },
    ctx: HookInvocationContext,
  ) => void;
}

/**
 * 处理单条调用的失败 hint 注入 + 副作用回调; per-call 触发
 * @keyword-en process-one-call-aftermath
 */
function processOneCallAftermath(
  entry: HookCallInput,
  reply: HookCallReply,
  ctx: HookInvocationContext,
  sideEffects?: CallHookSideEffects,
): void {
  const { err } = countReply(reply);
  const sessionId = ctx.extras?.sessionId as string | undefined;
  const failureKey = buildFailureKey(
    sessionId,
    ctx.principalId,
    entry.hookName,
  );
  if (err > 0) {
    const failureCount = recordHookFailure(failureKey);
    const hasSchemaError = reply.errorMsg.some((m) =>
      /payload-schema-invalid/i.test(m),
    );
    if (
      !hasSchemaError &&
      failureCount >= FAILURE_HINT_THRESHOLD &&
      !entry.debug
    ) {
      reply.errorMsg.push(
        `⚠ 该 hook 在本会话已连续失败 ${failureCount} 次。建议: ` +
          `(1) 调 tool init_tip 重新拿 discoveryChains, 走 callLog / hook 链路重新发现正确用法; ` +
          `(2) 下次调用时传 debug: true 启用 OTel trace, 拿 handler 内部日志 (debugLog 字段) 辅助诊断 — ` +
          `errorMsg 之外可能有 service 层 warn/info 解释根因 (如 id 格式 / 不存在 / 越权拦截)。`,
      );
    }
  } else {
    recordHookSuccess(failureKey);
  }

  if (sideEffects?.onCallComplete) {
    try {
      sideEffects.onCallComplete(
        {
          hookName: entry.hookName,
          target: entry.target,
          payload: entry.payload ?? null,
          result: reply.result ?? null,
          errorMsg: reply.errorMsg ?? [],
          ts: Date.now(),
        },
        ctx,
      );
    } catch (e) {
      toolLogger.warn(
        `[call_hook] sideEffect failed (${entry.hookName}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

/**
 * 构建 call_hook (同步, 批量) 工具
 * - 一次接受 calls 数组, 并发派发, 顺序与返回 results 对齐
 * - 单调用 = 单元素数组; 任一项软错不影响其他项
 * - options.defaultDebug :: 节点级 debug 默认值; 工厂闭包绑定, 整个 graph 流共享
 * @keyword-en build-call-hook-tool
 */
export function buildCallHookTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
  sideEffects?: CallHookSideEffects,
  options?: { defaultDebug?: boolean },
) {
  const defaultDebug = options?.defaultDebug ?? false;
  return tool(
    async (input: CallHookBatchInput): Promise<string> => {
      const start = Date.now();
      const ctx = getCtx();
      const calls = input.calls.map(normalizeHookCallInput);
      const replies = await Promise.all(
        calls.map((entry) =>
          dispatchOne(hookBus, hookRpc, ctx, entry, defaultDebug),
        ),
      );

      const results: HookCallResultEntry[] = calls.map((entry, i) => {
        const reply = replies[i] ?? softError('dispatch-missing');
        processOneCallAftermath(entry, reply, ctx, sideEffects);
        const { ok, err } = countReply(reply);
        toolLogger.log(
          `[call_hook] ${targetTag(entry.target, entry.runnerId)} ${entry.hookName} ` +
            `payload=${preview(entry.payload ?? {})} ok=${ok} err=${err}` +
            (err > 0
              ? ` errMsg=${preview(reply.errorMsg, 200)}`
              : ` data=${preview(reply.result, 240)}`),
        );
        return { hookName: entry.hookName, ...reply };
      });

      const totalErr = results.reduce(
        (acc, r) => acc + (r.errorMsg?.length ?? 0),
        0,
      );
      toolLogger.log(
        `[call_hook] batch=${calls.length} err=${totalErr} duration=${Date.now() - start}ms`,
      );

      return JSON.stringify({ results });
    },
    {
      name: 'call_hook',
      description:
        '同步批量调用 hook, 等待全部结果. 这是我触达平台真实数据/能力的唯一通道. ' +
        '入参 { calls: [{ hookName, payload, target, runnerId, debug, debugDb }, ...] }.\n\n' +
        '<when_to_call>\n' +
        '我需要平台数据 / 想发消息给用户 / 想触发任何业务动作时调它. ' +
        '若仅是闲聊且 initTip 已声明 false/false, 也要用本工具调 sendMsg 把回复发出去 — ' +
        '直接返回 final prose 不会送达用户.\n' +
        '</when_to_call>\n\n' +
        '<routing>\n' +
        '- saas.* 自动路由 SaaS; runner.* 自动路由 Runner (必填 runnerId).\n' +
        '- hookName 前缀优先于 target 字段; SaaS hook 永远不会被发到 Runner.\n' +
        '</routing>\n\n' +
        '<payload>每个 payload 是位置参数数组: 单参 [input], 多参 [arg1, arg2], 无参 [].</payload>\n\n' +
        '<no_guess>\n' +
        'hookName 和 payload 都不许凭记忆猜. ' +
        'hookName 必须来自 search_hook / get_hook_info 的真实返回 — 漏段 / 改名 / 缩写都会 hook-not-found (返回里带 "Did you mean" 候选, 照抄完整全名). ' +
        'payload 必须照 get_hook_info 的 payloadSchema 填: payload[0] 要对象就传对象, 不要塞 "" / null / 占位; 无参才传 []. ' +
        '不确定先 get_hook_info, 不要靠软错回退一遍遍试探.\n' +
        '</no_guess>\n\n' +
        '<batching>\n' +
        '- 独立的读调用共享一个 batch (一次 call_hook 传多 entry).\n' +
        '- 有依赖的调用拆 stage (前一次拿结果, 后一次基于结果再调).\n' +
        '- 写调用仅在彼此独立、不会互相覆盖时才并行.\n' +
        `- 单 batch 上限 ${CALL_HOOK_BATCH_LIMIT}.\n` +
        '</batching>\n\n' +
        '<errors>\n' +
        '- errorMsg 非空 = 软错, 不影响 batch 其它项. 据此纠正再试.\n' +
        '- payload-schema-invalid: read expectedPayloadSchema in errorMsg and fix payload directly. Do not call init_tip for this error.\n' +
        '- hook-not-found: hook name is wrong or undiscovered; call init_tip, then use get_hook_tag / search_hook / get_hook_info.\n' +
        '- 鉴权/数据缺失: 如实告诉用户, 不绕过.\n' +
        '</errors>\n\n' +
        '<example>\n' +
        '用户问 "我的待办":\n' +
        'call_hook({ calls: [{ hookName: "saas.app.todo.list", payload: [{ ownerPrincipalId: "<from-ctx>" }] }] })\n' +
        '</example>\n\n' +
        '<example_bad>\n' +
        'call_hook 凭记忆编造 payload 字段 ← 软错回退浪费一轮; payload 不确定先看 callHistory 或 get_hook_info.\n' +
        '</example_bad>',
      schema: callHookSchema,
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
  options?: { defaultDebug?: boolean },
) {
  const defaultDebug = options?.defaultDebug ?? false;
  return tool(
    (input: CallHookBatchInput): string => {
      const ctx = getCtx();
      const calls = input.calls.map(normalizeHookCallInput);
      const queued = calls.map((entry) => {
        toolLogger.log(
          `[call_hook_async] ${targetTag(entry.target, entry.runnerId)} ${entry.hookName} ` +
            `payload=${preview(entry.payload ?? {})} (fire-and-forget)`,
        );
        void dispatchOne(hookBus, hookRpc, ctx, entry, defaultDebug).catch(
          () => undefined,
        );
        return {
          hookName: entry.hookName,
          target: entry.target,
          queued: true,
        };
      });
      return JSON.stringify({ results: queued });
    },
    {
      name: 'call_hook_async',
      description:
        '异步批量触发 hook (fire-and-forget), 立即返回不等结果. ' +
        '入参 { calls: [{...}, ...] }.\n\n' +
        '<when_to_call>\n' +
        '仅用于触发后台任务且我不关心返回值. 默认走 call_hook 同步; ' +
        '只有明确不需要结果时才用 async (例: 触发分析任务、写日志、广播事件).\n' +
        '</when_to_call>\n\n' +
        '<routing/payload/batching>\n' +
        '与 call_hook 相同 (saas./runner. 前缀路由, payload 数组, ' +
        `单 batch 上限 ${CALL_HOOK_BATCH_LIMIT}).\n` +
        '</routing/payload/batching>\n\n' +
        '返回 { results: [{ hookName, target, queued: true }, ...] } 顺序与 calls 对齐.',
      schema: callHookSchema,
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
      // 完整 input payload (含 target/runnerId), 比 filter-only 更便于调试 LLM 实际传值
      const payloadPreview = preview(input);
      const wantWeb = input.isWeb === true;
      if (input.target === SAAS) {
        const all = projectSaasRegistrations(
          hookBus.listRegistrations(),
        ).filter((item) => {
          // isWeb 分离: 默认只返回普通 hook, isWeb=true 只返回组件
          if (item.isComponent !== wantWeb) return false;
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
        });
        const limit = Math.max(
          1,
          Math.min(input.limit ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
        );
        const cursor = Math.max(0, input.cursor ?? 0);
        const slice = all.slice(cursor, cursor + limit);
        const nextCursor =
          cursor + slice.length < all.length ? cursor + slice.length : null;
        toolLogger.log(
          `[search_hook] ${targetTag(input.target)} payload=${payloadPreview} ` +
            `total=${all.length} returned=${slice.length} duration=${Date.now() - start}ms`,
        );
        const resultBody: Record<string, unknown> = {
          items: slice,
          total: all.length,
          cursor,
          nextCursor,
        };
        if (wantWeb && slice.length > 0) {
          resultBody['_instruction'] =
            'These are Web Component Hooks. ' +
            'NEXT STEP: call get_hook_info to get payloadSchema, then output a hook fence in your reply message: ' +
            '```hook\\n{"actionHook":"<hookName>","payload":{...按 payloadSchema 填筛选条件}}\\n``` ' +
            'Then call sendMsg. DO NOT call these hooks via call_hook — the component fetches its own data. Turn complete after sendMsg.';
        }
        return JSON.stringify({
          errorMsg: [],
          result: resultBody,
          debugLog: [],
        });
      }
      if (!input.runnerId) {
        toolLogger.warn(`[search_hook] runner missing runnerId, soft error`);
        return JSON.stringify(softError('runnerId-required'));
      }
      const reply = await hookRpc.callHook(input.runnerId, {
        hookName: 'runner.system.hookbus.search',
        payload: [
          {
            tags: input.tags,
            pluginName: input.pluginName,
            cursor: input.cursor,
            limit: input.limit,
            isWeb: input.isWeb,
          },
        ],
        context: getCtx(),
      });
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[search_hook] ${targetTag(input.target, input.runnerId)} payload=${payloadPreview} ` +
          `ok=${ok} err=${err} duration=${Date.now() - start}ms` +
          (err > 0 ? ` errMsg=${preview(reply.errorMsg, 200)}` : ''),
      );
      return JSON.stringify(reply);
    },
    {
      name: 'search_hook',
      description:
        '搜索 hook 注册表, 默认每页 100 条, 通过 cursor 翻页。tags 任一命中即返回。' +
        'target=saas 直接走平台 HookBus; target=runner 必填 runnerId。' +
        'isWeb=false (默认) 只返回普通 hook; isWeb=true 只返回 Web Component Hook。' +
        '两类严格分离，不传 isWeb 永远不会返回组件，避免搜索混淆。',
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
      const payloadPreview = preview(input);
      if (input.target === SAAS) {
        const wantWeb = input.isWeb === true;
        const projected = projectSaasRegistrations(
          hookBus.listRegistrations(),
        ).filter((item) => item.isComponent === wantWeb);
        const tagCount = new Map<string, number>();
        for (const item of projected) {
          if (input.pluginName && item.pluginName !== input.pluginName)
            continue;
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
          `[get_hook_tag] ${targetTag(input.target)} payload=${payloadPreview} ` +
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
        payload: [
          {
            pluginName: input.pluginName,
            cursor: input.cursor,
            limit: input.limit,
            isWeb: input.isWeb,
          },
        ],
        context: getCtx(),
      });
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[get_hook_tag] ${targetTag(input.target, input.runnerId)} payload=${payloadPreview} ` +
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
        '推荐作为 hook 发现链路的起点 - 先看 tag 全景, 再据此 search_hook 缩范围. ' +
        'isWeb=false (默认) 只统计普通 hook 的 tag; isWeb=true 只统计 Web Component Hook 的 tag，两类严格分离。',
      schema: getHookTagSchema,
    },
  );
}

/* =========================================================================
 * 5) get_hook_info  ::  批量取 hook 描述+tags+payload schema
 * ========================================================================= */
/**
 * get_hook_info 完成后的可选副作用回调.
 * @keyword-en get-hook-info-side-effects
 */
export interface GetHookInfoSideEffects {
  onGetHookInfo?: (ctx: HookInvocationContext) => void;
}

/**
 * 构建 get_hook_info 工具 (target 路由)
 * @keyword-en build-get-hook-info-tool
 */
export function buildGetHookInfoTool(
  hookBus: HookBusService,
  hookRpc: RunnerHookRpcService,
  getCtx: InvocationContextProvider,
  sideEffects?: GetHookInfoSideEffects,
) {
  return tool(
    async (input: GetHookInfoInput): Promise<string> => {
      const start = Date.now();
      const askCount = input.hookNames?.length ?? 0;
      // 副作用 :: 可选统计 get_hook_info 调用次数
      const ctx = getCtx();
      if (sideEffects?.onGetHookInfo) {
        try {
          sideEffects.onGetHookInfo(ctx);
        } catch (e) {
          toolLogger.warn(
            `[get_hook_info] sideEffect failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if (input.target === SAAS) {
        const want = new Set(input.hookNames ?? []);
        const all = hookBus.listRegistrations();
        const items: Array<{
          name: string;
          description: string | null;
          tags: string[];
          pluginName: string | null;
          payloadSchema: unknown;
          isComponent?: true;
          _usage?: string;
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
          const isComponent = item.metadata?.isComponent === true;
          items.push({
            name: item.name,
            description: item.metadata?.description ?? null,
            tags: item.metadata?.tags ?? [],
            pluginName: item.metadata?.pluginName ?? null,
            payloadSchema: schema,
            ...(isComponent
              ? {
                  isComponent: true as const,
                  _usage:
                    `Web Component Hook — DO NOT call via call_hook. ` +
                    `Output a hook fence in your reply message instead: ` +
                    `\`\`\`hook\\n{"actionHook":"${item.name}","payload":{...按 payloadSchema 填筛选条件}}\\n\`\`\` ` +
                    `Then call sendMsg. The component fetches its own data. Turn complete after sendMsg.`,
                }
              : {}),
          });
        }
        toolLogger.log(
          `[get_hook_info] ${targetTag(input.target)} payload=${preview(input)} ask=${askCount || 'all'} ` +
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
        payload: [{ hookNames: input.hookNames }],
        context: getCtx(),
      });
      const { ok, err } = countReply(reply);
      toolLogger.log(
        `[get_hook_info] ${targetTag(input.target, input.runnerId)} payload=${preview(input)} ask=${askCount || 'all'} ` +
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
