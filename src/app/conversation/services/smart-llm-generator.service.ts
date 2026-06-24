import { Injectable, Logger } from '@nestjs/common';
import { AIModelService } from '@core/ai/services/ai-model.service';

/**
 * @title Smart 段 LLM 摘要 + 关键词生成器
 * @description 取段内拼接正文, 调指定 modelId 让 LLM 输出严格 JSON: { summary, keywords: { zh, en } }.
 *   失败 (LLM 不可用 / JSON 解析错 / 字段格式不对) → 抛错, 由调用方 (ChatSessionSmartService) 回退到规则算法。
 * @keywords-cn smart摘要, LLM生成, 关键词抽取, 失败回退
 * @keywords-en smart-summary, llm-generation, keyword-extraction, fallback-on-fail
 */
@Injectable()
export class SmartLlmGeneratorService {
  private readonly logger = new Logger(SmartLlmGeneratorService.name);

  constructor(private readonly ai: AIModelService) {}

  /**
   * 让 LLM 看段内文本, 返 summary + zh/en keywords。
   * @keyword-en generate-summary-keywords
   */
  async generate(
    modelId: string,
    text: string,
  ): Promise<{
    summary: string;
    keywords: { zh: string[]; en: string[] };
  }> {
    const systemPrompt =
      '你是会话摘要助手。读用户提供的多轮会话文本, 输出严格 JSON, 不要 markdown 围栏。JSON 字段:\n' +
      '- summary: string, 简练摘要 (200-400 字), 突出"谁 + 做了什么 + 关键事实", 不要主观评价\n' +
      '- keywords.zh: string[], 5-12 个有真实意义的中文名词/动词/专有名词, 不要"这个/那个/可以"等填充词\n' +
      '- keywords.en: string[], 5-12 个英文小写关键词, 同上\n' +
      '示例: {"summary":"用户提出页面生成需求, agent 已完成模块拆分。","keywords":{"zh":["页面生成","模块拆分"],"en":["page-generation","module-split"]}}\n' +
      '只输出 JSON, 不输出任何其他文字。';

    const resp = await this.ai.chat({
      modelId,
      source: 'chat-session-smart.enrich',
      systemPrompt,
      messages: [{ role: 'user', content: text.slice(0, 12000) }],
      isolateCallbacks: true,
    });

    const raw = (resp.content ?? '').trim();
    const parsed = parseJsonLoose(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(
        `smart-llm: response not valid JSON: ${raw.slice(0, 200)}`,
      );
    }
    const obj = parsed as Record<string, unknown>;
    const summary = readSummary(obj);
    if (!summary) {
      throw new Error('smart-llm: empty summary');
    }
    const parsedKeywords = readKeywords(obj);
    const fallbackKeywords = fallbackKeywordsFromText(`${summary}\n${text}`);
    const zh =
      parsedKeywords.zh.length > 0 ? parsedKeywords.zh : fallbackKeywords.zh;
    const en =
      parsedKeywords.en.length > 0 ? parsedKeywords.en : fallbackKeywords.en;
    if (zh.length === 0 && en.length === 0) {
      throw new Error('smart-llm: no keywords extracted');
    }
    this.logger.debug(
      `[smart-llm] generated summary=${summary.length}c zh=${zh.length} en=${en.length} model=${modelId}`,
    );
    return {
      summary: summary.slice(0, 1200),
      keywords: { zh: zh.slice(0, 40), en: en.slice(0, 40) },
    };
  }
}

/**
 * 容错解析 JSON: 直接 parse 失败, 试着剥 ```json / ``` 围栏再 parse。
 * @keyword-en parse-json-loose, strip-code-fence
 */
function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    /* try strip fence */
  }
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      return null;
    }
  }
  // 找第一个 { 到最后一个 }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 读取 LLM 摘要字段, 兼容中文字段名。
 * @keyword-en read-summary-field, summary-normalize
 */
