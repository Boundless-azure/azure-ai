import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  ChatSessionDataEntity,
  SessionDataType,
} from '@core/ai/entities/chat-session-data.entity';

const KEY_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const MAX_KEYS = 50;
const MAX_VALUE_BYTES = 10_000;
const MAX_TOTAL_BYTES = 200_000;

/**
 * @title AI 会话数据服务
 * @description 管理 AI 自主读写的对话级 session_data，支持 key-value 存储与自动 prompt 注入。
 * @keywords-cn AI会话数据, session-data, key-value, prompt注入
 * @keywords-en ai-session-data, key-value, prompt-inject, upsert
 */
@Injectable()
export class AiSessionDataService {
  private readonly logger = new Logger(AiSessionDataService.name);

  constructor(
    @InjectRepository(ChatSessionDataEntity)
    private readonly dataRepo: Repository<ChatSessionDataEntity>,
  ) {}

  /**
   * upsert 一个 key-value 记录（可选 title）
   * @keyword-en save-upsert
   */
  async save(
    sessionId: string,
    key: string,
    value: unknown,
    title?: string,
  ): Promise<void> {
    if (!KEY_RE.test(key)) {
      throw new Error(
        `invalid key "${key}": must match ^[a-zA-Z0-9_-]{1,128}$`,
      );
    }
    if (title !== undefined && title.length > 255) {
      throw new Error(`title too long: ${title.length} > 255`);
    }

    const valStr = JSON.stringify(value);
    if (valStr.length > MAX_VALUE_BYTES) {
      throw new Error(
        `value too large: ${valStr.length} > ${MAX_VALUE_BYTES}`,
      );
    }

    const existing = await this.dataRepo.find({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        dataKey: key,
        isDelete: false,
      },
    });

    const totalBytes =
      existing.reduce((sum, r) => sum + (r.dataVal?.length ?? 0), 0) +
      valStr.length -
      (existing[0]?.dataVal?.length ?? 0);

    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        `total session data exceeds ${MAX_TOTAL_BYTES} bytes`,
      );
    }

    const activeCount = await this.dataRepo.count({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        isDelete: false,
      },
    });

    if (existing.length === 0 && activeCount >= MAX_KEYS) {
      throw new Error(
        `too many keys: ${activeCount} >= ${MAX_KEYS}`,
      );
    }

    if (existing.length > 0) {
      await this.dataRepo.update(
        { id: existing[0].id },
        { isDelete: true },
      );
    }

    const entity = this.dataRepo.create({
      id: uuidv7(),
      dataType: SessionDataType.AiSession,
      dataVal: valStr,
      forSessionId: sessionId,
      dataKey: key,
      dataTitle: title ?? undefined,
    });
    await this.dataRepo.save(entity);
    this.logger.debug(
      `[ai-session-data] saved key="${key}" session=${sessionId}`,
    );
  }

  /**
   * 获取单个 key 的值
   * @keyword-en get-key
   */
  async get(
    sessionId: string,
    key: string,
  ): Promise<{ key: string; title: string | null; value: unknown; updatedAt: Date } | null> {
    const row = await this.dataRepo.findOne({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        dataKey: key,
        isDelete: false,
      },
    });
    if (!row) return null;
    try {
      return {
        key: row.dataKey!,
        title: row.dataTitle ?? null,
        value: JSON.parse(row.dataVal),
        updatedAt: row.updatedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * 列出所有 key 概要（含 title，不含 value）
   * @keyword-en list-keys
   */
  async list(
    sessionId: string,
  ): Promise<Array<{ key: string; title: string | null; updatedAt: Date; sizeBytes: number }>> {
    const rows = await this.dataRepo.find({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        isDelete: false,
      },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((r) => ({
      key: r.dataKey!,
      title: r.dataTitle ?? null,
      updatedAt: r.updatedAt,
      sizeBytes: r.dataVal?.length ?? 0,
    }));
  }

  /**
   * 软删除单个 key
   * @keyword-en delete-key
   */
  async delete(sessionId: string, key: string): Promise<boolean> {
    const result = await this.dataRepo.update(
      {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        dataKey: key,
        isDelete: false,
      },
      { isDelete: true },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * 生成 [session data]...[/session data] prompt 文本块，无数据时返回 null
   * @keyword-en build-prompt-block
   */
  async getAllAsPromptBlock(sessionId: string): Promise<string | null> {
    const rows = await this.dataRepo.find({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        isDelete: false,
      },
      order: { updatedAt: 'DESC' },
    });
    if (rows.length === 0) return null;

    const entries = rows.map((r) => {
      const titleSuffix = r.dataTitle ? ` | title: "${r.dataTitle}"` : '';
      const date = r.updatedAt.toISOString().slice(0, 10);
      let parsed: unknown;
      try { parsed = JSON.parse(r.dataVal); } catch { parsed = r.dataVal; }
      return `- key: "${r.dataKey}"${titleSuffix} (updated: ${date})\n  \`\`\`json\n${JSON.stringify(parsed, null, 2)}\n  \`\`\``;
    });

    return [
      '[session data]',
      '当前会话有以下持久化数据（跨轮次可用，每轮自动注入）：',
      '如需更新，调用 saas.app.conversation.sessionData.save；删除调用 .delete。',
      '---',
      ...entries,
      '[/session data]',
    ].join('\n');
  }
}
