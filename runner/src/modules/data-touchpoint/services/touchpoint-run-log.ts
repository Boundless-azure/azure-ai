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
 *  - success :: 正常 return
 *  - error   :: handler 抛错 / worker 异常退出
 *  - timeout :: 超时被 worker.terminate kill
 *  - denied  :: 沙箱白名单拒绝某个 callHook
 * @keyword-en touchpoint-run-outcome
 */
export type RunOutcome = 'success' | 'error' | 'timeout' | 'denied';

/**
 * payload / result 摘要 (前 512 字节预览 + 总字节数), 避免文档膨胀
 * @keyword-en run-log-payload-summary
 */
export interface RunLogPayloadSummary {
  bytes: number;
  preview: string;
}

/**
 * 触发或运行期错误结构
 *  - hookName / allowedHooks 仅 outcome=denied 时填
 * @keyword-en run-log-error
 */
export interface RunLogError {
  message: string;
  stack?: string;
  hookName?: string;
  allowedHooks?: string[];
}

/**
 * mongo 持久化文档形态
 * @keyword-en run-log-doc
 */
export interface RunLogDoc {
  _id: string;
  touchpointId: string;
  runnerId: string;
  startedAt: Date;
  durationMs: number;
  firedBy: 'source' | 'schedule';
  matchedSources: string[];
  outcome: RunOutcome;
  payloadSummary: RunLogPayloadSummary;
  result?: RunLogPayloadSummary;
  error?: RunLogError;
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
      coll.createIndex({ startedAt: 1 }, { expireAfterSeconds: TTL_SECONDS }),
    ]);
  }

  private readonly collection: Collection<RunLogDoc>;

  constructor(db: Db) {
    this.collection = db.collection<RunLogDoc>(COLLECTION_NAME);
  }

  /**
   * 写一条运行记录; 写入异常静默吞掉 (日志写不下去不能拖死触点执行)
   * @keyword-en write-run-log
   */
  async write(doc: Omit<RunLogDoc, '_id'>): Promise<void> {
    try {
      await this.collection.insertOne({ ...doc, _id: randomUUID() });
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
