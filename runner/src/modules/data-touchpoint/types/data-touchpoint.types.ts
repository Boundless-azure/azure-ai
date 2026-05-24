import { z } from 'zod';

/**
 * @title 数据触点类型与 zod schema
 * @description Runner 侧数据触点的元数据定义。物理代码挂在 solution 目录下,本文件仅描述 mongo 存储的元数据 + CRUD payload schema。
 * @keywords-cn 数据触点, 类型定义, zod-schema, 元数据, 主动推送
 * @keywords-en data-touchpoint, types, zod-schema, metadata, proactive-push
 */

/**
 * 数据触点元数据 (mongo 存储外形, _id 由调用方生成 UUID)
 *  - 健康度从 `data_touchpoint_runs` 运行历史推算, 不在元数据上挂 status
 * @keyword-en data-touchpoint-entity
 */
export interface DataTouchpoint {
  _id: string;
  solutionId: string;
  name: string;
  description: string;
  /** 触发器调用时携带的 source 名 (业务表 / 自定义维度) */
  sources: string[];
  /**
   * 通知派发对象 (session → 该 session 内要 @ 的 agent 列表 的中间表).
   *  - 一个 session 只能有一个 entry; agent 只能列在该 session 真实成员里 (创建时责任在调用方)
   *  - 同一 agent 可出现在多条 entry (一个 agent 在多个 session 里都关注此数据维度)
   *  - 发送时 forEach entry: 给 entry.sessionId 发一条消息, mentions = entry.agentIds (一个 session 一条, 同 session 多 agent 合并 @)
   *  - 任一 session 不存在 / sendMsg 抛错 → 整条 run 翻 outcome='error' + code='NOTIFY_TARGET_INVALID'
   * @keyword-en notify-targets
   */
  notifyTargets: Array<{
    sessionId: string;
    agentIds: string[];
  }>;
  /**
   * 创建该触点的 agent principal id (由 create hook 从 context.principalId 自动注入, 不允许 LLM 显式传).
   *  - 胶水 callHook 业务 hook 用这个身份做 principal (`principalType='agent'`)
   *  - 跟 notifyTargets 解耦: 创建者可能不在通知目标的任何 agent 里 (例如运营 agent 创建给监控 agent 用)
   *  - 一经创建不可改 (update schema 也不放开)
   * @keyword-en created-by-agent-id
   */
  createdByAgentId: string;
  /** 胶水代码相对 solution 根的路径 (e.g. touchpoints/<id>/index.js); 路径越根会被 touchpoint-paths.ts 拒绝 */
  filePath: string;
  /** 受限 hook 白名单配置文件相对路径 */
  configPath: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const sourceListSchema = z
  .array(z.string().min(1).max(128))
  .min(1)
  .max(32)
  .describe('触发 source 名列表, 1-32 个');

/**
 * 通知派发中间表的 entry schema
 *  - sessionId :: 目标会话 ID
 *  - agentIds :: 该 session 内要 @ 的 agent principal id 子集 (调用方负责保证 agent 是该 session 实际成员)
 * @keyword-en notify-target-entry-schema
 */
const notifyTargetEntrySchema = z.object({
  sessionId: z.string().min(1),
  agentIds: z
    .array(z.string().min(1))
    .min(1)
    .max(32)
    .describe('该 session 内要 @ 的 agent 子集 (1-32 个)'),
});

const notifyTargetsSchema = z
  .array(notifyTargetEntrySchema)
  .min(1)
  .max(64)
  .describe(
    '通知派发对象中间表: 一个 session 一条 entry, 该 entry.agentIds 是该 session 内要 @ 的 agent 子集. ' +
      '同一 sessionId 不应出现多次 (重复会被 service 层合并去重). ' +
      '发送时按 entry forEach: 给 sessionId 发一条消息, mentions = agentIds, 同 session 多 agent 合并到一条消息.',
  );

/**
 * create payload schema
 * @keyword-en create-data-touchpoint-schema
 */
export const CreateDataTouchpointSchema = z.object({
  solutionId: z.string().min(1).describe('挂载的 solution id'),
  name: z.string().min(1).max(128).describe('触点名称'),
  description: z.string().max(2000).default('').describe('触点描述'),
  sources: sourceListSchema,
  notifyTargets: notifyTargetsSchema,
  filePath: z
    .string()
    .min(1)
    .describe('胶水代码相对 solution 根路径 (e.g. touchpoints/<id>/index.js)'),
  configPath: z.string().min(1).describe('受限 hook 白名单配置文件相对路径'),
  enabled: z.boolean().default(true),
});

/**
 * update payload schema (id 必填, 其他字段可选)
 * @keyword-en update-data-touchpoint-schema
 */
export const UpdateDataTouchpointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  sources: sourceListSchema.optional(),
  notifyTargets: notifyTargetsSchema.optional(),
  filePath: z.string().min(1).optional(),
  configPath: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

/**
 * delete payload schema
 * @keyword-en delete-data-touchpoint-schema
 */
export const DeleteDataTouchpointSchema = z.object({
  id: z.string().min(1),
});

/**
 * list payload schema (全部可选过滤, 无参数返回全量)
 * @keyword-en list-data-touchpoint-schema
 */
export const ListDataTouchpointSchema = z.object({
  solutionId: z.string().min(1).optional(),
  sessionId: z
    .string()
    .min(1)
    .optional()
    .describe(
      '过滤 notifyTargets 含此 sessionId 的触点 (按 session 维度查 "通知到此 session 的触点")',
    ),
  agentId: z
    .string()
    .min(1)
    .optional()
    .describe(
      '过滤 notifyTargets 的任一 entry.agentIds 含此 agent id 的触点 (按 agent 维度查 "通知到此 agent 的触点")',
    ),
  createdByAgentId: z
    .string()
    .min(1)
    .optional()
    .describe('过滤创建者是此 agent 的触点 ("我创建的触点")'),
  source: z
    .string()
    .min(1)
    .optional()
    .describe('过滤 sources 数组包含此单值的触点 (单值过滤, 与 sourceIn 互斥)'),
  sourceIn: z
    .array(z.string().min(1))
    .min(1)
    .max(32)
    .optional()
    .describe(
      '过滤 sources 数组与任一值相交的触点 ($in 语义); 与 source 互斥, 同传时此字段优先',
    ),
  enabled: z.boolean().optional(),
});

export type CreateDataTouchpointInput = z.infer<
  typeof CreateDataTouchpointSchema
>;
export type UpdateDataTouchpointInput = z.infer<
  typeof UpdateDataTouchpointSchema
>;
export type DeleteDataTouchpointInput = z.infer<
  typeof DeleteDataTouchpointSchema
>;
export type ListDataTouchpointInput = z.infer<typeof ListDataTouchpointSchema>;

/**
 * 触发器入参
 * - sources :: 单字符串或数组. 一次操作影响多张表时直接传数组 (例如 ['user', 'auth']),
 *              同时订阅这些 source 的触点会被自然去重, 仅跑一次, 胶水 ctx 拿到 matchedSources / payloadsBySource
 * - payload :: 共享 payload (单 source 场景, 或对所有 source 通用的上下文)
 * - payloadsBySource :: 按 source 名分发 payload; 命中触点只拿到与其 sources 交集的子集
 * @keyword-en trigger-touchpoint-schema
 */
export const TriggerTouchpointSchema = z.object({
  sources: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(32)])
    .describe('触发的 source 名 (单字符串或数组, 匹配 touchpoint.sources)'),
  payload: z
    .unknown()
    .optional()
    .describe('共享 payload, 透传给胶水代码 (单 source 或通用上下文)'),
  payloadsBySource: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      '按 source 名分发 payload; key=source 名, value=该 source 专属 payload. ' +
        '胶水只会拿到本触点 sources 与触发 sources 的交集子集',
    ),
  solutionId: z
    .string()
    .min(1)
    .optional()
    .describe(
      '限定触发范围到指定 solution; 不传则匹配全部 solution 下命中此 source 的触点',
    ),
});
export type TriggerTouchpointInput = z.infer<typeof TriggerTouchpointSchema>;

