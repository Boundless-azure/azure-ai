模块名称：app/todo（待办事项模块）

概述
- 管理待办事项（发起人、所属任务、待办名、描述、内容、单个跟进人、状态、状态颜色）
- 提供待办增删改查接口；支持按状态、跟进人、所属任务过滤
- 支持待办与聊天会话可选关联：todos.session_id 为空表示全局待办，非空可用于对话窗口待办列表。
- 列表接口对普通用户默认只返回当前登录主体发起或跟进的待办；具备 `todo/*` 或全局 `*` 管理权限的管理员默认可看全量，聊天窗口待办抽屉使用真实 Todo 接口并按 sessionId 过滤。
- 支持无状态跟进记录管理（创建、列表、删除跟进记录）
- 支持评论管理（创建、列表、删除评论）

文件清单（File List）
- app/todo/entities/todo.entity.ts
- app/todo/entities/todo-followup.entity.ts
- app/todo/entities/todo-followup-comment.entity.ts
- app/todo/enums/todo.enums.ts
- app/todo/types/todo.types.ts
- app/todo/services/todo.service.ts
- app/todo/services/todo-components.service.ts
- app/todo/controllers/todo.controller.ts
- app/todo/controllers/todo.hook-controller.ts
- app/todo/todo.module.ts

函数清单（Function Index）
- TodoComponentsService
  - todoTable (@HookComponent) — Web Component Hook: 表格展示待办列表，支持 q/status/sessionId 过滤；状态彩色 badge；经 ctx.callHook('saas.app.todo.list') 获取数据，组件不碰 URL/token | keywords: todo-table-web-component, todo-components, web-component-hook-declaration
- TodoService
  - list(query, principal?) — 查询待办列表，管理员跳过默认自己过滤，普通用户只看发起或跟进自己的待办；支持 taskId 过滤 | keywords: todo-list, admin-bypass, own-filter
  - count(query) — 统计待办总数，支持 status/sessionId/taskId 过滤，返回 { count: number } | keywords: count-todos, todo-count
  - canReadAllTodos(ctx) — 判断当前主体是否拥有待办管理级读取能力 | keywords: todo-admin-bypass, todo-list, management-permission
  - get(id)
  - create(dto)
  - update(id, dto)
  - delete(id)
  - createFollowup(todoId, dto, userId)
  - listFollowups(todoId)
  - deleteFollowup(id)
  - updateFollowup(id, dto, userId)
  - createComment(followupId, dto, userId)
  - listComments(followupId)
  - deleteComment(id)
- TodoController （纯 HTTP，@HookRoute 已迁出到 TodoHookController）
  - GET /todo/count, GET /todo, GET /todo/:id, POST /todo, PUT /todo/:id, DELETE /todo/:id
  - POST /todo/:id/followups, GET /todo/:id/followups
  - DELETE /todo/followups/:followupId, PUT /todo/followups/:followupId
  - POST /todo/followups/:followupId/comments, GET /todo/followups/:followupId/comments
  - DELETE /todo/comments/:commentId
  - resolveTodoPrincipal(context?) — 从 Hook 调用上下文解析 JwtPayload principal (principalId/principalType/tenantId)，无 principalId 返回 undefined | keywords: resolve-todo-principal, hook-context
- TodoHookController （@Injectable + @HookController(pluginName=todo, tags=[todo])，单对象 payload）
  - 每个 @HookRoute 只收 ONE object arg (scalar-id → { id }; id+body → { id, ...body }); handler (payload, _principal, context?)，principal 从 context 解析；@CheckAbility 逐字保留
  - count/list/get/create/update/delete — saas.app.todo.todoCount / list / get / create / update / delete | keywords: todo-count, todo-list, todo-detail, todo-create, todo-update, todo-delete
  - createFollowup/listFollowups/deleteFollowup/updateFollowup — saas.app.todo.followup.create/list/delete/update | keywords: followup-create, followup-list, followup-delete, followup-update
  - createComment/listComments/deleteComment — saas.app.todo.comment.create/list/delete | keywords: comment-create, comment-list, comment-delete

关键词索引（中文 / English Keyword Index）
待办事项实体 -> app/todo/entities/todo.entity.ts
待办跟进记录实体 -> app/todo/entities/todo-followup.entity.ts
待办评论实体 -> app/todo/entities/todo-followup-comment.entity.ts
待办状态枚举 -> app/todo/enums/todo.enums.ts
待办请求类型 -> app/todo/types/todo.types.ts
待办服务 -> app/todo/services/todo.service.ts
待办控制器 -> app/todo/controllers/todo.controller.ts
待办Hook声明 -> app/todo/controllers/todo.hook-controller.ts
待办模块 -> app/todo/todo.module.ts

快速检索映射（Keywords -> Files）
- "TodoEntity" -> app/todo/entities/todo.entity.ts
- "TodoFollowupEntity" -> app/todo/entities/todo-followup.entity.ts
- "TodoFollowupCommentEntity" -> app/todo/entities/todo-followup-comment.entity.ts
- "TodoStatus" -> app/todo/enums/todo.enums.ts
- "CreateTodoDto" -> app/todo/types/todo.types.ts
- "UpdateTodoDto" -> app/todo/types/todo.types.ts
- "CreateFollowupDto" -> app/todo/types/todo.types.ts
- "CreateCommentDto" -> app/todo/types/todo.types.ts
- "QueryTodoDto" -> app/todo/types/todo.types.ts
- "sessionId" -> app/todo/entities/todo.entity.ts, app/todo/types/todo.types.ts, app/todo/services/todo.service.ts
- "taskId" -> app/todo/entities/todo.entity.ts, app/todo/types/todo.types.ts, app/todo/services/todo.service.ts
- "followerId" -> app/todo/entities/todo.entity.ts, app/todo/types/todo.types.ts, app/todo/services/todo.service.ts
- "TodoService" -> app/todo/services/todo.service.ts
- "TodoController" -> app/todo/controllers/todo.controller.ts
- "TodoHookController" -> app/todo/controllers/todo.hook-controller.ts
- "resolveTodoPrincipal" -> app/todo/controllers/todo.controller.ts
- "TodoModule" -> app/todo/todo.module.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- TodoService.list -> 91a3f2c1
- TodoService.create -> f21c9bd0
- TodoService.update -> 31d4aa92
- TodoService.delete -> 0f7e915c
- TodoService.createFollowup -> followup_create_001
- TodoService.listFollowups -> followup_list_002
- TodoService.createComment -> comment_create_003
- TodoService.listComments -> comment_list_004
- TodoController.create -> 7e3c112a
- TodoController.update -> 1c9a77b3
- TodoController.list(HookRoute) -> todo_hook_list_001
- TodoController.create(HookRoute) -> todo_hook_create_002
- TodoController.createFollowup -> todo_hook_followup_003
- TodoController.createComment -> todo_hook_comment_004

模块功能描述（Description）
本模块提供待办事项的实体与 REST 接口，支持创建、查询、更新待办事项，并提供跟进记录和评论管理功能，以便前端构建完整的任务跟踪系统。
