# 模块名称 (Module Name)

SaaS Solution 模块

## 概述 (Overview)

提供 SaaS 侧 Solution 管理、跨 Runner 聚合检索、批量详情、批量应用列表和批量单元列表能力。HTTP 路由 (`SolutionController`) 与 Hook 声明 (`SolutionHookController`, 单对象 payload) 已解耦, 各自在注册处同址挂载 `@CheckAbility`。

## 文件清单 (File List)

- `entities/solution.entity.ts` — Solution TypeORM 实体。
- `entities/solution-purchase.entity.ts` — Solution 购买记录实体。
- `controllers/solution.controller.ts` — Solution HTTP 入口 (hook 已迁出)。
- `controllers/solution.hook-controller.ts` — Solution Hook 声明层 (单对象 payload)。
- `services/solution.service.ts` — Solution CRUD、Runner hook 聚合与批量关联查询。
- `types/solution.types.ts` — Zod schema、请求类型与响应类型。
- `enums/solution.enums.ts` — Solution 状态、来源、包含内容枚举。

## 函数清单 (Function List)

- `SolutionController.create(body, req)` — 创建本地 Solution 记录 | keywords: create-solution
- `SolutionController.searchRunnerSolutions(body)` — 搜索一个或多个 Runner 上的 Solution 摘要 | keywords: runner-solution-search, batch-runner
- `SolutionController.getBatchDetails(body)` — 批量获取 Solution 详情并包含 apps/units | keywords: batch-solution-detail, app-unit-detail
- `SolutionController.listSolutionApps(body)` — 批量列出 Solution 关联应用 | keywords: solution-app-list, batch-solution-association
- `SolutionController.listSolutionUnits(body)` — 批量列出 Solution 关联单元 | keywords: solution-unit-list, batch-solution-association
- `SolutionController.getById(id)` — 获取本地 Solution 详情 | keywords: get-solution, Solution详情
- `SolutionController.update(id, body, req)` — 更新本地 Solution 记录 | keywords: update-solution
- `SolutionController.delete(id)` — 软删除本地 Solution 记录 | keywords: delete-solution
- `SolutionController.list(query)` — 跨 Runner 聚合 Solution 列表 | keywords: list-solutions
- `SolutionController.listMarketplace(query)` — 返回 marketplace 占位列表 | keywords: list-marketplace
- `SolutionController.install(id, body, req)` — 记录 Solution 安装到指定 Runner | keywords: install-solution
- `SolutionController.uninstall(id, body, req)` — 从指定 Runner 卸载 Solution | keywords: uninstall-solution
- `SolutionController.getPurchases(req)` — 返回购买记录占位列表 | keywords: get-purchases
- `SolutionController.purchase(body, req)` — 创建 Solution 购买记录 | keywords: purchase-solution
- `SolutionController.getRunners()` — 列出可见 Runner | keywords: get-runners
- `SolutionController.getTags()` — 聚合 Solution 标签频次 | keywords: get-tags
- `resolveSolutionUserId(context)` — 从 hook invocationContext 解析用户 id (缺省 system) | keywords: resolve-solution-user-id
- `SolutionHookController.create(payload, _principal, context)` — hook 创建本地 Solution | keywords: create-solution
- `SolutionHookController.searchRunnerSolutions(payload, _principal, _context)` — hook 搜索 Runner Solution 摘要 | keywords: runner-solution-search, batch-runner
- `SolutionHookController.getBatchDetails(payload, _principal, _context)` — hook 批量 Solution 详情 | keywords: batch-solution-detail, app-unit-detail
- `SolutionHookController.listSolutionApps(payload, _principal, _context)` — hook 批量 Solution 应用 | keywords: solution-app-list, batch-solution-association
- `SolutionHookController.listSolutionUnits(payload, _principal, _context)` — hook 批量 Solution 单元 | keywords: solution-unit-list, batch-solution-association
- `SolutionHookController.getById(payload, _principal, _context)` — hook 本地 Solution 详情 | keywords: get-solution
- `SolutionHookController.update(payload, _principal, context)` — hook 更新本地 Solution (id 平铺) | keywords: update-solution
- `SolutionHookController.delete(payload, _principal, _context)` — hook 软删除本地 Solution | keywords: delete-solution
- `SolutionHookController.list(payload, _principal, _context)` — hook 跨 Runner 聚合列表 | keywords: list-solutions
- `SolutionHookController.listMarketplace(payload, _principal, _context)` — hook marketplace 占位列表 | keywords: list-marketplace
- `SolutionHookController.install(payload, _principal, context)` — hook 安装到 Runner (id 平铺) | keywords: install-solution
- `SolutionHookController.uninstall(payload, _principal, context)` — hook 从 Runner 卸载 (id 平铺) | keywords: uninstall-solution
- `SolutionHookController.getPurchases(_principal, context)` — hook 购买记录占位 | keywords: get-purchases
- `SolutionHookController.purchase(payload, _principal, context)` — hook 创建购买记录 | keywords: purchase-solution
- `SolutionHookController.getRunners(_principal, _context)` — hook 列出可见 Runner | keywords: get-runners
- `SolutionHookController.getTags(_principal, _context)` — hook 聚合标签频次 | keywords: get-tags
- `SolutionService.create(userId, data)` — 创建本地 Solution 实体 | keywords: create-solution
- `SolutionService.getById(id)` — 按本地 id 获取 Solution 实体 | keywords: get-solution-by-id
- `SolutionService.update(id, userId, data)` — 更新 Solution 实体 | keywords: update-solution
- `SolutionService.delete(id)` — 软删除 Solution 实体 | keywords: delete-solution
- `SolutionService.list(query)` — 按 runnerId/runnerIds 聚合并分页 Solution | keywords: list-solutions, cross-runner-aggregate, hook-dispatch, in-memory-pagination
- `SolutionService.searchRunnerSolutions(query)` — 搜索一个或多个 Runner 的 Solution 摘要 | keywords: runner-solution-search, batch-runner
- `SolutionService.getDetailsByIds(ids)` — 批量解析 Solution 详情 | keywords: batch-solution-detail, app-unit-detail
- `SolutionService.listAppsBySolutionIds(solutionIds)` — 批量列出 Solution 应用 | keywords: solution-app-list, batch-solution-association
- `SolutionService.listUnitsBySolutionIds(solutionIds)` — 批量列出 Solution 单元 | keywords: solution-unit-list, batch-solution-association
- `SolutionService.listMarketplace(query)` — 返回 marketplace 占位分页 | keywords: list-marketplace-placeholder
- `SolutionService.install(id, runnerIds, userId)` — 更新本地安装 Runner 列表 | keywords: install-solution
- `SolutionService.uninstall(id, runnerIds, userId)` — 卸载本地或 runner 合成 id Solution | keywords: uninstall-solution, dual-id-shape, cross-process-dispatch
- `SolutionService.getTags()` — 统计聚合结果中的标签频次 | keywords: get-tags
- `SolutionService.getRunners()` — 返回 Runner 展示列表 | keywords: get-runners
- `SolutionService.getPurchases(userId)` — 返回购买记录占位数据 | keywords: get-purchases-placeholder
- `SolutionService.purchase(userId, solutionId, solutionName, solutionVersion)` — 写入购买记录 | keywords: purchase-solution
- `SolutionService.listAssociationsBySolutionIds(solutionIds, hookName, normalize)` — 批量调用 Runner 关联 hook | keywords: batch-association-hook, runner-solution-association
- `SolutionService.getOnlineRunners(runnerIds)` — 过滤 mounted Runner | keywords: online-runner-filter, batch-runner
- `SolutionService.mergeRunnerIds(runnerId, runnerIds)` — 合并单数和复数 Runner id | keywords: merge-runner-ids, batch-runner
- `SolutionService.splitSolutionRefs(ids)` — 拆分原生 solutionId 与合成 id | keywords: split-solution-refs, synthetic-solution-id
- `SolutionService.buildAssociationPayload(refs, runnerId)` — 构造 Runner 批量关联 payload | keywords: association-payload, solution-id-list
- `SolutionService.aggregateFromRunners(runnerId, runnerIds)` — 跨 Runner 聚合 Solution 列表 | keywords: cross-runner-aggregate, batch-runner
- `SolutionService.extractSolutionItems(rawResult)` — 从 Runner HookResult 提取 items | keywords: extract-solution-items
- `SolutionService.extractHookData(rawResult)` — 从 Runner HookResult 提取 data | keywords: extract-hook-data, runner-hook-reply
- `SolutionService.normalizeRunnerSolution(raw, runnerId)` — 标准化 Runner Solution 为 SaaS 列表项 | keywords: normalize-runner-solution
- `SolutionService.normalizeRunnerSolutionSearchItem(raw, runnerId)` — 标准化搜索返回项 | keywords: normalize-solution-search, runner-solution-search
- `SolutionService.normalizeRunnerSolutionDetail(raw, runnerId)` — 标准化详情返回项 | keywords: normalize-solution-detail, app-unit-detail
- `SolutionService.normalizeRunnerApp(raw, runnerId, fallbackSolutionId, fallbackSolutionName)` — 标准化应用关联项 | keywords: normalize-solution-app, app-association
- `SolutionService.normalizeRunnerUnit(raw, runnerId, fallbackSolutionId, fallbackSolutionName)` — 标准化单元关联项 | keywords: normalize-solution-unit, unit-association
- `SolutionService.readString(raw, key)` — 安全读取字符串字段 | keywords: read-string-field, payload-normalize

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| Runner方案搜索 | runner-solution-search |
| 批量Runner | batch-runner |
| 批量Solution详情 | batch-solution-detail |
| 应用单元详情 | app-unit-detail |
| Solution应用列表 | solution-app-list |
| Solution单元列表 | solution-unit-list |
| 批量Solution关联 | batch-solution-association |
| 跨Runner聚合 | cross-runner-aggregate |
| 合成Solution标识 | synthetic-solution-id |
| Runner方案关联 | runner-solution-association |
| Solution Hook声明 | solution-hook-controller |
| 单对象payload | single-object-payload |
| 解析用户ID | resolve-solution-user-id |

