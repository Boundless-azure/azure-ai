模块名称：app/todo（待办事项模块）

概述
- 管理待办事项（发起人、待办名、描述、内容、跟进人、状态、状态颜色）
- 提供待办增删改查接口；支持按状态、跟进人过滤
- 支持跟进记录管理（创建、列表、删除跟进记录）
- 支持评论管理（创建、列表、删除评论）

文件清单（File List）
- app/todo/entities/todo.entity.ts
- app/todo/entities/todo-followup.entity.ts
- app/todo/entities/todo-followup-comment.entity.ts
- app/todo/enums/todo.enums.ts
- app/todo/types/todo.types.ts
- app/todo/services/todo.service.ts
- app/todo/controllers/todo.controller.ts
- app/todo/todo.module.ts

函数清单（Function Index）
- TodoService
  - list(query)
  - get(id)
  - create(dto)
  - update(id, dto)
  - delete(id)
  - createFollowup(todoId, dto, userId)
  - listFollowups(todoId)
  - deleteFollowup(id)
  - createComment(followupId, dto, userId)
  - listComments(followupId)
  - deleteComment(id)
- TodoController
  - GET /todo
  - GET /todo/:id
  - POST /todo
  - PUT /todo/:id
  - DELETE /todo/:id
  - POST /todo/:id/followups
  - GET /todo/:id/followups
  - DELETE /todo/followups/:followupId
  - POST /todo/followups/:followupId/comments
  - GET /todo/followups/:followupId/comments
  - DELETE /todo/comments/:commentId
  - HookLifecycle on CRUD: 全部声明 zod payloadSchema (input 形状), lifecycle-registration 自动包成 envelope
    · 命名遵循 platform.app.module.action:
    · saas.app.todo.list (status?/followerId?/initiatorId?/q?), saas.app.todo.get ({id}),
      saas.app.todo.create (CreateTodoInput), saas.app.todo.update (UpdateTodoInput),
      saas.app.todo.delete ({id})

关键词索引（中文 / English Keyword Index）
待办事项实体 -> app/todo/entities/todo.entity.ts
待办跟进记录实体 -> app/todo/entities/todo-followup.entity.ts
待办评论实体 -> app/todo/entities/todo-followup-comment.entity.ts
待办状态枚举 -> app/todo/enums/todo.enums.ts
待办请求类型 -> app/todo/types/todo.types.ts
待办服务 -> app/todo/services/todo.service.ts
待办控制器 -> app/todo/controllers/todo.controller.ts
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
- "TodoService" -> app/todo/services/todo.service.ts
- "TodoController" -> app/todo/controllers/todo.controller.ts
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
- TodoController.list(HookLifecycle) -> todo_hook_list_001
- TodoController.create(HookLifecycle) -> todo_hook_create_002
- TodoController.createFollowup -> todo_hook_followup_003
- TodoController.createComment -> todo_hook_comment_004

模块功能描述（Description）
本模块提供待办事项的实体与 REST 接口，支持创建、查询、更新待办事项，并提供跟进记录和评论管理功能，以便前端构建完整的任务跟踪系统。
