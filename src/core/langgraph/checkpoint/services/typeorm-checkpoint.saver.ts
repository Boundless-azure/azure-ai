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
import type { RunnableConfig } from '@langchain/core/runnables';
import { LGCheckpointEntity } from '../entities/lg-checkpoint.entity';
import { LGWriteEntity } from '../entities/lg-write.entity';
import { ContextService } from '@core/ai';
import type { ChatMessage } from '@core/ai/types';

type CheckpointSaverOptions = Record<string, never>;

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
    @Inject(forwardRef(() => ContextService))
    private readonly contextService: ContextService,
    @Inject('CHECKPOINT_OPTIONS')
    private readonly options: CheckpointSaverOptions = {},
  ) {
    super();
  }

  async getTuple(
    config: RunnableConfig,
  ): ReturnType<BaseCheckpointSaver['getTuple']> {
    const threadId = String(config.configurable?.thread_id ?? '');
    if (!threadId) return undefined;
    const rawNs = (config.configurable as { checkpoint_ns?: unknown })
      ?.checkpoint_ns;
    const ns =
      typeof rawNs === 'string' && rawNs.trim().length > 0 ? rawNs : 'default';
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
    const rawNs = (config.configurable as { checkpoint_ns?: unknown })
      ?.checkpoint_ns;
    const ns =
      typeof rawNs === 'string' && rawNs.trim().length > 0 ? rawNs : 'default';
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
    const rawNs = (config.configurable as { checkpoint_ns?: unknown })
      ?.checkpoint_ns;
    const ns =
      typeof rawNs === 'string' && rawNs.trim().length > 0 ? rawNs : 'default';

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
    const rawNs = (config.configurable as { checkpoint_ns?: unknown })
      ?.checkpoint_ns;
    const ns =
      typeof rawNs === 'string' && rawNs.trim().length > 0 ? rawNs : 'default';
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

  private async ensureContext(sessionId: string): Promise<void> {
    const ctx = await this.contextService.getContext(sessionId);
    if (!ctx) {
      await this.contextService.createContext(sessionId);
    }
  }
}
