import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionSmartEntity } from '@core/ai/entities/chat-session-smart.entity';
import { AIModelEntity } from '@core/ai/entities/ai-model.entity';
import { ChatMessageType } from '@core/ai/enums/chat.enums';
import { AgentEntity } from '@/app/agent/entities/agent.entity';
import { SmartLlmGeneratorService } from './smart-llm-generator.service';
import { AiCallLogService } from './ai-call-log.service';

const SMART_SEGMENT_TARGET_CHARS_DEFAULT = 5000;
const SMART_ANALYZE_DEBOUNCE_MS = 3000;
const SMART_MAX_PENDING_MESSAGES = 5000;
const SMART_SUMMARY_MAX_CHARS = 1200;
const SMART_KEYWORD_LIMIT = 40;
const SMART_CONTEXT_MAX_SEGMENTS = 30;
const SMART_CONTEXT_SUMMARY_MAX_CHARS = 520;

export interface ChatSessionSmartContextItem {
  smartId: string;
  keywords: string[];
  summary: string;
  startMessageId: string;
  endMessageId: string;
  messageCount: number;
  analyzedAt: Date | null;
}

export interface ChatSessionSmartContextDigest {
  items: ChatSessionSmartContextItem[];
  coveredUntilMessageId: string | null;
  omittedCount: number;
}

interface SegmentBuildResult {
  startMessageId: string;
  endMessageId: string;
  messageCount: number;
  charCount: number;
  text: string;
  ruleKeywords: { zh: string[]; en: string[] };
  ruleSummary: string;
  /** 段时间窗口 (首/末消息 createdAt 毫秒), 用于拉取本段内的 tool 调用纳入摘要 */
  fromMs: number;
  toMs: number;
}

interface ModelContext {
  modelId: string | null;
  targetChars: number;
}

/**
 * smart 分析模型 hint, 用于把后台摘要绑定到本轮 agent 首个模型。
 * @keyword-en smart-analyze-hint, agent-model
 */
export interface ChatSessionSmartAnalyzeHint {
  agentPrincipalId?: string | null;
  modelId?: string | null;
}

/**
 * @title 会话 smart 分段写入服务
 * @description 按可见消息正文累计到阈值生成 chat_session_smart 分段索引。
 *   优先使用本轮触发 agent 的 aiModelIds[0] 对应模型的 smartSegmentChars 字段;
 *   找不到模型时回退到 5000 默认值。摘要 + 关键词优先用 LLM 生成 (SmartLlmGeneratorService),
 *   LLM 失败回退规则算法 (中文 bigram + 英文词频)。
 *   并发: smart 自己按 sessionId 去重串行, 不占用 agent-run 的回复队列。
 * @keywords-cn 会话smart, 历史索引, 分段摘要, 关键词, 模型阈值, 会话串行
 * @keywords-en session-smart, history-index, segment-summary, keywords, model-threshold, session-serial
 */
