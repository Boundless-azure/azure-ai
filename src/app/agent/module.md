模块名称：app/agent（Agent 与执行记录模块）

概述
- 管理 Agent 元信息（拟人昵称、用途说明、关联向量、节点图、代码目录、对话组关联、AI模型ID列表、关联 principalId）。
 - 支持向量列 embedding（pgvector）用于 Agent 的向量检索；并新增 keywords(JSON) 作为回退匹配。
- 支持 Agent ↔ 知识书本分配关系；数据库知识可按 Agent 自定义绑定，本地知识默认分配给所有 Agent。
- 管理执行Agent记录（任务说明、引用Agent、节点状态、最新返回、上下文关联）。
- 提供查/改/删接口；新增不在本模块受理。
- principalId 字段供前端"分配角色"入口使用：membership 表落点 = principalId, 角色分配复用 identity 模块的 RBAC 系统。

文件清单（File List）
- app/agent/entities/agent.entity.ts
- app/agent/entities/agent-knowledge-assignment.entity.ts
- app/agent/entities/agent-execution.entity.ts
- app/agent/services/agent.service.ts
- app/agent/services/execution.service.ts
- app/agent/controllers/agent.controller.ts
- app/agent/controllers/execution.controller.ts
- app/agent/types/agent.types.ts
- app/agent/enums/agent.enums.ts
- app/agent/cache/agent.cache.ts
- app/agent/agent.module.ts

函数清单（Function Index）
- AgentService
  - list(query)
  - get(id)
  - getKnowledgeAssignments(agentId)
  - updateKnowledgeAssignments(agentId, bookIds)
  - update(id, dto)
  - validateAiModelIds(modelIds)
  - delete(id)
- AgentExecutionService
  - list(query)
  - get(id)
  - update(id, dto)
  - delete(id)
- AgentController
  - GET /agent
  - GET /agent/:id
  - GET /agent/:id/knowledge-assignments
  - PUT /agent/:id
  - PUT /agent/:id/knowledge-assignments
  - DELETE /agent/:id
  - HookController(pluginName=agent, tags=[agent])
  - HookRoute on CRUD: 全部声明 zod payloadSchema (input 形状), 命名 platform.app.module.action
    · saas.app.agent.list (q?), saas.app.agent.get ({id}), saas.app.agent.update (UpdateAgentInput),
      saas.app.agent.delete ({id}), saas.app.agent.embeddingsUpdate (ids?),
      saas.app.agent.knowledgeAssignmentList ({id}), saas.app.agent.knowledgeAssignmentUpdate ({id, bookIds[]})
- AgentExecutionController
  - GET /agent-execution
  - GET /agent-execution/:id
  - PUT /agent-execution/:id
  - DELETE /agent-execution/:id
  - HookController(pluginName=agent, tags=[agent, execution])
  - HookRoute on CRUD: 全部声明 zod payloadSchema (input 形状), 命名 platform.app.module.action
    · saas.app.agent.executionList, executionGet/executionDelete ({id}), executionUpdate (UpdateExecutionInput)

关键词索引（中文 / English Keyword Index）
Agent表 -> app/agent/entities/agent.entity.ts
Agent知识分配表 -> app/agent/entities/agent-knowledge-assignment.entity.ts
执行Agent表 -> app/agent/entities/agent-execution.entity.ts
改删查接口 -> app/agent/controllers/*
知识分配接口 -> app/agent/controllers/agent.controller.ts
用途说明 -> app/agent/entities/agent.entity.ts
拟人昵称 -> app/agent/entities/agent.entity.ts
头像地址 -> app/agent/entities/agent.entity.ts
AI模型槽位 -> app/agent/services/agent.service.ts
模型ID校验 -> app/agent/services/agent.service.ts
节点状态 -> app/agent/entities/agent-execution.entity.ts
最新返回 -> app/agent/entities/agent-execution.entity.ts
上下文关联 -> app/agent/entities/agent-execution.entity.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- AgentService.list -> 7a1c2b63
- AgentService.getKnowledgeAssignments -> agent_knowledge_state_003
- AgentService.updateKnowledgeAssignments -> agent_knowledge_update_004
- AgentService.update -> 5e9d114f
- AgentService.validateAiModelIds -> agent_model_slot_id_005
- AgentService.delete -> 9b4c77a2
- AgentExecutionService.list -> 3d0c9f21
- AgentExecutionService.update -> 2b7a8890
- AgentExecutionService.delete -> d17f6a45
- AgentController.update -> 6c2bf912
- AgentExecutionController.update -> 84ad315e
- AgentController.list(HookRoute) -> agent_hook_list_001
- AgentExecutionController.update(HookRoute) -> agent_hook_exec_update_002

模块功能描述（Description）
本模块提供 Agent、Agent 知识分配与其执行记录的持久化与接口，仅支持查询、修改（受限字段）与删除。Agent 修改允许更新"昵称""用途说明""头像地址""AI模型ID列表"；知识分配允许为单个 Agent 绑定数据库知识书本，并自动并入全部本地知识。执行记录允许更新节点状态、最新返回与上下文关联。
AI模型ID列表必须保存 `ai_models.id`，不接受模型 name；更新时会校验槽位内每个值都能解析为启用模型 ID，运行时只在当前 Agent 已分配模型内按最近槽位回退，Agent 未分配模型时不会兜底到其他供应商。
