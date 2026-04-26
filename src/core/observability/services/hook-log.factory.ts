import { SpanStatusCode, type Attributes, type Span } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import type {
  HookLog,
  HookLogEntry,
  HookLogSession,
} from '@core/hookbus/types/hook.types';

/**
 * @title HookLog 工厂 (SaaS)
 * @description 给单次 hook 调用造一个 log 会话:
 *              - debug=false 走 NOOP_SESSION, 全是 no-op, 零开销 (不创建 provider/span/exporter)
 *              - debug=true 起一次性 BasicTracerProvider + InMemorySpanExporter, 单 span 收 SpanEvent;
 *                调用结束 finalize() 拿到结构化 HookLogEntry[] 写到 reply.debugLog
 *              CLAUDE.md 强约束: 禁 console.log, 禁独立 LogRecord, 走这套统一 API
 * @keywords-cn HookLog工厂, OTel封装, 隔离Provider, 内存Exporter, debug开关
 * @keywords-en hook-log-factory, otel-wrapper, isolated-provider, memory-exporter, debug-toggle
 */

/** 复用的 noop 实现 (单例, 因为没有任何状态) */
const NOOP_LOG: HookLog = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  event: () => {},
};

const NOOP_SESSION: HookLogSession = {
  log: NOOP_LOG,
  finalize: () => [],
};

/** OTel SpanEvent 不允许嵌套对象, 这里浅 stringify 安全降级 */
function flattenAttrs(attrs?: Record<string, unknown>): Attributes {
  if (!attrs) return {};
  const out: Attributes = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      out[k] = v as string[];
      continue;
    }
    try {
      out[k] = JSON.stringify(v);
    } catch {
      out[k] = String(v);
    }
  }
  return out;
}

/** 反向: 从 SpanEvent.attributes 拆出 log.level 与剩余 attrs */
function splitAttrs(attrs: Attributes | undefined): {
  level: HookLogEntry['level'];
  rest?: Record<string, unknown>;
} {
  if (!attrs) return { level: 'info' };
  const { ['log.level']: lvl, ...rest } = attrs;
  const level = (typeof lvl === 'string' ? lvl : 'info') as HookLogEntry['level'];
  return Object.keys(rest).length === 0
    ? { level }
    : { level, rest: rest as Record<string, unknown> };
}

/** [秒,纳秒] → ms */
function hrTimeToMs(t: [number, number]): number {
  return t[0] * 1000 + Math.floor(t[1] / 1e6);
}

function addEvent(
  span: Span,
  level: HookLogEntry['level'],
  message: string,
  attrs?: Record<string, unknown>,
): void {
  span.addEvent(message, { 'log.level': level, ...flattenAttrs(attrs) });
}

/**
 * 为一次 hook 调用创建 log 会话
 * @keyword-en create-hook-log-session
 */
export function createHookLogSession(opts: {
  hookName: string;
  debug: boolean;
  /** 上游传过来的 traceId, 仅作 span attribute 标记, 不做跨进程上下文继承 */
  upstreamTraceId?: string;
}): HookLogSession {
  if (!opts.debug) return NOOP_SESSION;

  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  const tracer = provider.getTracer('hookbus');
  const span = tracer.startSpan(opts.hookName);
  if (opts.upstreamTraceId) {
    span.setAttribute('hook.upstreamTraceId', opts.upstreamTraceId);
  }

  const log: HookLog = {
    trace: (m, a) => addEvent(span, 'trace', m, a),
    debug: (m, a) => addEvent(span, 'debug', m, a),
    info: (m, a) => addEvent(span, 'info', m, a),
    warn: (m, a) => addEvent(span, 'warn', m, a),
    error: (m, a) => addEvent(span, 'error', m, a),
    event: (m, a) => addEvent(span, 'event', m, a),
  };

  return {
    log,
    finalize: ({ ok, error } = {}) => {
      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error });
      } else if (ok) {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
      const finished: ReadableSpan[] = exporter.getFinishedSpans();
      const entries: HookLogEntry[] = [];
      for (const sp of finished) {
        for (const ev of sp.events) {
          const { level, rest } = splitAttrs(ev.attributes);
          entries.push({
            ts: hrTimeToMs(ev.time),
            level,
            message: ev.name,
            ...(rest ? { attrs: rest } : {}),
          });
        }
      }
      void provider.shutdown().catch(() => undefined);
      return entries;
    },
  };
}

/** 共享 noop log, 所有未启 debug 的调用都用同一个 (HookEvent.log 永远非空) */
export const NOOP_HOOK_LOG: HookLog = NOOP_LOG;