@Injectable()
export class ChatSessionSmartService {
  private readonly logger = new Logger(ChatSessionSmartService.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly analyzeHints = new Map<
    string,
    ChatSessionSmartAnalyzeHint
  >();
  private readonly runningSessions = new Set<string>();
  private readonly rerunSessions = new Set<string>();

  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionSmartEntity)
    private readonly smartRepo: Repository<ChatSessionSmartEntity>,
    @InjectRepository(AIModelEntity)
    private readonly modelRepo: Repository<AIModelEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly llmGen: SmartLlmGeneratorService,
    private readonly callLog: AiCallLogService,
  ) {}

  /**
   * 延迟触发会话 smart 分段分析, 多条消息会被 debounce 合并; hint 用于锁定本轮 agent 模型。
   * @keyword-cn smart分析, 防抖, 会话索引
   * @keyword-en schedule-smart-analysis, debounce, session-index
   */
  scheduleAnalyze(sessionId: string, hint?: ChatSessionSmartAnalyzeHint): void {
    const sid = sessionId.trim();
    if (!sid) return;
    this.rememberAnalyzeHint(sid, hint);
    const oldTimer = this.timers.get(sid);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
      this.timers.delete(sid);
      const runHint = this.consumeAnalyzeHint(sid);
      void this.analyzeSession(sid, runHint).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[session-smart] analyze failed session=${sid}: ${msg}`,
        );
      });
    }, SMART_ANALYZE_DEBOUNCE_MS);
    this.timers.set(sid, timer);
  }

  /**
   * 分析指定会话的未索引消息, 每累计到阈值写入一个 smart 段。
   *   smart 自身同 sessionId 串行; 若运行中又收到调度, 本轮结束后重新 debounce。
   * @keyword-cn smart分析, 分段写入, 会话索引, 会话串行
   * @keyword-en analyze-smart-session, segment-write, session-index, session-serial
   */
  async analyzeSession(
    sessionId: string,
    hint?: ChatSessionSmartAnalyzeHint,
  ): Promise<number> {
    const sid = sessionId.trim();
    if (!sid) return 0;
    if (this.runningSessions.has(sid)) {
      this.rememberAnalyzeHint(sid, hint);
      this.rerunSessions.add(sid);
      return 0;
    }

    const runHint = this.consumeAnalyzeHint(sid, hint);
    this.runningSessions.add(sid);
    try {
      return await this.analyzeSessionInner(sid, runHint);
    } finally {
      this.runningSessions.delete(sid);
      if (this.rerunSessions.delete(sid) || this.analyzeHints.has(sid)) {
        this.scheduleAnalyze(sid);
      }
    }
  }

  /**
   * analyzeSession 的实际工作体, 假设同 session smart 分析已由 runningSessions 串行。
   * @keyword-en analyze-session-inner
   */
  private async analyzeSessionInner(
    sessionId: string,
    hint?: ChatSessionSmartAnalyzeHint,
  ): Promise<number> {
    let created = 0;
    let cachedCtx: ModelContext | null = null;
    while (true) {
      const pending = await this.loadPendingMessages(sessionId);
      // 模型上下文按本轮分析解析一次, 避免每个段重复查 agent / model
      if (cachedCtx === null) {
        cachedCtx = await this.resolveModelContext(pending, hint);
      }
      const seg = this.buildSegmentFromMessages(pending, cachedCtx.targetChars);
      if (!seg) break;
      const exists = await this.smartRepo.findOne({
        where: {
          sessionId,
          startMessageId: seg.startMessageId,
          endMessageId: seg.endMessageId,
          isDelete: false,
        },
        select: ['id'],
      });
      if (exists) {
        this.logger.debug(
          `[session-smart] segment already exists session=${sessionId} start=${seg.startMessageId} end=${seg.endMessageId}`,
        );
        break;
      }

      // 本段时间窗口内的 tool 调用 (call_history) 折进摘要输入, 让段摘要忠实记住"这段干过啥 hook"
      const toolCalls = await this.callLog.listByTimeRange(
        sessionId,
        seg.fromMs,
        seg.toMs,
      );
      const toolText = formatToolInteractions(toolCalls);
      const enriched = await this.tryLlmEnrich(cachedCtx.modelId, seg, toolText);
      await this.smartRepo.save(
        this.smartRepo.create({
          sessionId,
          startMessageId: seg.startMessageId,
          endMessageId: seg.endMessageId,
          messageCount: seg.messageCount,
          keywords: enriched.keywords,
          embedding: null,
          summary: enriched.summary,
          analyzedAt: new Date(),
          isDelete: false,
        }),
      );
      created += 1;
      this.logger.debug(
        `[session-smart] segment created session=${sessionId} messages=${seg.messageCount} chars=${seg.charCount} targetChars=${cachedCtx.targetChars} source=${enriched.source} model=${cachedCtx.modelId ?? 'none'}`,
      );
    }
    return created;
  }

  /**
   * 记住 smart 分析 hint, debounce 期间后来的本轮 agent/model 会覆盖旧值。
   * @keyword-en remember-analyze-hint, agent-model
   */
  private rememberAnalyzeHint(
    sessionId: string,
    hint?: ChatSessionSmartAnalyzeHint,
  ): void {
    const normalized = normalizeAnalyzeHint(hint);
    if (!normalized) return;
    const old = this.analyzeHints.get(sessionId) ?? {};
    this.analyzeHints.set(sessionId, {
      agentPrincipalId: normalized.agentPrincipalId ?? old.agentPrincipalId,
      modelId: normalized.modelId ?? old.modelId,
    });
  }

  /**
   * 取出本次 smart 分析 hint; 显式传入的 hint 会先合并到缓存。
   * @keyword-en consume-analyze-hint, debounce-hint
   */
  private consumeAnalyzeHint(
    sessionId: string,
    hint?: ChatSessionSmartAnalyzeHint,
  ): ChatSessionSmartAnalyzeHint | undefined {
    this.rememberAnalyzeHint(sessionId, hint);
    const stored = this.analyzeHints.get(sessionId);
    this.analyzeHints.delete(sessionId);
    return stored;
  }

  /**
   * 读取 LLM 上下文用的 smart 历史摘要索引, 不展开原消息。
   * @keyword-cn smart上下文, 历史摘要, 上下文压缩
   * @keyword-en smart-context-digest, history-summary, context-compression
   */
  async getContextDigest(
    sessionId: string,
    beforeMessageId: string,
  ): Promise<ChatSessionSmartContextDigest> {
    const baseQb = this.smartRepo
      .createQueryBuilder('s')
      .where('s.session_id = :sessionId', { sessionId })
      .andWhere('s.is_delete = false')
      .andWhere('s.end_message_id < :beforeMessageId', { beforeMessageId });
    const [rows, totalCount] = await Promise.all([
      baseQb
        .clone()
        .orderBy('s.end_message_id', 'DESC')
        .limit(SMART_CONTEXT_MAX_SEGMENTS)
        .getMany(),
      baseQb.clone().getCount(),
    ]);
    const omittedCount = Math.max(0, totalCount - rows.length);
    const selected = rows.reverse();
    const items = selected.map((row) => ({
      smartId: row.id,
      keywords: flattenSmartKeywords(row.keywords),
      summary: truncateSmartSummary(row.summary ?? ''),
      startMessageId: row.startMessageId,
      endMessageId: row.endMessageId,
      messageCount: row.messageCount,
      analyzedAt: row.analyzedAt,
    }));
    return {
      items,
      coveredUntilMessageId:
        selected.length > 0 ? selected[selected.length - 1].endMessageId : null,
      omittedCount,
    };
  }

  /**
   * 解析当前 smart 分析应该用哪个模型 + 阈值:
   *  - 优先 hint.modelId
   *  - 其次 hint.agentPrincipalId 对应 agent.aiModelIds[0]
   *  - 最后从待分析消息 senderId 集合里反查 agents
   *  - 没 agent / 没 model / smartSegmentChars 为 null → 走 5000 默认
   * @keyword-cn 模型解析, 分段阈值, agent模型
   * @keyword-en resolve-model-context, segment-threshold, agent-model
   */
  private async resolveModelContext(
    pending: ChatMessageEntity[],
    hint?: ChatSessionSmartAnalyzeHint,
  ): Promise<ModelContext> {
    const hintedModel = await this.resolveModelContextByModelId(hint?.modelId);
    if (hintedModel) return hintedModel;

    const hintedAgent = await this.resolveAgentModelContext(
      hint?.agentPrincipalId,
    );
    if (hintedAgent) return hintedAgent;

    const senderIds = Array.from(
      new Set(
        pending.map((m) => m.senderId).filter((id): id is string => !!id),
      ),
    );
    if (senderIds.length === 0) {
      return { modelId: null, targetChars: SMART_SEGMENT_TARGET_CHARS_DEFAULT };
    }
    const agents = await this.agentRepo.find({
      where: { principalId: In(senderIds), isDelete: false, active: true },
      select: ['id', 'principalId', 'aiModelIds', 'createdAt'],
      order: { createdAt: 'ASC' },
      take: 5,
    });
    const firstAgentWithModel = agents.find(
      (a) => Array.isArray(a.aiModelIds) && a.aiModelIds.length > 0,
    );
    if (!firstAgentWithModel || !firstAgentWithModel.aiModelIds) {
      return { modelId: null, targetChars: SMART_SEGMENT_TARGET_CHARS_DEFAULT };
    }
    const resolved = await this.resolveModelContextByModelId(
      firstAgentWithModel.aiModelIds[0],
    );
    return (
      resolved ?? {
        modelId: null,
        targetChars: SMART_SEGMENT_TARGET_CHARS_DEFAULT,
      }
    );
  }

  /**
   * 按 agentPrincipalId 读取 agent.aiModelIds[0], 作为 smart LLM 与阈值模型来源。
   * @keyword-en resolve-agent-model-context, agent-first-model
   */
  private async resolveAgentModelContext(
    agentPrincipalId?: string | null,
  ): Promise<ModelContext | null> {
    const pid = agentPrincipalId?.trim();
    if (!pid) return null;
    const agent = await this.agentRepo.findOne({
      where: { principalId: pid, isDelete: false, active: true },
      select: ['id', 'principalId', 'aiModelIds'],
    });
    const modelId = Array.isArray(agent?.aiModelIds)
      ? agent.aiModelIds[0]
      : null;
    return this.resolveModelContextByModelId(modelId);
  }

  /**
   * 按 modelId 读取 smartSegmentChars; 模型不可用时返回 null 让调用方继续回退。
   * @keyword-en resolve-model-context-by-id, smart-threshold
   */
  private async resolveModelContextByModelId(
    modelId?: string | null,
  ): Promise<ModelContext | null> {
    const mid = modelId?.trim();
    if (!mid) return null;
    const model = await this.modelRepo.findOne({
      where: { id: mid, isDelete: false, enabled: true },
      select: ['id', 'smartSegmentChars'],
    });
    if (!model) {
      return null;
    }
    const target =
      typeof model.smartSegmentChars === 'number' && model.smartSegmentChars > 0
        ? model.smartSegmentChars
        : SMART_SEGMENT_TARGET_CHARS_DEFAULT;
    return { modelId: model.id, targetChars: target };
  }

  /**
   * 调 SmartLlmGeneratorService 生 summary + keywords, 失败回退规则算法 (segment 自带的 ruleSummary/ruleKeywords)。
   *   modelId 为 null (无可用模型) → 直接走规则, 不浪费一次失败调用。
   * @keyword-cn LLM摘要回退, smart生成, 规则兜底
   * @keyword-en llm-enrich-fallback, smart-generate, rule-fallback
   */
  private async tryLlmEnrich(
    modelId: string | null,
    seg: SegmentBuildResult,
    toolText?: string,
  ): Promise<{
    summary: string;
    keywords: { zh: string[]; en: string[] };
    source: 'llm' | 'rule';
  }> {
    if (!modelId) {
      // 兜底规则摘要不含 tool (无模型时降级); tool 折进只作用于 LLM 摘要
      return {
        summary: seg.ruleSummary,
        keywords: seg.ruleKeywords,
        source: 'rule',
      };
    }
    try {
      const enrichInput = toolText ? `${seg.text}\n\n${toolText}` : seg.text;
      const r = await this.llmGen.generate(modelId, enrichInput);
      return { summary: r.summary, keywords: r.keywords, source: 'llm' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[session-smart] llm-enrich failed model=${modelId} → fallback to rule: ${msg}`,
      );
      return {
        summary: seg.ruleSummary,
        keywords: seg.ruleKeywords,
        source: 'rule',
      };
    }
  }

  /**
   * 读取最后一个 smart 段之后尚未索引的可见文本消息; 游标按消息 ID 推进, 避免 Date 毫秒精度重复收录。
   * @keyword-cn 待分析消息, smart游标, 可见正文
   * @keyword-en pending-smart-messages, smart-cursor, visible-text
   */
  private async loadPendingMessages(
    sessionId: string,
  ): Promise<ChatMessageEntity[]> {
    const lastSmart = await this.smartRepo.findOne({
      where: { sessionId, isDelete: false },
      order: { createdAt: 'DESC' },
      select: ['id', 'endMessageId'],
    });
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sessionId', { sessionId })
      .andWhere('m.is_delete = false')
      .andWhere('m.message_type = :messageType', {
        messageType: ChatMessageType.Text,
      });

    if (lastSmart?.endMessageId) {
      qb.andWhere('m.id > :cursorId', { cursorId: lastSmart.endMessageId });
    }

    return qb
      .orderBy('m.id', 'ASC')
      .limit(SMART_MAX_PENDING_MESSAGES)
      .getMany();
  }

  /**
   * 从待分析消息中截取一个达到 targetChars 阈值的 smart 段;
   *   同时返回规则算法生成的兜底 summary/keywords 与原始拼接 text (供 LLM enrich 使用)。
   * @keyword-cn smart分段, 字数阈值, 历史索引, 兜底摘要
   * @keyword-en build-smart-segment, char-threshold, history-index, fallback-summary
   */
  private buildSegmentFromMessages(
    messages: ChatMessageEntity[],
    targetChars: number,
  ): SegmentBuildResult | null {
    const segment: ChatMessageEntity[] = [];
    let charCount = 0;
    for (const msg of messages) {
      if (!isSegmentableMessage(msg)) continue;
      segment.push(msg);
      charCount += countTextChars(visibleMessageText(msg));
      if (charCount >= targetChars) break;
    }
    if (charCount < targetChars || segment.length === 0) {
      return null;
    }
    const text = flattenSegmentText(segment);
    return {
      startMessageId: segment[0].id,
      endMessageId: segment[segment.length - 1].id,
      messageCount: segment.length,
      charCount,
      text,
      ruleKeywords: extractKeywords(text),
      ruleSummary: summarizeSegment(segment),
      fromMs: segment[0].createdAt.getTime(),
      toMs: segment[segment.length - 1].createdAt.getTime(),
    };
  }
}

