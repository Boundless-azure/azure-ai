import { Injectable, Logger } from '@nestjs/common';
import { AIModelService } from '../ai/services/ai-model.service';
import type { PluginConfig } from './types';

interface KeywordsResult {
  zh: string[];
  en: string[];
}

@Injectable()
export class PluginKeywordsService {
  private readonly logger = new Logger(PluginKeywordsService.name);

  constructor(private readonly aiModelService: AIModelService) {}

  async pickDefaultModelId(): Promise<string> {
    const enabled = await this.aiModelService.getEnabledModels();
    if (!enabled.length) {
      throw new Error('No enabled AI models found for keyword generation');
    }
    return enabled[0].id;
  }

  async generateKeywords(config: PluginConfig): Promise<KeywordsResult> {
    const modelId = await this.pickDefaultModelId();
    const zhPrompt = this.buildPrompt(config, 'zh');
    const enPrompt = this.buildPrompt(config, 'en');

    // 让模型一次性输出 JSON，避免两次调用；但兼容不规范输出的容错解析
    const combinedPrompt = `You are a keyword generator for a plugin registry. Return a JSON object with two arrays: { "zh": [ ... ], "en": [ ... ] }.
中文数组 zh：包含尽可能全面的中文关键词（含同义词、俗称、行业术语）。
英文数组 en：包含尽可能全面的英文关键词（含词根、复数、常见缩写、同义词）。
要求：
- 不要解释，只返回 JSON
- 小写化，去除重复，规范连接符（- 或空格）
- 每个关键词尽量为 1-3 个词

插件信息：
${zhPrompt}
${enPrompt}`;

    const res = await this.aiModelService.chat({
      modelId,
      messages: [
        {
          role: 'system',
          content: 'You generate comprehensive, normalized keywords.',
        },
        { role: 'user', content: combinedPrompt },
      ],
      params: { temperature: 0.2, maxTokens: 1024 },
    });

    const parsed = this.safeParseKeywords(res.content);
    this.logger.log(
      `Generated keywords for plugin ${config.name}@${config.version}: zh=${parsed.zh.length}, en=${parsed.en.length}`,
    );
    return parsed;
  }

  private buildPrompt(config: PluginConfig, lang: 'zh' | 'en'): string {
    const hooksText = config.hooks
      .map((h) => `${h.name}: ${h.payloadDescription}`)
      .join('\n');
    if (lang === 'zh') {
      return `描述(中文可能优先)：${config.description}\nHooks：\n${hooksText}`;
    }
    return `Description: ${config.description}\nHooks:\n${hooksText}`;
  }

  private safeParseKeywords(content: string): KeywordsResult {
    try {
      const obj: unknown = JSON.parse(content);
      let zh: string[] = [];
      let en: string[] = [];
      if (obj && typeof obj === 'object') {
        const rec = obj as Record<string, unknown>;
        if (Array.isArray(rec.zh)) {
          zh = rec.zh.map((v) => String(v));
        }
        if (Array.isArray(rec.en)) {
          en = rec.en.map((v) => String(v));
        }
      }
      return { zh: this.normalize(zh), en: this.normalize(en) };
    } catch {
      // 更稳健的容错解析：基于括号深度与引号状态提取数组内容
      const zh = this.extractArrayForKey(content, 'zh');
      const en = this.extractArrayForKey(content, 'en');
      return { zh: this.normalize(zh), en: this.normalize(en) };
    }
  }

  /**
   * 提取键对应的数组内容，支持不规范 JSON：通过匹配键后第一个 '['，再按括号深度与引号状态找到对应的闭合 ']'
   * 尝试 JSON.parse 解析；若失败则退化为按逗号分割（考虑引号包裹）
   */
  private extractArrayForKey(content: string, key: 'zh' | 'en'): string[] {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[`, 'i');
    const keyIndex = content.search(keyRegex);
    if (keyIndex < 0) return [];
    const startBracket = content.indexOf('[', keyIndex);
    if (startBracket < 0) return [];

    let i = startBracket;
    let depth = 0;
    let inString = false;
    let quote: '"' | "'" | null = null;
    let escaped = false;

    for (; i < content.length; i++) {
      const ch = content[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') {
          escaped = true;
        } else if (ch === quote) {
          inString = false;
          quote = null;
        }
        continue;
      }
      if (this.isQuote(ch)) {
        inString = true;
        quote = ch;
        continue;
      }
      if (ch === '[') {
        depth++;
      } else if (ch === ']') {
        depth--;
        if (depth === 0) {
          const inner = content.slice(startBracket + 1, i);
          // 先尝试严格 JSON 解析
          try {
            const arr = JSON.parse(`[${inner}]`);
            if (Array.isArray(arr)) {
              return arr.map((x) => String(x));
            }
          } catch {
            // 回退为按逗号分割（考虑引号）
            return this.splitCsvRespectingQuotes(inner);
          }
          break;
        }
      }
    }
    return [];
  }

  /**
   * 以逗号为分隔符拆分，但仅在不处于引号内部时分割；保留引号内的逗号与空格。
   */
  private splitCsvRespectingQuotes(inner: string): string[] {
    const out: string[] = [];
    let buf = '';
    let inString = false;
    let quote: '"' | "'" | null = null;
    let escaped = false;

    const push = () => {
      const raw = buf.trim();
      buf = '';
      if (!raw) return;
      // 去除包裹引号
      const unquoted =
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
          ? raw.slice(1, -1)
          : raw;
      out.push(unquoted);
    };

    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (escaped) {
        buf += ch;
        escaped = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') {
          buf += ch;
          escaped = true;
        } else if (ch === quote) {
          buf += ch;
          inString = false;
          quote = null;
        } else {
          buf += ch;
        }
        continue;
      }
      if (this.isQuote(ch)) {
        inString = true;
        quote = ch;
        buf += ch;
        continue;
      }
      if (ch === ',') {
        push();
      } else if (ch === '\n' || ch === '\r') {
        // 将换行视为分隔符
        push();
      } else {
        buf += ch;
      }
    }
    push();
    return out;
  }

  private normalize(arr: string[]): string[] {
    const set = new Set<string>();
    for (const k of arr) {
      const v = k.trim().toLowerCase().replace(/\s+/g, ' ');
      if (v) set.add(v);
    }
    return Array.from(set);
  }

  private isQuote(ch: string): ch is '"' | "'" {
    return ch === '"' || ch === "'";
  }
}
