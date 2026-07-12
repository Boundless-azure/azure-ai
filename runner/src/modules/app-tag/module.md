# 模块名称 (Module Name)

Runner App 关键词模块 (app-tag)

## 概述 (Overview)

为 code-agent 的**并发代码生成节点**提供每个 app 的**维度化注释关键词词表**。用途: 生成代码时按项目固有格式补**文档注释** (单个 `@keyword` 行, 词按 `维度:词` 标注), 关键词沿**固定的工程向 4 维**构建 —— `功能职责 / 技术栈 / 数据接口 / 依赖关系` (不在集内的归 `其他`)。这就是"限定 tag 维度": 维度受控有限, 维度下的词开放。每个 app 目录顶层存一份 `tags.json` —— 一个**维度分组的对象** `{ 维度: [纯词] }`, 随 app / solution 分发, 不进 Mongo。通过 `runner.app.appTag.{getList,ensure,ensureMany,search}` 四个业务 hook 暴露给 SaaS。找/建都带 **appId** (由 `RunnerDbService.findAppById` 解析出 `app.location`)。因为代码生成**全分散并发**, `ensure`/`ensureMany` 走每 appId 串行化 read-modify-write, 维度经 `canonicalDimension` 归一、按 `(维度, 归一化词)` 去重。只触碰目标 app 的 `tags.json`。`requiredAbility` 复用 `solution` subject。

## 文件清单 (File List)

- `types/app-tag.types.ts` — 维度集 (`KEYWORD_DIMENSIONS` + `canonicalDimension`)、四个 hook 的 Zod payload、词表形状常量。
- `services/app-tag.service.ts` — 按 appId 读写 app 目录 tags.json (维度化对象) 的服务, ensure/ensureMany appId 串行化归一去重。
- `hooks/app-tag.hooks.ts` — 把四个 `runner.app.appTag.*` 业务 hook 注册到 Runner HookBus。

## 函数清单 (Function List)

- `RunnerAppTagService.getList(appId)` — 读某 app 的维度化关键词词表 `{维度:[词]}` (只读, 可并发) | keywords: list-keywords, read-only
- `RunnerAppTagService.ensure(payload)` — 幂等新增一个维度化关键词 (维度归一 + 按(维度,归一化词)去重), 串行化 | keywords: ensure-keyword, idempotent-dedupe
- `RunnerAppTagService.ensureMany(payload)` — 批量把维度化关键词同步进 tags.json (逐条归一维度 + 去重, 只加缺的, 一次落盘) | keywords: ensure-many, keyword-sync
- `RunnerAppTagService.search(payload)` — 词表内按 query 跨维度子串搜, 回命中的 `{维度:[词]}` | keywords: search-keywords, cross-dimension
- `RunnerAppTagService.resolveTagsFile(appId)` — 由 appId 解析 app 目录顶层 tags.json 绝对路径 | keywords: resolve-path, app-locate
- `RunnerAppTagService.readStore(file)` — 读 tags.json 为维度化对象, 缺文件回空, 兼容旧扁平 string[] (归 `其他`) | keywords: read-store, legacy-tolerant
- `RunnerAppTagService.writeStore(file, store)` — 维度化词表写回 tags.json | keywords: write-store, persist
- `RunnerAppTagService.withLock(appId, fn)` — 每 appId 串行化 read-modify-write, 抗并发 | keywords: concurrency-lock, serialize
- `canonicalDimension(raw)` — 把维度前缀归一到 canonical key, 不认识归 `其他` | keywords: canonical-dimension, other-fallback
- `normalizeKeyword(keyword)` — 归一化关键词做去重键 | keywords: normalize-keyword, dedupe-key
- `registerAppTagHooks(hookBus, runnerDb, workspacePath)` — 注册四个 runner.app.appTag.* 业务 hook | keywords: app-tag-hook-register, business-hook

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| 词表文件 | tag-file |
| 关键词维度 | keyword-dimensions |
| 工程4维 | four-facets |
| 维度归一 | canonical-dimension |
| 兜底其他 | other-fallback |
| 词表形状 | keyword-store |
| 维度分组 | dimension-grouped |
| 关键词服务 | app-keyword-service |
| 维度化 | dimensioned |
| 并发原子 | concurrent-atomic |
| 词表列出 | list-keywords |
| 确保关键词 | ensure-keyword |
| 幂等去重 | idempotent-dedupe |
| 批量确保 | ensure-many |
| 关键词同步 | keyword-sync |
| 关键词搜索 | search-keywords |
| 跨维度 | cross-dimension |
| 读词表 | read-store |
| 兼容旧格式 | legacy-tolerant |
| 关键词归一 | normalize-keyword |
| 并发锁 | concurrency-lock |
| 标签hook注册 | app-tag-hook-register |

