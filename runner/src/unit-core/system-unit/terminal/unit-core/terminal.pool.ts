import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TerminalRecord, TerminalStatus, TerminalPoolStatus } from './terminal.types';

/**
 * @title Terminal 进程池
 * @description 管理 child_process 的生命周期、超时、记录持久化与延时批量删除。
 *   持久化策略:
 *     - sync 正常完成 → 不落盘 (race 已返回 record 给调用方, 盘上版本无意义)
 *     - sync 超时转 async → 落盘 (LLM 后续靠 getOutput 拿结果)
 *     - async 任意完成 → 落盘
 *   删除策略:
 *     - getOutput 调用后 markForDelete: 5 分钟延时, 单一 tick (30s) 扫到点批量 rm
 *     - 24h 兜底: 从未 getOutput 的孤儿记录 (LLM 起了 async 任务忘了 getOutput) 24h 后强制清
 * @keywords-cn 进程池, 终端, 超时, 异步持久化, 延时删除, 队列批量
 * @keywords-en process-pool, terminal, timeout, async-persistence, delay-delete, batch-cleanup
 */

const CLEANUP_TICK_MS = 30_000; // 30s 扫一次 pendingDelete + 24h 兜底
const DELETE_DELAY_MS = 5 * 60 * 1000; // getOutput 后 5 分钟删
const ORPHAN_CUTOFF_MS = 86_400_000; // 24h 兜底

export class TerminalPool {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** spawn 内部 record 引用 + onComplete 闭包, 让 sync 超时分支可以 "提升为 async" 改写 record.persist 状态 */
  private readonly pending = new Map<
    string,
    {
      record: TerminalRecord;
      persistRecord: boolean;
      onComplete?: (r: TerminalRecord) => void;
    }
  >();
  /** handleId → 到点时间戳, tick 扫到 <= now 的批量删 */
  private readonly pendingDelete = new Map<string, number>();
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly recordsDir: string;

  constructor(
    private readonly workspacePath: string,
    private readonly maxPoolSize = 8,
  ) {
    this.recordsDir = join(workspacePath, '.terminal-records');
    mkdirSync(this.recordsDir, { recursive: true });
    // 30s 周期 tick: 同时处理 pendingDelete 到点 + 24h 兜底; unref() 返回 timer 自身, 失败兜底用原 timer
    const timer = setInterval(() => this.runCleanupTick(), CLEANUP_TICK_MS);
    this.cleanupTimer = (timer.unref?.() as NodeJS.Timeout | undefined) ?? timer;
  }

