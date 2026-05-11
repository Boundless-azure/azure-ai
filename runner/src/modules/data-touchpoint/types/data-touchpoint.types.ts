import { z } from 'zod';

/**
 * @title 数据触点类型与 zod schema
 * @description Runner 侧数据触点的元数据定义。物理代码挂在 solution 目录下,本文件仅描述 mongo 存储的元数据 + CRUD payload schema。
 * @keywords-cn 数据触点, 类型定义, zod-schema, 元数据, 主动推送
 * @keywords-en data-touchpoint, types, zod-schema, metadata, proactive-push
 */

/**
 * 数据触点状态
 * - ready    :: 配置正常,代码可加载
 * - broken   :: 文件缺失 / 加载失败 (运行时回写)
 * - disabled :: 用户主动禁用,不参与触发
 * @keyword-en data-touchpoint-status
 */
export type DataTouchpointStatus = 'ready' | 'broken' | 'disabled';

/**
 * 数据触点元数据 (mongo 存储外形, _id 由调用方生成 UUID)
 * @keyword-en data-touchpoint-entity
 */
export interface DataTouchpoint {
  _id: string;
  solutionId: string;
  name: string;
  description: string;
  /** 触发器调用时携带的 source 名 (业务表 / 自定义维度) */
  sources: string[];
  /** 创建时绑定的 session = 回调目标 (跨 session 后续再扩展) */
  bindSessionId: string;
  /** 群聊艾特目标 agent 的 principalId */
  bindAgentId: string;
  /** 胶水代码相对 solution 根的路径 (e.g. touchpoints/<id>/index.js) */
  filePath: string;
  /** 受限 hook 白名单配置文件相对路径 */
  configPath: string;
  enabled: boolean;
  status: DataTouchpointStatus;
  createdAt: string;
  updatedAt: string;
}

const sourceListSchema = z
  .array(z.string().min(1).max(128))
  .min(1)
  .max(32)
  .describe('触发 source 名列表, 1-32 个');

/**
 * create payload schema
 * @keyword-en create-data-touchpoint-schema
 */
export const CreateDataTouchpointSchema = z.object({
  solutionId: z.string().min(1).describe('挂载的 solution id'),
  name: z.string().min(1).max(128).describe('触点名称'),
  description: z.string().max(2000).default('').describe('触点描述'),
  sources: sourceListSchema,
  bindSessionId: z.string().min(1).describe('绑定的 IM session id, 回调目标'),
  bindAgentId: z.string().min(1).describe('群聊艾特的 agent principal id'),
  filePath: z
    .string()
    .min(1)
    .describe('胶水代码相对 solution 根路径 (e.g. touchpoints/<id>/index.js)'),
  configPath: z
    .string()
    .min(1)
    .describe('受限 hook 白名单配置文件相对路径'),
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
  bindSessionId: z.string().min(1).optional(),
  bindAgentId: z.string().min(1).optional(),
  filePath: z.string().min(1).optional(),
  configPath: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(['ready', 'broken', 'disabled']).optional(),
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
  bindSessionId: z.string().min(1).optional(),
  source: z
    .string()
    .min(1)
    .optional()
    .describe('过滤 sources 数组包含此值的触点'),
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
 * @keyword-en trigger-touchpoint-schema
 */
export const TriggerTouchpointSchema = z.object({
  sourceName: z.string().min(1).describe('触发的 source 名 (匹配 touchpoint.sources)'),
  payload: z.unknown().optional().describe('触发负载, 透传给胶水代码'),
  solutionId: z
    .string()
    .min(1)
    .optional()
    .describe('限定触发范围到指定 solution; 不传则匹配全部 solution 下命中此 source 的触点'),
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
 * 胶水代码 default export 函数签名
 *  - export default async function ({ payload, sourceName, prevState, callHook, log, touchpoint }) { ... }
 *  - 推送决策完全交还胶水代码: 想推就自己 callHook('saas.app.conversation.sendMsg', {...}) (白名单内必须列上)
 *  - 返回值即 newState, 由 trigger.service 写入 store, 下次执行 prevState 就是这个
 *  - return undefined / 不写 return → state 不更新, 保留上次
 * @keyword-en touchpoint-handler
 */
export type TouchpointHandler = (ctx: {
  payload: unknown;
  /** 业务事件触发时的 source 名; schedule 触发时为 undefined */
  sourceName?: string;
  /**
   * 上一次执行写入的 state (return 值); 首次执行 / mongo 没记录 / redis TTL 过期 时为 undefined
   * 高频触点 (export const highFrequency=true) 走 redis 存储, 持久性弱, 必须容忍 undefined
   * @keyword-en touchpoint-prev-state
   */
  prevState: unknown;
  /**
   * 受限 callHook, 仅放行 config.allowedHooks 列出的 hook (saas.* / runner.* 一视同仁)
   * - saas.* 自动跨进程转发 (由 hookBus 内部按前缀路由)
   * - 多 handler 时返回数组, 单 handler 返回首个 data
   */
  callHook: (name: string, payload: unknown) => Promise<unknown>;
  /** 简易 log, 写到 runner 标准输出, 加 [touchpoint:<name>] 前缀 */
  log: (msg: string, attrs?: Record<string, unknown>) => void;
  /** 当前触点元数据快照 */
  touchpoint: DataTouchpoint;
}) => Promise<unknown> | unknown;

/**
 * loader 加载触点后返回的运行时 bundle: 可执行 + 胶水声明的元数据
 * @keyword-en loaded-touchpoint
 */
export interface LoadedTouchpoint {
  /** 执行入口 (内部已包好沙箱 callHook + 超时 + prevState 注入) */
  run(input: {
    payload: unknown;
    sourceName?: string;
    prevState: unknown;
  }): Promise<unknown>;
  /**
   * 胶水代码 export const highFrequency = true → state 走 redis, 否则 mongo
   * @keyword-en touchpoint-high-frequency
   */
  highFrequency: boolean;
  /**
   * 胶水代码 export const schedule = { cron / interval / once } → 注册到 BullMQ Repeatable
   * 不声明 (undefined) → 仅业务事件 trigger 触发, 无定时调度
   * @keyword-en touchpoint-schedule-decl
   */
  schedule?: import('../services/touchpoint-schedule').Schedule;
}
