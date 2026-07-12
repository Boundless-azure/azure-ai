# 模块名称 (Module Name)

Runner Code-Agent 生成文件工具模块 (code-agent-fs)

## 概述 (Overview)

给 SaaS code-agent 的**并发代码节点**提供 **plan 作用域**的文件读写/搜索能力, 通过 `runner.app.codeAgentFs.{writeTaskFile,readFile,grep,fastSearch}` 四个业务 hook 暴露。核心约束两条:
1. **写只认权威 path** —— `writeTaskFile` 按 `planId+taskId` 从 plan 里取该 task 存的 `path` 落盘, **path 不由 LLM 提供**, 强制"生成只填已规划的文件, 不即兴造文件"(要造新文件回 change-plan 加 task)。
2. **读/搜围栏在目标根内** —— `readFile`/`grep`/`fastSearch` 只在该 plan 的目标根 (`solutions/<sol>/apps|units|data/<name>`, 从 plan 全部 task 路径推导) 内活动, 一律防 `..`/越界。

task 路径与目标根都经 `RunnerCodeAgentPlanService.searchTasks` 解析 —— **计划三集合仍归 plan store 独占, 本模块只读它、只写 workspace 文件**。`requiredAbility` 复用 `solution` subject。文件级完成判定 (Astro 校验) 与 todo 状态由 SaaS 完成流水线负责, 本模块不碰 todo。

## 文件清单 (File List)

- `types/code-agent-fs.types.ts` — 各 hook 的 Zod payload、grep/tag 命中形状、遍历/结果/rg 上限常量。
- `services/code-agent-fs.service.ts` — plan 作用域文件读写/搜索服务, 权威 path 写 + 目标根围栏 + 有界遍历 + 内置 ripgrep 按 tag 反查。
- `hooks/code-agent-fs.hooks.ts` — 把 `runner.app.codeAgentFs.*` 业务 hook 注册到 Runner HookBus。
- `ripgrep.d.ts` — `@vscode/ripgrep` 最小类型声明 (`rgPath`/`rgVersion`), 内置 rg 二进制路径。

## 函数清单 (Function List)

