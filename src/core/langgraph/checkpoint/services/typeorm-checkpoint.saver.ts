import { Injectable, Inject } from '@nestjs/common';
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

type CheckpointSaverOptions = Record<string, never>;

type CheckpointWorkflowContext = {
  sessionId?: string;
  agentId?: string;
  agentPrincipalId?: string;
  aiModelIds?: string[];
};

/**
 * @title TypeORM Checkpoint Saver
 * @description 基于 TypeORM 的 LangGraph BaseCheckpointSaver 实现，适配 MySQL/Postgres/SQLite。
 * @keywords-cn TypeORM, LangGraph, BaseCheckpointSaver, 检查点, 写入
 * @keyword-cn TypeORM, LangGraph, 检查点, 写入
 * @keyword-en typeorm, langgraph, base-checkpoint-saver, checkpoint, writes
 */
@Injectable()
export class TypeOrmCheckpointSaver extends BaseCheckpointSaver {
  constructor(
    @InjectRepository(LGCheckpointEntity)
    private readonly cpRepo: Repository<LGCheckpointEntity>,
    @InjectRepository(LGWriteEntity)
    private readonly writeRepo: Repository<LGWriteEntity>,
    @Inject('CHECKPOINT_OPTIONS')
    private readonly options: CheckpointSaverOptions = {},
  ) {
    super();
  }