/**
 * 归一化 smart 分析 hint, 空字符串视为未提供。
 * @keyword-en normalize-analyze-hint, agent-model
 */
function normalizeAnalyzeHint(
  hint?: ChatSessionSmartAnalyzeHint,
): ChatSessionSmartAnalyzeHint | null {
  if (!hint) return null;
  const agentPrincipalId = hint.agentPrincipalId?.trim() || null;
  const modelId = hint.modelId?.trim() || null;
  if (!agentPrincipalId && !modelId) return null;
  return { agentPrincipalId, modelId };
}

/**
 * 判断消息是否适合进入 smart 分段索引。
 * @keyword-cn 可见消息, smart分段
 * @keyword-en segmentable-message, smart-segment
 */
function isSegmentableMessage(msg: ChatMessageEntity): boolean {
  const text = visibleMessageText(msg);
  if (!text) return false;
  if (text.includes('<agent-lazy-guard')) return false;
  return msg.messageType === ChatMessageType.Text;
}

/**
 * 读取消息可见正文, 不使用 metadata.llmContent 等隐藏提示。
 * @keyword-cn 可见正文, 隐藏提示隔离
 * @keyword-en visible-message-text, hidden-prompt-isolation
 */
function visibleMessageText(msg: ChatMessageEntity): string {
  return (msg.content ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 统计文本长度, 作为配置分段阈值依据。
 * @keyword-cn 字数统计, 分段阈值
 * @keyword-en text-char-count, segment-threshold
 */
function countTextChars(text: string): number {
  return text.trim().length;
}

/**
 * 把本段时间窗口内的 tool 调用压成紧凑文本, 折进段摘要输入, 让摘要器记住"这段调了哪些 hook / 结果概况"。
 * 空调用返回空串 (不影响原有纯文本摘要)。
 * @keyword-cn 工具交互摘要, 分段召回
 * @keyword-en format-tool-interactions, segment-tool-recall
 */
function formatToolInteractions(
  calls: Array<{ hookName: string; payload: unknown; result: unknown }>,
): string {
  if (!calls.length) return '';
  const lines = calls.map((c) => {
    const p = previewSmartValue(c.payload, 60);
    const r = previewSmartResult(c.result, 80);
    return `- ${c.hookName}${p ? ` payload=${p}` : ''} → ${r}`;
  });
  return `[本段工具调用 ${calls.length} 次]\n${lines.join('\n')}`;
}

/**
 * 压缩展示任意值 (JSON 化 + 截断), 供 tool 交互摘要用。
 * @keyword-en preview-smart-value
 */
function previewSmartValue(value: unknown, max: number): string {
  if (value == null) return '';
  let s: string;
  try {
    s = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * 概括 hook 结果: 数组 / { items } / { data.items } 给条数, 其余给截断预览, 空给 ok。
 * @keyword-en preview-smart-result
 */
function previewSmartResult(value: unknown, max: number): string {
  if (value == null) return 'ok';
  if (Array.isArray(value)) return `${value.length} 项`;
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (Array.isArray(rec.items)) return `${rec.items.length} 项`;
    if (rec.data && typeof rec.data === 'object') {
      const d = rec.data as Record<string, unknown>;
      if (Array.isArray(d.items)) return `${d.items.length} 项`;
    }
  }
  return previewSmartValue(value, max) || 'ok';
}

/**
 * 拼接 smart 段内所有可见消息正文, 带 sender 前缀供 LLM 识别角色。
 * @keyword-cn smart正文, 消息拼接
 * @keyword-en smart-text, message-flatten
 */
function flattenSegmentText(messages: ChatMessageEntity[]): string {
  return messages
    .map((msg) => {
      const who = msg.senderId ?? 'system';
      const body = visibleMessageText(msg);
      return body ? `${who}: ${body}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * 规则兜底摘要 (LLM 不可用时使用): 直接截断原文。
 * @keyword-cn 规则摘要, smart摘要兜底
 * @keyword-en rule-summary, smart-summary-fallback
 */
function summarizeSegment(messages: ChatMessageEntity[]): string {
  const joined = flattenSegmentText(messages);
  if (joined.length <= SMART_SUMMARY_MAX_CHARS) return joined;
  return `${joined.slice(0, SMART_SUMMARY_MAX_CHARS)}...`;
}

/**
 * 从 smart 段文本中提取中英文关键词 (规则算法, LLM 失败时兜底)。
 * @keyword-cn 关键词提取, smart标签
 * @keyword-en keyword-extraction, smart-tags
 */
function extractKeywords(text: string): { zh: string[]; en: string[] } {
  return {
    zh: tokenizeChineseKeywords(text, SMART_KEYWORD_LIMIT),
    en: tokenizeEnglishKeywords(text, SMART_KEYWORD_LIMIT),
  };
}

/**
 * 展平 smart keywords, 用于 LLM 上下文摘要索引。
 * @keyword-cn smart关键词, 上下文摘要
 * @keyword-en smart-keywords, context-digest
 */
function flattenSmartKeywords(
  keywords: { zh: string[]; en: string[] } | null,
): string[] {
  if (!keywords) return [];
  return [...keywords.zh, ...keywords.en].filter(
    (it, index, arr) => it && arr.indexOf(it) === index,
  );
}

/**
 * 截断 smart summary, 避免摘要索引重新撑爆上下文。
 * @keyword-cn smart摘要, 上下文截断
 * @keyword-en smart-summary, context-truncate
 */
function truncateSmartSummary(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length <= SMART_CONTEXT_SUMMARY_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, SMART_CONTEXT_SUMMARY_MAX_CHARS)}...`;
}

/**
 * 基于中文二字词频提取关键词。
 * @keyword-cn 中文关键词, 二字词频
 * @keyword-en chinese-keywords, bigram-frequency
 */
function tokenizeChineseKeywords(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  const chunks = text.match(/[一-鿿]{2,}/g) ?? [];
  for (const chunk of chunks) {
    for (let i = 0; i <= chunk.length - 2; i += 1) {
      const token = chunk.slice(i, i + 2);
      if (CHINESE_STOP_TOKENS.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return rankTokens(counts, limit);
}

/**
 * 基于英文词频提取关键词。
 * @keyword-cn 英文关键词, 词频
 * @keyword-en english-keywords, word-frequency
 */
function tokenizeEnglishKeywords(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  for (const word of words) {
    if (ENGLISH_STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return rankTokens(counts, limit);
}

/**
 * 按词频与长度稳定排序关键词。
 * @keyword-cn 关键词排序, 词频
 * @keyword-en rank-keywords, frequency
 */
function rankTokens(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]),
    )
    .slice(0, limit)
    .map(([token]) => token);
}

const CHINESE_STOP_TOKENS = new Set([
  '这个',
  '那个',
  '就是',
  '一下',
  '可以',
  '不是',
  '没有',
  '我们',
  '你们',
  '他们',
  '什么',
  '一个',
  '已经',
]);

const ENGLISH_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'are',
  'was',
  'were',
  'you',
  'your',
  'have',
  'has',
  'not',
  'but',
  'can',
  'will',
  'use',
]);
