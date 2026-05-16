import { randomUUID } from 'node:crypto';
import type { Collection, Db, Filter } from 'mongodb';
import type {
  CreateDataTouchpointInput,
  DataTouchpoint,
  ListDataTouchpointInput,
  UpdateDataTouchpointInput,
} from '../types/data-touchpoint.types';

/**
 * @title Runner 数据触点服务
 * @description 数据触点元数据 CRUD (mongo collection: data_touchpoints)。物理胶水代码不在此层管理,本服务仅对外暴露元数据增删改查。
 * @keywords-cn 数据触点服务, 元数据CRUD, 主动推送, mongo
 * @keywords-en data-touchpoint-service, metadata-crud, proactive-push, mongo
 */

/**
 * 合并 notifyTargets: 同 sessionId 多 entry 合并 agentIds (去重), 同 entry 内 agentIds 也去重
 * @keyword-en merge-notify-targets
 */
function mergeNotifyTargets(
  raw: ReadonlyArray<{ sessionId: string; agentIds: string[] }>,
): Array<{ sessionId: string; agentIds: string[] }> {
  const map = new Map<string, Set<string>>();
  for (const entry of raw) {
    if (!entry?.sessionId) continue;
    const set = map.get(entry.sessionId) ?? new Set<string>();
    for (const a of entry.agentIds ?? []) {
      if (typeof a === 'string' && a.length > 0) set.add(a);
    }
    map.set(entry.sessionId, set);
  }
  return Array.from(map.entries())
    .filter(([, set]) => set.size > 0)
    .map(([sessionId, set]) => ({
      sessionId,
      agentIds: Array.from(set),
    }));
}
/** 创建/更新都不可改的字段; service.update 会兜底过滤掉, 即便外部硬调也防漏 */
const IMMUTABLE_FIELDS = new Set<keyof DataTouchpoint>([
  '_id',
  'solutionId',
  'createdByAgentId',
  'createdAt',
]);

const COLLECTION_NAME = 'data_touchpoints';

export class RunnerDataTouchpointService {
  /**
   * 幂等创建索引:
   *  - { solutionId } solution 维度查
   *  - { enabled, sources } consumeTrigger 主路径 ($in sources + enabled=true)
   *  - { 'notifyTargets.sessionId' } 按 session 维度反查触点 (UI / 纠错机制)
   *  - { 'notifyTargets.agentIds' } 按 agent 维度反查触点 (UI / 我关注的)
   *  - { createdByAgentId } 按创建者维度查 (我创建的)
   * @keyword-en ensure-indexes
   */
  static async ensureIndexes(db: Db): Promise<void> {
    const coll = db.collection<DataTouchpoint>(COLLECTION_NAME);
    await Promise.all([
      coll.createIndex({ solutionId: 1 }),
      coll.createIndex({ enabled: 1, sources: 1 }),
      coll.createIndex({ 'notifyTargets.sessionId': 1 }),
      coll.createIndex({ 'notifyTargets.agentIds': 1 }),
      coll.createIndex({ createdByAgentId: 1 }),
    ]);
  }

  private readonly collection: Collection<DataTouchpoint>;

  constructor(db: Db) {
    this.collection = db.collection<DataTouchpoint>(COLLECTION_NAME);
  }

