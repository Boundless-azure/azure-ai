import { join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Collection, Db } from 'mongodb';
import type { SolutionInfo, InstallSolution, SearchSolution } from '../types/solution.types';

/**
 * @title Runner Solution 服务
 * @description 提供 Runner 本地 Solution 的安装、删除、升级、查询功能
 * @keywords-cn solution服务, solution管理, runner方案
 * @keywords-en solution-service, solution-management, runner-solution
 */
export class RunnerSolutionService {
  private collection: Collection<SolutionInfo>;

  constructor(private readonly db: Db) {
    this.collection = db.collection<SolutionInfo>('solutions');
  }

  /**
   * @title 获取所有已安装的 Solution
   * @description 查询当前 Runner 上所有已安装的 Solution
   * @keywords-cn 获取solution列表, 已安装solution, solution列表
   * @keywords-en get-solutions, installed-solutions, solution-list
   */
  async list(): Promise<SolutionInfo[]> {
    return this.collection.find().toArray();
  }

  /**
   * @title 获取 Solution 详情
   * @description 根据名称获取 Solution 详细信息
   * @keywords-cn 获取solution详情, solution详情, 详情查询
   * @keywords-en get-solution-detail, solution-detail, detail-query
   */
  async getByName(name: string): Promise<SolutionInfo | null> {
    return this.collection.findOne({ name });
  }

  /**
   * @title 安装 Solution
   * @description 从指定源安装 Solution 到 Runner
   * @keywords-cn 安装solution, solution安装, 安装
   * @keywords-en install-solution, solution-install, install
   */
  async install(params: InstallSolution): Promise<SolutionInfo> {
    const solutionDir = this.getSolutionDir(params.name);

    // 创建解决方案目录
    if (!existsSync(solutionDir)) {
      mkdirSync(solutionDir, { recursive: true });
    }

    // 写入 solution.json 元信息
    const solutionInfo: SolutionInfo = {
      name: params.name,
      version: params.version,
      source: params.source,
      location: solutionDir,
      summary: params.summary ?? '',
      description: params.description ?? '',
      images: params.images ?? [],
      includes: params.includes ?? [],
      installedAt: new Date().toISOString(),
    };

    const metaPath = join(solutionDir, 'solution.json');
    writeFileSync(metaPath, JSON.stringify(solutionInfo, null, 2), 'utf-8');

    // 如果有 sourceUrl，这里可以下载或复制内容（暂不实现）
    // await this.downloadFromSource(params.sourceUrl, solutionDir);

    await this.collection.updateOne(
      { name: params.name },
      { $set: solutionInfo },
      { upsert: true },
    );

    return solutionInfo;
  }

  /**
   * @title 删除 Solution
   * @description 从 Runner 删除指定的 Solution
   * @keywords-cn 删除solution, solution删除, 删除
   * @keywords-en delete-solution, solution-delete, delete
   */
  async delete(name: string): Promise<boolean> {
    const solution = await this.getByName(name);
    if (!solution) return false;

    // 删除解决方案目录
    const solutionDir = solution.location;
    if (existsSync(solutionDir)) {
      rmSync(solutionDir, { recursive: true, force: true });
    }

    // 从数据库删除
    await this.collection.deleteOne({ name });
    return true;
  }

  /**
   * @title 升级 Solution
   * @description 从指定源升级已安装的 Solution
   * @keywords-cn 升级solution, solution升级, 升级
   * @keywords-en upgrade-solution, solution-upgrade, upgrade
   */
  async upgrade(name: string, sourceUrl: string): Promise<SolutionInfo | null> {
    const existing = await this.getByName(name);
    if (!existing) return null;

    // 重新安装（会覆盖）
    const solutionDir = existing.location;
    if (existsSync(solutionDir)) {
      rmSync(solutionDir, { recursive: true, force: true });
    }
    mkdirSync(solutionDir, { recursive: true });

    const updated: SolutionInfo = {
      ...existing,
      location: solutionDir,
      installedAt: new Date().toISOString(),
    };

    const metaPath = join(solutionDir, 'solution.json');
    writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf-8');

    await this.collection.updateOne({ name }, { $set: updated });
    return updated;
  }

  /**
   * @title 搜索 Solution
   * @description 根据条件搜索 Solution
   * @keywords-cn 搜索solution, solution搜索, 搜索
   * @keywords-en search-solution, solution-search, search
   */
  async search(query: SearchSolution): Promise<SolutionInfo[]> {
    const filter: Record<string, unknown> = {};

    if (query.q) {
      filter.$or = [
        { name: { $regex: query.q, $options: 'i' } },
        { summary: { $regex: query.q, $options: 'i' } },
        { description: { $regex: query.q, $options: 'i' } },
      ];
    }

    if (query.source) {
      filter.source = query.source;
    }

    if (query.include) {
      filter.includes = { $in: [query.include] };
    }

    return this.collection.find(filter).toArray();
  }

  /**
   * @title 获取 Solution 存储目录
   * @description 根据 Solution 名称获取其在 Runner 中的存储目录
   * @keywords-cn solution目录, 存储目录, 路径
   * @keywords-en solution-dir, storage-dir, path
   */
  private getSolutionDir(name: string): string {
    const workspacePath = join(process.cwd(), 'workspace');
    const solutionsPath = join(workspacePath, 'solutions');
    if (!existsSync(solutionsPath)) {
      mkdirSync(solutionsPath, { recursive: true });
    }
    return join(solutionsPath, name);
  }
}
