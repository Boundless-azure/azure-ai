import { Logger } from '@nestjs/common';
import type {
  CodeGraphLogEntry,
  CodeGraphNodeLogger,
  CodeGraphRequest,
} from './dependency-check.types';

const logger = new Logger('CodeAgentDependencyCheckLog');

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
