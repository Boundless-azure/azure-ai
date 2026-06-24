模块名称：migrations（数据库迁移模块）

概述

- 数据库结构迁移目录, 按时间戳文件名顺序执行 TypeORM `MigrationInterface`。
- 新建表和新增 ID/引用字段默认使用 `VARCHAR(36)`, 支持 `azure-ai` 等语义化固定 ID, 避免 PostgreSQL `CHAR(36)` 右侧补空格。
- LangGraph checkpoint 自定义 saver 的 `lg_checkpoints` / `lg_writes` 表结构统一由迁移维护，saver 运行时不再执行 DDL。

文件清单（File List）

- `1774200000000-ChatSessionData.ts` — 创建 `chat_sessions_data` 表, 存储 WebMCP/sessionData/callLog 共享数据值。函数: `ChatSessionData1774200000000.up` 创建表和索引; `ChatSessionData1774200000000.down` 删除表。keywords: chat-session-data, webmcp, session-data
- `1774700000000-AddAiCallLogDataType.ts` — 扩展 `chat_sessions_data.data_type` 约束, 支持 `ai_call_log` 调用日志类型。函数: `AddAiCallLogDataType1774700000000.up` 添加类型; `AddAiCallLogDataType1774700000000.down` 清理并回滚类型。keywords: ai-call-log, data-type
- `1774800000000-WidenChatSessionDataVal.ts` — 放宽 `chat_sessions_data.data_val` 大文本容量, MySQL/MariaDB 使用 `LONGTEXT`, 保障 call log 完整保存 payload/result。函数: `WidenChatSessionDataVal1774800000000.up` 放宽字段; `WidenChatSessionDataVal1774800000000.down` 回滚字段。keywords: longtext, call-log, payload-result
- `1779602000000-CodeAgentPurposeModelOrder.ts` — 更新 `src/agents/code-agent` 的用途说明, 补充 3 个模型槽位（对话 / 逻辑编程 / 前端）的用途与配置建议。函数: `CodeAgentPurposeModelOrder1779602000000.up` 更新用途说明; `CodeAgentPurposeModelOrder1779602000000.down` 回滚旧说明。keywords: code-agent, purpose, model-order
- `1779604000000-LangGraphCheckpointCustomSchema.ts` — 创建缺失的 `lg_checkpoints` / `lg_writes` 表，并补齐自定义 TypeORM checkpoint saver 所需的 `checkpoint_ns`、`checkpoint_json`、`value_b64`、`session_id`、`agent_id`、`ai_model_ids` 等字段。函数: `LangGraphCheckpointCustomSchema1779604000000.up` 建表、补字段和索引; `LangGraphCheckpointCustomSchema1779604000000.down` 回滚补字段。keywords: langgraph-checkpoint, custom-saver, schema-align
- `1779605000000-LangGraphCheckpointEnsureTables.ts` — 对已经执行过旧补列迁移但实际库仍缺表的环境进行幂等补救，确保 `lg_checkpoints` / `lg_writes` 表和自定义 saver 字段存在。函数: `LangGraphCheckpointEnsureTables1779605000000.up` 建表、补字段和索引; `LangGraphCheckpointEnsureTables1779605000000.down` 保留数据不删除。keywords: langgraph-checkpoint, custom-saver, ensure-tables
- `1779606000000-LangGraphCheckpointWorkflowContext.ts` — 为 checkpoint/write 表补齐 `session_id`、`agent_id`、`agent_principal_id`、`ai_model_ids` 和索引，让 workflowId 能反查真实会话与 agent。函数: `LangGraphCheckpointWorkflowContext1779606000000.up` 补字段和索引; `LangGraphCheckpointWorkflowContext1779606000000.down` 回滚上下文字段。keywords: langgraph-checkpoint, workflow-context, agent-link
- `1779607000000-AgentAiModelIdsUseIds.ts` — 将 `agents.ai_model_ids` 中误存的模型 name 迁移为稳定的 `ai_models.id`，避免模型槽位解析失败后走兜底模型。函数: `AgentAiModelIdsUseIds1779607000000.up` 按 name/id 映射修复数组; `AgentAiModelIdsUseIds1779607000000.down` 保留 ID 不回滚。keywords: agent-model-slots, model-id, rollback-guard
- `1779608000000-RemoveChatMessageKeywords.ts` — 删除 `chat_session_messages.keywords` 逐消息关键词列，历史 tag 检索统一保留 `chat_session_smart` 分段索引。函数: `RemoveChatMessageKeywords1779608000000.up` 删除列; `RemoveChatMessageKeywords1779608000000.down` 恢复 nullable JSON 列。keywords: message-keywords, smart-index, chat-session-messages
- `1779609000000-CleanupOfficialCheckpointTables.ts` — 删除官方 LangGraph Postgres saver 遗留的 `checkpoint_writes`、`checkpoint_blobs`、`checkpoints`、`checkpoint_migrations` 表；当前 graph 运行史只使用 `lg_checkpoints` / `lg_writes`。函数: `CleanupOfficialCheckpointTables1779609000000.up` 幂等删除旧表; `CleanupOfficialCheckpointTables1779609000000.down` 不恢复旧 schema。keywords: checkpoint-cleanup, official-saver-tables, rollback-guard
- `1779069600000-DefaultFixedAvatars.ts` — 为 `azure-ai` 与 `ai-notify` 固定入口写入专属默认头像，覆盖 principal/agent/chat_session 中的固定入口记录。函数: `DefaultFixedAvatars1779069600000.up` 写入头像路径; `DefaultFixedAvatars1779069600000.down` 清空固定入口头像路径。keywords: default-avatar, fixed-entry, azure-assistant, system-notify
- `1779070400000-ResourceSessionId.ts` — 为 `resources` 表增加可选 `session_id` 字段和索引, 支持聊天文件列表按会话读取。函数: `ResourceSessionId1779070400000.up` 增加字段/索引; `ResourceSessionId1779070400000.down` 移除字段/索引。keywords: resources, session-id, chat-files
- `1779070500000-TodoSessionId.ts` — 为 `todos` 表增加可选 `session_id` 字段和索引, 支持聊天待办列表按会话读取。函数: `TodoSessionId1779070500000.up` 增加字段/索引; `TodoSessionId1779070500000.down` 移除字段/索引。keywords: todos, session-id, chat-todos
- `历史建表迁移` — `1737200000001-CoreAI.ts`, `1737200000002-ChatIM.ts`, `1737200000003-Identity.ts`, `1737200000004-Agent.ts`, `1737200000005-LangGraph.ts`, `1737200000006-Plugin.ts`, `1737200000007-Todo.ts`, `1769890000000-Resources.ts`, `1769950000000-ImContactGroups.ts`, `1769951000000-Apps.ts`, `1773300000000-Runners.ts`, `1773942000000-PluginTable.ts`, `1773951000000-StorageNodes.ts`, `1773971000000-SolutionPurchases.ts`, `1773980000000-RedesignTodos.ts`, `1774000000000-AddRunnerProxyTables.ts`, `1774000000002-RewardRecords.ts`, `1774100000000-KnowledgeModule.ts`, `1774200000000-ChatSessionData.ts` 等建表/补字段迁移统一使用 `VARCHAR(36)` 承载 ID 与引用字段。keywords: fixed-id, varchar-id, schema-default
- `1779070600000-UseVarcharForFixedIds.ts` — 将 PostgreSQL 既有 schema 内的 `CHAR(36)` 固定标识字段转换为 `VARCHAR(36)`, 并清理历史右侧空格。函数: `UseVarcharForFixedIds1779070600000.up` 转换字段并重建外键; `UseVarcharForFixedIds1779070600000.down` 保留可变长度定义避免回滚重新引入 padding。keywords: fixed-id, varchar-id, trim-padding

