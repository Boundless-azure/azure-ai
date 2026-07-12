// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import type { CodeGraphLogEntry } from '../nodes/dependency-check.types';

/**
 * @title Code graph LLM call event
 * @description 一次节点内 LLM 调用的可观测事件 (由 aiAdapter 包层产生)。含 prompt/response 全文 (截断), 供
 *   监听页展示"每层调了哪些 LLM、耗时多少、进出内容是什么"。callId 关联同一次调用的 start/done。
 * @keyword-cn LLM调用事件, 监听
 * @keyword-en llm-call-event, monitor
 */
export type CodeGraphLlmEvent = {
  ts: string;
  callId: string;
  /** 从 chat source 推导的节点名 (e.g. 'change-plan') */
  node: string;
  /** 原始 source (e.g. 'code-agent.change-plan') */
  source: string;
  /** start=开始(带prompt); delta=流式输出增量; tool_start/tool_end=工具调用; done=完成; error=出错 */
  phase: 'start' | 'delta' | 'tool_start' | 'tool_end' | 'done' | 'error';
  model?: string;
  durationMs?: number;
  /** 完整提示 (截断到上限) */
  prompt?: string;
  /** 完整模型输出 (截断到上限; done 时给全量) */
  response?: string;
  /** 流式增量文本 (phase=delta) */
  delta?: string;
  /** 工具调用 (phase=tool_start/tool_end) */
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolCalls?: number;
  error?: string;
};

/**
 * @title Code graph progress entry
 * @description 监听页的统一进度条目: 要么是一条节点日志 (kind=node, 复用 graphLog 结构), 要么是一次 LLM 调用
 *   事件 (kind=llm)。前端据此拼出每层的时间线与 LLM 调用列表。
 * @keyword-cn 进度条目, 监听
 * @keyword-en progress-entry, monitor
 */
export type CodeGraphProgressEntry =
  | ({ kind: 'node' } & CodeGraphLogEntry)
  | ({ kind: 'llm' } & CodeGraphLlmEvent);

/**
 * @title Code graph progress message
 * @description 一条进度推送: 按 sessionId 归属 (web 天然知道的会话键), 附 threadId/runnerId 便于区分同会话多次运行。
 * @keyword-cn 进度推送, 监听
 * @keyword-en progress-message, monitor
 */
export type CodeGraphProgressMessage = {
  sessionId: string;
  threadId?: string;
  runnerId?: string;
  entry: CodeGraphProgressEntry;
};

type CodeGraphProgressSink = (msg: CodeGraphProgressMessage) => void;

let currentSink: CodeGraphProgressSink | null = null;

/**
 * Register the real progress sink (Redis + WebSocket), or null to detach. Kept as a plain module-level
 * hook so the graph logger / aiAdapter wrapper stay decoupled from Nest / Redis / Socket.IO.
 * @keyword-cn 注册进度sink, 监听
 * @keyword-en register-progress-sink, monitor
 */
export function setCodeGraphProgressSink(
  sink: CodeGraphProgressSink | null,
): void {
  currentSink = sink;
}

/**
 * Publish one progress message to the registered sink; best-effort — a sink failure must never break the
 * code graph run. No-op when no sink is registered (e.g. unit tests, sink not yet wired).
 * @keyword-cn 发布进度, 监听
 * @keyword-en publish-progress, monitor
 */
export function publishCodeGraphProgress(msg: CodeGraphProgressMessage): void {
  if (!currentSink) return;
  try {
    currentSink(msg);
  } catch {
    // 监听 sink 故障绝不能拖垮 code graph 主流程
  }
}
