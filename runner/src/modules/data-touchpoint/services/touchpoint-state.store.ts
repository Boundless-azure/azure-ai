import type { Collection, Db } from 'mongodb';
import type Redis from 'ioredis';

/**
 * @title 触点状态存储 (双 store: mongo / redis)
 * @description 默认 mongo (持久 + 可审计), 高频显式切 redis (低延迟, 弱持久). 胶水代码契约统一, 不感知存储差异. read 返回上次 state, write 落最新 state + meta.
 * @keywords-cn 触点状态, 状态存储, mongo持久, redis高频, 双store
 * @keywords-en touchpoint-state, state-store, mongo-persist, redis-high-freq, dual-store
 */

/**
 * 触点状态写入元数据 (跟随 state 一起记录)
 * @keyword-en touchpoint-state-meta
 */
export interface TouchpointStateMeta {
  lastFiredAt: number;
  lastFiredBy: 'source' | 'schedule';
  lastFiredPayload?: unknown;
  lastResult?: unknown;
  lastError?: { message: string; ts: number };
}

/**
 * 触点状态存储接口
 * @keyword-en touchpoint-state-store
 */
export interface TouchpointStateStore {
  /** 读上次 state, 首次为 undefined */
  read(touchpointId: string): Promise<unknown>;
  /** 写最新 state + meta (upsert) */
  write(
    touchpointId: string,
    state: unknown,
    meta: TouchpointStateMeta,
  ): Promise<void>;
  /** 移除 (触点 delete 时联动清理) */
  remove(touchpointId: string): Promise<void>;
}

/**
 * Mongo collection 形态 (data_touchpoint_states)
 * @keyword-en mongo-state-doc
 */
interface MongoStateDoc {
  _id: string;
  state: unknown;
  lastFiredAt: number;
  lastFiredBy: 'source' | 'schedule';
  lastFiredPayload?: unknown;
  lastResult?: unknown;
  lastError?: { message: string; ts: number };
  updatedAt: Date;
}

/**
 * 默认 store: mongo data_touchpoint_states (持久 + 可审计)
 * @keyword-en mongo-state-store
 */
export class MongoStateStore implements TouchpointStateStore {
  private readonly collection: Collection<MongoStateDoc>;

  constructor(db: Db) {
    this.collection = db.collection<MongoStateDoc>('data_touchpoint_states');
  }

  async read(touchpointId: string): Promise<unknown> {
    const doc = await this.collection.findOne({ _id: touchpointId });
    return doc?.state;
  }

  async write(
    touchpointId: string,
    state: unknown,
    meta: TouchpointStateMeta,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: touchpointId },
      {
        $set: {
          _id: touchpointId,
          state,
          lastFiredAt: meta.lastFiredAt,
          lastFiredBy: meta.lastFiredBy,
          ...(meta.lastFiredPayload !== undefined
            ? { lastFiredPayload: meta.lastFiredPayload }
            : {}),
          ...(meta.lastResult !== undefined
            ? { lastResult: meta.lastResult }
            : {}),
          ...(meta.lastError ? { lastError: meta.lastError } : {}),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  async remove(touchpointId: string): Promise<void> {
    await this.collection.deleteOne({ _id: touchpointId });
  }
}

/**
 * 高频 store: redis (低延迟, 弱持久; 胶水代码必须容忍 prevState=undefined)
 * - key: tp:state:<id>
 * - 24h TTL, 可后续按需调
 * @keyword-en redis-state-store
 */
export class RedisStateStore implements TouchpointStateStore {
  private static readonly DEFAULT_TTL_SEC = 86_400;

  constructor(
    private readonly redis: Redis,
    private readonly ttlSec: number = RedisStateStore.DEFAULT_TTL_SEC,
  ) {}

  private key(touchpointId: string): string {
    return `tp:state:${touchpointId}`;
  }

  async read(touchpointId: string): Promise<unknown> {
    const raw = await this.redis.get(this.key(touchpointId));
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as { state?: unknown };
      return parsed.state;
    } catch {
      return undefined;
    }
  }

  async write(
    touchpointId: string,
    state: unknown,
    meta: TouchpointStateMeta,
  ): Promise<void> {
    const payload = JSON.stringify({ state, ...meta });
    await this.redis.set(this.key(touchpointId), payload, 'EX', this.ttlSec);
  }

  async remove(touchpointId: string): Promise<void> {
    await this.redis.del(this.key(touchpointId));
  }
}
