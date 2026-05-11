import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';

/**
 * @title 触点级互斥锁 (基于 redis SET NX EX)
 * @description 每个 touchpointId 一把锁, 同触点串行执行 (满足 prev → run → new 的状态正确性). 释放锁走 Lua 原子脚本, 仅持锁 token 匹配才删, 避免超时被他人占用后误释放.
 * @keywords-cn 触点锁, 互斥锁, 线性化, redis SET NX EX, Lua释放
 * @keywords-en touchpoint-lock, mutex, linearization, redis-set-nx-ex, lua-release
 */

const LUA_RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/**
 * 触点锁服务
 * @keyword-en touchpoint-lock-service
 */
export class TouchpointLock {
  constructor(private readonly redis: Redis) {}

  private key(touchpointId: string): string {
    return `tp:lock:${touchpointId}`;
  }

  /**
   * 抢锁; 抢到返回 token (释放凭据), 抢不到返回 null
   * @keyword-en acquire-touchpoint-lock
   */
  async acquire(touchpointId: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(
      this.key(touchpointId),
      token,
      'PX',
      ttlMs,
      'NX',
    );
    return result === 'OK' ? token : null;
  }

  /**
   * 释放锁; 仅持 token 匹配才删除 (避免超时被他人占用后误释放)
   * @keyword-en release-touchpoint-lock
   */
  async release(touchpointId: string, token: string): Promise<boolean> {
    const result = (await this.redis.eval(
      LUA_RELEASE_SCRIPT,
      1,
      this.key(touchpointId),
      token,
    )) as number;
    return result === 1;
  }
}
