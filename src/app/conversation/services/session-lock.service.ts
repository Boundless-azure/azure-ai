import { Injectable, Logger } from '@nestjs/common';

/**
 * @title Session 级互斥锁服务
 * @description 给同一个 sessionId 上的多个并发任务 (agent 对话 + smart 压缩) 排队串行,
 *   避免压缩过程读取的消息状态跟正在跑的对话不一致, 也避免重复压缩。
 *   实现: in-memory promise queue, 按 sessionId 维护 tail promise; 每个 runExclusive
 *   把 fn 串到 tail 上, 自己成为新 tail。任务结束自动清理空 tail 防内存泄漏。
 * @keywords-cn 会话锁, 串行执行, 互斥, 压缩与对话同步
 * @keywords-en session-lock, serial-execution, mutex, compress-dialogue-sync
 */
@Injectable()
export class SessionLockService {
  private readonly logger = new Logger(SessionLockService.name);
  /** sessionId → 当前队尾 promise (resolve 表示队尾任务跑完) */
  private readonly tails = new Map<string, Promise<unknown>>();

  /**
   * 在 sessionId 锁内串行执行 fn; 同 sessionId 的多次 runExclusive 严格 FIFO。
   * fn 抛错不会污染后续任务 (内部 catch, 仅本次 reject)。
   * @keyword-en run-exclusive, session-mutex
   */
  async runExclusive<T>(
    sessionId: string,
    label: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prev = this.tails.get(sessionId) ?? Promise.resolve();
    // task: prev 跑完 (无论成败) 后再跑 fn
    const task = prev.then(
      () => fn(),
      () => fn(),
    );
    this.tails.set(sessionId, task);
    const waitedMs = prev === Promise.resolve() ? 0 : Date.now();
    try {
      const result = await task;
      const dur = waitedMs ? Date.now() - waitedMs : 0;
      if (dur > 500) {
        this.logger.debug(
          `[session-lock] ${sessionId}::${label} waited ${dur}ms`,
        );
      }
      return result;
    } finally {
      // tail 是我们这条 → 清掉 (避免空 tail 累积)
      if (this.tails.get(sessionId) === task) {
        this.tails.delete(sessionId);
      }
    }
  }

  /** 判断当前是否有任务在排队/跑 (debug 用) */
  isBusy(sessionId: string): boolean {
    return this.tails.has(sessionId);
  }
}
