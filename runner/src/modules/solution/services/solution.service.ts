import { basename, join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import type { Collection, Db } from 'mongodb';
import type {
  EnsureSolutionTarget,
  InstallSolution,
  BatchSolutionIdentity,
  RunnerSolutionAppInfo,
  RunnerSolutionDetail,
  RunnerSolutionUnitInfo,
  SearchSolution,
  SolutionIdentity,
  SolutionInfo,
  UpsertSolutionMetadata,
} from '../types/solution.types';
import type { RunnerDbService } from '../../runner-db/services/runner-db.service';
import type { RunnerAppManagement } from '../../runner-db/types/runner-db.types';

const DEFAULT_LIGHTWEIGHT_SOLUTION_NAME = 'default-view-solution';
const DEFAULT_LIGHTWEIGHT_SOLUTION_VERSION = '1.0.0';
const DEFAULT_LIGHTWEIGHT_SOLUTION_SUMMARY =
  'Default lightweight display solution';
const DEFAULT_LIGHTWEIGHT_SOLUTION_DESCRIPTION =
  'Built-in Solution for temporary tables, lightweight pages, and one-off visual displays.';

/**
 * @title Runner Solution 服务
 * @description 提供 Runner 本地 Solution 的安装、删除、升级、查询功能
 * @keywords-cn solution服务, solution管理, runner方案
 * @keywords-en solution-service, solution-management, runner-solution
 * @keyword-en solution-service, solution-management, runner-solution
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
   * @keyword-en get-solutions, installed-solutions, solution-list
   */
  async list(): Promise<SolutionInfo[]> {
    return this.collection.find().toArray();
  }

  /**
   * @title 获取 Solution 详情
   * @description 根据名称获取 Solution 详细信息
   * @keywords-cn 获取solution详情, solution详情, 详情查询
   * @keywords-en get-solution-detail, solution-detail, detail-query
   * @keyword-en get-solution-detail, solution-detail, detail-query
   */
  async getByName(name: string): Promise<SolutionInfo | null> {
    return this.collection.findOne({ name });
  }

  /**
   * @title Get solution by stable id
   * @description Finds one installed solution by its stable solutionId.
   * @keyword-en get-solution-by-id, solution-identity
   * @keyword-cn Solution按ID查询, Solution标识
   */
  async getById(solutionId: string): Promise<SolutionInfo | null> {
    return this.collection.findOne({ solutionId });
  }

  /**
   * @title Get solution by identity
   * @description Resolves one solution from solutionId first, then name.
   * @keyword-en get-solution-by-identity, solution-detail
   * @keyword-cn Solution标识查询, Solution详情
   */
  async getByIdentity(
    identity: SolutionIdentity,
  ): Promise<SolutionInfo | null> {
    if (identity.solutionId) {
      const byId = await this.getById(identity.solutionId);
      if (byId) return byId;
    }
    if (identity.name) return this.getByName(identity.name);
    return null;
  }

  /**
   * @title List solutions by batch identity
   * @description Filters installed solutions by solution ids or names; empty filter returns all.
   * @keyword-en batch-solution-filter, solution-list
   * @keyword-cn 批量Solution过滤, Solution列表
   */
  async listByIdentity(
    identity: BatchSolutionIdentity,
  ): Promise<SolutionInfo[]> {
    const all = await this.list();
    const ids = new Set([
      ...(identity.solutionId ? [identity.solutionId] : []),
      ...(identity.solutionIds ?? []),
    ]);
    const names = new Set([
      ...(identity.name ? [identity.name] : []),
      ...(identity.names ?? []),
    ]);
    if (ids.size === 0 && names.size === 0) return all;
    return all.filter((solution) => {
      return ids.has(solution.solutionId) || names.has(solution.name);
    });
  }

  /**
   * @title Get solution detail
   * @description Returns solution metadata with associated apps and solution-local units.
   * @keyword-en solution-detail, app-unit-detail
   * @keyword-cn Solution详情, 应用单元详情
   */
  async getDetail(
    identity: SolutionIdentity,
    runnerDb?: RunnerDbService,
  ): Promise<RunnerSolutionDetail | null> {
    const solution = await this.getByIdentity(identity);
    if (!solution) return null;
    return this.buildDetail(solution, runnerDb);
  }

  /**
   * @title List solution apps
   * @description Returns runner app records associated with the selected solutions.
   * @keyword-en solution-app-list, app-association
   * @keyword-cn Solution应用列表, 应用关联
   */
  async listAppsBySolutions(
    identity: BatchSolutionIdentity,
    runnerDb?: RunnerDbService,
  ): Promise<RunnerSolutionAppInfo[]> {
    if (!runnerDb) return [];
    const solutions = await this.listByIdentity(identity);
    const apps = await runnerDb.findApps();
    const solutionById = new Map(
      solutions.map((solution) => [solution.solutionId, solution]),
    );
    const solutionByName = new Map(
      solutions.map((solution) => [solution.name, solution]),
    );

    return apps
      .map((app) => {
        const solution =
          (app.solutionId ? solutionById.get(app.solutionId) : undefined) ??
          (app.solutionName ? solutionByName.get(app.solutionName) : undefined);
        if (!solution) return null;
        return this.toAppInfo(solution, app);
      })
      .filter((item): item is RunnerSolutionAppInfo => item !== null);
  }

  /**
   * @title List solution units
   * @description Returns unit directories found under the selected solution workspaces.
   * @keyword-en solution-unit-list, unit-association
   * @keyword-cn Solution单元列表, 单元关联
   */
  async listUnitsBySolutions(
    identity: BatchSolutionIdentity,
  ): Promise<RunnerSolutionUnitInfo[]> {
    const solutions = await this.listByIdentity(identity);
    return solutions.flatMap((solution) => this.listUnitsForSolution(solution));
  }

  /**
   * @title 安装 Solution
   * @description 从指定源安装 Solution 到 Runner
   * @keywords-cn 安装solution, solution安装, 安装
   * @keywords-en install-solution, solution-install, install
   * @keyword-en install-solution, solution-install, install
   */
  async install(params: InstallSolution): Promise<SolutionInfo> {
    const solutionDir = this.getSolutionDir(params.name);

    // 创建解决方案目录
    if (!existsSync(solutionDir)) {
      mkdirSync(solutionDir, { recursive: true });
    }

    const solutionInfo: SolutionInfo = {
      solutionId: buildStableId('solution', params.name, params.version),
      name: params.name,
      version: params.version,
      source: params.source,
      location: solutionDir,
      summary: params.summary ?? '',
      description: params.description ?? '',
      images: params.images ?? [],
      includes: params.includes ?? [],
      installedAt: new Date().toISOString(),
      isInitialized: true,
    };

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
   * @title Upsert Solution metadata
   * @description Creates or updates the canonical Runner-local Solution metadata in the solutions collection.
   * @keyword-en solution-upsert, solution-metadata
   * @keyword-cn Solution更新, Solution元数据
   */
  async upsertMetadata(
    params: UpsertSolutionMetadata,
  ): Promise<SolutionInfo> {
    const name = params.name.trim();
    const existing = await this.collection.findOne({ name });
    const version = params.version?.trim() || existing?.version || '1.0.0';
    const solutionDir = existing?.location ?? this.getSolutionDir(name);
    if (!existsSync(solutionDir)) {
      mkdirSync(solutionDir, { recursive: true });
    }
    const solution: SolutionInfo = {
      solutionId:
        existing?.solutionId ??
        params.solutionId?.trim() ??
        buildStableId('solution', name, version),
      name,
      version,
      source: params.source ?? existing?.source ?? 'self_developed',
      location: solutionDir,
      summary: params.summary ?? existing?.summary ?? '',
      description: params.description ?? existing?.description ?? '',
      images: params.images ?? existing?.images ?? [],
      includes: params.includes ?? existing?.includes ?? [],
      installedAt: existing?.installedAt ?? new Date().toISOString(),
      isInitialized:
        params.isInitialized ?? existing?.isInitialized ?? true,
    };

    await this.collection.updateOne(
      { name: solution.name },
      { $set: solution },
      { upsert: true },
    );
    return solution;
  }

  /**
   * @title 确保默认轻量展示 Solution
   * @description Runner 启动时写入内置 view Solution，用于临时表格、单页展示等轻量目标。
   * @keyword-en default-lightweight-solution, view-solution, runner-bootstrap
   */
  async ensureDefaultLightweightSolution(): Promise<SolutionInfo> {
    const now = new Date();
    const nowIso = now.toISOString();
    const solutionName = DEFAULT_LIGHTWEIGHT_SOLUTION_NAME;
    const solutionVersion = DEFAULT_LIGHTWEIGHT_SOLUTION_VERSION;
    const solutionDir = this.getSolutionDir(solutionName);
    if (!existsSync(solutionDir)) {
      mkdirSync(solutionDir, { recursive: true });
    }

    const existing = await this.collection.findOne({ name: solutionName });
    const includes = Array.from(
      new Set([...(existing?.includes ?? []), 'view']),
    ) as SolutionInfo['includes'];
    const solution: SolutionInfo = {
      solutionId:
        existing?.solutionId ??
        buildStableId('solution', solutionName, solutionVersion),
      name: solutionName,
      version: existing?.version ?? solutionVersion,
      source: existing?.source ?? 'self_developed',
      location: existing?.location ?? solutionDir,
      summary: DEFAULT_LIGHTWEIGHT_SOLUTION_SUMMARY,
      description: DEFAULT_LIGHTWEIGHT_SOLUTION_DESCRIPTION,
      images: existing?.images ?? [],
      includes,
      installedAt: existing?.installedAt ?? nowIso,
      isInitialized: true,
    };

    await this.collection.updateOne(
      { name: solution.name },
      { $set: solution },
      { upsert: true },
    );
    return solution;
  }

  /**
   * @title 确保 code-agent 目标 Solution/App
   * @description 按名称和版本在 Runner 本地确保 Solution 记录；带 appName 时同步写入 runner_apps。
   * @keyword-en ensure-target, solution-create, app-create
   */
  async ensureTarget(
    params: EnsureSolutionTarget,
    runnerDb: RunnerDbService,
  ): Promise<{ solution: SolutionInfo; app?: RunnerAppManagement }> {
    const now = new Date();
    const nowIso = now.toISOString();
    const solutionName = params.solutionName.trim();
    const solutionVersion = params.solutionVersion?.trim() || '1.0.0';
    const solutionId = buildStableId(
      'solution',
      solutionName,
      solutionVersion,
    );
    const solutionDir = this.getSolutionDir(solutionName);
    if (!existsSync(solutionDir)) {
      mkdirSync(solutionDir, { recursive: true });
    }

    const existing = await this.collection.findOne({ name: solutionName });
    const isDefaultLightweightSolution =
      solutionName === DEFAULT_LIGHTWEIGHT_SOLUTION_NAME;
    const includes = Array.from(
      new Set([
        ...(existing?.includes ?? []),
        ...(isDefaultLightweightSolution ? ['view'] : []),
        ...(params.appName ? ['app'] : []),
      ]),
    ) as SolutionInfo['includes'];
    const solution: SolutionInfo = {
      solutionId: existing?.solutionId ?? solutionId,
      name: solutionName,
      version: existing?.version ?? solutionVersion,
      source: existing?.source ?? 'self_developed',
      location: existing?.location ?? solutionDir,
      summary: isDefaultLightweightSolution
        ? DEFAULT_LIGHTWEIGHT_SOLUTION_SUMMARY
        : existing
          ? existing.summary
          : params.solutionSummary ??
            `${solutionName} solution managed by code-agent`,
      description: isDefaultLightweightSolution
        ? DEFAULT_LIGHTWEIGHT_SOLUTION_DESCRIPTION
        : existing
          ? existing.description
          : params.solutionDescription ?? '',
      images: existing?.images ?? [],
      includes,
      installedAt: existing?.installedAt ?? nowIso,
      isInitialized: isDefaultLightweightSolution
        ? true
        : existing?.isInitialized ?? false,
    };

    await this.collection.updateOne(
      { name: solution.name },
      { $set: solution },
      { upsert: true },
    );
    const appName = params.appName?.trim();
    if (!appName) return { solution };

    const appVersion = params.appVersion?.trim() || '1.0.0';
    const appId = buildStableId('app', solution.solutionId, appName, appVersion);
    const existingApp = await runnerDb.findAppById(appId);
    const appLocation = join(solution.location, 'apps', appName);
    const app: RunnerAppManagement = {
      appId,
      name: appName,
      version: existingApp?.version ?? appVersion,
      description:
        params.appDescription ??
        existingApp?.description ??
        `${appName} app managed by code-agent`,
      keywords: normalizeKeywords(params.tags ?? existingApp?.keywords ?? []),
      solutionId: solution.solutionId,
      solutionName: solution.name,
      appPort: existingApp?.appPort ?? 0,
      status: existingApp?.status ?? 'stopped',
      isInitialized: existingApp?.isInitialized ?? false,
      sessionId: params.sessionId ?? existingApp?.sessionId,
      location: existingApp?.location ?? appLocation,
      createdAt: existingApp?.createdAt ?? now,
      updatedAt: now,
    };
    await runnerDb.upsertApp(app);

    return { solution, app };
  }

  /**
   * @title 删除 Solution
   * @description 从 Runner 删除指定的 Solution
   * @keywords-cn 删除solution, solution删除, 删除
   * @keywords-en delete-solution, solution-delete, delete
   * @keyword-en delete-solution, solution-delete, delete
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
   * @keyword-en upgrade-solution, solution-upgrade, upgrade
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

    await this.collection.updateOne({ name }, { $set: updated });
    return updated;
  }

  /**
   * @title 搜索 Solution
   * @description 根据条件搜索 Solution
   * @keywords-cn 搜索solution, solution搜索, 搜索
   * @keywords-en search-solution, solution-search, search
   * @keyword-en search-solution, solution-search, search
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
   * @title Build solution detail
   * @description Combines solution metadata with app and unit associations.
   * @keyword-en build-solution-detail, app-unit-detail
   * @keyword-cn 构建Solution详情, 应用单元详情
   */
  private async buildDetail(
    solution: SolutionInfo,
    runnerDb?: RunnerDbService,
  ): Promise<RunnerSolutionDetail> {
    const apps = await this.listAppsBySolutions(
      { solutionIds: [solution.solutionId], names: [solution.name] },
      runnerDb,
    );
    const units = this.listUnitsForSolution(solution);
    return { ...solution, apps, units };
  }

  /**
   * @title Convert runner app association
   * @description Maps runner app management data to a solution-associated app payload.
   * @keyword-en solution-app-normalize, app-association
   * @keyword-cn Solution应用标准化, 应用关联
   */
  private toAppInfo(
    solution: SolutionInfo,
    app: RunnerAppManagement,
  ): RunnerSolutionAppInfo {
    return {
      solutionId: solution.solutionId,
      solutionName: solution.name,
      appId: app.appId,
      name: app.name,
      version: app.version ?? '0.0.0',
      description: app.description ?? '',
      status: app.status,
      isInitialized: app.isInitialized ?? false,
      ...(app.location ? { location: app.location } : {}),
    };
  }

  /**
   * @title List units for one solution
   * @description Reads solution-local unit directories from unit/ and units/ folders.
   * @keyword-en solution-unit-scan, unit-association
   * @keyword-cn Solution单元扫描, 单元关联
   */
  private listUnitsForSolution(
    solution: SolutionInfo,
  ): RunnerSolutionUnitInfo[] {
    const unitRoots = [
      join(solution.location, 'unit'),
      join(solution.location, 'units'),
    ];
    const merged = new Map<string, RunnerSolutionUnitInfo>();
    for (const root of unitRoots) {
      for (const unit of this.listUnitDirectory(solution, root)) {
        merged.set(unit.unitId, unit);
      }
    }
    return Array.from(merged.values());
  }

  /**
   * @title List one unit directory
   * @description Converts a unit root or its child folders into unit association records.
   * @keyword-en unit-directory-scan, solution-unit-list
   * @keyword-cn 单元目录扫描, Solution单元列表
   */
  private listUnitDirectory(
    solution: SolutionInfo,
    root: string,
  ): RunnerSolutionUnitInfo[] {
    if (!existsSync(root)) return [];
    const items: RunnerSolutionUnitInfo[] = [];
    const rootModule = join(root, 'module.md');
    if (existsSync(rootModule)) {
      items.push(this.toUnitInfo(solution, basename(root), root));
    }
    try {
      const children = readdirSync(root, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory()) continue;
        const sourcePath = join(root, child.name);
        items.push(this.toUnitInfo(solution, child.name, sourcePath));
      }
    } catch {
      return items;
    }
    return items;
  }

  /**
   * @title Convert unit association
   * @description Builds a stable solution-associated unit payload.
   * @keyword-en solution-unit-normalize, unit-association
   * @keyword-cn Solution单元标准化, 单元关联
   */
  private toUnitInfo(
    solution: SolutionInfo,
    unitName: string,
    sourcePath: string,
  ): RunnerSolutionUnitInfo {
    return {
      solutionId: solution.solutionId,
      solutionName: solution.name,
      unitId: buildStableId('unit', solution.solutionId, unitName),
      unitName,
      source: 'solution-workspace',
      sourcePath,
    };
  }

  /**
   * @title 获取 Solution 存储目录
   * @description 根据 Solution 名称获取其在 Runner 中的存储目录
   * @keywords-cn solution目录, 存储目录, 路径
   * @keywords-en solution-dir, storage-dir, path
   * @keyword-en solution-dir, storage-dir, path
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

/**
 * @title 构造稳定 Runner 元数据 ID
 * @description 将名称/版本收敛为可重复生成的短 ID，用于 ensure 幂等 upsert。
 * @keyword-en stable-target-id
 */
function buildStableId(prefix: string, ...parts: string[]): string {
  const body = parts
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('-');
  return `${prefix}-${body || 'default'}`.slice(0, 160);
}

/**
 * @title 标准化关键词
 * @description 去空、去重并限制长度，供 Runner App 元数据检索使用。
 * @keyword-en normalize-keywords
 */
function normalizeKeywords(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const value = item.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.slice(0, 50);
}
