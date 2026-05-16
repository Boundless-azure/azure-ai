import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerDataTouchpointService } from './data-touchpoint.service';
import { loadTouchpoint, type LoadedTouchpoint } from './touchpoint-loader';
import { runTouchpointInWorker } from './touchpoint-executor';
import { TouchpointLock } from './touchpoint-lock';
import {
  MongoStateStore,
  RedisStateStore,
  type TouchpointStateStore,
} from './touchpoint-state.store';
import {
  removeTouchpointSchedule,
  upsertTouchpointSchedule,
  type ScheduleJobData,
} from './touchpoint-schedule';
import {
  RunnerTouchpointRunLog,
  summarizePayload,
  TouchpointErrorCode,
  type RunLogError,
  type RunOutcome,
} from './touchpoint-run-log';
import { createTouchpointLogSession } from './touchpoint-otel';
import { dispatchTouchpointNotify } from './touchpoint-notifier';
import type {
  DataTouchpoint,
  TriggerTouchpointInput,
} from '../types/data-touchpoint.types';

/**
 * @title 数据触点触发服务
 * @description BullMQ 异步队列 + 触点级 redis 锁串行化 + state 双 store (mongo / redis 高频) + worker_thread 执行 + OTel + 运行历史。
 *              attempts=1, 不重试: 单触点失败仅写 `data_touchpoint_runs` 记录, 不影响其他触点, 也不回写元数据 status。
 *              所有 redis key + BullMQ queue prefix 均加 runnerId 前缀, 多 runner 共享 redis 不互串。
 * @keywords-cn 触发器, 异步队列, BullMQ, 触点锁, 线性化, 状态存储, 双store, 高频, 多租户, 不重试, 运行历史
 * @keywords-en touchpoint-trigger, async-queue, bullmq, touchpoint-lock, linearization, state-store, dual-store, high-frequency, multi-tenant, no-retry, run-history
 */

const QUEUE_NAME = 'data-touchpoint-trigger';
const WORKER_CONCURRENCY = 4;
const LOCK_RETRY_BACKOFF_MS = 200;
const LOCK_TTL_MS = 60_000;

/**
 * 规范化 trigger 入参的 sources (单字符串或数组), 输出去重后的 string[]
 * @keyword-en normalize-trigger-sources
 */
function normalizeTriggerSources(input: TriggerTouchpointInput): string[] {
  const raw = Array.isArray(input.sources) ? input.sources : [input.sources];
  return Array.from(
    new Set(raw.filter((s) => typeof s === 'string' && s.length > 0)),
  );
}

/**
 * 业务事件 trigger job 数据
 * @keyword-en trigger-job-data
 */
interface TriggerJobData {
  sources: string[];
  payload?: unknown;
  payloadsBySource?: Record<string, unknown>;
  solutionId?: string;
  ts: number;
}

/** Worker job 数据 union: 业务事件 trigger / 时间调度 schedule, 通过 job.name 区分 */
type AnyJobData = TriggerJobData | ScheduleJobData;

/**
 * Runner 数据触点触发服务
 *  - start() :: 创建 Queue + Worker + 锁服务 + 双 state store + runLog 索引
 *  - trigger() :: 业务代码主入口, 入队后立即返回
 *  - attempts=1 不重试; 单触点失败只追加 run 记录, 不抛错
 * @keyword-en touchpoint-trigger-service
 */
export class RunnerTouchpointTriggerService {
  private queue?: Queue<AnyJobData>;
  private worker?: Worker<AnyJobData>;
  private redis?: IORedis;
  private lock?: TouchpointLock;
  private mongoStore?: TouchpointStateStore;
  private redisStore?: TouchpointStateStore;
  private runLog?: RunnerTouchpointRunLog;

  constructor(
    private readonly redisUri: string,
    private readonly hookBus: RunnerHookBusService,
    private readonly mongoClient: RunnerMongoClient,
    private readonly runnerId: string,
  ) {
    if (!runnerId) {
      throw new Error(
        'RunnerTouchpointTriggerService requires non-empty runnerId for multi-tenant key isolation',
      );
    }
  }