- `RunnerCodeAgentFsService.writeTaskFile(payload)` — 写某 task 已规划的文件 (path 取自 task, 非 LLM) | keywords: write-task-file, authoritative-path
- `RunnerCodeAgentFsService.editFile(payload)` — **按行号区间**修改某 task 已规划的文件 (1-based startLine..endLine 含端点替成 newText, 空串=删行; 行号越界/区间反/重叠即抛, 原子全成才落盘); 行号天然唯一→根除"子串不唯一"; 供 build-test 返修 / op:modify | keywords: edit-file, line-edit
- `RunnerCodeAgentFsService.readFile(payload)` — 读 plan 目标根内一个文件; 可选 1-based startLine/endLine **按行号窗口只读一段** (大文件避免整份); 回 `{path, content, startLine, totalLines}` | keywords: read-file, line-window
- `RunnerCodeAgentFsService.grep(payload)` — 目标根内正则搜内容, 回命中行 (bounded) | keywords: grep-search, content-search
- `RunnerCodeAgentFsService.fastSearch(payload)` — 目标根内按文件名子串快速找文件 | keywords: fast-search, filename-search
- `RunnerCodeAgentFsService.searchByTag(payload)` — **第一层 搜注释**: 内置 ripgrep 在 path (目标根内) 下按注释 @keyword tag 反查关联文件 + 展开注释节点; tag 须在 tags.json 已声明否则回可用词表 (先声明后搜、不编造) | keywords: search-by-tag, reverse-lookup
- `RunnerCodeAgentFsService.readNode(payload)` — **第二层 读代码**: 给定 search_by_tag 命中的 line, 读它标注的整个符号代码体 (注释块起→下一个 @keyword 注释前/EOF), 回 `{path,content,startLine,endLine,totalLines}` 直接喂 edit_file | keywords: read-node, node-body
- `commentBlockStart(lines, idx)` — 从某行向上找所属注释块起始行 (块注释/HTML opener, 否则连续行注释顶) | keywords: comment-block-start, read-node
- `RunnerCodeAgentFsService.readTagsStore(rootAbs)` — 读目标根顶层 tags.json 为维度化词表 {维度:[词]}, 缺文件回空、兼容旧扁平 string[] | keywords: read-tags-store, legacy-tolerant
- `RunnerCodeAgentFsService.runRipgrep(dirAbs, tag, cap)` — 用内置 rgPath 定位含 tag 的 @keyword 注释行 (bounded + 超时), rg 出错回空不抛 | keywords: ripgrep-locate, keyword-line-hit
- `RunnerCodeAgentFsService.verifyTasks(payload)` — 按 changePlan 校验每个 task 文件是否已落盘 (存在且非空), 回 present/missing | keywords: verify-tasks, missing-files
- `RunnerCodeAgentFsService.collectKeywords(payload)` — 扫 plan 全部文件注释收集**维度化** @keyword 条目, 按 appId 分组 (去重/归一在 appTag 侧) | keywords: collect-keywords, comment-scan
- `RunnerCodeAgentFsService.runCommand(payload)` — 在某 app 目录 (cwd 围栏) 跑终端命令 (脚手架/装依赖), 有界超时 | keywords: run-command, project-init
- `RunnerCodeAgentFsService.resolveAppDir(planId, appId?)` — 由 planId(+appId) 解析 app 目录绝对路径 (围栏在 workspace) | keywords: resolve-app-dir, init-cwd
- `RunnerCodeAgentFsService.checkInitLock(payload)` — 查 app 目录有没有 init.lock, 回 { initialized } (通用初始化判定, 不绑技术栈) | keywords: check-init-lock, app-initialized
- `RunnerCodeAgentFsService.writeInitLock(payload)` — 写 init.lock 标记该 app 已初始化 | keywords: write-init-lock, mark-initialized
- `extractKeywordEntries(content)` — 抽注释 @keyword 的 `维度:词` 条目 (无维度 undefined; 兼容旧 -cn/-en), 每行截维度上限、去前导 @ | keywords: extract-keywords, dimension-parse
- `extractCommentNode(content, lineNo)` — 把某命中行所属的整个注释节点展开出来 (JSDoc/块注释、HTML/Astro/Vue、连续行注释) + 附被注释声明片段, 有界; searchByTag 用它取"关联注释节点" | keywords: extract-comment-node, comment-style-agnostic
- `execCommand(command, cwd, timeoutMs)` — 在 cwd 跑 shell 命令 (有界超时+输出截断, 超时 SIGKILL), 不 reject; **PATH 注入内置 rg 目录** (`RG_DIR`), 让终端也能直接 `rg` | keywords: exec-command, child-process
- `RunnerCodeAgentFsService.allowedRoots(planId)` — 目标根围栏集: 全部 task 路径推导的根 **并上** 计划声明的 scopeRoots (`planService.getScopeRoots`); 后者让规划前无 task 时也能围栏到既有目标 (修"roots 空→全越界") | keywords: target-roots, fence-roots
- `RunnerCodeAgentFsService.walkFiles(roots)` — 递归有界遍历目标根 (跳 node_modules 等) | keywords: walk-files, bounded
- `RunnerCodeAgentFsService.readTextSafe(abs)` — 读文本文件, 跳二进制/超大 | keywords: read-text-safe, skip-binary
- `RunnerCodeAgentFsService.resolveInsideWorkspace(relPath)` — workspace 内解析 + 防越界 | keywords: resolve-in-workspace, no-escape
- `RunnerCodeAgentFsService.resolveInsideRoots(relPath, roots)` — 解析并要求落在目标根内 | keywords: resolve-in-roots, scope-fence
- `RunnerCodeAgentFsService.toRel(abs)` — 绝对路径转 workspace 相对 (正斜杠) | keywords: workspace-relative, path-normalize
- `targetRoot(relPath)` — 从 task 路径提取 solutions/<sol>/apps|units|data/<name> 根 | keywords: target-root-extract, path-segments
- `registerCodeAgentFsHooks(hookBus, mongoClient, workspacePath)` — 注册 runner.app.codeAgentFs.* hooks; 注册时先 `ensureWorkspacePnpmStore` 固定 pnpm store | keywords: code-agent-fs-hook-register, business-hook
- `ensureWorkspacePnpmStore(workspacePath)` — 在 workspace 根写 `.npmrc` 把 pnpm `store-dir` 钉到 `<workspace>/.pnpm-store` (与各 app node_modules 同卷→硬链接生效、共享一份 store、装依赖极快; 不同版本各存不冲突); 已配则不动, 失败不致命 | keywords: pin-pnpm-store, hardlink-same-volume

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| 遍历上限 | walk-limit |
| 结果上限 | result-limit |
| 写任务文件 | write-task-file |
| 权威路径 | authoritative-path |
| 读文件 | read-file |
| 编辑文件 | edit-file |
| 按行编辑 | line-edit |
| 行号窗口 | line-window |
| 读节点 | read-node |
| 注释代码体 | node-body |
| 注释块起始 | comment-block-start |
| 作用域围栏 | scope-fence |
| grep搜索 | grep-search |
| 内容搜索 | content-search |
| 快速搜索 | fast-search |
| 文件名搜索 | filename-search |
| 按标签反查 | search-by-tag |
| 反查关联文件 | reverse-lookup |
| 标签命中 | tag-hit |
| 注释节点 | comment-node |
| 注释节点展开 | extract-comment-node |
| 跨注释风格 | comment-style-agnostic |
| 读词表 | read-tags-store |
| 兼容旧格式 | legacy-tolerant |
| ripgrep定位 | ripgrep-locate |
| 关键词行命中 | keyword-line-hit |
| 门控引导 | gate-guidance |
| ripgrep声明 | ripgrep-declaration |
| 目标根 | target-roots |
| 围栏根集 | fence-roots |
| 文件遍历 | walk-files |
| 有界 | bounded |
| 安全读文本 | read-text-safe |
| 跳二进制 | skip-binary |
| 工作区内解析 | resolve-in-workspace |
| 防越界 | no-escape |
| 目标根内解析 | resolve-in-roots |
| 工作区相对 | workspace-relative |
| 目标根提取 | target-root-extract |
| 生成文件hook注册 | code-agent-fs-hook-register |
| 业务hook | business-hook |

