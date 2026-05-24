import type {
  Collection,
  Db,
  Document,
  Filter,
  OptionalUnlessRequiredId,
} from 'mongodb';
import { RunnerDbCollection } from '../enums/runner-db.enums';
import type {
  RunnerAppDomain,
  RunnerAppManagement,
  RunnerCapabilityManagement,
  RunnerConnectionHistory,
  RunnerHookFailure,
  RunnerMcpRecord,
  RunnerResourceLibrary,
  RunnerSkillRecord,
  RunnerSolutionRecord,
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
    await this.getCollection<RunnerConnectionHistory>(
      RunnerDbCollection.ConnectionHistory,
    ).insertOne(payload);
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
    await this.getCollection<RunnerHookFailure>(
      RunnerDbCollection.HookFailure,
    ).insertOne(payload);
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
        filter: {
          capabilityId: item.capabilityId,
        } as Filter<RunnerCapabilityManagement>,
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
  async recordWebMcp(
    payload: OptionalUnlessRequiredId<RunnerWebMcpRecord>,
  ): Promise<void> {
    await this.getCollection<RunnerWebMcpRecord>(
      RunnerDbCollection.WebMcp,
    ).insertOne(payload);
  }

  /**
   * @title 写入 MCP 记录
   * @description 保存 MCP 能力描述信息。
   * @keywords-cn MCP, 能力记录, 写入
   * @keywords-en mcp, capability-record, insert
   */
  async recordMcp(
    payload: OptionalUnlessRequiredId<RunnerMcpRecord>,
  ): Promise<void> {
    await this.getCollection<RunnerMcpRecord>(RunnerDbCollection.Mcp).insertOne(
      payload,
    );
  }

  /**
   * @title 写入 Skill 记录
   * @description 保存 Skill 能力描述信息。
   * @keywords-cn Skill, 能力记录, 写入
   * @keywords-en skill, capability-record, insert
   */
  async recordSkill(
    payload: OptionalUnlessRequiredId<RunnerSkillRecord>,
  ): Promise<void> {
    await this.getCollection<RunnerSkillRecord>(
      RunnerDbCollection.Skill,
    ).insertOne(payload);
  }

  /**
   * @title 写入资源库记录
   * @description 保存资源库条目数据。
   * @keywords-cn 资源库, 资源记录, 写入
   * @keywords-en resource-library, resource-record, insert
   */
  async recordResource(
    payload: OptionalUnlessRequiredId<RunnerResourceLibrary>,
  ): Promise<void> {
    await this.getCollection<RunnerResourceLibrary>(
      RunnerDbCollection.ResourceLibrary,
    ).insertOne(payload);
  }

  /**
   * @title Upsert 应用
   * @description 创建或更新应用记录。
   * @keywords-cn 应用, upsert, 创建更新
   * @keywords-en app-upsert, create-update, runner-db
   */
  async upsertApp(
    payload: OptionalUnlessRequiredId<RunnerAppManagement>,
  ): Promise<void> {
    const collection = this.getCollection<RunnerAppManagement>(
      RunnerDbCollection.AppManagement,
    );
    await collection.updateOne(
      { appId: payload.appId } as Filter<RunnerAppManagement>,
      { $set: payload },
      { upsert: true },
    );
  }

  /**
   * @title 获取应用列表
   * @description 查询所有应用记录。
   * @keywords-cn 应用列表, 查询, runner-db
   * @keywords-en app-list, find, runner-db
   */
  async findApps(): Promise<RunnerAppManagement[]> {
    return this.getCollection<RunnerAppManagement>(
      RunnerDbCollection.AppManagement,
    )
      .find({})
      .toArray();
  }

  /**
   * @title 根据 ID 获取应用
   * @description 根据 appId 查询应用记录。
   * @keywords-cn 应用查询, appId, runner-db
   * @keywords-en find-app-by-id, appId, runner-db
   */
  async findAppById(appId: string): Promise<RunnerAppManagement | null> {
    return this.getCollection<RunnerAppManagement>(
      RunnerDbCollection.AppManagement,
    ).findOne({ appId } as Filter<RunnerAppManagement>);
  }

  /**
   * @title 删除应用
   * @description 根据 appId 删除应用记录。
   * @keywords-cn 删除应用, appId, runner-db
   * @keywords-en delete-app, appId, runner-db
   */
  async deleteApp(appId: string): Promise<void> {
    await this.getCollection<RunnerAppManagement>(
      RunnerDbCollection.AppManagement,
    ).deleteOne({ appId } as Filter<RunnerAppManagement>);
  }

  /**
   * @title Upsert 应用域名绑定
   * @description 创建或更新应用域名绑定记录。
   * @keywords-cn 应用域名, upsert, 绑定
   * @keywords-en app-domain-upsert, binding, runner-db
   */
  async upsertAppDomain(
    payload: OptionalUnlessRequiredId<RunnerAppDomain>,
  ): Promise<void> {
    const collection = this.getCollection<RunnerAppDomain>(
      RunnerDbCollection.AppDomains,
    );
    await collection.updateOne(
      {
        appId: payload.appId,
        domain: payload.domain,
      } as Filter<RunnerAppDomain>,
      { $set: payload },
      { upsert: true },
    );
  }

  /**
   * @title 获取应用域名绑定列表
   * @description 查询所有应用域名绑定记录。
   * @keywords-cn 应用域名列表, 查询, runner-db
   * @keywords-en app-domain-list, find, runner-db
   */
  async findAppDomains(): Promise<RunnerAppDomain[]> {
    return this.getCollection<RunnerAppDomain>(RunnerDbCollection.AppDomains)
      .find({})
      .toArray();
  }

  /**
   * @title 删除应用域名绑定
   * @description 根据 appId 删除应用域名绑定记录。
   * @keywords-cn 删除应用域名, appId, runner-db
   * @keywords-en delete-app-domain, appId, runner-db
   */
  async deleteAppDomainsByAppId(appId: string): Promise<void> {
    await this.getCollection<RunnerAppDomain>(
      RunnerDbCollection.AppDomains,
    ).deleteMany({ appId } as Filter<RunnerAppDomain>);
  }

  /**
   * @title 根据域名查询应用域名绑定
   * @description 通过域名查找对应的应用域名绑定记录。
   * @keywords-cn 域名查询, 应用域名, runner-db
   * @keywords-en find-by-domain, app-domain, runner-db
   */
  async findAppDomainByDomain(domain: string): Promise<RunnerAppDomain | null> {
    return this.getCollection<RunnerAppDomain>(
      RunnerDbCollection.AppDomains,
    ).findOne({ domain } as Filter<RunnerAppDomain>);
  }

  /**
   * @title Upsert Solution
   * @description 创建或更新 Solution 记录。
   * @keywords-cn Solution, upsert, 创建更新
   * @keywords-en solution-upsert, create-update, runner-db
   */
  async upsertSolution(
    payload: OptionalUnlessRequiredId<RunnerSolutionRecord>,
  ): Promise<void> {
    const collection = this.getCollection<RunnerSolutionRecord>(
      RunnerDbCollection.Solution,
    );
    await collection.updateOne(
      { solutionId: payload.solutionId } as Filter<RunnerSolutionRecord>,
      { $set: payload },
      { upsert: true },
    );
  }

  /**
   * @title 获取 Solution 列表
   * @description 查询所有 Solution 记录。
   * @keywords-cn Solution列表, 查询, runner-db
   * @keywords-en solution-list, find, runner-db
   */
  async findSolutions(): Promise<RunnerSolutionRecord[]> {
    return this.getCollection<RunnerSolutionRecord>(RunnerDbCollection.Solution)
      .find({})
      .toArray();
  }

  /**
   * @title 根据 ID 获取 Solution
   * @description 根据 solutionId 查询 Solution 记录。
   * @keywords-cn Solution查询, solutionId, runner-db
   * @keywords-en find-solution-by-id, solutionId, runner-db
   */
  async findSolutionById(solutionId: string): Promise<RunnerSolutionRecord | null> {
    return this.getCollection<RunnerSolutionRecord>(
      RunnerDbCollection.Solution,
    ).findOne({ solutionId } as Filter<RunnerSolutionRecord>);
  }

  /**
   * @title 删除 Solution
   * @description 根据 solutionId 删除 Solution 记录。
   * @keywords-cn 删除Solution, solutionId, runner-db
   * @keywords-en delete-solution, solutionId, runner-db
   */
  async deleteSolution(solutionId: string): Promise<void> {
    await this.getCollection<RunnerSolutionRecord>(
      RunnerDbCollection.Solution,
    ).deleteOne({ solutionId } as Filter<RunnerSolutionRecord>);
  }

  /**
   * @title 删除应用域名绑定
   * @description 根据域名删除应用域名绑定记录。
   * @keywords-cn 删除应用域名, 域名, runner-db
   * @keywords-en delete-app-domain, domain, runner-db
   */
  async deleteAppDomain(domain: string): Promise<void> {
    await this.getCollection<RunnerAppDomain>(
      RunnerDbCollection.AppDomains,
    ).deleteOne({ domain } as Filter<RunnerAppDomain>);
  }
}
