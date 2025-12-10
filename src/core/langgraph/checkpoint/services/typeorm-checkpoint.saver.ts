import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointTuple,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type PendingWrite,
  type ChannelVersions,
  getCheckpointId,
} from '@langchain/langgraph-checkpoint';
import type { SerializerProtocol } from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import { LGCheckpointEntity } from '../entities/lg-checkpoint.entity';
import { LGWriteEntity } from '../entities/lg-write.entity';
import { AIModelService, ContextService } from '@core/ai';
import { RoundSummaryEntity } from '@core/ai/entities/round-summary.entity';
import type { ChatMessage } from '@core/ai/types';
import type { SummaryModelHandle } from '../checkpoint.module';

interface CheckpointSaverOptions {
  summary?: boolean;
  summaryInterval?: number;
  insertSummaryAsSystemMessage?: boolean;
  summaryModel?:
    | SummaryModelHandle
    | ((messages: ChatMessage[]) => Promise<string>);
}

/**
 * @title TypeORM Checkpoint Saver
 * @description 基于 TypeORM 的 LangGraph BaseCheckpointSaver 实现，适配 MySQL/Postgres/SQLite。
 * @keywords-cn TypeORM, LangGraph, BaseCheckpointSaver, 检查点, 写入
 * @keywords-en typeorm, langgraph, BaseCheckpointSaver, checkpoint, writes
 */
@Injectable()
export class TypeOrmCheckpointSaver extends BaseCheckpointSaver {
  constructor(
    @InjectRepository(LGCheckpointEntity)
    private readonly cpRepo: Repository<LGCheckpointEntity>,
    @InjectRepository(LGWriteEntity)
    private readonly writeRepo: Repository<LGWriteEntity>,
    @InjectRepository(RoundSummaryEntity)
    private readonly summaryRepo: Repository<RoundSummaryEntity>,
    @Inject(forwardRef(() => AIModelService))
    private readonly aiModelService: AIModelService,
    @Inject(forwardRef(() => ContextService))
    private readonly contextService: ContextService,
    @Inject('CHECKPOINT_OPTIONS')
    private readonly options: CheckpointSaverOptions = {},
    serde?: SerializerProtocol,
  ) {
    super(serde);
  }

  async getTuple(
    config: RunnableConfig,
  ): ReturnType<BaseCheckpointSaver['getTuple']> {
    const threadId = String(config.configurable?.thread_id ?? '');
    if (!threadId) return undefined;
    const ns = String(config.configurable?.checkpoint_ns ?? 'default');
    const targetId = config.configurable?.checkpoint_id
      ? String(config.configurable.checkpoint_id)
      : undefined;

    const where = targetId
      ? { threadId, checkpointNs: ns, checkpointId: targetId, isDelete: false }
      : { threadId, checkpointNs: ns, isDelete: false };

    const row = targetId
      ? await this.cpRepo.findOne({ where, order: { createdAt: 'DESC' } })
      : await this.cpRepo.findOne({ where, order: { createdAt: 'DESC' } });

    if (!row) return undefined;
    const checkpoint = this.parseCheckpoint(row.checkpointJson);
    const metadata = row.metadataJson ?? undefined;
    const writes = await this.writeRepo.find({
      where: {
        threadId,
        checkpointNs: ns,
        checkpointId: row.checkpointId,
        isDelete: false,
      },
      order: { idx: 'ASC' },
    });
    const pendingWrites = writes.map(
      (w) =>
        [w.taskId, w.channel, this.decodeValue(w.valueType, w.valueB64)] as [
          string,
          string,
          unknown,
        ],
    );

    return {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: ns,
          checkpoint_id: row.checkpointId,
        },
      },
      checkpoint,
      metadata: metadata as unknown as CheckpointMetadata,
      pendingWrites,
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = String(config.configurable?.thread_id ?? '');
    if (!threadId) return;
    const ns = String(config.configurable?.checkpoint_ns ?? 'default');
    const limit =
      options && typeof (options as { limit?: number }).limit === 'number'
        ? (options as { limit?: number }).limit!
        : 50;
    const beforeId =
      options && (options as { before?: RunnableConfig }).before
        ? (options as { before?: RunnableConfig }).before!.configurable
            ?.checkpoint_id
        : undefined;