## 类型导出 (Type Exports)

- `CODE_AGENT_FS_LIMITS` — 遍历/结果/文件大小上限常量 | keywords: walk-limit, result-limit
- `WriteTaskFilePayloadSchema` / `WriteTaskFilePayload` — writeTaskFile 入参 `{ planId, taskId, content }` | keywords: write-task-file-payload, authoritative-path
- `EditFilePayloadSchema` / `EditFilePayload` — editFile 入参 `{ planId, taskId, edits:[{startLine,endLine,newText}] }` (1-based 行号区间替换) | keywords: edit-file-payload, line-edit
- `ReadFilePayloadSchema` / `ReadFilePayload` — readFile 入参 `{ planId, path, startLine?, endLine? }` (行号窗口) | keywords: read-file-payload, line-window
- `ReadNodePayloadSchema` / `ReadNodePayload` — readNode 入参 `{ planId, path, line }` (第二层读注释节点代码体) | keywords: read-node-payload, node-body
- `ReadNodeResult` — readNode 结果 `{ path, content, startLine, endLine, totalLines }` (符号体行号区间+原文) | keywords: read-node-result, node-body
- `GrepPayloadSchema` / `GrepPayload` — grep 入参 `{ planId, pattern, flags?, maxResults? }` | keywords: grep-payload, content-search
- `FastSearchPayloadSchema` / `FastSearchPayload` — fastSearch 入参 `{ planId, query, maxResults? }` | keywords: fast-search-payload, filename-search
- `SearchByTagPayloadSchema` / `SearchByTagPayload` — searchByTag 入参 `{ planId, path, tag, maxResults? }` | keywords: search-by-tag-payload, reverse-lookup
- `TagHit` — 一条 tag 关联命中 `{ path, line, node }` (node = 展开的整个注释节点) | keywords: tag-hit, comment-node
- `SearchByTagResult` — searchByTag 结果 `{ tag, declared, message?, availableTags?, hits? }` | keywords: search-by-tag-result, gate-guidance
- `GrepMatch` — 单条内容命中 `{ path, line, text }` | keywords: grep-match, content-hit
- `VerifyTasksPayloadSchema` / `VerifyTasksPayload` — verifyTasks 入参 `{ planId }` | keywords: verify-payload, materialize-check
- `VerifyTasksResult` — 落盘校验结果 `{ present: string[], missing: [{taskId, path}] }` | keywords: verify-result, missing-files
- `CollectKeywordsPayloadSchema` / `CollectKeywordsPayload` — collectKeywords 入参 `{ planId }` | keywords: collect-payload, keyword-collect
- `CollectKeywordsResult` — 按 appId 分组的维度化条目 `{ byApp: Record<appId, [{dimension?, keyword}]> }` | keywords: collect-result, dimension-entries
- `RunCommandPayloadSchema` / `RunCommandPayload` — runCommand 入参 `{ planId, appId?, command, timeoutMs? }` | keywords: run-command-payload, project-init
- `RunCommandResult` — 命令结果 `{ exitCode, stdout, stderr, timedOut, cwd }` | keywords: command-result, terminal-output
- `InitLockPayloadSchema` / `InitLockPayload` — checkInitLock/writeInitLock 入参 `{ planId, appId? }` | keywords: init-lock-payload, app-initialized

## 模块功能描述 (Module Function Description)

