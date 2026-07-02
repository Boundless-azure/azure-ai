# 模块名称 (Module Name)

Runner Code-Agent 变更集存储模块 (code-agent-plan)

## 概述 (Overview)

为 SaaS code-agent 的「文件处理分析 / 变更集规划」节点提供专有持久化能力。变更集 (changePlan) 的体积可能很大且需要边生成边局部修改、局部搜索, 系统又是多租户, 因此不能存 SaaS 进程内存; 本模块把它落在**当前 Runner 的 Mongo** 里 (物理按租户隔离), 通过 `runner.app.codeAgentPlan.*` 六个专有业务 hook 暴露给 SaaS。所有 hook 内部走 `RunnerCodeAgentPlanService` 用原生 Mongo `Db` 直接读写, 是底层 `runner.unitcore.mongo.*` 写 hook (`denyLlm:true`) 的合法业务出口 —— 业务 service 直接用 Db 不受 denyLlm 限制。一切读写按 `planId` 作用域, 且只触碰 `code_agent_plans` / `code_agent_change_tasks` / `code_agent_plan_todos` 三个集合, 不能用来改其它业务数据。`requiredAbility` 复用 `solution` subject, 与 code-agent 既有权限对齐。

## 文件清单 (File List)

- `types/code-agent-plan.types.ts` — 变更集存储的 Zod payload schema、文档存储形状与常量 (集合名/命名前缀/枚举)。
- `services/code-agent-plan.service.ts` — 变更集三集合的 planId 作用域 CRUD 服务, 原生 Db 直读写。
- `hooks/code-agent-plan.hooks.ts` — 把六个 `runner.app.codeAgentPlan.*` 业务 hook 注册到 Runner HookBus。

## 函数清单 (Function List)

- `RunnerCodeAgentPlanService.ensurePlan(payload)` — 幂等创建/读取计划元数据文档 | keywords: ensure-plan, idempotent
- `RunnerCodeAgentPlanService.upsertTasks(payload)` — 批量 merge-upsert 变更任务节点 (按 planId+taskId) | keywords: upsert-tasks, partial-upsert
- `RunnerCodeAgentPlanService.searchTasks(payload)` — 计划内按 taskIds/routeId/hookName 局部搜索任务 | keywords: search-tasks, local-search
- `RunnerCodeAgentPlanService.upsertTodos(payload)` — 批量 merge-upsert 规划 todo (新增与改状态共用) | keywords: upsert-todos, state-machine
- `RunnerCodeAgentPlanService.listTodos(payload)` — 按状态过滤列出某计划的 todo, 驱动外循环 | keywords: list-todos, status-filter
- `RunnerCodeAgentPlanService.getSnapshot(payload)` — 读取计划元数据 + 计数 (任务数/开放 todo 数) 供完成判定 | keywords: plan-snapshot, completion-check
- `RunnerCodeAgentPlanService.fallbackPlan(payload, now)` — ensurePlan 读回失败时的内存兜底文档 | keywords: plan-fallback, shape-guarantee
- `stripUndefined(value)` — 删除对象里值为 undefined 的键, 避免 $set 覆盖为 undefined | keywords: strip-undefined, mongo-set
- `registerCodeAgentPlanHooks(hookBus, mongoClient)` — 注册六个 runner.app.codeAgentPlan.* 业务 hook | keywords: change-plan-hook-register, dedicated-business-hook

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| 变更集命名空间 | change-plan-namespace |
| hook前缀 | hook-prefix |
| 集合名 | collection-names |
| 变更集存储 | change-plan-store |
| 变更操作 | change-op |
| 新增 | create-only |
| todo状态 | todo-status |
| 状态机 | state-machine |
| 计划状态 | plan-status |
| hook契约 | hook-contract |
| 依赖边 | dependency-edge |
| 变更任务 | change-task |
| 局部更新 | partial-upsert |
| todo写入 | todo-input |
| 确保计划 | ensure-plan |
| 幂等 | idempotent |
| 任务批量写 | upsert-tasks |
| 任务搜索 | search-tasks |
| 局部搜索 | local-search |
| todo批量写 | upsert-todos |
| todo列表 | list-todos |
| 状态过滤 | status-filter |
| 计划快照 | plan-snapshot |
| 完成判定 | completion-check |
| 变更集服务 | change-plan-service |
| 专有存储 | dedicated-store |
| planId作用域 | plan-scoped |
| 变更集hook注册 | change-plan-hook-register |
| 专有业务hook | dedicated-business-hook |
| 计划兜底 | plan-fallback |

## 类型导出 (Type Exports)

