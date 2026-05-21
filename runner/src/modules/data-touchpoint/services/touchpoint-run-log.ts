import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import type { HookLogEntry } from '../../hookbus/types/hook.types';

/**
 * @title 触点运行历史 store
 * @description 每次触点执行 (无论成败 / 超时 / 沙箱拒绝) 都写一条 run 记录到 mongo collection `data_touchpoint_runs`,
 *              用于 UI 展示运行时间轴 + 错误诊断。带 TTL 30 天自动清理, 写入失败静默 (不能因日志写不下去把触点跑挂)。
 *              payload / result 走 summarize 截前 512 字节, 防止文档膨胀。
 * @keywords-cn 触点运行历史, 运行日志, 运行记录, TTL自动清理, payload摘要, 静默写入
 * @keywords-en touchpoint-run-log, run-history, run-record, ttl-cleanup, payload-summary, silent-write
 */

const COLLECTION_NAME = 'data_touchpoint_runs';
const TTL_SECONDS = 30 * 24 * 3600;
const PREVIEW_LIMIT = 512;

/**
 * 执行结果
 *  - success :: 正常 return (newState 落 state)
 *  - skip    :: 胶水主动 ret.skip() 跳过 (state 保留上次, run 记录是否写由 record 决定)
 *  - error   :: handler 抛错 / worker 异常退出
 *  - timeout :: 超时被 worker.terminate kill
 *  - denied  :: 沙箱白名单拒绝某个 callHook
 * @keyword-en touchpoint-run-outcome
 */
export type RunOutcome = 'success' | 'skip' | 'error' | 'timeout' | 'denied';

/**
 * payload / result 摘要 (前 512 字节预览 + 总字节数), 避免文档膨胀
 * @keyword-en run-log-payload-summary
 */
export interface RunLogPayloadSummary {
  bytes: number;
  preview: string;
}

/**
 * 错误码 (内定枚举, 跟 outcome 配合可快速分类筛选)
 *  - HANDLER_THROW          :: 胶水主动抛错 / 没接住, 或显式调 ret.error 未传 code
 *  - HOOK_DENIED            :: 沙箱白名单拒绝 (跟 outcome='denied' 一一对应)
 *  - TIMEOUT                :: 60s 超时被 worker.terminate kill (跟 outcome='timeout' 一一对应)
 *  - LOAD_FAILED            :: 路径越根 / import 失败 / config 解析失败
 *  - NOTIFY_TARGET_INVALID  :: ret.success({ notify }) 时任一 bindSessionId 不存在
 *  - INTERNAL_ERROR         :: 框架内部异常 (lock 抢不到 / mongo 断连等)
 * @keyword-en touchpoint-error-code
 */