## 类型导出 (Type Exports)

- `APP_TAG_FILE` — app 目录顶层关键词文件名 (`tags.json`) | keywords: tag-file, app-dir
- `KEYWORD_DIMENSIONS` / `KEYWORD_DIMENSION_KEYS` / `KEYWORD_DIMENSION_OTHER` — 工程向 4 维 (功能职责/技术栈/数据接口/依赖关系) + 别名 + 其他兜底 | keywords: keyword-dimensions, four-facets
- `canonicalDimension(raw)` — 维度前缀归一函数 | keywords: canonical-dimension, other-fallback
- `AppKeywordStore` — tags.json 存储形状 `Record<维度, string[]>` | keywords: keyword-store, dimension-grouped
- `KeywordEntrySchema` / `KeywordEntry` — 关键词条目 `{ dimension?, keyword }` | keywords: keyword-entry, dimension-term
- `GetAppTagListPayloadSchema` / `GetAppTagListPayload` — getList 入参 `{ appId }` | keywords: list-payload, app-id
- `EnsureAppTagPayloadSchema` / `EnsureAppTagPayload` — ensure 入参 `{ appId, dimension?, keyword }` | keywords: ensure-payload, idempotent
- `EnsureManyPayloadSchema` / `EnsureManyPayload` — ensureMany 入参 `{ appId, entries: [{dimension?, keyword}] }` | keywords: ensure-many-payload, keyword-sync
- `SearchAppTagsPayloadSchema` / `SearchAppTagsPayload` — search 入参 `{ appId, query?, limit? }` | keywords: search-payload, fast-search

## 模块功能描述 (Module Function Description)

- `tags.json` 存储形状: **维度分组对象** `{ "功能职责": [...], "技术栈": [...], "数据接口": [...], "依赖关系": [...], "其他": [...] }`。维度受限于工程向 4 维 + 其他。
- Runner hook: `runner.app.appTag.getList`, payload `{ appId }`, 返回 `{ keywords: {维度:[词]} }`。
- Runner hook: `runner.app.appTag.ensure`, payload `{ appId, dimension?, keyword }`, 返回 `{ dimension, keyword, created }`; 维度经 canonicalDimension 归一 (不认识归 `其他`), 按 (维度, 归一化词) 去重。
- Runner hook: `runner.app.appTag.ensureMany`, payload `{ appId, entries: [{dimension?, keyword}] }`, 返回 `{ added, total }`; 构建后由 SaaS 把从文件收集的维度化 `@keyword` 批量同步进 tags.json (归一 + 去重, 只加缺的)。
- Runner hook: `runner.app.appTag.search`, payload `{ appId, query?, limit? }`, 返回 `{ keywords: {维度:[命中词]} }`; query 空回全表。
- 读 hook (`getList`/`search`) requiredAbility = `read solution`; 写 hook (`ensure`/`ensureMany`) = `create solution`。
- 存储位于 `RunnerDbService.findAppById(appId).location` 指向的 app 目录顶层; 相对 location 兜底 join 到 `workspace/`。
- 原子性: `Map<appId, Promise>` 链把同一 app 的 read-modify-write 串行化, 抗全并发写竞态; 跨 app 互不阻塞。
- 兼容: `readStore` 兼容旧的扁平 `string[]` (归到 `其他`)。
- 在 `app.ts` 的 `if (cfg.mongoUri)` 块内, 紧随 `registerCodeAgentPlanHooks` 之后由 `registerAppTagHooks(hookBus, runnerDb, workspacePath)` 注册。
