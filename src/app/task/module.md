模块名称：app/task（任务模块）

概述
- 管理任务基础信息（名称、描述、关联人、里程碑、PM、关联文件夹路径、所属会话）。
- 提供任务增删改查接口，支持按会话、PM、关联人、关键字过滤。
- 任务详情页可基于 folderPath 关联资源库文件夹，并通过 sessionId 与会话上下文关联。

文件清单（File List）
- app/task/entities/task.entity.ts
- app/task/types/task.types.ts
- app/task/services/task.service.ts
- app/task/controllers/task.controller.ts
- app/task/controllers/task.hook-controller.ts
- app/task/task.module.ts

函数清单（Function Index）
- TaskService
  - list(query) — 查询任务列表，支持 sessionId/pmId/assigneeId/q 过滤 | keywords: task-list, task-filter, task-query
  - get(id) — 查询单个任务详情 | keywords: task-get, task-detail
  - create(dto) — 创建任务并持久化 | keywords: task-create, task-write
  - update(id, dto) — 更新任务可变字段 | keywords: task-update, task-write
  - delete(id) — 软删除任务 | keywords: task-delete, task-soft-delete
- TaskController
  - GET /task — 任务列表查询 | keywords: task-list, task-controller, task-query
  - GET /task/:id — 任务详情查询 | keywords: task-get, task-controller, task-detail
  - POST /task — 任务创建 | keywords: task-create, task-controller, task-write
  - PUT /task/:id — 任务更新 | keywords: task-update, task-controller, task-write
  - DELETE /task/:id — 任务删除 | keywords: task-delete, task-controller, task-write
- TaskHookController (单对象 payload; @HookController pluginName=task)
  - list(payload) — saas.app.task.list 任务列表查询 | keywords: list-tasks, task-query
  - get(payload) — saas.app.task.get 任务详情 ({ id }) | keywords: get-task, read-detail
  - create(payload) — saas.app.task.create 任务创建 | keywords: create-task, task-write
  - update(payload) — saas.app.task.update 任务更新 ({ id, ...body }) | keywords: update-task, task-write
  - delete(payload) — saas.app.task.delete 任务软删除 ({ id }) | keywords: delete-task, soft-delete

关键词索引（中文 / English Keyword Index）
任务实体 -> app/task/entities/task.entity.ts
任务请求类型 -> app/task/types/task.types.ts
任务服务 -> app/task/services/task.service.ts
任务控制器 -> app/task/controllers/task.controller.ts
任务Hook控制器 / task-hook-controller -> app/task/controllers/task.hook-controller.ts
任务模块 -> app/task/task.module.ts

模块功能描述（Description）
本模块提供任务 CRUD 能力，作为 Todo 的上层业务容器，承载任务级会话、资源文件夹与人员信息。