  /**
   * 读取指定线程和命名空间下最近或指定的 checkpoint。
   * @keyword-en checkpoint-read, custom-saver, langgraph-checkpoint
   */
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
          ...this.toConfigurableWorkflowContext({
            ...(row.sessionId ? { sessionId: row.sessionId } : {}),
            ...(row.agentId ? { agentId: row.agentId } : {}),
            ...(row.agentPrincipalId
              ? { agentPrincipalId: row.agentPrincipalId }
              : {}),
            ...(row.aiModelIds ? { aiModelIds: row.aiModelIds } : {}),
          }),
        },
      },
      checkpoint,
      metadata: metadata as unknown as CheckpointMetadata,
      pendingWrites,
    };
  }

  /**
   * 按线程和命名空间倒序列出 checkpoint。
   * @keyword-en checkpoint-list, custom-saver, langgraph-checkpoint
   */
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
            ...this.toConfigurableWorkflowContext({
              ...(row.sessionId ? { sessionId: row.sessionId } : {}),
              ...(row.agentId ? { agentId: row.agentId } : {}),
              ...(row.agentPrincipalId
                ? { agentPrincipalId: row.agentPrincipalId }
                : {}),
              ...(row.aiModelIds ? { aiModelIds: row.aiModelIds } : {}),
            }),
          },
        },
        checkpoint,
        metadata: metadata as unknown as CheckpointMetadata,
      };
    }
  }

  /**
   * 保存 LangGraph checkpoint 并返回可继续写入的 runnable config。
   * @keyword-en checkpoint-write, custom-saver, langgraph-checkpoint
   */
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
    const workflowContext = this.extractWorkflowContext(config);

    const serialized = this.serializeCheckpoint(checkpoint);
    const checkpointId =
      (checkpoint as unknown as { id?: string }).id ?? getCheckpointId(config);

    const entity = this.cpRepo.create({
      threadId,
      checkpointNs: ns,
      checkpointId,
      sessionId: workflowContext.sessionId,
      agentId: workflowContext.agentId,
      agentPrincipalId: workflowContext.agentPrincipalId,
      aiModelIds: workflowContext.aiModelIds,
      checkpointJson: JSON.stringify(serialized),
      metadataJson: this.mergeWorkflowMetadata(metadata, workflowContext),
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
        ...this.toConfigurableWorkflowContext(workflowContext),
      },
    };
  }

  /**
   * 保存 checkpoint 关联的 pending writes；checkpoint 只作为 Agent 运行史，不同步到真实会话消息。
   * @keyword-en pending-writes, custom-saver, agent-run-history
   */
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
    const workflowContext = this.extractWorkflowContext(config);

    let idx = 0;
    for (const [channel, value] of writes) {
      const { t: type, b64 } = this.encodeValue(value);
      const e = this.writeRepo.create({
        threadId,
        checkpointNs: ns,
        checkpointId,
        sessionId: workflowContext.sessionId,
        agentId: workflowContext.agentId,
        agentPrincipalId: workflowContext.agentPrincipalId,
        aiModelIds: workflowContext.aiModelIds,
        taskId,
        idx: idx++,
        channel: String(channel),
        valueType: type,
        valueB64: b64,
        isDelete: false,
      });
      await this.writeRepo.save(e);
    }
  }

  /**
   * 软删除指定线程的 checkpoint 与 pending writes。
   * @keyword-en checkpoint-delete, custom-saver, soft-delete
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.cpRepo.update({ threadId, isDelete: false }, { isDelete: true });
    await this.writeRepo.update(
      { threadId, isDelete: false },
      { isDelete: true },
    );
  }

  /**
   * 从 LangGraph configurable 中提取 workflow/session/agent 追踪上下文。
   * @keyword-en checkpoint-workflow-context, custom-saver, agent-link
   */
  private extractWorkflowContext(
    config: RunnableConfig,
  ): CheckpointWorkflowContext {
    const sessionId = this.readConfigString(config, 'session_id');
    const agentId = this.readConfigString(config, 'agent_id');
    const agentPrincipalId = this.readConfigString(
      config,
      'agent_principal_id',
    );
    const aiModelIds = this.readConfigStringArray(config, 'ai_model_ids');
    return {
      ...(sessionId ? { sessionId } : {}),
      ...(agentId ? { agentId } : {}),
      ...(agentPrincipalId ? { agentPrincipalId } : {}),
      ...(aiModelIds.length > 0 ? { aiModelIds } : {}),
    };
  }

  /**
   * 将 workflow 上下文回写到下一步 configurable，避免 put 后丢失 session/agent 绑定。
   * @keyword-en checkpoint-workflow-context, configurable-context, agent-link
   */
  private toConfigurableWorkflowContext(
    context: CheckpointWorkflowContext,
  ): Record<string, unknown> {
    return {
      ...(context.sessionId ? { session_id: context.sessionId } : {}),
      ...(context.agentId ? { agent_id: context.agentId } : {}),
      ...(context.agentPrincipalId
        ? { agent_principal_id: context.agentPrincipalId }
        : {}),
      ...(context.aiModelIds && context.aiModelIds.length > 0
        ? { ai_model_ids: context.aiModelIds }
        : {}),
    };
  }

  /**
   * 将 workflow 上下文写入 checkpoint metadata，便于从 checkpoint 反查 agent/session。
   * @keyword-en checkpoint-workflow-context, metadata, agent-link
   */
  private mergeWorkflowMetadata(
    metadata: CheckpointMetadata,
    context: CheckpointWorkflowContext,
  ): Record<string, unknown> {
    return {
      ...(metadata as unknown as Record<string, unknown>),
      workflowContext: {
        ...this.toConfigurableWorkflowContext(context),
      },
    };
  }

  /**
   * 从 configurable 读取字符串字段。
   * @keyword-en configurable-read, checkpoint-workflow-context, type-guard
   */
  private readConfigString(
    config: RunnableConfig,
    key: string,
  ): string | undefined {
    const value = (
      config.configurable as Record<string, unknown> | undefined
    )?.[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  /**
   * 从 configurable 读取字符串数组字段。
   * @keyword-en configurable-read, checkpoint-workflow-context, type-guard
   */
  private readConfigStringArray(config: RunnableConfig, key: string): string[] {
    const value = (
      config.configurable as Record<string, unknown> | undefined
    )?.[key];
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /**
   * 将 checkpoint 的 channel_values 编码为可持久化 JSON。
   * @keyword-en checkpoint-serialize, custom-saver, value-encoding
   */
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

  /**
   * 解析持久化 checkpoint，并兼容旧 raw JSON channel value。
   * @keyword-en checkpoint-parse, custom-saver, legacy-checkpoint
   */
  private parseCheckpoint(json: string): Checkpoint {
    const obj = JSON.parse(json) as {
      v: number;
      id: string;
      ts: string;
      channel_values: Record<string, unknown>;
      channel_versions: Record<string, string | number>;
      versions_seen: Record<string, Record<string, string | number>>;
    };
    const values: Record<string, unknown> = {};
    for (const [ch, enc] of Object.entries(obj.channel_values ?? {})) {
      if (this.isEncodedCheckpointValue(enc)) {
        values[ch] = this.decodeValue(enc.t, enc.b64);
      } else {
        values[ch] = enc;
      }
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

  /**
   * 判断 checkpoint channel value 是否为自定义 saver 编码格式。
   * @keyword-en checkpoint-value-compat, custom-saver, legacy-checkpoint
   */
  private isEncodedCheckpointValue(
    value: unknown,
  ): value is { t: string; b64: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { t?: unknown }).t === 'string' &&
      typeof (value as { b64?: unknown }).b64 === 'string'
    );
  }

  /**
   * 将任意写入值编码为 base64 JSON。
   * @keyword-en value-encoding, pending-writes, custom-saver
   */
  private encodeValue(val: unknown): { t: string; b64: string } {
    const str = JSON.stringify(val);
    if (typeof str !== 'string') {
      return { t: 'undefined', b64: '' };
    }
    return { t: 'json', b64: Buffer.from(str, 'utf8').toString('base64') };
  }

  /**
   * 从 base64 JSON 还原 pending write 值。
   * @keyword-en value-decoding, pending-writes, custom-saver
   */
  private decodeValue(t: string, b64: string): unknown {
    if (t === 'undefined') {
      return undefined;
    }
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
}