  /**
   * @title 执行命令并返回句柄信息
   * @description spawn 一个子进程, cwd 限制为 workspace 目录。
   *   persistRecord=true 时完成才落盘; sync 模式调用方应传 false (内存 race 已拿结果),
   *   超时转 async 场景通过 promoteToAsync() 提升此标记。
   * @keyword-en spawn-command, persist-on-async
   */
  spawn(
    command: string,
    options: {
      sessionId: string;
      mode: 'sync' | 'async';
      timeout: number;
      maxBuffer: number;
      invocationContext?: Record<string, unknown>;
      /** 完成后是否落盘. sync 默认 false; async 默认 true; sync 超时转 async 用 promoteToAsync 改 */
      persistRecord?: boolean;
      /** 完成回调; sync 一般不传, async 传 sendMsg 通知函数 */
      onComplete?: (record: TerminalRecord) => void;
    },
  ): { handleId: string; promise: Promise<TerminalRecord> } | { error: string } {
    if (this.processes.size >= this.maxPoolSize) {
      return { error: '终端繁忙, 请稍后再试' };
    }

    const handleId = randomUUID().replace(/-/g, '').slice(0, 16);
    const cwd = this.workspacePath;

    const record: TerminalRecord = {
      handleId,
      command,
      sessionId: options.sessionId,
      mode: options.mode,
      status: 'running',
      cwd,
      exitCode: null,
      stdout: '',
      stderr: '',
      startedAt: Date.now(),
      finishedAt: null,
      timeout: options.timeout,
      invocationContext: options.invocationContext,
    };

    this.pending.set(handleId, {
      record,
      persistRecord: options.persistRecord ?? options.mode === 'async',
      onComplete: options.onComplete,
    });

    const proc = spawn(command, [], {
      cwd,
      shell: true,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.processes.set(handleId, proc);

    const chunks_out: Buffer[] = [];
    const chunks_err: Buffer[] = [];

    proc.stdout?.on('data', (chunk: Buffer) => {
      chunks_out.push(chunk);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      chunks_err.push(chunk);
    });

    const promise = new Promise<TerminalRecord>((resolve) => {
      const done = (status: TerminalStatus, exitCode: number | null) => {
        this.processes.delete(handleId);
        const timer = this.timers.get(handleId);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(handleId);
        }

        record.status = status;
        record.exitCode = exitCode;
        record.stdout = Buffer.concat(chunks_out).toString('utf8').slice(0, options.maxBuffer);
        record.stderr = Buffer.concat(chunks_err).toString('utf8').slice(0, options.maxBuffer);
        record.finishedAt = Date.now();

        const meta = this.pending.get(handleId);
        this.pending.delete(handleId);
        // 落盘条件: 显式 persistRecord 或 timeout 状态 (sync 超时一律落盘, 让 LLM 能 getOutput)
        const shouldPersist =
          (meta?.persistRecord ?? false) || status === 'timeout';
        if (shouldPersist) {
          this.writeRecord(record);
        }
        meta?.onComplete?.(record);
        resolve(record);
      };

      proc.on('close', (code) => done(code === 0 ? 'completed' : 'failed', code));
      proc.on('error', () => done('failed', -1));

      // 超时处理
      const timer = setTimeout(() => {
        if (this.processes.has(handleId)) {
          proc.kill('SIGTERM');
          // 3s 后强制 kill
          const killTimer = setTimeout(() => {
            if (this.processes.has(handleId)) {
              proc.kill('SIGKILL');
            }
          }, 3000).unref();
          this.timers.set(`${handleId}:kill`, killTimer);
          done('timeout', null);
        }
      }, options.timeout).unref();
      this.timers.set(handleId, timer);
    });

    return { handleId, promise };
  }

  /**
   * 把指定 handleId 从 "sync 不落盘" 提升为 "async 落盘"; 同时注入 (或替换) onComplete 通知回调。
   * 用于 ops.exec 中 sync race 超时分支: 原 promise 还在跑, 让它完成时落盘 + 触发通知。
   * @keyword-en promote-to-async
   */
  promoteToAsync(
    handleId: string,
    onComplete?: (record: TerminalRecord) => void,
  ): boolean {
    const meta = this.pending.get(handleId);
    if (!meta) return false;
    meta.persistRecord = true;
    if (onComplete) meta.onComplete = onComplete;
    return true;
  }

  /**
   * 标记某条记录在 delayMs 后被删除; 由 getOutput 调用 (LLM 读过了, 5 分钟后清).
   * 多次 mark 取最晚的删除时间.
   * @keyword-en mark-for-delete, delayed-delete
   */
  markForDelete(handleId: string, delayMs = DELETE_DELAY_MS): void {
    const target = Date.now() + delayMs;
    const existing = this.pendingDelete.get(handleId);
    if (existing === undefined || target > existing) {
      this.pendingDelete.set(handleId, target);
    }
  }

  /**
   * @title 终止指定进程
   * @keyword-en kill-process
   */
  kill(handleId: string): boolean {
    const proc = this.processes.get(handleId);
    if (!proc) return false;
    proc.kill('SIGTERM');
    return true;
  }

  /**
   * @title 获取进程池状态
   * @keyword-en pool-status
   */
  getPoolStatus(): TerminalPoolStatus {
    return {
      active: this.processes.size,
      max: this.maxPoolSize,
      available: this.maxPoolSize - this.processes.size,
    };
  }

  /**
   * @title 读取执行记录
   * @description 优先从 pending 内存拿 (running / 刚完成未落盘); 否则读盘.
   * @keyword-en get-record
   */
  getRecord(handleId: string): TerminalRecord | null {
    const live = this.pending.get(handleId);
    if (live) return live.record;
    const filePath = join(this.recordsDir, `${handleId}.json`);
    try {
      const raw = readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as TerminalRecord;
    } catch {
      return null;
    }
  }

  /**
   * @title 终止所有活跃进程
   * @keyword-en cleanup-all
   */
  cleanupAll(): void {
    for (const [id, proc] of this.processes) {
      proc.kill('SIGKILL');
      this.processes.delete(id);
    }
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  /**
   * @title 销毁进程池
   * @keyword-en destroy-pool
   */
  destroy(): void {
    this.cleanupAll();
    clearInterval(this.cleanupTimer);
  }

  /** 写记录文件 */
  private writeRecord(record: TerminalRecord): void {
    const filePath = join(this.recordsDir, `${record.handleId}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch {
      /* ignore write errors */
    }
  }

  /**
   * 30s 周期 tick: 先扫 pendingDelete 到点的批量删, 再做 24h 兜底.
   * @keyword-en cleanup-tick, batch-delete
   */
  private runCleanupTick(): void {
    const now = Date.now();
    // ① pendingDelete 批量删
    const toDelete: string[] = [];
    for (const [handleId, deleteAt] of this.pendingDelete) {
      if (deleteAt <= now) toDelete.push(handleId);
    }
    for (const id of toDelete) {
      this.pendingDelete.delete(id);
      try {
        rmSync(join(this.recordsDir, `${id}.json`), { force: true });
      } catch {
        /* ignore */
      }
    }

    // ② 24h 兜底: 扫盘, 已 finished 超过 24h 的强制清 (LLM 起了 async 忘 getOutput 的孤儿)
    const orphanCutoff = now - ORPHAN_CUTOFF_MS;
    try {
      const files = readdirSync(this.recordsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = join(this.recordsDir, file);
        try {
          const raw = readFileSync(filePath, 'utf8');
          const record = JSON.parse(raw) as TerminalRecord;
          if (record.finishedAt && record.finishedAt < orphanCutoff) {
            rmSync(filePath, { force: true });
          }
        } catch {
          // 解析失败也清理
          rmSync(filePath, { force: true });
        }
      }
    } catch {
      /* ignore */
    }
  }
}
