import type { Collection, Db } from 'mongodb';
import { RunnerDbCollection } from '../enums/runner-db.enums';

/**
 * @title Runner Mongo 迁移服务
 * @description 仅对 runner 管理库执行集合初始化与索引迁移。
 * @keywords-cn Mongo迁移, Runner库, 集合初始化
 * @keywords-en mongo-migration, runner-db, collection-init
 */
export class RunnerDbMigrationService {
  /**
   * @title 执行迁移
   * @description 按迁移记录执行 runner 管理库的结构初始化。
   * @keywords-cn 执行迁移, Runner库, 初始化
   * @keywords-en run-migrations, runner-db, init
   */
  async run(db: Db): Promise<void> {
    const migrationCollection = db.collection<{ id: string; ts: number }>(
      RunnerDbCollection.Migration,
    );
    await this.ensureCollection(db, RunnerDbCollection.Migration);
    const applied = new Set(
      (await migrationCollection.find({}).toArray()).map((item) => item.id),
    );
    const migrations = [this.bootstrapCollections.bind(this)];
    for (const migration of migrations) {
      const id = migration.name;
      if (applied.has(id)) continue;
      await migration(db);
      await migrationCollection.insertOne({ id, ts: Date.now() });
    }
  }

  /**
   * @title 初始化集合与索引
   * @description 创建 runner 管理库所需集合与基础索引。
   * @keywords-cn 初始化集合, 索引, Runner库
   * @keywords-en init-collections, indexes, runner-db
   */
  private async bootstrapCollections(db: Db): Promise<void> {
    await Promise.all([
      this.ensureCollection(db, RunnerDbCollection.ConnectionHistory),
      this.ensureCollection(db, RunnerDbCollection.HookFailure),
      this.ensureCollection(db, RunnerDbCollection.AppManagement),
      this.ensureCollection(db, RunnerDbCollection.CapabilityManagement),
      this.ensureCollection(db, RunnerDbCollection.ResourceLibrary),
      this.ensureCollection(db, RunnerDbCollection.WebMcp),
      this.ensureCollection(db, RunnerDbCollection.Mcp),
      this.ensureCollection(db, RunnerDbCollection.Skill),
    ]);

    await db
      .collection(RunnerDbCollection.ConnectionHistory)
      .createIndex({ runnerId: 1, createdAt: -1 });
    await db
      .collection(RunnerDbCollection.HookFailure)
      .createIndex({ hookName: 1, createdAt: -1 });
    await db
      .collection(RunnerDbCollection.AppManagement)
      .createIndex({ appId: 1 }, { unique: true });
    await db
      .collection(RunnerDbCollection.CapabilityManagement)
      .createIndex({ capabilityId: 1 }, { unique: true });
    await db
      .collection(RunnerDbCollection.ResourceLibrary)
      .createIndex({ resourceId: 1 }, { unique: true });
    await db
      .collection(RunnerDbCollection.WebMcp)
      .createIndex({ domain: 1 }, { unique: true });
    await db.collection(RunnerDbCollection.Mcp).createIndex({ name: 1 });
    await db.collection(RunnerDbCollection.Skill).createIndex({ name: 1 });
  }

  /**
   * @title 确保集合存在
   * @description 若集合不存在则创建，已存在则跳过。
   * @keywords-cn 确保集合, 创建集合, Mongo
   * @keywords-en ensure-collection, create-collection, mongo
   */
  private async ensureCollection(db: Db, name: RunnerDbCollection): Promise<Collection> {
    const collections = await db.listCollections({ name }).toArray();
    if (collections.length > 0) {
      return db.collection(name);
    }
    return await db.createCollection(name);
  }
}
