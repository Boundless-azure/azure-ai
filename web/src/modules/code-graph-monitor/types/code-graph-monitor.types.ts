// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
/**
 * @title Code Graph 监听类型
 * @description 监听页与后端 `/code-graph` 网关约定的进度事件形状 (镜像后端 code-graph-progress.sink) + code
 *   graph 固定节点拓扑。node 事件是一条节点日志, llm 事件是一次 LLM 调用 (含 prompt/response 全文)。
 * @keywords-cn 监听类型, 进度事件, 节点拓扑
 * @keywords-en monitor-types, progress-event, node-topology
 */

export type CodeGraphNodeEntry = {
  kind: 'node';
  ts: string;
  node: string;
  step: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
};

export type CodeGraphLlmEntry = {
  kind: 'llm';
  ts: string;
  callId: string;
  node: string;
  source: string;
  phase: 'start' | 'delta' | 'tool_start' | 'tool_end' | 'done' | 'error';
  model?: string;
  durationMs?: number;
  prompt?: string;
  response?: string;
  delta?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolCalls?: number;
  error?: string;
};

/** 页面侧合并同一 callId 的流式事件后的调用视图 */
export type CodeGraphLlmCall = {
  callId: string;
  node: string;
  source: string;
  phase: string;
  model?: string;
  durationMs?: number;
  prompt: string;
  response: string;
  tools: Array<{ name?: string; input?: unknown; output?: unknown; done: boolean }>;
  error?: string;
  ts: string;
};

export type CodeGraphProgressEntry = CodeGraphNodeEntry | CodeGraphLlmEntry;

export type CodeGraphProgressMessage = {
  sessionId: string;
  threadId?: string;
  runnerId?: string;
  entry: CodeGraphProgressEntry;
};

/** code graph 固定节点顺序 (监听页拓扑渲染用) */
export const CODE_GRAPH_NODES: readonly string[] = [
  'dependency-check',
  'target-resolution',
  'target-bootstrap',
  'change-plan',
  'project-init',
  'build-dispatch',
  'generate-file',
  'build-verify',
  'build-join',
  'build-test',
];

export type CodeGraphNodeStatus =
  | 'pending'
  | 'active'
  | 'done'
  | 'error';
