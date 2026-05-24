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
      '只输出 JSON, 不输出任何其他文字。';

    const resp = await this.ai.chat({
      modelId,
      systemPrompt,
      messages: [{ role: 'user', content: text.slice(0, 12000) }],
    });

    const raw = (resp.content ?? '').trim();
    const parsed = parseJsonLoose(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(
        `smart-llm: response not valid JSON: ${raw.slice(0, 200)}`,
      );
    }
    const obj = parsed as Record<string, unknown>;
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    if (!summary) {
      throw new Error('smart-llm: empty summary');
    }
    const kw = (obj.keywords ?? {}) as Record<string, unknown>;
    const zh = sanitizeKeywords(kw.zh);
    const en = sanitizeKeywordsLower(kw.en);
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

function sanitizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const v = item.trim();
    if (!v || v.length > 30) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function sanitizeKeywordsLower(input: unknown): string[] {
  return sanitizeKeywords(input).map((s) => s.toLowerCase());
}
