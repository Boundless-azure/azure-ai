import type { Collection, Db, Document, Filter, OptionalUnlessRequiredId } from 'mongodb';
import { RunnerDbCollection } from '../enums/runner-db.enums';
import type {
  RunnerCapabilityManagement,
  RunnerConnectionHistory,
  RunnerHookFailure,
  RunnerMcpRecord,
  RunnerResourceLibrary,
  RunnerSkillRecord,
  RunnerWebMcpRecord,
} from '../types/runner-db.types';

/**
 * @title Runner 管理库服务
 * @description 提供 runner 管理库的集合访问与基础写入能力。
 * @keywords-cn Runner管理库, 集合访问, 基础写入
 * @keywords-en runner-db-service, collection-access, basic-write
 */
export class RunnerDbService {
  constructor(private readonly db: Db) {}

  /**
   * @title 获取集合实例
   * @description 按照集合枚举返回 Mongo Collection 实例。
   * @keywords-cn 获取集合, Collection, Runner库
   * @keywords-en get-collection, mongo-collection, runner-db
   */
  getCollection<T extends Document>(name: RunnerDbCollection): Collection<T> {
    return this.db.collection<T>(name);
  }

  /**
   * @title 记录连接历史
   * @description 写入 runner 注册连接历史记录。
   * @keywords-cn 连接历史, 注册记录, 写入
   * @keywords-en connection-history, registration-log, insert
   */
  async recordConnectionHistory(
    payload: OptionalUnlessRequiredId<RunnerConnectionHistory>,
  ): Promise<void> {
    await this.getCollection<RunnerConnectionHistory>(RunnerDbCollection.ConnectionHistory).insertOne(
      payload,
    );
  }

  /**
   * @title 记录 Hook 失败
   * @description 写入 hook 调用失败记录。
   * @keywords-cn Hook失败, 错误记录, 写入
   * @keywords-en hook-failure, error-log, insert
   */
  async recordHookFailure(
    payload: OptionalUnlessRequiredId<RunnerHookFailure>,
  ): Promise<void> {
    await this.getCollection<RunnerHookFailure>(RunnerDbCollection.HookFailure).insertOne(
      payload,
    );
  }

  /**
   * @title Upsert 能力清单
   * @description 将 hook 能力信息写入能力管理集合。
   * @keywords-cn 能力管理, upsert, hook清单
   * @keywords-en capability-upsert, hook-registry, runner-db
   */
  async upsertCapabilities(
    items: OptionalUnlessRequiredId<RunnerCapabilityManagement>[],
  ): Promise<void> {
    if (items.length === 0) return;
    const collection = this.getCollection<RunnerCapabilityManagement>(
      RunnerDbCollection.CapabilityManagement,
    );
    const operations = items.map((item) => ({
      updateOne: {
        filter: { capabilityId: item.capabilityId } as Filter<RunnerCapabilityManagement>,
        update: { $set: item },
        upsert: true,
      },
    }));
    await collection.bulkWrite(operations);
  }

  /**
   * @title 写入 WebMCP 记录
   * @description 保存域名与注入脚本位置的映射信息。
   * @keywords-cn WebMCP, 域名映射, 写入
   * @keywords-en webmcp, domain-map, insert
   */
  async recordWebMcp(payload: OptionalUnlessRequiredId<RunnerWebMcpRecord>): Promise<void> {
    await this.getCollection<RunnerWebMcpRecord>(RunnerDbCollection.WebMcp).insertOne(payload);
  }

  /**
   * @title 写入 MCP 记录
   * @description 保存 MCP 能力描述信息。
   * @keywords-cn MCP, 能力记录, 写入
   * @keywords-en mcp, capability-record, insert
   */
  async recordMcp(payload: OptionalUnlessRequiredId<RunnerMcpRecord>): Promise<void> {
    await this.getCollection<RunnerMcpRecord>(RunnerDbCollection.Mcp).insertOne(payload);
  }

  /**
   * @title 写入 Skill 记录
   * @description 保存 Skill 能力描述信息。
   * @keywords-cn Skill, 能力记录, 写入
   * @keywords-en skill, capability-record, insert
   */
  async recordSkill(payload: OptionalUnlessRequiredId<RunnerSkillRecord>): Promise<void> {
    await this.getCollection<RunnerSkillRecord>(RunnerDbCollection.Skill).insertOne(payload);
  }

  /**
   * @title 写入资源库记录
   * @description 保存资源库条目数据。
   * @keywords-cn 资源库, 资源记录, 写入
   * @keywords-en resource-library, resource-record, insert
   */
  async recordResource(payload: OptionalUnlessRequiredId<RunnerResourceLibrary>): Promise<void> {
    await this.getCollection<RunnerResourceLibrary>(RunnerDbCollection.ResourceLibrary).insertOne(
      payload,
    );
  }
}