export enum TouchpointErrorCode {
  HANDLER_THROW = 'HANDLER_THROW',
  HOOK_DENIED = 'HOOK_DENIED',
  TIMEOUT = 'TIMEOUT',
  LOAD_FAILED = 'LOAD_FAILED',
  NOTIFY_TARGET_INVALID = 'NOTIFY_TARGET_INVALID',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * 触发或运行期错误结构
 *  - code 必填; UI / AI 按 code 快速定位错误来源
 *  - hookName / allowedHooks 仅 outcome=denied (code=HOOK_DENIED) 时填
 * @keyword-en run-log-error
 */
export interface RunLogError {
  /** 错误码 (内定枚举) */
  code: TouchpointErrorCode;
  message: string;
  stack?: string;
  hookName?: string;
  allowedHooks?: string[];
}

/**
 * mongo 持久化文档形态
 *  - 同 touchpointId 下多条记录构成一条**单向链表**: 每条记录的 previousRunId 指向上一条 run 的 _id
 *  - 首条 (或链断点) :: previousRunId = null
 *  - skip + record=false 不写记录 → 不进链; skip + record=true 进链
 *  - 30 天 TTL 过期会让链头被清掉, 是预期行为 (历史本来就该有保留窗口)
 * @keyword-en run-log-doc
 */
export interface RunLogDoc {
  _id: string;
  touchpointId: string;
  runnerId: string;
  /**
   * 触点创建者 agent principal id (从触点元数据冗余进来, 让按"创建者维度"查运行历史不用 join)
   * @keyword-en run-log-created-by-agent-id
   */
  createdByAgentId: string;
  /**
   * 指向同 touchpointId 下上一条 run 的 _id; 首次 / 链断点为 null。
   * UI / AI 拿任意一条可反向追溯整条历史链。
   * @keyword-en previous-run-id
   */
  previousRunId: string | null;
  startedAt: Date;
  durationMs: number;
  firedBy: 'source' | 'schedule';
  matchedSources: string[];
  outcome: RunOutcome;
  payloadSummary: RunLogPayloadSummary;
  result?: RunLogPayloadSummary;
  error?: RunLogError;
  /** outcome=skip 时胶水说明跳过原因; 其他 outcome 留空 */
  skipReason?: string;
  traceId?: string;
  log: HookLogEntry[];
}

/**
 * 把任意值压成摘要 (大于 512 字节截断 + 追加 ...);
 *  - undefined → 空摘要 (bytes=0, preview='')
 *  - 不可 JSON.stringify (循环引用 / 含 BigInt) 走 String(...)
 * @keyword-en summarize-payload
 */
export function summarizePayload(payload: unknown): RunLogPayloadSummary {
  if (payload === undefined) return { bytes: 0, preview: '' };
  let str: string;
  try {
    str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  } catch {
    str = String(payload);
  }
  if (typeof str !== 'string') str = String(str);
  const bytes = Buffer.byteLength(str, 'utf8');
  const preview =
    str.length > PREVIEW_LIMIT ? str.slice(0, PREVIEW_LIMIT) + '...' : str;
  return { bytes, preview };
}

/**
 * 触点运行历史 store; 包装 mongo collection 写入 + TTL 索引初始化
 * @keyword-en runner-touchpoint-run-log
 */
export class RunnerTouchpointRunLog {
  /**
   * 幂等创建索引:
   *  - { touchpointId, startedAt: -1 } 触点详情按时间倒序拉
   *  - { runnerId, startedAt: -1 } 多租户全局视图
   *  - { startedAt } TTL 30 天自动清理
   * @keyword-en ensure-indexes
   */
  static async ensureIndexes(db: Db): Promise<void> {
    const coll = db.collection<RunLogDoc>(COLLECTION_NAME);
    await Promise.all([
      coll.createIndex({ touchpointId: 1, startedAt: -1 }),
      coll.createIndex({ runnerId: 1, startedAt: -1 }),
      coll.createIndex({ createdByAgentId: 1, startedAt: -1 }),
      coll.createIndex({ startedAt: 1 }, { expireAfterSeconds: TTL_SECONDS }),
    ]);
  }

  private readonly collection: Collection<RunLogDoc>;

  constructor(db: Db) {
    this.collection = db.collection<RunLogDoc>(COLLECTION_NAME);
  }

  /**
   * 写一条运行记录, 自动挂上 previousRunId 形成链表:
   *  1. 查同 touchpointId 最新一条 run 的 _id (用 (touchpointId, startedAt:-1) 索引, projection 只拿 _id, O(1))
   *  2. 把新条的 previousRunId 指向它 (首次 = null)
   *  3. insertOne 新条
   * 触点级 redis 锁保证同 touchpointId 不并发, 无 race。
   * 写入异常静默吞掉 (日志写不下去不能拖死触点执行)。
   * 调用方传的 doc 里的 previousRunId 会被忽略 — 链由本方法权威填写。
   * @keyword-en write-run-log
   */
  async write(doc: Omit<RunLogDoc, '_id' | 'previousRunId'>): Promise<void> {
    try {
      const latest = await this.collection.findOne(
        { touchpointId: doc.touchpointId },
        { sort: { startedAt: -1 }, projection: { _id: 1 } },
      );
      await this.collection.insertOne({
        ...doc,
        _id: randomUUID(),
        previousRunId: latest?._id ?? null,
      });
    } catch {
      // 静默: 不能因日志写入失败把触点跑挂
    }
  }

  /**
   * 触点删除时联动清理 (TTL 也会兜底, 即时删更干净)
   * @keyword-en remove-run-log-by-touchpoint
   */
  async removeByTouchpoint(touchpointId: string): Promise<void> {
    try {
      await this.collection.deleteMany({ touchpointId });
    } catch {
      // ignore
    }
  }
}
