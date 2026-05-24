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
} from '../hookbus/types/hook.types';

/**
 * @title HookLog 工厂 (Runner)
 * @description 与 SaaS 端 core/observability 同构:
 *              - debug=false 走 NOOP_SESSION, 零开销
 *              - debug=true 起一次性 BasicTracerProvider + InMemorySpanExporter, 单 span 收 SpanEvent
 *              用于实现 envelope.debug=true 时把 handler 写的日志条目随 hook:result.debugLog 回 SaaS。
 *              CLAUDE.md 强约束: 禁 console.log, 禁独立 LogRecord, 一律走这套 API。
 * @keywords-cn HookLog工厂Runner, OTel封装, 隔离Provider, 内存Exporter, debug开关
 * @keywords-en hook-log-factory-runner, otel-wrapper, isolated-provider, memory-exporter, debug-toggle
 */

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

export const NOOP_HOOK_LOG: HookLog = NOOP_LOG;
