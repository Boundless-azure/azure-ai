// ============================================================================
// AGENT-MONITOR-TEMP :: 临时调试监听埋点, 后期整体删除 (grep: AGENT-MONITOR-TEMP)
// ============================================================================
import type {
  AgentAiModelClient,
  AgentAiRequest,
  AgentAiServer,
} from '@core/agent-runtime/types/agent-runtime.types';
import type {
  AIModelResponse,
  ModelSseEvent,
} from '@core/ai/types/ai-model.types';
import {
  publishCodeGraphProgress,
  type CodeGraphLlmEvent,
} from './code-graph-progress.sink';

let globalCallSeq = 0;

/** 流式增量批量刷新阈值 (攒够这么多字符再发一条 delta, 避免逐 token 刷爆 WS) */
const DELTA_FLUSH_CHARS = 160;

type MonitorKeys = { sessionId: string; threadId?: string; runnerId?: string };

/** 发一条 LLM 监听事件 (补齐 ts/归属键) */
function publishLlm(
  keys: MonitorKeys,
  entry: Omit<CodeGraphLlmEvent, 'kind' | 'ts'>,
): void {
  publishCodeGraphProgress({
    sessionId: keys.sessionId,
    ...(keys.threadId ? { threadId: keys.threadId } : {}),
    ...(keys.runnerId ? { runnerId: keys.runnerId } : {}),
    entry: { kind: 'llm', ts: new Date().toISOString(), ...entry },
  });
}

/**
 * 用 chatStream 跑一次调用, 边流边发监听事件 (start → delta / tool_start / tool_end → done), 返回最终结果。
 * 流的 return 值就是最终 AIModelResponse, 节点侧 API 不变 (仍是 Promise<AIModelResponse>)。
 * @keyword-cn 流式监听消费, LLM流式
 * @keyword-en stream-and-monitor, llm-stream
 */