函数清单（Function Index）

- UseVarcharForFixedIds1779070600000.up(queryRunner) — 转换 `CHAR(36)` 标识字段为 `VARCHAR(36)` 并清理右侧空格 | keywords: fixed-id, varchar-id, trim-padding
- UseVarcharForFixedIds1779070600000.down(\_queryRunner) — 保留 `VARCHAR(36)` 定义以避免回滚重新引入 padding | keywords: fixed-id, varchar-id, rollback-guard
- CodeAgentPurposeModelOrder1779602000000.up(queryRunner) — 更新 code-agent 的用途说明，补充 3 个模型槽位用途与配置建议 | keywords: code-agent, purpose, model-order
- CodeAgentPurposeModelOrder1779602000000.down(queryRunner) — 将 code-agent 的用途说明回滚到旧文案 | keywords: code-agent, purpose, rollback
- LangGraphCheckpointCustomSchema1779604000000.up(queryRunner) — 创建缺失表并补齐自定义 TypeORM checkpoint saver 需要的列、索引与旧数据 backfill | keywords: langgraph-checkpoint, custom-saver, schema-align
- LangGraphCheckpointCustomSchema1779604000000.down(queryRunner) — 回滚自定义 checkpoint saver 新增列和索引 | keywords: langgraph-checkpoint, custom-saver, rollback
- LangGraphCheckpointEnsureTables1779605000000.up(queryRunner) — 幂等确保 checkpoint/write 表、列、索引与旧数据 backfill 存在 | keywords: langgraph-checkpoint, custom-saver, ensure-tables
- LangGraphCheckpointEnsureTables1779605000000.down(\_queryRunner) — 保留 checkpoint 数据，避免补救迁移回滚删除工作流状态 | keywords: langgraph-checkpoint, custom-saver, rollback-guard
- LangGraphCheckpointWorkflowContext1779606000000.up(queryRunner) — 为 checkpoint/write 表补充 session、agent 与模型 ID 快照字段 | keywords: langgraph-checkpoint, workflow-context, agent-link
- LangGraphCheckpointWorkflowContext1779606000000.down(queryRunner) — 回滚 checkpoint/write 表的 workflow 上下文字段 | keywords: langgraph-checkpoint, workflow-context, rollback
- AgentAiModelIdsUseIds1779607000000.up(queryRunner) — 将 agents.ai_model_ids 内的历史模型 name 修复为 ai_models.id | keywords: agent-model-slots, model-id
- AgentAiModelIdsUseIds1779607000000.down(_queryRunner) — 保留模型 ID 形态，避免回滚重新写入 name | keywords: agent-model-slots, rollback-guard
- RemoveChatMessageKeywords1779608000000.up(queryRunner) — 删除 `chat_session_messages.keywords` 逐消息关键词列 | keywords: message-keywords, smart-index
- RemoveChatMessageKeywords1779608000000.down(queryRunner) — 恢复 nullable JSON keywords 列 | keywords: message-keywords, rollback
- CleanupOfficialCheckpointTables1779609000000.up(queryRunner) — 幂等删除官方 LangGraph saver 遗留 checkpoint 表 | keywords: checkpoint-cleanup, official-saver-tables
- CleanupOfficialCheckpointTables1779609000000.down(_queryRunner) — 不恢复官方 saver 旧表，保留自定义 `lg_checkpoints` / `lg_writes` 作为唯一运行史 schema | keywords: checkpoint-cleanup, rollback-guard

