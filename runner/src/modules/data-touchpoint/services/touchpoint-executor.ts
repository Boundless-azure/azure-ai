import { Worker } from 'node:worker_threads';
import type { DataTouchpoint } from '../types/data-touchpoint.types';
import type { HookLog } from '../../hookbus/types/hook.types';
import type { RunLogError, RunOutcome } from './touchpoint-run-log';
import { TouchpointHookDeniedError } from './touchpoint-loader';

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
 *  - success :: handler 正常 return, newState 在 result
 *  - error   :: handler 抛错 / worker 异常退出
 *  - timeout :: 超时 worker.terminate kill
 *  - denied  :: 沙箱白名单拒绝, error.hookName/allowedHooks 有值
 * @keyword-en touchpoint-run-result
 */
export interface TouchpointRunResult {
  outcome: RunOutcome;
  newState?: unknown;
  error?: RunLogError;
  durationMs: number;
}

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
        bindSessionId: input.touchpoint.bindSessionId,
        bindAgentId: input.touchpoint.bindAgentId,
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
          deps.log.event('touchpoint.worker.done');
          settle({
            outcome: 'success',
            newState: msg.newState,
            durationMs: 0,
          });
          return;
        }
        case 'error': {
          const kind = msg.kind === 'denied' ? 'denied' : 'error';
          deps.log.event('touchpoint.worker.error', {
            message: msg.message,
            kind,
            ...(msg.hookName ? { hookName: msg.hookName } : {}),
          });
          settle({
            outcome: kind,
            error: {
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
        error: { message: `worker exited unexpectedly with code ${code}` },
        durationMs: 0,
      });
    });
  });
}
