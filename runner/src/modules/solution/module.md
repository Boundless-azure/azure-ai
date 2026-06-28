# 模块名称 (Module Name)

Runner Solution 模块

## 概述 (Overview)

提供 Runner 本地 Solution 的安装、删除、升级、搜索、详情、应用关联和单元关联能力。Solution 元数据只存储在 Mongo `solutions` collection，不再写入 workspace 下的 `solution.json` 镜像文件。核心能力通过 4 段命名空间 HookBus hook 暴露给 SaaS，hook 名均包含模块目录名 `solution` 并声明 requiredAbility。

## 文件清单 (File List)

- `types/solution.types.ts` — Solution 类型、Zod schema、详情/app/unit 关联返回结构。
- `services/solution.service.ts` — Mongo 与 workspace 文件系统上的 Solution 管理逻辑。
- `routes/solution.routes.ts` — Runner 本地 HTTP API。
- `hooks/solution.hooks.ts` — Runner Solution HookBus 注册。

## 函数清单 (Function List)

- `RunnerSolutionService.list()` — 列出已安装 Solution | keywords: get-solutions, installed-solutions, solution-list
- `RunnerSolutionService.getByName(name)` — 按名称获取 Solution 详情 | keywords: get-solution-detail, solution-detail, detail-query
- `RunnerSolutionService.getById(solutionId)` — 按稳定 solutionId 获取 Solution | keywords: get-solution-by-id, solution-identity
- `RunnerSolutionService.getByIdentity(identity)` — 按 solutionId 或 name 解析单个 Solution | keywords: get-solution-by-identity, solution-detail
- `RunnerSolutionService.listByIdentity(identity)` — 按批量 id/name 过滤 Solution | keywords: batch-solution-filter, solution-list
- `RunnerSolutionService.getDetail(identity, runnerDb)` — 返回包含 apps/units 的 Solution 详情 | keywords: solution-detail, app-unit-detail
- `RunnerSolutionService.listAppsBySolutions(identity, runnerDb)` — 列出选中 Solution 的应用 | keywords: solution-app-list, app-association
- `RunnerSolutionService.listUnitsBySolutions(identity)` — 列出选中 Solution 的本地单元 | keywords: solution-unit-list, unit-association
- `RunnerSolutionService.install(params)` — 安装 Solution 并写入 Mongo 源表 | keywords: install-solution, solution-install, install
- `RunnerSolutionService.upsertMetadata(params)` — 在真实 `solutions` collection 中创建或更新 Solution 元数据 | keywords: solution-upsert, solution-metadata
- `RunnerSolutionService.ensureDefaultLightweightSolution()` — 确保内置默认展示 Solution 存在 | keywords: default-lightweight-solution, view-solution, runner-bootstrap
- `RunnerSolutionService.ensureTarget(params, runnerDb)` — 确保 code-agent 目标 Solution/App 元数据存在 | keywords: ensure-target, solution-create, app-create
- `RunnerSolutionService.delete(name)` — 删除 Solution 目录与 Mongo 记录 | keywords: delete-solution, solution-delete, delete
- `RunnerSolutionService.upgrade(name, sourceUrl)` — 升级已安装 Solution | keywords: upgrade-solution, solution-upgrade, upgrade
- `RunnerSolutionService.search(query)` — 按 q/source/include 搜索 Solution | keywords: search-solution, solution-search, search
- `RunnerSolutionService.buildDetail(solution, runnerDb)` — 组合 Solution、apps、units 详情 | keywords: build-solution-detail, app-unit-detail
- `RunnerSolutionService.toAppInfo(solution, app)` — 标准化应用关联返回项 | keywords: solution-app-normalize, app-association
- `RunnerSolutionService.listUnitsForSolution(solution)` — 扫描单个 Solution 的本地 unit/units 目录 | keywords: solution-unit-scan, unit-association
- `RunnerSolutionService.listUnitDirectory(solution, root)` — 将 unit 根目录或子目录转换为单元记录 | keywords: unit-directory-scan, solution-unit-list
- `RunnerSolutionService.toUnitInfo(solution, unitName, sourcePath)` — 标准化单元关联返回项 | keywords: solution-unit-normalize, unit-association
- `RunnerSolutionService.getSolutionDir(name)` — 获取 workspace/solutions 下的 Solution 目录 | keywords: solution-dir, storage-dir, path
- `buildStableId(prefix, ...parts)` — 构造稳定元数据 id | keywords: stable-target-id
- `normalizeKeywords(input)` — 标准化关键词数组 | keywords: normalize-keywords
- `registerSolutionHooks(hookBus, mongoClient, runnerDb)` — 注册 Runner Solution hooks | keywords: register-solution-hooks

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| Solution标识 | solution-identity |
| 批量Solution标识 | batch-solution-identity |
| Solution详情 | solution-detail |
| 应用单元详情 | app-unit-detail |
| Solution应用列表 | solution-app-list |
| 应用关联 | app-association |
| Solution单元列表 | solution-unit-list |
| 单元关联 | unit-association |
| Solution单元扫描 | solution-unit-scan |
| Solution更新 | solution-upsert |
| Solution元数据 | solution-metadata |
| Runner本地数据 | runner-local-data |