  /**
   * 启动队列 + Worker + 锁 + state store + runLog 索引; 重复调用安全
   * @keyword-en start-trigger
   */
  async start(): Promise<void> {
    if (this.queue) return;
    const queueConn = new IORedis(this.redisUri, {
      maxRetriesPerRequest: null,
    });
    const workerConn = new IORedis(this.redisUri, {
      maxRetriesPerRequest: null,
    });
    this.redis = new IORedis(this.redisUri, { maxRetriesPerRequest: null });
    this.lock = new TouchpointLock(this.redis, this.runnerId);
    this.redisStore = new RedisStateStore(this.redis, this.runnerId);
    const db = this.mongoClient.getDb();
    if (db) {
      this.mongoStore = new MongoStateStore(db);
      this.runLog = new RunnerTouchpointRunLog(db);
      // 幂等建索引: 触点元数据 + 运行历史; 失败静默 (mongo 版本兼容 / 并发建索引等场景)
      await Promise.all([
        RunnerDataTouchpointService.ensureIndexes(db).catch(() => undefined),
        RunnerTouchpointRunLog.ensureIndexes(db).catch(() => undefined),
      ]);
    }
    const queuePrefix = `tp:${this.runnerId}`;
    this.queue = new Queue<AnyJobData>(QUEUE_NAME, {
      connection: queueConn,
      prefix: queuePrefix,
    });
    this.worker = new Worker<AnyJobData>(
      QUEUE_NAME,
      (job) => this.dispatch(job),
      {
        connection: workerConn,
        concurrency: WORKER_CONCURRENCY,
        prefix: queuePrefix,
      },
    );
    this.worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(
        `[touchpoint-trigger] job ${job?.id} failed:`,
        err.message,
      );
    });
  }

  /**
   * 关闭队列 + Worker + redis 连接 (优雅退出)
   * @keyword-en stop-trigger
   */
  async stop(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.redis?.quit();
    this.worker = undefined;
    this.queue = undefined;
    this.redis = undefined;
    this.lock = undefined;
    this.mongoStore = undefined;
    this.redisStore = undefined;
    this.runLog = undefined;
  }

  /**
   * 触发器入口: 业务代码 / hook handler 调用此处入队.
   * attempts=1 不重试: 单触点失败由内部捕获并写运行记录, 不靠 BullMQ retry.
   * @keyword-en trigger-touchpoint
   */
  async trigger(input: TriggerTouchpointInput): Promise<{ jobId: string }> {
    if (!this.queue) {
      throw new Error('touchpoint trigger not started');
    }
    const sources = normalizeTriggerSources(input);
    if (sources.length === 0) {
      throw new Error('trigger requires non-empty sources');
    }
    const job = await this.queue.add(
      'trigger',
      {
        sources,
        payload: input.payload,
        ...(input.payloadsBySource
          ? { payloadsBySource: input.payloadsBySource }
          : {}),
        ...(input.solutionId ? { solutionId: input.solutionId } : {}),
        ts: Date.now(),
      },
      {
        attempts: 1,
        removeOnComplete: { age: 3_600, count: 1_000 },
        removeOnFail: { age: 24 * 3_600 },
      },
    );
    return { jobId: job.id ?? '' };
  }

  /**
   * 联动清理触点状态 + 运行历史 (delete hook 调用)
   * @keyword-en remove-touchpoint-state
   */
  async removeState(touchpointId: string): Promise<void> {
    await Promise.all([
      this.mongoStore?.remove(touchpointId).catch(() => undefined),
      this.redisStore?.remove(touchpointId).catch(() => undefined),
      this.runLog?.removeByTouchpoint(touchpointId).catch(() => undefined),
    ]);
  }

  /**
   * 重载触点的 schedule (create/update 后调用 + Runner 启动批量调用)
   *  - 触点 enabled=false 时统一 remove
   *  - 加载失败不抛, 仅写一条 run 记录 outcome='error', 避免一个坏触点拖死启动扫表
   * @keyword-en reload-touchpoint-schedule
   */
  async reloadSchedule(tp: DataTouchpoint): Promise<void> {
    if (!this.queue) return;
    if (!tp.enabled) {
      await removeTouchpointSchedule(this.queue, this.runnerId, tp._id);
      return;
    }
    let loaded: LoadedTouchpoint;
    try {
      loaded = await loadTouchpoint(tp, this.hookBus);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.warn(
        `[touchpoint-trigger] reloadSchedule load failed for ${tp._id} (${tp.name}): ${msg}`,
      );
      await this.runLog
        ?.write({
          touchpointId: tp._id,
          runnerId: this.runnerId,
          createdByAgentId: tp.createdByAgentId,
          startedAt: new Date(),
          durationMs: 0,
          firedBy: 'schedule',
          matchedSources: [],
          outcome: 'error',
          payloadSummary: summarizePayload(undefined),
          error: {
            code: TouchpointErrorCode.LOAD_FAILED,
            message: `reloadSchedule load failed: ${msg}`,
          },
          log: [],
        })
        .catch(() => undefined);
      await removeTouchpointSchedule(this.queue, this.runnerId, tp._id);
      return;
    }
    if (loaded.schedule) {
      await upsertTouchpointSchedule(
        this.queue,
        this.runnerId,
        tp._id,
        loaded.schedule,
      );
    } else {
      await removeTouchpointSchedule(this.queue, this.runnerId, tp._id);
    }
  }

  /**
   * 触点 delete 时移除 schedule
   * @keyword-en remove-touchpoint-schedule-by-id
   */
  async removeSchedule(touchpointId: string): Promise<void> {
    if (!this.queue) return;
    await removeTouchpointSchedule(this.queue, this.runnerId, touchpointId);
  }

  /**
   * Runner 启动期批量重载所有 enabled 触点的 schedule (兜底 redis 数据丢失场景)
   * @keyword-en bootstrap-schedules
   */
  async bootstrapSchedules(): Promise<void> {
    const db = this.mongoClient.getDb();
    if (!db || !this.queue) return;
    const svc = new RunnerDataTouchpointService(db);
    const all = await svc.list({ enabled: true });
    for (const tp of all) {
      await this.reloadSchedule(tp);
    }
  }

  /**
   * Worker 入口: 按 job.name 分流业务事件触发 / 时间调度触发
   * @keyword-en dispatch-job
   */
  private async dispatch(job: Job<AnyJobData>): Promise<void> {
    if (job.name === 'schedule') {
      await this.consumeSchedule(job as Job<ScheduleJobData>);
      return;
    }
    await this.consumeTrigger(job as Job<TriggerJobData>);
  }

  /**
   * 业务事件触发: 按 sources $in 拉所有命中触点 → 逐个跑.
   * 单触点失败只写 run 记录, 不抛出, 不影响其他触点 (attempts=1, 也不依赖 retry).
   * @keyword-en consume-trigger-job
   */
  private async consumeTrigger(job: Job<TriggerJobData>): Promise<void> {
    const db = this.mongoClient.getDb();
    if (!db) {
      throw new Error('mongo not connected');
    }
    const svc = new RunnerDataTouchpointService(db);
    const requestedSources = job.data.sources ?? [];
    if (requestedSources.length === 0) return;
    const touchpoints = await svc.list({
      sourceIn: requestedSources,
      enabled: true,
      ...(job.data.solutionId ? { solutionId: job.data.solutionId } : {}),
    });

    const requestedSet = new Set(requestedSources);
    const allPayloads = job.data.payloadsBySource ?? {};

    for (const tp of touchpoints) {
      const matched = tp.sources.filter((s) => requestedSet.has(s));
      if (matched.length === 0) continue;
      const slicedPayloads: Record<string, unknown> = {};
      for (const s of matched) {
        if (s in allPayloads) {
          slicedPayloads[s] = allPayloads[s];
        }
      }
      // 单触点完全自治, 永远不抛 — 错误已落进 run 记录
      await this.runOne(tp, matched, slicedPayloads, job.data.payload, 'source');
    }
  }

  /**
   * 时间调度触发: 直接对指定触点跑; once 类型完成后自动 enabled=false
   * @keyword-en consume-schedule-job
   */
  private async consumeSchedule(job: Job<ScheduleJobData>): Promise<void> {
    const db = this.mongoClient.getDb();
    if (!db) {
      throw new Error('mongo not connected');
    }
    const svc = new RunnerDataTouchpointService(db);
    const tp = await svc.getById(job.data.touchpointId);
    if (!tp) {
      // eslint-disable-next-line no-console
      console.warn(
        `[touchpoint-trigger] schedule fired for missing touchpoint ${job.data.touchpointId}; removing scheduler`,
      );
      await this.removeSchedule(job.data.touchpointId);
      return;
    }
    if (!tp.enabled) {
      await this.removeSchedule(tp._id);
      return;
    }
    const firedAt = Date.now();
    const payload = { firedBy: 'schedule', firedAt };
    await this.runOne(tp, [], {}, payload, 'schedule');
    if (job.data.once) {
      try {
        await svc.update({ id: tp._id, enabled: false });
      } catch {
        // ignore
      }
    }
  }

  /**
   * 执行单触点: load (含路径防护) → OTel session 起 span → 抢锁 → read prev → executor 起 worker 跑 →
   * 写 state + run log + drain logs → 释放锁. 永远不抛.
   * @keyword-en run-one-touchpoint
   */
  private async runOne(
    tp: DataTouchpoint,
    matchedSources: string[],
    payloadsBySource: Record<string, unknown>,
    payload: unknown,
    firedBy: 'source' | 'schedule',
  ): Promise<void> {
    const session = createTouchpointLogSession({
      touchpointId: tp._id,
      touchpointName: tp.name,
      firedBy,
    });
    const startedAt = new Date();
    let outcome: RunOutcome = 'error';
    let newState: unknown = undefined;
    let runError: RunLogError | undefined;
    let durationMs = 0;
    let prevState: unknown = undefined;
    // skip 路径: 胶水 ret.skip({ record, reason }) 透传过来; record=true 才写 runLog
    let skipRecord = false;
    let skipReason: string | undefined = undefined;

    try {
      // 1. 加载 (路径校验 + config + 预读 metadata)
      let loaded: LoadedTouchpoint;
      try {
        loaded = await loadTouchpoint(tp, this.hookBus);
        session.log.event('touchpoint.loaded', {
          highFrequency: loaded.highFrequency,
          allowedHooks: loaded.config.allowedHooks,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        session.log.error('touchpoint.load.failed', { message: msg });
        runError = {
          code: TouchpointErrorCode.LOAD_FAILED,
          message: msg,
          ...(e instanceof Error && e.stack ? { stack: e.stack } : {}),
        };
        return;
      }

      // 2. 抢锁 (TTL 60s, 一次重试)
      if (!this.lock) {
        runError = {
          code: TouchpointErrorCode.INTERNAL_ERROR,
          message: 'touchpoint lock not ready',
        };
        return;
      }
      let token = await this.lock.acquire(tp._id, LOCK_TTL_MS);
      if (!token) {
        await new Promise((r) => setTimeout(r, LOCK_RETRY_BACKOFF_MS));
        token = await this.lock.acquire(tp._id, LOCK_TTL_MS);
      }
      if (!token) {
        session.log.warn('touchpoint.lock.contention');
        runError = {
          code: TouchpointErrorCode.INTERNAL_ERROR,
          message: `touchpoint ${tp._id} lock contention; another execution in progress`,
        };
        return;
      }

      try {
        // 3. 读 prev state
        const store = this.pickStore(loaded.highFrequency);
        prevState = store ? await store.read(tp._id) : undefined;

        // 4. 起 worker 跑 (60s 超时强 kill)
        // notifyDispatch bind 当前 touchpoint + traceId, 让 executor 在 ret.success({ notify }) 时无脑调用;
        // traceId 透传给 saas sendMsg, 串联跨服务 trace 链 (notifier OTel events 跟 saas span 同 trace)
        const notifyDispatch = (
          notify: { content: string; extras?: Record<string, unknown> },
          log: typeof session.log,
        ) =>
          dispatchTouchpointNotify(this.hookBus, tp, notify, log, session.traceId);
        const result = await runTouchpointInWorker(
          {
            fileUrl: loaded.fileUrl,
            touchpoint: tp,
            payload,
            matchedSources,
            payloadsBySource,
            prevState,
          },
          {
            sandboxedCallHook: loaded.sandboxedCallHook,
            notifyDispatch,
            log: session.log,
            timeoutMs: loaded.config.timeout,
          },
        );
        outcome = result.outcome;
        durationMs = result.durationMs;
        if (result.outcome === 'success') {
          newState = result.newState;
          // handler return undefined 时保留上次 state (语义跟旧版一致)
          const stateToWrite = newState === undefined ? prevState : newState;
          if (store) {
            await store
              .write(tp._id, stateToWrite, {
                lastFiredAt: startedAt.getTime(),
                lastFiredBy: firedBy,
                lastFiredPayload: payload,
                lastResult: newState,
              })
              .catch(() => undefined);
          }
        } else if (result.outcome === 'skip') {
          // skip: state 不动; record/reason 透传到 finally 决定是否写 runLog
          skipRecord = result.skipRecord === true;
          skipReason = result.skipReason;
        } else {
          runError = result.error;
        }
      } finally {
        await this.lock.release(tp._id, token).catch(() => undefined);
      }
    } finally {
      // 5. finalize OTel session → drain logs → 按规则写 run 记录
      const { entries, traceId } = session.finalize({
        outcome,
        error: runError?.message,
      });
      // skip 默认静默 (record=false 不写 runLog); 其他 outcome 一律写
      const shouldWriteRunLog = outcome !== 'skip' || skipRecord;
      if (shouldWriteRunLog) {
        await this.runLog
          ?.write({
            touchpointId: tp._id,
            runnerId: this.runnerId,
            createdByAgentId: tp.createdByAgentId,
            startedAt,
            durationMs,
            firedBy,
            matchedSources,
            outcome,
            payloadSummary: summarizePayload(payload),
            ...(outcome === 'success' && newState !== undefined
              ? { result: summarizePayload(newState) }
              : {}),
            ...(runError ? { error: runError } : {}),
            ...(outcome === 'skip' && skipReason
              ? { skipReason }
              : {}),
            traceId,
            log: entries,
          })
          .catch(() => undefined);
      }
    }
  }

  private pickStore(highFrequency: boolean): TouchpointStateStore | undefined {
    return highFrequency ? this.redisStore : this.mongoStore;
  }
}
