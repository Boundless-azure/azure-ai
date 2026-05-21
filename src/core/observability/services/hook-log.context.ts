import { AsyncLocalStorage } from 'node:async_hooks';
import type { HookLog } from '@core/hookbus/types/hook.types';
import { NOOP_HOOK_LOG } from './hook-log.factory';

/**
 * @title HookLog 调用上下文 (AsyncLocalStorage)
 * @description 把当前 hook 调用的 OTel log 实例挂进 AsyncLocalStorage, 让 controller / service 不带 event 参数也能用 `getCurrentHookLog()` 写日志.
 *              hook.invoker.service.ts 在 chain(decorated) 前用 `runWithHookLog(session.log, ...)` 包一层, 内部所有 await/then 都能透传到这条调用链上的同一个 log.
 *              debug=false 时 session.log 本身是 NOOP_LOG, 全部方法 no-op, 零开销; LLM 调用时 envelope.debug=true → log 写到 OTel SpanEvent → finalize 出 HookLogEntry[] → 跟随 hook result.debugLog 回到 LLM 上下文.
 *              CLAUDE.md 强约束: handler / service 写日志一律走这套, 禁 console.log / 独立 LogRecord.
 * @keywords-cn HookLog上下文, AsyncLocalStorage, 调用栈log, 隐式注入, debug透传
 * @keywords-en hook-log-context, async-local-storage, callstack-log, implicit-injection, debug-propagation
 */

const storage = new AsyncLocalStorage<{ log: HookLog }>();

/**
 * 在 ALS 上下文中执行 fn, 内部任意层 service 调 getCurrentHookLog() 都能拿到这个 log
 *  - 调用方: hook.invoker.service.ts 包 chain 调用; runner 端 hookbus.service.ts 包 chain 调用
 *  - fn 内的 await 链路、Promise 回调、setImmediate 都被 ALS 自动追踪
 * @keyword-en run-with-hook-log
 */
export function runWithHookLog<T>(
  log: HookLog,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(storage.run({ log }, fn));
}

/**
 * 取当前 hook 调用上下文的 log; 不在 hook 调用链路里时 (普通 HTTP 请求 / job 等) 返回 NOOP_HOOK_LOG, 永远不为 undefined
 * @keyword-en get-current-hook-log
 */
export function getCurrentHookLog(): HookLog {
  return storage.getStore()?.log ?? NOOP_HOOK_LOG;
}