    const rows = await this.cpRepo.find({
      where: { threadId, checkpointNs: ns, isDelete: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    for (const row of rows) {
      if (beforeId && row.checkpointId === beforeId) continue;
      const checkpoint = this.parseCheckpoint(row.checkpointJson);
      const metadata = row.metadataJson ?? undefined;
      yield {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: ns,
            checkpoint_id: row.checkpointId,
          },
        },
        checkpoint,
        metadata: metadata as unknown as CheckpointMetadata,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const threadId = String(config.configurable?.thread_id ?? '');
    if (!threadId) throw new Error('thread_id is required');
    const ns = String(config.configurable?.checkpoint_ns ?? 'default');

    const serialized = this.serializeCheckpoint(checkpoint);

    const entity = this.cpRepo.create({
      threadId,
      checkpointNs: ns,
      checkpointId:
        (checkpoint as unknown as { id?: string }).id ??
        getCheckpointId(config),
      checkpointJson: JSON.stringify(serialized),
      metadataJson: metadata as unknown as Record<string, unknown>,
      parentsJson:
        (metadata as unknown as { parents?: Record<string, string> }).parents ??
        {},
      isDelete: false,
    });
    await this.cpRepo.save(entity);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: ns,
        checkpoint_id: entity.checkpointId,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const threadId = String(config.configurable?.thread_id ?? '');
    if (!threadId) throw new Error('thread_id is required');
    const ns = String(config.configurable?.checkpoint_ns ?? 'default');
    const checkpointId = String(config.configurable?.checkpoint_id ?? '');
    if (!checkpointId)
      throw new Error('checkpoint_id is required for putWrites');

    let idx = 0;
    for (const [channel, value] of writes) {
      const { t: type, b64 } = this.encodeValue(value);
      const e = this.writeRepo.create({
        threadId,
        checkpointNs: ns,
        checkpointId,
        taskId,
        idx: idx++,
        channel: String(channel),
        valueType: type,
        valueB64: b64,
        isDelete: false,
      });
      await this.writeRepo.save(e);

      const msg = this.toChatMessageFromWrite(String(channel), value);
      if (msg) {
        await this.ensureContext(threadId);
        await this.contextService.addMessage(threadId, msg);
        if (msg.role === 'assistant') {
          await this.maybeSummarize(threadId);
        }
      }
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.cpRepo.update({ threadId, isDelete: false }, { isDelete: true });
    await this.writeRepo.update(
      { threadId, isDelete: false },
      { isDelete: true },
    );
  }

  private serializeCheckpoint(checkpoint: Checkpoint): {
    v: number;
    id: string;
    ts: string;
    channel_values: Record<string, { t: string; b64: string }>;
    channel_versions: Record<string, string | number>;
    versions_seen: Record<string, Record<string, string | number>>;
  } {
    const channelValues: Record<string, { t: string; b64: string }> = {};
    const ck = checkpoint as unknown as {
      v: number;
      id: string;
      ts: string;
      channel_values?: Record<string, unknown>;
      channel_versions?: Record<string, string | number>;
      versions_seen?: Record<string, Record<string, string | number>>;
    };
    for (const [ch, val] of Object.entries(ck.channel_values ?? {})) {
      const enc = this.encodeValue(val);
      channelValues[ch] = { t: enc.t, b64: enc.b64 };
    }
    return {
      v: ck.v,
      id: ck.id,
      ts: ck.ts,
      channel_values: channelValues,
      channel_versions: ck.channel_versions ?? {},
      versions_seen: ck.versions_seen ?? {},
    };
  }

  private parseCheckpoint(json: string): Checkpoint {
    const obj = JSON.parse(json) as {
      v: number;
      id: string;
      ts: string;
      channel_values: Record<string, { t: string; b64: string }>;
      channel_versions: Record<string, string | number>;
      versions_seen: Record<string, Record<string, string | number>>;
    };
    const values: Record<string, unknown> = {};
    for (const [ch, enc] of Object.entries(obj.channel_values ?? {})) {
      values[ch] = this.decodeValue(enc.t, enc.b64);
    }
    return {
      v: obj.v,
      id: obj.id,
      ts: obj.ts,
      channel_values: values,
      channel_versions: obj.channel_versions,
      versions_seen: obj.versions_seen,
    } as Checkpoint;
  }

  private encodeValue(val: unknown): { t: string; b64: string } {
    const str = JSON.stringify(val);
    return { t: 'json', b64: Buffer.from(str, 'utf8').toString('base64') };
  }

  private decodeValue(t: string, b64: string): unknown {
    if (t === 'json') {
      const str = Buffer.from(b64, 'base64').toString('utf8');
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    }
    return Buffer.from(b64, 'base64');
  }

  private toChatMessageFromWrite(
    channel: string,
    value: unknown,
  ): Omit<ChatMessage, 'timestamp'> | null {
    const lower = channel.toLowerCase();
    if (
      lower === 'tool' ||
      lower === 'tools' ||
      lower.startsWith('tool_') ||
      lower.includes('function')
    ) {
      const obj =
        typeof value === 'object' && value
          ? (value as Record<string, unknown>)
          : undefined;
      const output = obj
        ? (obj['output'] as string | undefined) ||
          (obj['result'] as string | undefined)
        : undefined;
      if (
        lower.endsWith('tool_end') ||
        lower.includes('tool_end') ||
        lower.includes('tool_result')
      ) {
        if (output && output.trim().length > 0) {
          return {
            role: 'assistant',
            content: output,
            metadata: { channel },
          } as Omit<ChatMessage, 'timestamp'>;
        }
      }
      return null;
    }
    const asObj = (v: unknown) =>
      (typeof v === 'object' && v ? v : undefined) as
        | Record<string, unknown>
        | undefined;
    const obj = asObj(value);
    if (obj) {
      const role =
        (obj['role'] as string | undefined) ||
        ((obj['type'] as string | undefined)?.toLowerCase() === 'human'
          ? 'user'
          : (obj['type'] as string | undefined)?.toLowerCase() === 'ai'
            ? 'assistant'
            : (obj['type'] as string | undefined)?.toLowerCase() === 'system'
              ? 'system'
              : undefined);
      const content =
        (obj['content'] as string | undefined) ||
        (obj['text'] as string | undefined) ||
        (obj['message'] as string | undefined);
      if (role && content) {
        return {
          role: role as ChatMessage['role'],
          content,
          metadata: { channel },
        } as Omit<ChatMessage, 'timestamp'>;
      }
    }
    if (typeof value === 'string') {
      const roleGuess: 'system' | 'user' | 'assistant' =
        lower.includes('user') || lower.includes('input')
          ? 'user'
          : lower.includes('system')
            ? 'system'
            : 'assistant';
      return { role: roleGuess, content: value, metadata: { channel } } as Omit<
        ChatMessage,
        'timestamp'
      >;
    }
    return null;
  }

  private async maybeSummarize(sessionId: string): Promise<void> {
    const enabled = this.options.summary ?? true;
    if (!enabled) return;
    const interval = Math.max(1, this.options.summaryInterval ?? 20);
    const stats = await this.contextService.getContextStats(sessionId);
    const rounds = stats.assistantMessages;
    if (rounds <= 0 || rounds % interval !== 0) return;

    const prev = await this.summaryRepo.findOne({
      where: { sessionId, isDelete: false },
      order: { roundNumber: 'DESC' },
    });

    const windowMessages = await this.contextService.getRoundWindowMessages(
      sessionId,
      Math.max(1, interval - 1),
      true,
    );

    const sysPrefix = [
      '你是对话记录的总结助手，输出上一阶段轮次的中文摘要，保留关键事实、意图变化与结论。',
      '摘要需简洁分点，避免重复与冗长，无需加入无关寒暄。',
      prev ? `上一阶段历史总结：\n${prev.summaryContent}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: sysPrefix },
      ...windowMessages.filter((m) => m.role !== 'system'),
    ];

    const summaryText = await this.generateSummaryText(messages, sessionId);

    const entity = this.summaryRepo.create({
      sessionId,
      roundNumber: rounds,
      summaryContent: summaryText,
      isDelete: false,
    });
    await this.summaryRepo.save(entity);

    if (this.options.insertSummaryAsSystemMessage ?? true) {
      await this.ensureContext(sessionId);
      await this.contextService.addMessage(sessionId, {
        role: 'system',
        content: summaryText,
        metadata: { summary: true, round: rounds },
      });
    }
  }

  private async pickDefaultModelId(): Promise<string> {
    const enabled = await this.aiModelService.getEnabledModels();
    if (!enabled.length) {
      throw new Error('No enabled AI models for checkpoint summarization');
    }
    return enabled[0].id;
  }

  private async generateSummaryText(
    messages: ChatMessage[],
    sessionId: string,
  ): Promise<string> {
    const m = this.options.summaryModel;
    if (typeof m === 'function') {
      return await m(messages);
    }
    if (m && typeof m.chat === 'function') {
      return await m.chat(messages);
    }
    const modelId = await this.pickDefaultModelId();
    const resp = await this.aiModelService.chat({
      modelId,
      messages,
      sessionId,
      params: { temperature: 0.2, maxTokens: 800 },
    });
    return resp.content;
  }

  private async ensureContext(sessionId: string): Promise<void> {
    const ctx = await this.contextService.getContext(sessionId);
    if (!ctx) {
      await this.contextService.createContext(sessionId);
    }
  }
}
