import { Worker } from 'node:worker_threads';
import type { DataTouchpoint } from '../types/data-touchpoint.types';
import type { HookLog } from '../../hookbus/types/hook.types';
import {
  TouchpointErrorCode,
  type RunLogError,
  type RunOutcome,
} from './touchpoint-run-log';
import { TouchpointHookDeniedError } from './touchpoint-loader';
import type { NotifyDispatchResult } from './touchpoint-notifier';

/**
 * @title 触点执行器 (主线程侧)
 * @description 起一个 worker_thread 跑胶水代码 + 60s 超时强 kill;
 *              监听子线程的 callHook / log RPC, 转发到主线程的 sandboxedCallHook (走 hookBus) + OTel session。
 *              输出统一的 outcome (success / error / timeout / denied) 给 trigger.service。
 * @keywords-cn 触点执行器, 主线程包装, worker通信, 真kill, callHook转发
 * @keywords-en touchpoint-executor, main-thread-wrapper, worker-rpc, real-kill, callhook-forward
 */

// dev (tsx) 下源是 .ts, prod (tsc → dist) 下编译成 .js; 用本模块自身扩展名决定 worker 文件名
const WORKER_EXT = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
const WORKER_URL = new URL(`./touchpoint-worker${WORKER_EXT}`, import.meta.url);

/**
 * 主线程 sandboxedCallHook 协议: 任一错误返回 RunLogError, 成功返回 data
 * @keyword-en sandboxed-callhook-result
 */
export type SandboxedCallHook = (
  name: string,
  payload: unknown,
) => Promise<unknown>;

/**
 * 执行入参
 * @keyword-en touchpoint-run-input
 */
export interface TouchpointRunInput {
  fileUrl: string;
  touchpoint: DataTouchpoint;
  payload: unknown;
  matchedSources: string[];
  payloadsBySource: Record<string, unknown>;
  prevState: unknown;
}

/**
 * 执行结果 (统一外形, 不抛错)
 *  - success :: handler return ret.success / 普通对象 / undefined; newState 落 state
 *  - skip    :: ret.skip; state 保留, skipRecord 决定是否写 runLog
 *  - error   :: ret.error / handler throw / worker 异常 / 通知 NOTIFY_TARGET_INVALID; error.code 必填
 *  - timeout :: 超时 worker.terminate kill (code=TIMEOUT)
 *  - denied  :: 沙箱白名单拒绝 (code=HOOK_DENIED, error.hookName/allowedHooks 有值)
 * @keyword-en touchpoint-run-result
 */
export interface TouchpointRunResult {
  outcome: RunOutcome;
  newState?: unknown;
  error?: RunLogError;
  /** outcome=skip 时胶水声明是否要写一条 run 记录 (默认 false) */
  skipRecord?: boolean;
  /** outcome=skip 时胶水声明的跳过原因 */
  skipReason?: string;
  /** ret.success({ notify }) 触发的通知派发结果; 任一 session 失败 outcome 已翻 error */
  notifyResult?: NotifyDispatchResult;
  durationMs: number;
}

type RetSentinel =
  | { __touchpointRet: 'skip'; record: boolean; reason?: string }
  | {
      __touchpointRet: 'success';
      state?: unknown;
      notify?: { content: string; extras?: Record<string, unknown> };
    }
  | { __touchpointRet: 'error'; message: string; code?: string };

/**
 * 检测 handler return 值是不是 ctx.ret.xxx() 的 sentinel
 * @keyword-en is-ret-sentinel
 */
function isRetSentinel(v: unknown): v is RetSentinel {
  if (!v || typeof v !== 'object') return false;
  const tag = (v as { __touchpointRet?: unknown }).__touchpointRet;
  return tag === 'skip' || tag === 'success' || tag === 'error';
}

/**
 * 通知派发器签名 (主线程 bind 好 touchpoint 后传入)
 * @keyword-en notify-dispatch-fn
 */
export type NotifyDispatchFn = (
  notify: { content: string; extras?: Record<string, unknown> },
  log: HookLog,
) => Promise<NotifyDispatchResult>;