关键词索引（中文 / English Keyword Index）

固定标识 -> 1779070600000-UseVarcharForFixedIds.ts
可变长度 -> 1779070600000-UseVarcharForFixedIds.ts
清理空格 -> 1779070600000-UseVarcharForFixedIds.ts
fixed-id -> 1779070600000-UseVarcharForFixedIds.ts
varchar-id -> 1779070600000-UseVarcharForFixedIds.ts
trim-padding -> 1779070600000-UseVarcharForFixedIds.ts
rollback-guard -> 1779070600000-UseVarcharForFixedIds.ts
schema-default -> 历史建表迁移
code-agent -> 1779602000000-CodeAgentPurposeModelOrder.ts
用途说明 -> 1779602000000-CodeAgentPurposeModelOrder.ts
模型顺序 -> 1779602000000-CodeAgentPurposeModelOrder.ts
model-order -> 1779602000000-CodeAgentPurposeModelOrder.ts
自定义保存器 -> 1779604000000-LangGraphCheckpointCustomSchema.ts, 1779605000000-LangGraphCheckpointEnsureTables.ts
检查点表结构 -> 1779604000000-LangGraphCheckpointCustomSchema.ts, 1779605000000-LangGraphCheckpointEnsureTables.ts, 1779606000000-LangGraphCheckpointWorkflowContext.ts
缺失表补救 -> 1779605000000-LangGraphCheckpointEnsureTables.ts
工作流上下文 -> 1779606000000-LangGraphCheckpointWorkflowContext.ts
Agent链接 -> 1779606000000-LangGraphCheckpointWorkflowContext.ts
Agent模型槽位 -> 1779607000000-AgentAiModelIdsUseIds.ts
模型ID -> 1779607000000-AgentAiModelIdsUseIds.ts
逐消息关键词 -> 1779608000000-RemoveChatMessageKeywords.ts
Smart索引 -> 1779608000000-RemoveChatMessageKeywords.ts
langgraph-checkpoint -> 1779604000000-LangGraphCheckpointCustomSchema.ts, 1779605000000-LangGraphCheckpointEnsureTables.ts, 1779606000000-LangGraphCheckpointWorkflowContext.ts
custom-saver -> 1779604000000-LangGraphCheckpointCustomSchema.ts, 1779605000000-LangGraphCheckpointEnsureTables.ts
schema-align -> 1779604000000-LangGraphCheckpointCustomSchema.ts
ensure-tables -> 1779605000000-LangGraphCheckpointEnsureTables.ts
workflow-context -> 1779606000000-LangGraphCheckpointWorkflowContext.ts
agent-link -> 1779606000000-LangGraphCheckpointWorkflowContext.ts
agent-model-slots -> 1779607000000-AgentAiModelIdsUseIds.ts
model-id -> 1779607000000-AgentAiModelIdsUseIds.ts
message-keywords -> 1779608000000-RemoveChatMessageKeywords.ts
smart-index -> 1779608000000-RemoveChatMessageKeywords.ts
checkpoint-cleanup -> 1779609000000-CleanupOfficialCheckpointTables.ts
official-saver-tables -> 1779609000000-CleanupOfficialCheckpointTables.ts
官方旧表 -> 1779609000000-CleanupOfficialCheckpointTables.ts

模块功能描述（Description）

本模块集中维护 TypeORM 数据库迁移。历史建表迁移默认使用 `VARCHAR(36)` 承载 ID 与引用字段; 新增固定 ID 迁移用于消除既有 PostgreSQL `CHAR(36)` 对短固定 ID 的右侧空格填充, 让 `azure-ai` 等语义化 ID 以原始字符串长度保存和读取。LangGraph checkpoint 相关 schema 以迁移为唯一来源，避免 saver 运行时 DDL 与迁移脚本发生漂移；checkpoint/write 表显式保留 session/agent/model ID 快照，避免 workflowId 被误用为业务会话。
