import { ConsoleLogger } from '@nestjs/common';
import { getCurrentHookLog } from './hook-log.context';

/**
 * @title Hook 感知的 NestJS Logger
 * @description 继承 NestJS ConsoleLogger, 重写 log/warn/error/debug/verbose 自动 fan-out 到当前 hook 调用上下文的 HookLog (OTel SpanEvent). 全局通过 app.useLogger(new HookAwareLogger()) 注册一次, 所有 service 内 `this.logger.log(...)` 调用自动同时进 server console + OTel trace, 调用方零感知 — 不再需要双写 logger / getCurrentHookLog.
 *              非 hook 调用链路 (普通 HTTP / job / startup) 时 getCurrentHookLog 返回 NOOP_HOOK_LOG, fan-out 是 no-op, 行为跟原版 ConsoleLogger 完全一致.
 *              hook 调用链路里 debug=true 时, 这条日志会进 hook result.debugLog, 跟随返回值给到 LLM (LLM 失败诊断的关键素材).
 *              CLAUDE.md 强约束: server 端 log 一律走 NestJS Logger, 禁 console.log; 这套 fan-out 机制保证 LLM 也能享受 server 写的 log, 不需要 service 各自调 getCurrentHookLog.
 * @keywords-cn Hook感知Logger, OTel mirror, fan-out, 全局替换, 零感知
 * @keywords-en hook-aware-logger, otel-mirror, fan-out, global-replace, zero-friction
 */

type HookLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

function safeStr(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export class HookAwareLogger extends ConsoleLogger {
  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message as string, ...(optionalParams as string[]));
    this.fanOut('info', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message as string, ...(optionalParams as string[]));
    this.fanOut('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message as string, ...(optionalParams as string[]));
    this.fanOut('error', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message as string, ...(optionalParams as string[]));
    this.fanOut('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message as string, ...(optionalParams as string[]));
    this.fanOut('trace', message, optionalParams);
  }

  /**
   * fan-out 到 HookLog: 拼上 [logger context] 前缀让 LLM 知道日志来源, optionalParams 序列化为 attrs.raw
   * 非 hook 链路时 hookLog 是 NOOP, 整体零开销
   * @keyword-en fan-out-to-hook-log
   */
  private fanOut(
    level: HookLogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const hookLog = getCurrentHookLog();
    const text = safeStr(message);
    // ConsoleLogger 内部 protected context 字段 (类名前缀, e.g. "RoleService")
    const ctx = (this as unknown as { context?: string }).context;
    const tagged = ctx ? `[${ctx}] ${text}` : text;
    // optionalParams 通常是 [errorStack?, context?]; 简化序列化进 attrs 留底, 无开销时 hookLog 直接 noop
    const attrs =
      optionalParams.length > 0
        ? { params: safeStr(optionalParams) }
        : undefined;
    hookLog[level](tagged, attrs);
  }
}
