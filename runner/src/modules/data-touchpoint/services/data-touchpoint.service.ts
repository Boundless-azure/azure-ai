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
export class RunnerDataTouchpointService {
  private readonly collection: Collection<DataTouchpoint>;

  constructor(db: Db) {
    this.collection = db.collection<DataTouchpoint>('data_touchpoints');
  }

  /**
   * 创建数据触点元数据
   * @keyword-en create-data-touchpoint
   */
  async create(input: CreateDataTouchpointInput): Promise<DataTouchpoint> {
    const now = new Date().toISOString();
    const doc: DataTouchpoint = {
      _id: randomUUID(),
      solutionId: input.solutionId,
      name: input.name,
      description: input.description,
      sources: input.sources,
      bindSessionId: input.bindSessionId,
      bindAgentId: input.bindAgentId,
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
    const { id, ...rest } = input;
    const $set: Partial<DataTouchpoint> = {
      ...rest,
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
   * - 过滤条件全部可选: solutionId / bindSessionId / source (单值) / sourceIn (多值 $in) / enabled
   * - source 与 sourceIn 互斥, 同传 sourceIn 优先 (语义更明确)
   * - sourceIn 用 mongo $in 一次查命中"任一 source"的触点, 自然去重, 多 source 触发场景核心
   * @keyword-en list-data-touchpoint
   */
  async list(filter: ListDataTouchpointInput): Promise<DataTouchpoint[]> {
    const where: Filter<DataTouchpoint> = {};
    if (filter.solutionId) where.solutionId = filter.solutionId;
    if (filter.bindSessionId) where.bindSessionId = filter.bindSessionId;
    if (filter.sourceIn && filter.sourceIn.length > 0) {
      where.sources = { $in: filter.sourceIn };
    } else if (filter.source) {
      where.sources = filter.source;
    }
    if (typeof filter.enabled === 'boolean') where.enabled = filter.enabled;
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