function readSummary(obj: Record<string, unknown>): string {
  const candidates = [obj.summary, obj['摘要'], obj.summarize, obj.abstract];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text;
  }
  return '';
}

/**
 * 读取 LLM 关键词字段, 兼容 keywords 数组/字符串、zh/en 顶层字段与中文字段名。
 * @keyword-en read-keywords-field, keyword-normalize
 */
function readKeywords(obj: Record<string, unknown>): {
  zh: string[];
  en: string[];
} {
  const kw = obj.keywords ?? obj.keyword ?? obj['关键词'] ?? obj['关键字'];
  const record =
    kw && typeof kw === 'object' && !Array.isArray(kw)
      ? (kw as Record<string, unknown>)
      : {};
  const loose = splitLooseKeywords(kw);
  return {
    zh: sanitizeKeywords([
      ...sanitizeKeywords(record.zh),
      ...sanitizeKeywords(record.cn),
      ...sanitizeKeywords(record.chinese),
      ...sanitizeKeywords(record['中文']),
      ...sanitizeKeywords(record['中文关键词']),
      ...sanitizeKeywords(obj.zh),
      ...sanitizeKeywords(obj.cn),
      ...sanitizeKeywords(obj.keywordsZh),
      ...sanitizeKeywords(obj.keywordZh),
      ...sanitizeKeywords(obj['中文关键词']),
      ...loose.zh,
    ]).slice(0, 40),
    en: sanitizeKeywordsLower([
      ...sanitizeKeywords(record.en),
      ...sanitizeKeywords(record.english),
      ...sanitizeKeywords(record['英文']),
      ...sanitizeKeywords(record['英文关键词']),
      ...sanitizeKeywords(obj.en),
      ...sanitizeKeywords(obj.keywordsEn),
      ...sanitizeKeywords(obj.keywordEn),
      ...sanitizeKeywords(obj['英文关键词']),
      ...loose.en,
    ]).slice(0, 40),
  };
}

/**
 * 将宽松关键词数组按中英文拆分。
 * @keyword-en split-loose-keywords, zh-en-keywords
 */
function splitLooseKeywords(input: unknown): { zh: string[]; en: string[] } {
  const zh: string[] = [];
  const en: string[] = [];
  for (const token of sanitizeKeywords(input)) {
    if (/[\u4e00-\u9fff]/.test(token)) {
      zh.push(token);
    } else {
      en.push(token);
    }
  }
  return { zh: sanitizeKeywords(zh), en: sanitizeKeywordsLower(en) };
}

/**
 * 当 LLM 只返回摘要但漏掉关键词时, 从摘要和原文中提取一组兜底关键词。
 * @keyword-en fallback-keywords, keyword-extraction
 */
function fallbackKeywordsFromText(text: string): {
  zh: string[];
  en: string[];
} {
  const englishMatches: string[] = text.match(/[a-z][a-z0-9_-]{2,}/gi) ?? [];
  const zh = sanitizeKeywords(text.match(/[\u4e00-\u9fff]{2,8}/g) ?? []).slice(
    0,
    12,
  );
  const en = sanitizeKeywordsLower(
    englishMatches.filter(
      (word: string) => !SMART_LLM_STOP_WORDS.has(word.toLowerCase()),
    ),
  ).slice(0, 12);
  return { zh, en };
}

/**
 * 清洗关键词数组或分隔字符串, 去空、去重、限制长度。
 * @keyword-en sanitize-keywords, keyword-normalize
 */
function sanitizeKeywords(input: unknown): string[] {
  const items = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,\n，、;；|]+/)
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const v = item.trim();
    if (!v || v.length > 30) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * 清洗英文关键词并转小写。
 * @keyword-en sanitize-keywords-lower, lowercase-keywords
 */
function sanitizeKeywordsLower(input: unknown): string[] {
  return sanitizeKeywords(input).map((s) => s.toLowerCase());
}

const SMART_LLM_STOP_WORDS = new Set([
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
