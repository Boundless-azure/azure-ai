import { parentPort, workerData } from 'node:worker_threads';

/**
 * @title 触点胶水代码 worker 入口 (子线程)
 * @description 在独立 worker_thread 里跑胶水代码, 主线程 60s 超时直接 worker.terminate() 真 kill。
 *              callHook / log 走 parentPort RPC, 子线程不直接接触 hookBus / mongo / redis。
 *              协议:
 *                主→子: workerData 一次性 init; 然后 parentPort.postMessage({ type: 'callHookResult', id, ok, data?, error? })
 *                子→主: { type: 'log', level, message, attrs? } / { type: 'callHook', id, name, payload } / { type: 'done', newState } / { type: 'error', message, stack? }
 * @keywords-cn 触点worker, 子线程, 隔离执行, 真kill, parentPort协议
 * @keywords-en touchpoint-worker, child-thread, isolated-exec, real-kill, parentport-protocol
 */

interface WorkerInit {
  fileUrl: string;
  touchpoint: {
    _id: string;
    name: string;
    bindSessionId: string;
    bindAgentId: string;
    solutionId: string;
    sources: string[];
  };
  payload: unknown;
  matchedSources: string[];
  payloadsBySource: Record<string, unknown>;
  prevState: unknown;
}

interface CallHookResultMsg {
  type: 'callHookResult';
  id: string;
  ok: boolean;
  data?: unknown;
  error?: {
    message: string;
    kind: 'denied' | 'error';
    hookName?: string;
    allowedHooks?: string[];
  };
}

if (!parentPort) {
  throw new Error('touchpoint-worker must run inside a Worker thread');
}
const port = parentPort;
const init = workerData as WorkerInit;

const pendingCallHooks = new Map<
  string,
  { resolve: (data: unknown) => void; reject: (err: Error) => void }
>();

let nextCallId = 0;
function nextId(): string {
  nextCallId += 1;
  return `${Date.now()}-${nextCallId}`;
}

port.on('message', (msg: CallHookResultMsg) => {
  if (msg && msg.type === 'callHookResult') {
    const p = pendingCallHooks.get(msg.id);
    if (!p) return;
    pendingCallHooks.delete(msg.id);
    if (msg.ok) {
      p.resolve(msg.data);
    } else {
      const err = new Error(msg.error?.message ?? 'callHook failed');
      if (msg.error) {
        (err as Error & { kind?: string }).kind = msg.error.kind;
        if (msg.error.hookName) {
          (err as Error & { hookName?: string }).hookName = msg.error.hookName;
        }
        if (msg.error.allowedHooks) {
          (err as Error & { allowedHooks?: string[] }).allowedHooks =
            msg.error.allowedHooks;
        }
      }
      p.reject(err);
    }
  }
});

/**
 * 子线程内的 callHook: 通过 parentPort 把调用转发到主线程, 主线程过白名单再走 hookBus
 * @keyword-en worker-call-hook
 */
function callHook(name: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    pendingCallHooks.set(id, { resolve, reject });
    port.postMessage({ type: 'callHook', id, name, payload });
  });
}

/**
 * 子线程内的 log: 通过 parentPort 转给主线程 OTel session
 * @keyword-en worker-log
 */
function makeLog(): {
  trace: (m: string, a?: Record<string, unknown>) => void;
  debug: (m: string, a?: Record<string, unknown>) => void;
  info: (m: string, a?: Record<string, unknown>) => void;
  warn: (m: string, a?: Record<string, unknown>) => void;
  error: (m: string, a?: Record<string, unknown>) => void;
  event: (m: string, a?: Record<string, unknown>) => void;
} {
  const send =
    (level: string) =>
    (message: string, attrs?: Record<string, unknown>): void => {
      port.postMessage({ type: 'log', level, message, attrs });
    };
  return {
    trace: send('trace'),
    debug: send('debug'),
    info: send('info'),
    warn: send('warn'),
    error: send('error'),
    event: send('event'),
  };
}

async function main(): Promise<void> {
  const mod = (await import(init.fileUrl)) as {
    default?: (ctx: unknown) => unknown;
    handler?: (ctx: unknown) => unknown;
  };
  const handler = mod.default ?? mod.handler;
  if (typeof handler !== 'function') {
    throw new Error(
      `touchpoint ${init.touchpoint._id} (${init.fileUrl}) has no default export function`,
    );
  }
  const log = makeLog();
  log.event('touchpoint.run.start', {
    'touchpoint.id': init.touchpoint._id,
    matchedSources: init.matchedSources,
  });
  const ctx = {
    payload: init.payload,
    matchedSources: init.matchedSources,
    payloadsBySource: init.payloadsBySource,
    prevState: init.prevState,
    callHook,
    log: (msg: string, attrs?: Record<string, unknown>): void =>
      log.info(msg, attrs),
    touchpoint: init.touchpoint,
  };
  const newState = await handler(ctx);
  log.event('touchpoint.run.success');
  port.postMessage({ type: 'done', newState });
}

main().catch((err: unknown) => {
  const e = err as Error & {
    kind?: string;
    hookName?: string;
    allowedHooks?: string[];
    stack?: string;
  };
  port.postMessage({
    type: 'error',
    message: e?.message ?? String(err),
    stack: typeof e?.stack === 'string' ? e.stack : undefined,
    kind: e?.kind,
    hookName: e?.hookName,
    allowedHooks: e?.allowedHooks,
  });
});
