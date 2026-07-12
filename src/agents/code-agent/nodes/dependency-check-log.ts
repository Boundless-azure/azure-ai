import { Logger } from '@nestjs/common';
// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import { publishCodeGraphProgress } from '../monitor/code-graph-progress.sink';
import type {
  CodeGraphLogEntry,
  CodeGraphNodeLogger,
  CodeGraphRequest,
} from './dependency-check.types';

const logger = new Logger('CodeAgentDependencyCheckLog');

/** 从 graph context 读会话/线程键, 供进度推送归属 (session_id 是 web 天然知道的键) */
function readProgressKeys(context: CodeGraphRequest['context']): {
  sessionId?: string;
  threadId?: string;
  runnerId?: string;
} {
  const read = (key: string): string | undefined => {
    const value = (context as Record<string, unknown>)[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  return {
    sessionId: read('session_id') ?? read('sessionId'),
    threadId: read('codeGraphThreadId') ?? read('threadId') ?? read('thread_id'),
    runnerId: read('runner_id') ?? read('runnerId'),
  };
}

/**
 * Create a node logger that continues any log already carried in graph context.
 * @keyword-cn 节点日志, 暂停恢复
 * @keyword-en node-log, resume-log
 */
export function createCodeGraphNodeLogger(
  node: string,
  context: CodeGraphRequest['context'],
): CodeGraphNodeLogger {
  const entries = extractCodeGraphLog(context);
  const keys = readProgressKeys(context);
  const append = (
    level: CodeGraphLogEntry['level'],
    step: string,
    message: string,
    data?: unknown,
  ) => {
    const entry: CodeGraphLogEntry = {
      ts: new Date().toISOString(),
      node,
      step,
      level,
      message,
      ...(data === undefined ? {} : { data }),
    };
    entries.push(entry);
    // 实时推给监听页 (best-effort, 无 sink 时 no-op); 需要 sessionId 才有归属
    if (keys.sessionId) {
      publishCodeGraphProgress({
        sessionId: keys.sessionId,
        ...(keys.threadId ? { threadId: keys.threadId } : {}),
        ...(keys.runnerId ? { runnerId: keys.runnerId } : {}),
        entry: { kind: 'node', ...entry },
      });
    }
    const line = `[${node}] ${step} ${message}`;
    if (level === 'error') {
      logger.error(line, data ? JSON.stringify(data) : undefined);
      return;
    }
    if (level === 'warn') {
      logger.warn(data ? `${line} ${JSON.stringify(data)}` : line);
      return;
    }
    logger.log(data ? `${line} ${JSON.stringify(data)}` : line);
  };
  return {
    entries,
    info: (step, message, data) => append('info', step, message, data),
    warn: (step, message, data) => append('warn', step, message, data),
    error: (step, message, data) => append('error', step, message, data),
  };
}

/**
 * Extract the carried code graph log from tool context.
 * @keyword-cn Graph日志, 暂停恢复
 * @keyword-en graph-log, resume-log
 */
function extractCodeGraphLog(
  context: CodeGraphRequest['context'],
): CodeGraphLogEntry[] {
  const raw = context.code_graph_log ?? context.codeGraphLog;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCodeGraphLogEntry);
}

/**
 * Check whether an unknown value is a graph log entry.
 * @keyword-cn Graph日志, 类型守卫
 * @keyword-en graph-log, type-guard
 */
function isCodeGraphLogEntry(value: unknown): value is CodeGraphLogEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.ts === 'string' &&
    typeof entry.node === 'string' &&
    typeof entry.step === 'string' &&
    typeof entry.message === 'string' &&
    (entry.level === 'info' ||
      entry.level === 'warn' ||
      entry.level === 'error')
  );
}