/**
 * 触点配置文件 (`touchpoint.config.json`) 形状
 * @keyword-en touchpoint-config
 */
export const TouchpointConfigSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  /**
   * 白名单 hook 列表; 胶水代码只能调列在此处的 hook (运行时拦截)
   * @keyword-en allowed-hooks
   */
  allowedHooks: z.array(z.string().min(1)).default([]),
  /** 单次执行超时 ms, 默认 10s, 上限 60s */
  timeout: z.number().int().positive().max(60_000).default(10_000),
});
export type TouchpointConfig = z.infer<typeof TouchpointConfigSchema>;

/**
 * 胶水代码 default export 函数签名 (在 worker_thread 内被执行, 主线程不直接调)
 *  - export default async function ({ payload, matchedSources, payloadsBySource, prevState, callHook, log, touchpoint }) { ... }
 *  - 推送决策完全交还胶水代码: 想推就自己 callHook('saas.app.conversation.sendMsg', {...}) (白名单内必须列上)
 *  - 返回值即 newState, 由 trigger.service 写入 store, 下次执行 prevState 就是这个
 *  - return undefined / 不写 return → state 不更新, 保留上次
 *  - 多 source 触发场景: 一次操作影响多张表 (例: ['user', 'auth']), 同时订阅多 source 的触点仅跑一次,
 *    matchedSources 给出"这次命中的交集", payloadsBySource 按 source 切好对应负载
 *  - 超时 (config.timeout, 默认 10s, 上限 60s) 由 worker.terminate() 强 kill, 胶水代码无机会清理 finally
 * @keyword-en touchpoint-handler
 */
