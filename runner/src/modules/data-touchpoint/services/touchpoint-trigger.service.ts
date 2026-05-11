import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerMongoClient } from '../../mongo/mongo.client';
import { RunnerDataTouchpointService } from './data-touchpoint.service';
import { loadTouchpoint } from './touchpoint-loader';
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
import type {
  DataTouchpoint,
  LoadedTouchpoint,
  TriggerTouchpointInput,
} from '../types/data-touchpoint.types';

/**
 * @title 数据触点触发服务
 * @description BullMQ 异步队列 (并发 4) + 触点级 redis 锁串行化 + state 双 store (mongo 持久 / redis 高频) + 单触点失败回写 status=broken. 胶水代码完全自治: 自己用 callHook 调任何白名单内的 hook, 推送决策不在这一层. ctx 注入 prevState, return 即 newState.
 * @keywords-cn 触发器, 异步队列, BullMQ, 触点锁, 线性化, 状态存储, 双store, 高频
 * @keywords-en touchpoint-trigger, async-queue, bullmq, touchpoint-lock, linearization, state-store, dual-store, high-frequency
 */

const QUEUE_NAME = 'data-touchpoint-trigger';
const WORKER_CONCURRENCY = 4;
const LOCK_RETRY_BACKOFF_MS = 200;

interface TriggerJobData {
  sourceName: string;
  payload?: unknown;
  solutionId?: string;
  ts: number;
}

/** Worker job 数据 union: 业务事件 trigger / 时间调度 schedule, 通过 job.name 区分 */
type AnyJobData = TriggerJobData | ScheduleJobData;

/**
 * Runner 数据触点触发服务
 * - start() :: 创建 Queue + Worker + 锁服务 + 双 state store (需 redis 已连)
 * - trigger() :: 业务代码主入口, 入队后立即返回
 * - 单触点失败不影响其他触点; status 回写 broken; lastError 写入 state 元数据
 * @keyword-en touchpoint-trigger-service
 */
export class RunnerTouchpointTriggerService {
  private queue?: Queue<AnyJobData>;
  private worker?: Worker<AnyJobData>;
  private redis?: IORedis;
  private lock?: TouchpointLock;
  private mongoStore?: TouchpointStateStore;
  private redisStore?: TouchpointStateStore;

  constructor(
    private readonly redisUri: string,
    private readonly hookBus: RunnerHookBusService,
    private readonly mongoClient: RunnerMongoClient,
  ) {}

  /**
   * 启动队列 + Worker + 锁 + state store; 重复调用安全
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
    // 共享一个 redis 连接给锁 + redisStore (避免一个进程开太多连接)
    this.redis = new IORedis(this.redisUri, { maxRetriesPerRequest: null });
    this.lock = new TouchpointLock(this.redis);
    this.redisStore = new RedisStateStore(this.redis);
    const db = this.mongoClient.getDb();
    if (db) {
      this.mongoStore = new MongoStateStore(db);
    }
    this.queue = new Queue<AnyJobData>(QUEUE_NAME, {
      connection: queueConn,
    });
    this.worker = new Worker<AnyJobData>(
      QUEUE_NAME,
      (job) => this.dispatch(job),
      { connection: workerConn, concurrency: WORKER_CONCURRENCY },
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
  }

  /**
   * 触发器入口: 业务代码 / hook handler 调用此处入队
   * @keyword-en trigger-touchpoint
   */
  async trigger(input: TriggerTouchpointInput): Promise<{ jobId: string }> {
    if (!this.queue) {
      throw new Error('touchpoint trigger not started');
    }
    const job = await this.queue.add(
      'trigger',
      {
        sourceName: input.sourceName,
        payload: input.payload,
        ...(input.solutionId ? { solutionId: input.solutionId } : {}),
        ts: Date.now(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 3_600, count: 1_000 },
        removeOnFail: { age: 24 * 3_600 },
      },
    );
    return { jobId: job.id ?? '' };
  }

  /**
   * 联动清理触点状态 (触点 delete hook 调用); 同时清两个 store, 冗余删无副作用
   * @keyword-en remove-touchpoint-state
   */
  async removeState(touchpointId: string): Promise<void> {
    await Promise.all([
      this.mongoStore?.remove(touchpointId).catch(() => undefined),
      this.redisStore?.remove(touchpointId).catch(() => undefined),
    ]);
  }