## 类型导出 (Type Exports)

- `SolutionIncludeEnum` — Solution 包含类型枚举 schema | keywords: solution-include, solution-type, app, unit, workflow, agent
- `SolutionSourceEnum` — Solution 来源枚举 schema | keywords: solution-source, self-developed, marketplace
- `SolutionInfo` — Runner Solution 基础信息类型 | keywords: solution-info, solution-structure, solution-detail
- `SolutionIdentitySchema` — 单个 Solution 标识 schema | keywords: solution-identity, solution-detail
- `BatchSolutionIdentitySchema` — 批量 Solution 标识 schema | keywords: batch-solution-identity, solution-list
- `RunnerSolutionAppInfo` — Runner Solution 应用关联类型 | keywords: solution-app-list, app-association
- `RunnerSolutionUnitInfo` — Runner Solution 单元关联类型 | keywords: solution-unit-list, unit-association
- `RunnerSolutionDetail` — 包含 apps/units 的详情类型 | keywords: solution-detail, app-unit-detail
- `InstallSolutionSchema` — Solution 安装请求 schema | keywords: solution-install, install-request, install-params
- `UpsertSolutionMetadataSchema` — Solution 元数据创建或更新 schema | keywords: solution-upsert, solution-metadata
- `EnsureSolutionTargetSchema` — code-agent 目标确保 schema | keywords: ensure-target, solution-create, app-create
- `SearchSolutionSchema` — Solution 搜索 schema | keywords: solution-search, search-query, query-params
- `ListSolutionSchema` — Solution 列表 schema | keywords: solution-list, list-query, pagination

## 模块功能描述 (Module Function Description)

- Runner hook: `runner.app.solution.list`，payload `{ source? }`，返回当前 Runner 已安装 Solution。
- Runner hook: `runner.app.solution.search`，payload `{ q?, source?, include? }`，返回搜索结果。
- Runner hook: `runner.app.solution.get`，payload `{ solutionId? , name? }`，返回包含 `apps` 和 `units` 的详情。
- Runner hook: `runner.app.solution.listApps`，payload `{ solutionId?, solutionIds?, name?, names? }`，返回 app 关联列表。
- Runner hook: `runner.app.solution.listUnits`，payload `{ solutionId?, solutionIds?, name?, names? }`，返回 solution-local unit 关联列表。
- Runner hook: `runner.app.solution.ensureTarget`，payload `{ solutionName, appName?, runnerId? }`，确保 code-agent 目标元数据存在。
- Runner hook: `runner.app.solution.delete`，payload `{ name }`，删除本地 Solution。
- Runner 本地 Solution 的唯一源表是 Mongo `solutions` collection；不再向 `runner_solutions` 投影表双写，也不再向 workspace 写 `solution.json` 镜像文件。
- App 关联来自 `runner_apps`；unit 关联只扫描 Solution 目录下的 `unit/` 或 `units/`，不把全局 `workspace/unit` 默认归属到每个 Solution。