  /**
   * 创建数据触点元数据
   *  - createdByAgentId 必须由 hook handler 从 context.principalId 注入, 不接受 LLM 显式传
   * @keyword-en create-data-touchpoint
   */
  async create(
    input: CreateDataTouchpointInput & { createdByAgentId: string },
  ): Promise<DataTouchpoint> {
    const now = new Date().toISOString();
    // notifyTargets 同 sessionId 重复时合并 agentIds (zod 文档约定不重复, 这里做兜底)
    const normalizedTargets = mergeNotifyTargets(input.notifyTargets);
    const doc: DataTouchpoint = {
      _id: randomUUID(),
      solutionId: input.solutionId,
      name: input.name,
      description: input.description,
      sources: input.sources,
      notifyTargets: normalizedTargets,
      createdByAgentId: input.createdByAgentId,
      filePath: input.filePath,
      configPath: input.configPath,
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return doc;
  }

  /**
   * 更新数据触点元数据 (id 必填, 其他字段可选)
   * @keyword-en update-data-touchpoint
   */
  async update(
    input: UpdateDataTouchpointInput,
  ): Promise<DataTouchpoint | null> {
    const { id, notifyTargets, ...rest } = input;
    // 软过滤不可变字段: schema 没列就 OK, 但外部直接调 svc.update 也防漏
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (IMMUTABLE_FIELDS.has(k as keyof DataTouchpoint)) continue;
      if (v === undefined) continue;
      filtered[k] = v;
    }
    const $set: Partial<DataTouchpoint> = {
      ...(filtered as Partial<DataTouchpoint>),
      ...(notifyTargets !== undefined
        ? { notifyTargets: mergeNotifyTargets(notifyTargets) }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set },
      { returnDocument: 'after' },
    );
    return result ?? null;
  }

  /**
   * 删除数据触点元数据 (硬删, 物理胶水代码由调用方负责清理)
   * @keyword-en delete-data-touchpoint
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * 取单条
   * @keyword-en get-data-touchpoint-by-id
   */
  async getById(id: string): Promise<DataTouchpoint | null> {
    return this.collection.findOne({ _id: id });
  }

  /**
   * 列出数据触点
   * - 过滤条件全部可选: solutionId / sessionId / agentId / createdByAgentId / source / sourceIn / enabled
   * - source 与 sourceIn 互斥, 同传 sourceIn 优先 (语义更明确)
   * - sourceIn 用 mongo $in 一次查命中"任一 source"的触点, 自然去重, 多 source 触发场景核心
   * - sessionId 走 notifyTargets.$elemMatch: 任一 entry.sessionId 等于此值
   * - agentId 走 notifyTargets.$elemMatch: 任一 entry.agentIds 含此值
   * - sessionId + agentId 同传走单一 $elemMatch (同一 entry 内 sessionId 等且 agentIds 含)
   * - createdByAgentId 等值匹配
   * - visibleToAgentId 加 $or 限定可见范围 (createdByAgentId=self 或 notifyTargets.agentIds 含 self), LLM 调用时由 hook handler 强制注入
   * @keyword-en list-data-touchpoint
   */
  async list(
    filter: ListDataTouchpointInput,
    visibleToAgentId?: string,
  ): Promise<DataTouchpoint[]> {
    const where: Filter<DataTouchpoint> = {};
    if (filter.solutionId) where.solutionId = filter.solutionId;
    if (filter.sessionId || filter.agentId) {
      const elemMatch: Record<string, unknown> = {};
      if (filter.sessionId) elemMatch.sessionId = filter.sessionId;
      if (filter.agentId) elemMatch.agentIds = filter.agentId;
      where.notifyTargets = { $elemMatch: elemMatch };
    }
    if (filter.createdByAgentId) {
      where.createdByAgentId = filter.createdByAgentId;
    }
    if (filter.sourceIn && filter.sourceIn.length > 0) {
      where.sources = { $in: filter.sourceIn };
    } else if (filter.source) {
      where.sources = filter.source;
    }
    if (typeof filter.enabled === 'boolean') where.enabled = filter.enabled;
    if (visibleToAgentId) {
      // 可见范围限定: 创建者 = self 或 被通知到 self (agent 视角"跟我相关的触点")
      where.$or = [
        { createdByAgentId: visibleToAgentId },
        { 'notifyTargets.agentIds': visibleToAgentId },
      ];
    }
    return this.collection.find(where).toArray();
  }

  /**
   * 联动清理: solution 卸载时删除其所有触点
   * @keyword-en delete-data-touchpoint-by-solution
   */
  async deleteBySolution(solutionId: string): Promise<number> {
    const result = await this.collection.deleteMany({ solutionId });
    return result.deletedCount;
  }
}