  /**
   * 重载触点的 schedule (create/update 后调用 + Runner 启动批量调用)
   * - 加载胶水拿 schedule 元数据; 有则 upsert, 无则确保移除
   * - 触点 enabled=false 时统一 remove (即便胶水声明了 schedule)
   * - 加载失败 (status broken) 不抛, 避免一个坏触点拖死启动扫表
   * @keyword-en reload-touchpoint-schedule
   */
  async reloadSchedule(tp: DataTouchpoint): Promise<void> {
    if (!this.queue) return;
    if (!tp.enabled) {
      await removeTouchpointSchedule(this.queue, tp._id);
      return;
    }
    let loaded: LoadedTouchpoint;
    try {
      loaded = await loadTouchpoint(tp, this.hookBus);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[touchpoint-trigger] reloadSchedule load failed for ${tp._id} (${tp.name}):`,
        e instanceof Error ? e.message : e,
      );
      // 加载失败也尝试清掉残留 schedule
      await removeTouchpointSchedule(this.queue, tp._id);
      return;
    }
    if (loaded.schedule) {
      await upsertTouchpointSchedule(this.queue, tp._id, loaded.schedule);
    } else {
      await removeTouchpointSchedule(this.queue, tp._id);
    }
  }

  /**
   * 触点 delete 时调用, 移除该触点所有 schedule
   * @keyword-en remove-touchpoint-schedule-by-id
   */
  async removeSchedule(touchpointId: string): Promise<void> {
    if (!this.queue) return;
    await removeTouchpointSchedule(this.queue, touchpointId);
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
    // 默认按 trigger 处理
    await this.consumeTrigger(job as Job<TriggerJobData>);
  }

  /**
   * 业务事件触发 (job.name='trigger'): 按 source/solutionId 拉所有命中触点 → 逐个跑
   * @keyword-en consume-trigger-job
   */
  private async consumeTrigger(job: Job<TriggerJobData>): Promise<void> {
    const db = this.mongoClient.getDb();
    if (!db) {
      throw new Error('mongo not connected');
    }
    const svc = new RunnerDataTouchpointService(db);
    const touchpoints = await svc.list({
      source: job.data.sourceName,
      enabled: true,
      ...(job.data.solutionId ? { solutionId: job.data.solutionId } : {}),
    });

    for (const tp of touchpoints) {
      try {
        await this.runOne(tp, job.data.sourceName, job.data.payload, 'source');
      } catch (e) {
        await this.markBroken(svc, tp, e);
      }
    }
  }

  /**
   * 时间调度触发 (job.name='schedule'): 直接对指定触点跑, 不查 sources;
   * once 类型完成后自动 enabled=false
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
      // 触点已禁用却 scheduler 还在, 清掉
      await this.removeSchedule(tp._id);
      return;
    }
    const firedAt = Date.now();
    const payload = { firedBy: 'schedule', firedAt };
    try {
      await this.runOne(tp, undefined, payload, 'schedule');
    } catch (e) {
      await this.markBroken(svc, tp, e);
    } finally {
      // once 类型: 跑完自动 enabled=false 防再次触发 (delayed job 本身不会再发, 但元数据要同步)
      if (job.data.once) {
        try {
          await svc.update({ id: tp._id, enabled: false });
        } catch {
          // ignore
        }
      }
    }
  }

  private async markBroken(
    svc: RunnerDataTouchpointService,
    tp: DataTouchpoint,
    e: unknown,
  ): Promise<void> {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(
      `[touchpoint-trigger] touchpoint ${tp._id} (${tp.name}) failed: ${msg}`,
    );
    try {
      await svc.update({ id: tp._id, status: 'broken' });
    } catch {
      // ignore status writeback failure
    }
  }

  /**
   * 执行单触点: 抢锁 → 加载胶水 → 选 store → read prev → run → write new → 释放锁
   * @keyword-en run-one-touchpoint
   */
  private async runOne(
    tp: DataTouchpoint,
    sourceName: string | undefined,
    payload: unknown,
    firedBy: 'source' | 'schedule',
  ): Promise<void> {
    if (!this.lock) {
      throw new Error('touchpoint lock not ready');
    }

    // 加载胶水拿元数据 + handler (loader 内含 config 读取 + 沙箱包装 + 超时)
    const loaded = await loadTouchpoint(tp, this.hookBus);
    const lockTtlMs = 60_000; // 默认 60s, 比胶水内部 timeout (10s) 大得多, 确保锁不在 handler 跑完前过期

    const token = await this.lock.acquire(tp._id, lockTtlMs);
    if (!token) {
      // 抢不到锁: 同触点正在跑, 短延迟后重试一次; 仍抢不到就抛, 由 BullMQ 指数退避兜底
      await new Promise((r) => setTimeout(r, LOCK_RETRY_BACKOFF_MS));
      const retryToken = await this.lock.acquire(tp._id, lockTtlMs);
      if (!retryToken) {
        throw new Error(
          `touchpoint ${tp._id} lock contention; another execution in progress`,
        );
      }
      return await this.runWithLock(
        loaded,
        tp,
        sourceName,
        payload,
        firedBy,
        retryToken,
      );
    }
    return await this.runWithLock(
      loaded,
      tp,
      sourceName,
      payload,
      firedBy,
      token,
    );
  }

  /**
   * 持锁后的执行体: read prev → run → write new → release. 异常时仍释放锁
   * @keyword-en run-with-lock
   */
  private async runWithLock(
    loaded: LoadedTouchpoint,
    tp: DataTouchpoint,
    sourceName: string | undefined,
    payload: unknown,
    firedBy: 'source' | 'schedule',
    lockToken: string,
  ): Promise<void> {
    const store = this.pickStore(loaded.highFrequency);
    const firedAt = Date.now();
    let prevState: unknown = undefined;
    try {
      prevState = store ? await store.read(tp._id) : undefined;
      const newState = await loaded.run({
        payload,
        sourceName,
        prevState,
      });
      // 写状态: handler return undefined 时也要写 meta (lastFiredAt 等), state 字段保留上次
      const stateToWrite = newState === undefined ? prevState : newState;
      if (store) {
        await store.write(tp._id, stateToWrite, {
          lastFiredAt: firedAt,
          lastFiredBy: firedBy,
          lastFiredPayload: payload,
          lastResult: newState,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 写错误元数据 (state 保留上次), 便于 UI 排错
      if (store) {
        try {
          await store.write(tp._id, prevState, {
            lastFiredAt: firedAt,
            lastFiredBy: firedBy,
            lastFiredPayload: payload,
            lastError: { message: msg, ts: firedAt },
          });
        } catch {
          // ignore meta writeback failure
        }
      }
      throw e;
    } finally {
      await this.lock?.release(tp._id, lockToken).catch(() => undefined);
    }
  }

  private pickStore(highFrequency: boolean): TouchpointStateStore | undefined {
    return highFrequency ? this.redisStore : this.mongoStore;
  }
}