interface WorkerCallHookMsg {
  type: 'callHook';
  id: string;
  name: string;
  payload: unknown;
}
interface WorkerLogMsg {
  type: 'log';
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'event';
  message: string;
  attrs?: Record<string, unknown>;
}
interface WorkerDoneMsg {
  type: 'done';
  newState: unknown;
}
interface WorkerErrorMsg {
  type: 'error';
  message: string;
  stack?: string;
  kind?: 'denied' | 'error';
  hookName?: string;
  allowedHooks?: string[];
}
type WorkerMsg =
  | WorkerCallHookMsg
  | WorkerLogMsg
  | WorkerDoneMsg
  | WorkerErrorMsg;

/**
 * 在 worker_thread 里跑一次触点。timeout 到 terminate worker, 真 kill。
 * 永远不抛错, 一律走 TouchpointRunResult.outcome 返回。
 * @keyword-en run-touchpoint-in-worker
 */
export async function runTouchpointInWorker(
  input: TouchpointRunInput,
  deps: {
    sandboxedCallHook: SandboxedCallHook;
    notifyDispatch: NotifyDispatchFn;
    log: HookLog;
    timeoutMs: number;
  },
): Promise<TouchpointRunResult> {
  const startedAt = Date.now();
  deps.log.event('touchpoint.worker.spawn', {
    'touchpoint.id': input.touchpoint._id,
    fileUrl: input.fileUrl,
    timeoutMs: deps.timeoutMs,
  });

  const worker = new Worker(WORKER_URL, {
    workerData: {
      fileUrl: input.fileUrl,
      touchpoint: {
        _id: input.touchpoint._id,
        name: input.touchpoint.name,
        notifyTargets: input.touchpoint.notifyTargets,
        createdByAgentId: input.touchpoint.createdByAgentId,
        solutionId: input.touchpoint.solutionId,
        sources: input.touchpoint.sources,
      },
      payload: input.payload,
      matchedSources: input.matchedSources,
      payloadsBySource: input.payloadsBySource,
      prevState: input.prevState,
    },
  });

  return new Promise<TouchpointRunResult>((resolve) => {
    let settled = false;
    const settle = (r: TouchpointRunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      worker.terminate().catch(() => undefined);
      resolve({ ...r, durationMs: Date.now() - startedAt });
    };

    const timeoutHandle = setTimeout(() => {
      deps.log.event('touchpoint.worker.timeout', {
        timeoutMs: deps.timeoutMs,
      });
      settle({
        outcome: 'timeout',
        error: {
          code: TouchpointErrorCode.TIMEOUT,
          message: `touchpoint timeout after ${deps.timeoutMs}ms (worker terminated)`,
        },
        durationMs: 0,
      });
    }, deps.timeoutMs);

    worker.on('message', (msg: WorkerMsg) => {
      if (!msg || typeof msg !== 'object') return;
      switch (msg.type) {
        case 'log': {
          const fn = deps.log[msg.level];
          if (typeof fn === 'function') fn(msg.message, msg.attrs);
          return;
        }
        case 'callHook': {
          void (async () => {
            try {
              const data = await deps.sandboxedCallHook(msg.name, msg.payload);
              worker.postMessage({
                type: 'callHookResult',
                id: msg.id,
                ok: true,
                data,
              });
            } catch (err: unknown) {
              const e = err as Error;
              const isDenied = err instanceof TouchpointHookDeniedError;
              worker.postMessage({
                type: 'callHookResult',
                id: msg.id,
                ok: false,
                error: {
                  message: e?.message ?? String(err),
                  kind: isDenied ? 'denied' : 'error',
                  ...(isDenied
                    ? {
                        hookName: (err as TouchpointHookDeniedError).hookName,
                        allowedHooks: (err as TouchpointHookDeniedError)
                          .allowedHooks,
                      }
                    : {}),
                },
              });
            }
          })();
          return;
        }
        case 'done': {
          void handleDone(msg.newState, deps, settle);
          return;
        }
        case 'error': {
          const isDenied = msg.kind === 'denied';
          deps.log.event('touchpoint.worker.error', {
            message: msg.message,
            kind: isDenied ? 'denied' : 'error',
            ...(msg.hookName ? { hookName: msg.hookName } : {}),
          });
          settle({
            outcome: isDenied ? 'denied' : 'error',
            error: {
              code: isDenied
                ? TouchpointErrorCode.HOOK_DENIED
                : TouchpointErrorCode.HANDLER_THROW,
              message: msg.message,
              ...(msg.stack ? { stack: msg.stack } : {}),
              ...(msg.hookName ? { hookName: msg.hookName } : {}),
              ...(msg.allowedHooks ? { allowedHooks: msg.allowedHooks } : {}),
            },
            durationMs: 0,
          });
          return;
        }
      }
    });

    worker.on('error', (err) => {
      deps.log.event('touchpoint.worker.exception', {
        message: err?.message ?? String(err),
      });
      settle({
        outcome: 'error',
        error: {
          code: TouchpointErrorCode.INTERNAL_ERROR,
          message: err?.message ?? String(err),
          ...(err?.stack ? { stack: err.stack } : {}),
        },
        durationMs: 0,
      });
    });

    worker.on('exit', (code) => {
      if (settled) return;
      // 非正常退出且未 settle (例如 SIGKILL / unhandled rejection)
      settle({
        outcome: 'error',
        error: {
          code: TouchpointErrorCode.INTERNAL_ERROR,
          message: `worker exited unexpectedly with code ${code}`,
        },
        durationMs: 0,
      });
    });
  });

  async function handleDone(
    raw: unknown,
    d: {
      sandboxedCallHook: SandboxedCallHook;
      notifyDispatch: NotifyDispatchFn;
      log: HookLog;
      timeoutMs: number;
    },
    settle: (r: TouchpointRunResult) => void,
  ): Promise<void> {
    // 普通 return (含 undefined) → 默认 success
    if (!isRetSentinel(raw)) {
      d.log.event('touchpoint.worker.done', { retKind: 'plain' });
      settle({ outcome: 'success', newState: raw, durationMs: 0 });
      return;
    }
    // ret.skip
    if (raw.__touchpointRet === 'skip') {
      d.log.event('touchpoint.worker.done', {
        retKind: 'skip',
        record: raw.record,
        ...(raw.reason ? { reason: raw.reason } : {}),
      });
      settle({
        outcome: 'skip',
        skipRecord: raw.record,
        ...(raw.reason ? { skipReason: raw.reason } : {}),
        durationMs: 0,
      });
      return;
    }
    // ret.error (胶水主动)
    if (raw.__touchpointRet === 'error') {
      d.log.event('touchpoint.worker.done', {
        retKind: 'error',
        message: raw.message,
        ...(raw.code ? { code: raw.code } : {}),
      });
      const code =
        (Object.values(TouchpointErrorCode) as string[]).includes(
          raw.code ?? '',
        )
          ? (raw.code as TouchpointErrorCode)
          : TouchpointErrorCode.HANDLER_THROW;
      settle({
        outcome: 'error',
        error: { code, message: raw.message },
        durationMs: 0,
      });
      return;
    }
    // ret.success — 可能带 notify, 派发后按 failedSessions 翻 outcome
    d.log.event('touchpoint.worker.done', { retKind: 'success' });
    let notifyResult: NotifyDispatchResult | undefined;
    if (raw.notify) {
      try {
        notifyResult = await d.notifyDispatch(raw.notify, d.log);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        d.log.event('touchpoint.notify.exception', { message });
        settle({
          outcome: 'error',
          error: {
            code: TouchpointErrorCode.NOTIFY_TARGET_INVALID,
            message: `notify dispatch crashed: ${message}`,
          },
          newState: raw.state,
          durationMs: 0,
        });
        return;
      }
    }
    if (notifyResult && notifyResult.failedSessions.length > 0) {
      const first = notifyResult.failedSessions[0];
      settle({
        outcome: 'error',
        error: {
          code: TouchpointErrorCode.NOTIFY_TARGET_INVALID,
          message: `notify failed for ${notifyResult.failedSessions.length}/${notifyResult.totalSessions} session(s); first: ${first.sessionId} - ${first.message}`,
        },
        newState: raw.state,
        notifyResult,
        durationMs: 0,
      });
      return;
    }
    settle({
      outcome: 'success',
      newState: raw.state,
      ...(notifyResult ? { notifyResult } : {}),
      durationMs: 0,
    });
  }
}
