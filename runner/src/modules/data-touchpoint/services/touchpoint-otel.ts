import { SpanStatusCode, type Attributes, type Span } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import type { HookLog, HookLogEntry } from '../../hookbus/types/hook.types';
import type { RunOutcome } from './touchpoint-run-log';

/**
 * @title 触点专用 OTel log session
 * @description 与 [hook-log.factory.ts](../../observability/hook-log.factory.ts) 同构: 每次触点执行起一次性 BasicTracerProvider + InMemorySpanExporter,
 *              load/parse/run/error/callhook 各阶段 addEvent, finalize drain 出 `HookLogEntry[]` 写进 run log。
 *              不复用 hook-log.factory 是因为 trigger 是异步 worker 拉 job, 不在 hook handler 调用栈内, 没有 hook event 可挂。
 * @keywords-cn 触点OTel, OTel session, span事件, 内存exporter, 日志drain
 * @keywords-en touchpoint-otel, otel-session, span-event, memory-exporter, log-drain
 */

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
 * 一次触点执行的 log 会话
 *  - log :: 调 .info/.event 等会落到 span 事件
 *  - traceId :: 会话创建即可读 (跟 span 同 trace), 用于通知派发跨服务串联 (notifier 透传给 saas sendMsg)
 *  - finalize :: 跑完调一次, 关闭 span, drain 出 entries + traceId
 * @keyword-en touchpoint-log-session
 */
export interface TouchpointLogSession {
  log: HookLog;
  /** 本次 run 的 OTel traceId; 创建即可用, 用于跨服务 trace 串联 */
  traceId: string;
  finalize(opts: { outcome: RunOutcome; error?: string }): {
    entries: HookLogEntry[];
    traceId: string;
  };
}

/**
 * 创建一个一次性的 OTel log session, 用于一次触点执行
 *  - span 名固定 `touchpoint.run`, attrs 挂 touchpoint.id / name / firedBy
 *  - 用一次性 provider (跟 hook-log.factory 一致), 避免污染全局 tracer
 * @keyword-en create-touchpoint-log-session
 */
export function createTouchpointLogSession(opts: {
  touchpointId: string;
  touchpointName: string;
  firedBy: 'source' | 'schedule';
}): TouchpointLogSession {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  const tracer = provider.getTracer('data-touchpoint');
  const span = tracer.startSpan('touchpoint.run', {
    attributes: {
      'touchpoint.id': opts.touchpointId,
      'touchpoint.name': opts.touchpointName,
      'touchpoint.firedBy': opts.firedBy,
    },
  });
  const traceId = span.spanContext().traceId;

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
    traceId,
    finalize: ({ outcome, error }) => {
      // skip 算正常路径 (胶水主动跳过), 跟 success 一样 OK 状态
      if (outcome === 'success' || outcome === 'skip') {
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error ?? outcome,
        });
      }
      span.setAttribute('touchpoint.outcome', outcome);
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
      return { entries, traceId };
    },
  };
}
