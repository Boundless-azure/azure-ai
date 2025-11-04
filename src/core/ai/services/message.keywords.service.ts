import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AIModelService } from './ai-model.service';

/**
 * @title 消息关键词结构
 * @desc 同时包含中文（zh）与英文（en）关键字集合，均为小写、去重、规范化结果。
 * @keywords-cn 关键词结构, 中文关键词, 英文关键词, 去重, 规范化
 * @keywords-en keywords-struct, zh, en, dedupe, normalize
 */
export interface MessageKeywords {
  zh: string[];
  en: string[];
}

/**
 * @title 消息关键词服务
 * @desc 负责对消息文本进行关键词抽取与规范化；默认选择启用的第一个模型执行抽取。
 * @keywords-cn 关键词服务, 抽取, 规范化, 模型选择
 * @keywords-en keywords-service, extraction, normalization, model-selection
 */
@Injectable()
export class MessageKeywordsService {
  private readonly logger = new Logger(MessageKeywordsService.name);

  constructor(
    @Inject(forwardRef(() => AIModelService))
    private readonly aiModelService: AIModelService,
  ) {}

  /**
   * @title 选择默认模型
   * @desc 选择已启用模型中的第一个，用于关键词抽取。
   * @returns string 可用模型 id
   * @throws Error 当没有启用的模型时抛出
   * @keywords-cn 默认模型, 已启用模型, 选择逻辑
   * @keywords-en default-model, enabled-models, selection
   */
  async pickDefaultModelId(): Promise<string> {
    const enabled = await this.aiModelService.getEnabledModels();
    if (!enabled.length) {
      throw new Error('No enabled AI models for message keyword analysis');
    }
    return enabled[0].id;
  }

  /**
   * @title 抽取消息关键词
   * @desc 基于选择的模型对文本进行关键词抽取，返回规范化的关键字集合。
   * @param text 输入文本
   * @returns MessageKeywords 关键词集合（zh/en）
   * @keywords-cn 文本分析, 关键词抽取, JSON 解析, 规范化
   * @keywords-en text-analysis, keyword-extraction, json-parse, normalize
   */
  async extractKeywords(text: string): Promise<MessageKeywords> {
    const modelId = await this.pickDefaultModelId();
    const prompt = `You are a keyword extractor. Return a JSON object { "zh": [], "en": [] }.
中文 zh：尽量全面涵盖中文关键词、同义词、行业术语。
英文 en：尽量全面涵盖英文关键词、词根、复数、缩写、同义词。
要求：
- 仅返回 JSON，不要附加解释
- 小写化，去重，规范连接符（- 或空格）

文本：\n${text}`;

    const res = await this.aiModelService.chat({
      modelId,
      messages: [
        {
          role: 'system',
          content: 'You extract comprehensive normalized keywords.',
        },
        { role: 'user', content: prompt },
      ],
      params: { temperature: 0.2, maxTokens: 512 },
    });

    return this.safeParseKeywords(res.content);
  }

  /**
   * @title 解析 AI 返回的关键词 JSON
   * @desc 容错解析：优先 JSON.parse，失败时尝试正则提取数组再构造结果。
   * @param content AI 返回文本
   * @returns MessageKeywords 关键词集合
   * @keywords-cn 容错解析, JSON-only, 兜底逻辑
   * @keywords-en robust-parse, json-only, fallback
   */
  private safeParseKeywords(content: string): MessageKeywords {
    try {
      const obj = JSON.parse(content) as unknown;
      const zh = this.getArrayField(obj, 'zh');
      const en = this.getArrayField(obj, 'en');
      return { zh: this.normalize(zh), en: this.normalize(en) };
    } catch {
      // 容错：尝试简单提取类似 ["..."] 的部分
      const zh = this.extractArray(content, 'zh');
      const en = this.extractArray(content, 'en');
      return { zh: this.normalize(zh), en: this.normalize(en) };
    }
  }

  /**
   * @title 读取键为数组的字段
   * @desc 若字段不是数组则返回空数组；所有元素转为字符串。
   * @param obj 任意对象
   * @param key 字段键（zh/en）
   * @returns string[] 数组值
   * @keywords-cn 字段读取, 数组规范化
   * @keywords-en field-read, array-normalize
   */
  private getArrayField(obj: unknown, key: 'zh' | 'en'): string[] {
    if (typeof obj !== 'object' || obj === null) return [];
    const rec = obj as Record<string, unknown>;
    const val = rec[key];
    return Array.isArray(val) ? val.map((x) => String(x)) : [];
  }

  /**
   * @title 正则兜底抽取数组
   * @desc 当 JSON 解析失败时，尽量从文本中抽取类似 "zh": [ ... ] 的片段。
   * @param text 文本
   * @param key 字段键（zh/en）
   * @returns string[] 字符串数组
   * @keywords-cn 正则提取, 兜底
   * @keywords-en regex-extract, fallback
   */
  private extractArray(text: string, key: 'zh' | 'en'): string[] {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[(.*?)\\]`, 'is'));
    if (!m) return [];
    try {
      const arr = JSON.parse(`[${m[1]}]`);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return m[1]
        .split(',')
        .map((s) => s.trim())
        .map((s) => s.replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
  }

  /**
   * @title 规范化数组
   * @desc 去重、小写化、去首尾空白。
   * @param arr 原始数组
   * @returns string[] 规范化后的数组
   * @keywords-cn 去重, 小写化, 规范化
   * @keywords-en dedupe, lower-case, normalization
   */
  private normalize(arr: string[]): string[] {
    const set = new Set<string>();
    for (const a of arr) {
      const norm = a.trim().toLowerCase();
      if (norm) set.add(norm);
    }
    return Array.from(set);
  }
}