export type TouchpointHandler = (ctx: {
  /** 共享 payload (单 source / 通用上下文); schedule 触发时含 { firedBy: 'schedule', firedAt } */
  payload: unknown;
  /**
   * 本次触发命中此触点的 source 列表 (业务事件场景); schedule 触发为空数组
   * 例: 触点 sources=['user','auth'], 触发 sources=['user','auth','order'] → matchedSources=['user','auth']
   * @keyword-en touchpoint-matched-sources
   */
  matchedSources: string[];
  /**
   * 按 source 名分发的 payload; 仅包含 matchedSources 对应的键, 未声明的 source 不出现
   * 业务调用方未传 payloadsBySource 时为空对象
   * @keyword-en touchpoint-payloads-by-source
   */
  payloadsBySource: Record<string, unknown>;
  /**
   * 上一次执行写入的 state (return 值); 首次执行 / mongo 没记录 / redis TTL 过期 时为 undefined
   * 高频触点 (export const highFrequency=true) 走 redis 存储, 持久性弱, 必须容忍 undefined
   * @keyword-en touchpoint-prev-state
   */
  prevState: unknown;
  /**
   * 受限 callHook, 仅放行 config.allowedHooks 列出的 hook (saas.* / runner.* 一视同仁)
   * - saas.* 自动跨进程转发 (由 hookBus 内部按前缀路由)
   * - 主体身份 = touchpoint.createdByAgentId (触点创建者, principalType='agent'); saas 端 system 链路放行, 真防越权靠白名单+黑名单
   * - 多 handler 时返回数组, 单 handler 返回首个 data
   */
  callHook: (name: string, payload: unknown) => Promise<unknown>;
  /** 简易 log, 通过 worker RPC 写到 OTel SpanEvent, 最终 drain 进运行历史 */
  log: (msg: string, attrs?: Record<string, unknown>) => void;
  /**
   * 统一返回器: 胶水通过 return ret.xxx(...) 声明本次执行结果。
   *  - ret.skip(opts?) :: 跳过, state 保留, 默认不写 RunLogDoc (record=true 才写 outcome='skip')
   *  - ret.success(opts?) :: 业务跑通; opts.state 落 state, opts.notify 触发框架按 notifyTargets forEach 发 sendMsg (每个 entry 一条消息, mentions=entry.agentIds)
   *      - opts 全部缺省 (或 return undefined) → outcome='success', state 保留, 不通知
   *      - notify.content 必填; 框架按 notifyTargets 中间表自动 forEach 发, 每条消息 mentions=该 entry.agentIds; extras 透传到 sendMsg payload
   *  - ret.error(opts) :: 显式报错; outcome='error', code 默认 'HANDLER_THROW', state 保留
   *      - 不调 ret.error 也无所谓: handler 内任何 throw 都被 worker 兜底捕获, 等价 ret.error({ message: e.message })
   *  - 任一 session 在通知阶段不存在 → 框架翻 outcome='error' + code='NOTIFY_TARGET_INVALID'
   * @keyword-en touchpoint-ret
   */
  ret: TouchpointRet;
  /** 当前触点元数据快照 (worker 内只读副本, 字段裁剪) */
  touchpoint: Pick<
    DataTouchpoint,
    | '_id'
    | 'name'
    | 'notifyTargets'
    | 'createdByAgentId'
    | 'solutionId'
    | 'sources'
  >;
}) => Promise<unknown> | unknown;

/**
 * ret API 形态: 胶水 ctx.ret 拿到这个对象
 * @keyword-en touchpoint-ret-api
 */
export interface TouchpointRet {
  /** 跳过本次; state 保留. record=true 才写 RunLogDoc (outcome='skip') */
  skip: (opts?: { record?: boolean; reason?: string }) => TouchpointRetSentinel;
  /**
   * 业务跑通; opts.state 写入触点 state, opts.notify 触发框架通知派发.
   * 全部缺省 / 不调 → 跟 return undefined 等价 (outcome='success' state 保留 不通知)
   */
  success: (opts?: {
    state?: unknown;
    notify?: { content: string; extras?: Record<string, unknown> };
  }) => TouchpointRetSentinel;
  /**
   * 显式报错; outcome='error', code 默认 HANDLER_THROW. state 保留.
   * 通常不需要主动调 — throw 就够了, 框架自动捕获
   */
  error: (opts: { message: string; code?: string }) => TouchpointRetSentinel;
}

/**
 * ret.xxx 返回的 sentinel 形状 (跨 worker postMessage structuredClone 友好)
 * @keyword-en touchpoint-ret-sentinel
 */
export type TouchpointRetSentinel =
  | { __touchpointRet: 'skip'; record: boolean; reason?: string }
  | {
      __touchpointRet: 'success';
      state?: unknown;
      notify?: { content: string; extras?: Record<string, unknown> };
    }
  | { __touchpointRet: 'error'; message: string; code?: string };
