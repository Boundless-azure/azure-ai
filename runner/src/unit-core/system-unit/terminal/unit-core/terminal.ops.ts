import type { UnitExecutionContext } from '../../../types/unit.types';
import { TerminalPool } from './terminal.pool';
import type {
  TerminalExecPayload,
  TerminalHandlePayload,
  TerminalRecord,
} from './terminal.types';

/**
 * @title Terminal 核心操作
 * @description 终端命令执行、状态查询、结果获取与进程池管理。
 * @keywords-cn 终端操作, 命令执行, 异步句柄, 进程池
 * @keywords-en terminal-ops, command-exec, async-handle, process-pool
 */

/** 默认同步超时 30s */
const SYNC_TIMEOUT_MS = 30_000;
/** 默认异步超时 5min */
const ASYNC_TIMEOUT_MS = 300_000;
/** 默认输出缓冲 1MB */
const DEFAULT_MAX_BUFFER = 1_024 * 1_024;

/** 模块级 pool 单例, workspacePath 相同则复用 */
let _pool: TerminalPool | null = null;
let _poolWorkspace = '';

/** 获取或创建 pool 实例 (按 workspacePath 单例) */
function getPool(ctx: UnitExecutionContext): TerminalPool {
  if (!_pool || _poolWorkspace !== ctx.workspacePath) {
    _pool?.destroy();
    _pool = new TerminalPool(ctx.workspacePath);
    _poolWorkspace = ctx.workspacePath;
  }
  return _pool;
}

/**
 * @title 执行终端命令
 * @description sync 模式 await ≤30s; async 立即返回 handleId, 完成后通过 callSaaSHook 发 Notification。
 * @keyword-en exec-terminal
 */
export async function exec(ctx: UnitExecutionContext, payload: TerminalExecPayload) {
  const pool = getPool(ctx);
  const mode = payload.mode ?? 'sync';
  const timeout = payload.timeout ?? (mode === 'sync' ? SYNC_TIMEOUT_MS : ASYNC_TIMEOUT_MS);
  const maxBuffer = payload.maxBuffer ?? DEFAULT_MAX_BUFFER;

  // 异步完成回调: 调用 SaaS sendMsg 发送 Notification
  const onComplete = async (record: TerminalRecord) => {
    if (!ctx.callSaaSHook) return;
    const content =
      `终端: ${record.command} 已执行完毕, 结果可以通过 'runner.unitcore.terminal.getOutput' 获取`;
    await ctx.callSaaSHook(
      'saas.app.conversation.sendMsg',
      {
        sessionId: record.sessionId,
        content,
        senderPrincipalId: (record.invocationContext as Record<string, unknown>)?.principalId ?? '',
        messageType: 'notification',
      },
      record.invocationContext,
    ).catch(() => { /* 回调失败不影响主流程 */ });
  };

  const result = pool.spawn(payload.command, {
    sessionId: payload.sessionId,
    mode,
    timeout,
    maxBuffer,
    invocationContext: (ctx as Record<string, unknown>).invocationContext as Record<string, unknown> | undefined,
    onComplete: mode === 'async' ? onComplete : undefined,
  });

  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  if (mode === 'sync') {
    // 同步模式: 等待完成, 超时则自动转 async
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), SYNC_TIMEOUT_MS),
    );
    const race = await Promise.race([result.promise, timeoutPromise]);

    if (race === 'timeout') {
      // 超时自动转 async, 后续通过回调通知
      return {
        ok: true,
        handleId: result.handleId,
        status: 'running',
        hint: 'timeout-switched-to-async',
      };
    }

    const record = race as TerminalRecord;
    return {
      ok: true,
      handleId: record.handleId,
      status: record.status,
      exitCode: record.exitCode,
      stdout: record.stdout,
      stderr: record.stderr,
      durationMs: record.finishedAt! - record.startedAt,
    };
  }

  // 异步模式: 立即返回 handleId
  return {
    ok: true,
    handleId: result.handleId,
    status: 'running',
  };
}

/**
 * @title 查询执行状态
 * @keyword-en get-terminal-status
 */
export function getStatus(ctx: UnitExecutionContext, payload: TerminalHandlePayload) {
  const pool = getPool(ctx);
  const record = pool.getRecord(payload.handleId);
  if (!record) {
    return { ok: false, error: 'handle not found' };
  }
  return {
    ok: true,
    handleId: record.handleId,
    status: record.status,
    exitCode: record.exitCode,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}

/**
 * @title 获取完整执行记录
 * @keyword-en get-terminal-output
 */
export function getOutput(ctx: UnitExecutionContext, payload: TerminalHandlePayload) {
  const pool = getPool(ctx);
  const record = pool.getRecord(payload.handleId);
  if (!record) {
    return { ok: false, error: 'handle not found' };
  }
  return {
    ok: true,
    handleId: record.handleId,
    command: record.command,
    status: record.status,
    exitCode: record.exitCode,
    stdout: record.stdout,
    stderr: record.stderr,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    durationMs: record.finishedAt ? record.finishedAt - record.startedAt : null,
  };
}

/**
 * @title 终止运行中的进程
 * @keyword-en kill-terminal
 */
export function kill(ctx: UnitExecutionContext, payload: TerminalHandlePayload) {
  const pool = getPool(ctx);
  const killed = pool.kill(payload.handleId);
  if (!killed) {
    return { ok: false, error: 'process not found or already exited' };
  }
  return { ok: true, handleId: payload.handleId };
}

/**
 * @title 获取进程池状态
 * @keyword-en get-pool-status
 */
export function getPoolStatus(ctx: UnitExecutionContext) {
  const pool = getPool(ctx);
  return { ok: true, ...pool.getPoolStatus() };
}