- Runner hook: `runner.app.codeAgentFs.writeTaskFile`, payload `{ planId, taskId, content }`, 返回 `{ path, bytes }`; path 取自 task, task 不存在即拒 (逼回 change-plan)。
- Runner hook: `runner.app.codeAgentFs.editFile`, payload `{ planId, taskId, edits:[{startLine,endLine,newText}] }`, 返回 `{ path, bytes, applied, content }`; **按 1-based 行号区间**替换 (含端点, 空 newText 删行), 从后往前应用避免行号漂移、原子; 行号取自 readFile 带行号输出→唯一; requiredAbility = `update solution`。
- Runner hook: `runner.app.codeAgentFs.readFile`, payload `{ planId, path, startLine?, endLine? }`, 返回 `{ path, content, startLine, totalLines }`; path 须在 plan 目标根内; 给 startLine/endLine 只回该行号窗口 (大文件按窗口读)。
- Runner hook: `runner.app.codeAgentFs.grep`, payload `{ planId, pattern, flags?, maxResults? }`, 返回 `{ matches: [{path,line,text}] }`; 有界遍历 + 命中数封顶。
- Runner hook: `runner.app.codeAgentFs.fastSearch`, payload `{ planId, query, maxResults? }`, 返回 `{ files: [path] }`; 文件名子串命中。
- Runner hook: `runner.app.codeAgentFs.searchByTag`, payload `{ planId, path, tag, maxResults? }`, 返回 `{ tag, declared, hits?: [{path,line,node}], message?, availableTags? }`; **第一层 搜注释**: 内置 ripgrep 在 `path` (plan 目标根内, `resolveInsideRoots` 围栏) 下按注释 `@keyword` 反查带 `tag` 的文件, `extractCommentNode` 展开每处**整个注释节点**。**门控**: `tag` 须在该目标根 `tags.json` 已声明否则 `declared:false` + `availableTags`。requiredAbility = `read solution`。
- Runner hook: `runner.app.codeAgentFs.readNode`, payload `{ planId, path, line }`, 返回 `{ path, content, startLine, endLine, totalLines }`; **第二层 读代码**: 给定 searchByTag 命中的 `line`, 读它标注的整个符号代码体 —— 从该注释块起截到**下一个 @keyword 注释块之前** (或 EOF, B 机制); 回 1-based 行号区间直接喂 editFile。requiredAbility = `read solution`。
- Runner hook: `runner.app.codeAgentFs.verifyTasks`, payload `{ planId }`, 返回 `{ present: [taskId], missing: [{taskId,path}] }`; 逐 task 校验文件存在且非空, 供 SaaS build-verify/repair 判断断链。
- Runner hook: `runner.app.codeAgentFs.collectKeywords`, payload `{ planId }`, 返回 `{ byApp: {appId: [{dimension?, keyword}]} }`; 扫全部文件注释收集**维度化** `@keyword` (`维度:词`, 兼容旧 `-cn/-en`)、每行截 `maxKeywordsPerLine(5)`、去前导 @、按 appId 分组 (维度归一/去重由 appTag.ensureMany 做), 供 SaaS 逐 app 同步进 tags.json。
- Runner hook: `runner.app.codeAgentFs.runCommand`, payload `{ planId, appId?, command, timeoutMs? }`, 返回 `{ exitCode, stdout, stderr, timedOut, cwd }`; **cwd 围栏**到该 app 目录 (`resolveAppDir`: appId 精确匹配 task.targetId → 不中按 app 名匹配目标根 → 单 app 直接用唯一目标根, **不因 id/name 约定不一致就硬挂**; 不存在则 mkdir)、有界超时 (默认 5min)、输出截断、**无用户通知**。供 SaaS project-init 节点的 run_terminal 工具跑脚手架/装依赖。requiredAbility = `create solution`。
- Runner hook: `runner.app.codeAgentFs.checkInitLock`, payload `{ planId, appId? }`, 返回 `{ initialized }`; 查 app 目录顶层有没有 `init.lock` —— **通用的"是否已初始化"判定** (不依赖 package.json/技术栈), 供 change-plan 的 decideInitTargets 用。read solution。
- Runner hook: `runner.app.codeAgentFs.writeInitLock`, payload `{ planId, appId? }`, 写 `init.lock` 标记该 app 已初始化; project-init 成功后调。create solution。
- 写 hook (`writeTaskFile`) requiredAbility = `create solution`; 读 hook (`readFile`/`grep`/`fastSearch`) = `read solution`。
- 围栏: `resolveInsideWorkspace` 防路径逃出 workspace; `resolveInsideRoots` 再要求落在 `allowedRoots` (plan 目标根) 内; 二进制/超大文件在遍历时跳过, 遍历/命中均有上限。
- 在 `app.ts` 的 `if (cfg.mongoUri)` 块内, 紧随 `registerAppTagHooks` 之后由 `registerCodeAgentFsHooks(hookBus, mongoClient, workspacePath)` 注册。