- `CODE_AGENT_PLAN_HOOK_PREFIX` — 变更集 hook 公共前缀 runner.app.codeAgentPlan | keywords: change-plan-namespace, hook-prefix
- `CODE_AGENT_PLAN_COLLECTIONS` — 三个专有集合名常量 | keywords: collection-names, change-plan-store
- `CHANGE_TASK_OPS` / `ChangeTaskOp` — 变更操作枚举 (当前仅 create) | keywords: change-op, create-only
- `PLAN_TODO_STATUS` / `PlanTodoStatus` — todo 状态机枚举 | keywords: todo-status, state-machine
- `PLAN_STATUS` / `PlanStatus` — 计划推进状态枚举 | keywords: plan-status, lifecycle-status
- `HookContractSchema` / `HookContract` — 单个 hook 契约形状 (签名 + 出边) | keywords: hook-contract, dependency-edge
- `ChangeTaskInputSchema` / `ChangeTaskInput` — 变更任务写入形状 (含 `dependsOn` 粗粒度兄弟 taskId 依赖, 供拓扑排序) | keywords: change-task, partial-upsert
- `PlanTodoInputSchema` / `PlanTodoInput` — 规划 todo 写入形状 | keywords: todo-input, partial-upsert
- `EnsurePlanPayloadSchema` / `EnsurePlanPayload` — ensurePlan 入参 | keywords: ensure-plan, plan-payload
- `UpsertTasksPayloadSchema` / `UpsertTasksPayload` — upsertTasks 入参 | keywords: upsert-tasks, change-plan
- `SearchTasksPayloadSchema` / `SearchTasksPayload` — searchTasks 入参 | keywords: search-tasks, local-search
- `UpsertTodosPayloadSchema` / `UpsertTodosPayload` — upsertTodos 入参 | keywords: upsert-todos, state-machine
- `ListTodosPayloadSchema` / `ListTodosPayload` — listTodos 入参 | keywords: list-todos, status-filter
- `GetSnapshotPayloadSchema` / `GetSnapshotPayload` — getSnapshot 入参 | keywords: plan-snapshot, completion-check
- `CodeAgentPlanDoc` — 计划元数据文档存储形状 | keywords: plan-doc, stored-shape
- `CodeAgentChangeTaskDoc` — 变更任务文档存储形状 | keywords: task-doc, stored-shape
- `CodeAgentPlanTodoDoc` — 规划 todo 文档存储形状 | keywords: todo-doc, stored-shape
- `CodeAgentPlanSnapshot` — getSnapshot 返回 (元数据 + 计数) | keywords: snapshot-result, counts

## 模块功能描述 (Module Function Description)

- Runner hook: `runner.app.codeAgentPlan.ensurePlan`, payload `{ planId, sessionId?, runnerId?, requirement?, solutionIds?, status? }`, 幂等创建/读取计划元数据。
- Runner hook: `runner.app.codeAgentPlan.upsertTasks`, payload `{ planId, tasks:[ChangeTaskInput] }`, 批量 merge-upsert 变更任务节点。
- Runner hook: `runner.app.codeAgentPlan.searchTasks`, payload `{ planId, taskIds?, routeId?, hookName?, limit? }`, 返回 `{ items }` 任务切片。
- Runner hook: `runner.app.codeAgentPlan.upsertTodos`, payload `{ planId, todos:[PlanTodoInput] }`, 批量 merge-upsert todo。
- Runner hook: `runner.app.codeAgentPlan.listTodos`, payload `{ planId, status?, limit? }`, 返回 `{ items }` todo 列表。
- Runner hook: `runner.app.codeAgentPlan.getSnapshot`, payload `{ planId }`, 返回 `{ plan, totalTasks, openTodos, doneTodos }`。
- 写 hook (`ensurePlan`/`upsertTasks`/`upsertTodos`) requiredAbility = `create solution`; 读 hook (`searchTasks`/`listTodos`/`getSnapshot`) = `read solution`。
- 三集合存储形状: `code_agent_plans` (计划元数据)、`code_agent_change_tasks` (变更任务 = 文件 + 它声明的 hook 契约 + calls/compatibleWith 出边 + `dependsOn` 粗粒度兄弟 taskId 依赖)、`code_agent_plan_todos` (规划 todo)。
- 写操作均 merge-upsert ($set 仅覆盖提供的字段, $setOnInsert 落 createdAt), 支持边生成边局部修改; 读操作只回切片, 避免把整份大计划拉进 SaaS 上下文。
- 当前阶段 changeTask 只支持 `op:'create'` (新增); modify/delete 后续接入。
- 在 `app.ts` 的 `if (cfg.mongoUri)` 块内, 紧随 `registerSolutionHooks` / `registerDataTouchpointHooks` 之后由 `registerCodeAgentPlanHooks(hookBus, mongoClient)` 注册。