## 类型导出 (Type Exports)

- `CreateSolutionSchema` — 创建 Solution 请求 schema | keywords: create-solution
- `UpdateSolutionSchema` — 更新 Solution 请求 schema | keywords: update-solution
- `ListSolutionsQuerySchema` — Solution 列表查询 schema | keywords: list-solutions
- `SearchRunnerSolutionsSchema` — Runner Solution 搜索 schema | keywords: runner-solution-search, batch-runner
- `BatchSolutionIdsSchema` — 批量 Solution 详情 id schema | keywords: batch-solution-detail, solution-id-list
- `BatchSolutionAssociationsSchema` — 批量 Solution 关联查询 schema | keywords: batch-solution-association, solution-id-list
- `SolutionResponse` — SaaS Solution 列表响应类型。
- `SolutionSearchItem` — Runner Solution 搜索返回类型。
- `SolutionDetailResponse` — Runner Solution 详情返回类型。
- `SolutionAppListItem` — Solution 应用关联返回类型。
- `SolutionUnitListItem` — Solution 单元关联返回类型。

## 模块功能描述 (Module Function Description)

- SaaS hook: `saas.app.solution.searchRunner`，payload `{ runnerId?, runnerIds?, q?, source?, include? }`，返回 `items[]`，每项包含 `id/runnerId/solutionId/name/version/summary`。
- SaaS hook: `saas.app.solution.getBatch`，payload `{ ids }`，支持合成 id 与 runner 原生 `solutionId`，返回详情 `items[]`。
- SaaS hook: `saas.app.solution.listApps`，payload `{ solutionIds }`，返回 app 关联 `items[]`。
- SaaS hook: `saas.app.solution.listUnits`，payload `{ solutionIds }`，返回 unit 关联 `items[]`。
- 旧 SaaS hook: `saas.app.solution.list` 继续可用，并支持 `runnerId` 或 `runnerIds` 过滤 mounted runners。
- Runner 调用策略: SaaS 只通过 `RunnerHookRpcService.callHook` 调 runner，不直接读 runner 存储。
