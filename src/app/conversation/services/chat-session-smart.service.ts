import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionSmartEntity } from '@core/ai/entities/chat-session-smart.entity';
import { ChatMessageType } from '@core/ai/enums/chat.enums';

const SMART_SEGMENT_TARGET_CHARS_ENV = 'CHAT_SESSION_SMART_SEGMENT_CHARS';
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

/**
 * @title 会话 smart 分段写入服务
 * @description 按可见消息正文累计到配置阈值生成 chat_session_smart 分段索引, 供 smartTags/search/messages 读取。
 * @keywords-cn 会话smart, 历史索引, 分段摘要, 关键词
 * @keywords-en session-smart, history-index, segment-summary, keywords
 */
@Injectable()
export class ChatSessionSmartService {
  private readonly logger = new Logger(ChatSessionSmartService.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly running = new Set<string>();
  private readonly segmentTargetChars = resolveSmartSegmentTargetChars();

  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionSmartEntity)
    private readonly smartRepo: Repository<ChatSessionSmartEntity>,
  ) {}

  /**
   * 延迟触发会话 smart 分段分析, 多条消息会被 debounce 合并。
   * @keyword-cn smart分析, 防抖, 会话索引
   * @keyword-en schedule-smart-analysis, debounce, session-index
   */
  scheduleAnalyze(sessionId: string): void {
    const sid = sessionId.trim();
    if (!sid) return;
    const oldTimer = this.timers.get(sid);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
      this.timers.delete(sid);
      void this.analyzeSession(sid).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[session-smart] analyze failed session=${sid}: ${msg}`,
        );
      });
    }, SMART_ANALYZE_DEBOUNCE_MS);
    this.timers.set(sid, timer);
  }

  /**
   * 分析指定会话的未索引消息, 每累计到配置阈值写入一个 smart 段。
   * @keyword-cn smart分析, 分段写入, 会话索引
   * @keyword-en analyze-smart-session, segment-write, session-index
   */
  async analyzeSession(sessionId: string): Promise<number> {
    if (this.running.has(sessionId)) return 0;
    this.running.add(sessionId);
    try {
      let created = 0;
      while (true) {
        const pending = await this.loadPendingMessages(sessionId);
        const segment = this.buildSegmentFromMessages(pending);
        if (!segment) break;
        const exists = await this.smartRepo.findOne({
          where: {
            sessionId,
            startMessageId: segment.startMessageId,
            endMessageId: segment.endMessageId,
            isDelete: false,
          },
          select: ['id'],
        });
        if (!exists) {
          await this.smartRepo.save(
            this.smartRepo.create({
              sessionId,
              startMessageId: segment.startMessageId,
              endMessageId: segment.endMessageId,
              messageCount: segment.messageCount,
              keywords: segment.keywords,
              embedding: null,
              summary: segment.summary,
              analyzedAt: new Date(),
              isDelete: false,
            }),
          );
          created += 1;
          this.logger.debug(
            `[session-smart] segment created session=${sessionId} messages=${segment.messageCount} chars=${segment.charCount} targetChars=${this.segmentTargetChars}`,
          );
        }
      }
      return created;
    } finally {
      this.running.delete(sessionId);
    }
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
   * 读取最后一个 smart 段之后尚未索引的可见文本消息。
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

    if (lastSmart) {
      const endMessage = await this.messageRepo.findOne({
        where: { id: lastSmart.endMessageId, sessionId },
        select: ['id', 'createdAt'],
      });
      if (endMessage) {
        qb.andWhere(
          '(m.created_at > :cursorAt OR (m.created_at = :cursorAt AND m.id > :cursorId))',
          { cursorAt: endMessage.createdAt, cursorId: endMessage.id },
        );
      }
    }

    return qb
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .limit(SMART_MAX_PENDING_MESSAGES)
      .getMany();
  }

  /**
   * 从待分析消息中截取一个达到配置字数阈值的 smart 段。
   * @keyword-cn smart分段, 字数阈值, 历史索引
   * @keyword-en build-smart-segment, char-threshold, history-index
   */
  private buildSegmentFromMessages(
    messages: ChatMessageEntity[],
  ):
    | {
        startMessageId: string;
        endMessageId: string;
        messageCount: number;
        charCount: number;
        keywords: { zh: string[]; en: string[] };
        summary: string;
      }
    | null {
    const segment: ChatMessageEntity[] = [];
    let charCount = 0;
    for (const msg of messages) {
      if (!isSegmentableMessage(msg)) continue;
      segment.push(msg);
      charCount += countTextChars(visibleMessageText(msg));
      if (charCount >= this.segmentTargetChars) break;
    }
    if (charCount < this.segmentTargetChars || segment.length === 0) {
      return null;
    }
    const text = flattenSegmentText(segment);
    return {
      startMessageId: segment[0].id,
      endMessageId: segment[segment.length - 1].id,
      messageCount: segment.length,
      charCount,
      keywords: extractKeywords(text),
      summary: summarizeSegment(segment),
    };
  }
}

/**
 * Resolve the visible-text char threshold for smart history segments.
 * @keyword-cn smart配置, 分段阈值
 * @keyword-en smart-config, segment-threshold
 */
function resolveSmartSegmentTargetChars(): number {
  const raw = process.env[SMART_SEGMENT_TARGET_CHARS_ENV]?.trim();
  if (!raw) return SMART_SEGMENT_TARGET_CHARS_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return SMART_SEGMENT_TARGET_CHARS_DEFAULT;
  }
  return parsed;
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
 * 拼接 smart 段内所有可见消息正文。
 * @keyword-cn smart正文, 消息拼接
 * @keyword-en smart-text, message-flatten
 */
function flattenSegmentText(messages: ChatMessageEntity[]): string {
  return messages.map(visibleMessageText).filter(Boolean).join('\n');
}

/**
 * 生成轻量规则摘要, 后续可替换为模型摘要。
 * @keyword-cn 规则摘要, smart摘要
 * @keyword-en rule-summary, smart-summary
 */
function summarizeSegment(messages: ChatMessageEntity[]): string {
  const lines = messages
    .map((msg) => {
      const who = msg.senderId ?? 'system';
      return `${who}: ${visibleMessageText(msg)}`;
    })
    .filter((line) => line.trim().length > 0);
  const joined = lines.join('\n');
  if (joined.length <= SMART_SUMMARY_MAX_CHARS) return joined;
  return `${joined.slice(0, SMART_SUMMARY_MAX_CHARS)}...`;
}

/**
 * 从 smart 段文本中提取中英文关键词。
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
  const chunks = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
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
        b[1] - a[1] ||
        b[0].length - a[0].length ||
        a[0].localeCompare(b[0]),
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
