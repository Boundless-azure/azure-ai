import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { TerminalRecord, TerminalStatus, TerminalPoolStatus } from './terminal.types';

/**
 * @title Terminal 进程池
 * @description 管理 child_process 的生命周期、超时、记录持久化与定时清理。
 * @keywords-cn 进程池, 终端, 超时, 记录持久化
 * @keywords-en process-pool, terminal, timeout, record-persistence
 */
export class TerminalPool {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly recordsDir: string;

  constructor(
    private readonly workspacePath: string,
    private readonly maxPoolSize = 8,
  ) {
    this.recordsDir = join(workspacePath, '.terminal-records');
    mkdirSync(this.recordsDir, { recursive: true });
    // 每 1 小时清理超过 24h 的记录文件
    this.cleanupTimer = setInterval(() => this.cleanOldRecords(), 3600_000).unref?.() ?? this.cleanupTimer;
  }

  /**
   * @title 执行命令并返回句柄信息
   * @description spawn 一个子进程, cwd 限制为 workspace 目录。
   * @keyword-en spawn-command
   */
  spawn(
    command: string,
    options: {
      sessionId: string;
      mode: 'sync' | 'async';
      timeout: number;
      maxBuffer: number;
      invocationContext?: Record<string, unknown>;
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

        this.writeRecord(record);
        options.onComplete?.(record);
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
   * @keyword-en get-record
   */
  getRecord(handleId: string): TerminalRecord | null {
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
    } catch { /* ignore write errors */ }
  }

  /** 清理超过 24h 的记录文件 */
  private cleanOldRecords(): void {
    const cutoff = Date.now() - 86_400_000; // 24h
    try {
      const files = readdirSync(this.recordsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = join(this.recordsDir, file);
        try {
          const raw = readFileSync(filePath, 'utf8');
          const record = JSON.parse(raw) as TerminalRecord;
          if (record.finishedAt && record.finishedAt < cutoff) {
            rmSync(filePath, { force: true });
          }
        } catch {
          // 解析失败也清理
          rmSync(filePath, { force: true });
        }
      }
    } catch { /* ignore */ }
  }
}