async function streamAndMonitor(
  streamFactory: () => AsyncGenerator<ModelSseEvent, AIModelResponse, unknown>,
  req: AgentAiRequest,
  keys: MonitorKeys,
): Promise<AIModelResponse> {
  const callId = `s-${Date.now()}-${globalCallSeq++}`;
  const node = nodeFromSource(req.source);
  const source = req.source ?? 'agent';
  const startedAt = Date.now();
  publishLlm(keys, {
    callId,
    node,
    source,
    phase: 'start',
    prompt: serializePrompt(req),
  });
  let acc = '';
  let flushed = 0;
  const flush = (): void => {
    if (acc.length > flushed) {
      publishLlm(keys, {
        callId,
        node,
        source,
        phase: 'delta',
        delta: acc.slice(flushed),
      });
      flushed = acc.length;
    }
  };
  const gen = streamFactory();
  try {
    while (true) {
      const next = await gen.next();
      if (next.done) {
        flush();
        const res = next.value;
        publishLlm(keys, {
          callId,
          node,
          source,
          phase: 'done',
          model: res.model,
          durationMs: Date.now() - startedAt,
          response: serializeResponse(res),
          toolCalls: res.functionCalls?.length ?? 0,
        });
        return res;
      }
      const evt = next.value;
      if (evt.type === 'token' || evt.type === 'reasoning') {
        acc += evt.data.text;
        if (acc.length - flushed >= DELTA_FLUSH_CHARS) flush();
      } else if (evt.type === 'tool_start') {
        flush();
        publishLlm(keys, {
          callId,
          node,
          source,
          phase: 'tool_start',
          toolName: evt.data.name,
          toolInput: evt.data.input,
        });
      } else if (evt.type === 'tool_end') {
        publishLlm(keys, {
          callId,
          node,
          source,
          phase: 'tool_end',
          toolName: evt.data.name,
          toolOutput: evt.data.output,
        });
      }
    }
  } catch (error) {
    publishLlm(keys, {
      callId,
      node,
      source,
      phase: 'error',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * AGENT-MONITOR-TEMP: 通用 chat 监听包装 —— 任何带 sessionId 的 AI 调用都推 LLM 事件 (含 prompt/response),
 * 让监听页在整个测试过程里看到全部 agent 的 LLM 活动 (不止 code-agent)。无 sessionId 则直接透传不插桩。
 * @keyword-cn 通用chat监听, 全程监听
 * @keyword-en universal-chat-monitor, monitor
 */
export function monitorChat(
  req: AgentAiRequest,
  runners: {
    chat: () => Promise<AIModelResponse>;
    stream: () => AsyncGenerator<ModelSseEvent, AIModelResponse, unknown>;
  },
): Promise<AIModelResponse> {
  // 无 sessionId (不被监听) → 走原 chat, 行为完全不变; 被监听才走 chatStream 边流边发。
  if (!req.sessionId) return runners.chat();
  return streamAndMonitor(runners.stream, req, { sessionId: req.sessionId });
}

/** prompt / response 全文推送前的截断上限 (防止单条事件过大) */
const PROMPT_CAP = 16000;
const RESPONSE_CAP = 16000;

/** source 主段 → 监听页拓扑节点名 (对齐 CODE_GRAPH_NODES); build-generate 的图节点叫 generate-file */
const SOURCE_NODE_ALIAS: Record<string, string> = {
  'build-generate': 'generate-file',
};

/**
 * 从 chat source 推导监听页用的拓扑节点名: 剥 'code-agent.' 前缀取主段 (子段如 change-plan.deps 归 change-plan),
 * 再按 alias 对齐拓扑 (build-generate→generate-file)。
 * @keyword-cn 来源推导节点, 监听
 * @keyword-en source-to-node, monitor
 */
function nodeFromSource(source?: string): string {
  if (!source) return 'unknown';
  const cleaned = source.replace(/^code-agent\./, '');
  const main = cleaned.split('.')[0] || cleaned;
  return SOURCE_NODE_ALIAS[main] ?? main;
}

/**
 * 把一次 chat 请求的 systemPrompt + messages 拼成可读的完整提示 (截断)。
 * @keyword-cn 提示序列化, 监听
 * @keyword-en prompt-serialize, monitor
 */
function serializePrompt(req: AgentAiRequest): string {
  const parts: string[] = [];
  if (req.systemPrompt) parts.push(`[system]\n${req.systemPrompt}`);
  for (const message of req.messages ?? []) {
    parts.push(`[${message.role}]\n${message.content}`);
  }
  return parts.join('\n\n').slice(0, PROMPT_CAP);
}

/**
 * 把模型返回拼成可读的完整输出 (正文 + 工具调用摘要, 截断)。
 * @keyword-cn 输出序列化, 监听
 * @keyword-en response-serialize, monitor
 */
function serializeResponse(res: AIModelResponse): string {
  const text = res.content ?? '';
  const calls =
    res.functionCalls && res.functionCalls.length > 0
      ? `\n[tool_calls] ${JSON.stringify(res.functionCalls).slice(0, 6000)}`
      : '';
  return `${text}${calls}`.slice(0, RESPONSE_CAP);
}

/**
 * Wrap an AgentAiServer so EVERY per-node LLM call (via useModel/withModel → chat) STREAMS through the
 * monitor: llm start (prompt) → delta (streamed text) / tool_start / tool_end → done (full response). The
 * wrapped chat runs the underlying chatStream internally and returns its final AIModelResponse, so the
 * node API (chat → Promise) is unchanged. Instrumenting once at graph construction covers all nodes with
 * no per-call-site edits. No-op (adapter unchanged) when there is no sessionId to attribute events to.
 * @keyword-cn AI适配器插桩, LLM流式监听
 * @keyword-en ai-instrument, llm-stream
 */
export function instrumentAiServerForMonitor(
  aiAdapter: AgentAiServer,
  keys: { sessionId?: string; threadId?: string; runnerId?: string },
): AgentAiServer {
  const sessionId = keys.sessionId;
  if (!sessionId) return aiAdapter;
  const monitorKeys: MonitorKeys = {
    sessionId,
    ...(keys.threadId ? { threadId: keys.threadId } : {}),
    ...(keys.runnerId ? { runnerId: keys.runnerId } : {}),
  };

  const wrapClient = (client: AgentAiModelClient): AgentAiModelClient => ({
    ...client,
    chat: (req: AgentAiRequest): Promise<AIModelResponse> =>
      streamAndMonitor(() => client.chatStream(req), req, monitorKeys),
  });

  return {
    ...aiAdapter,
    useModel: (preferredIndex: number) =>
      wrapClient(aiAdapter.useModel(preferredIndex)),
    withModel: (modelId: string) => wrapClient(aiAdapter.withModel(modelId)),
  };
}
