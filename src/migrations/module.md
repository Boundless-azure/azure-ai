模块名称：migrations（数据库迁移模块）

概述
- 数据库结构迁移目录, 按时间戳文件名顺序执行 TypeORM `MigrationInterface`。
- 新建表和新增 ID/引用字段默认使用 `VARCHAR(36)`, 支持 `azure-ai` 等语义化固定 ID, 避免 PostgreSQL `CHAR(36)` 右侧补空格。

文件清单（File List）

- `1774200000000-ChatSessionData.ts` — 创建 `chat_sessions_data` 表, 存储 WebMCP/sessionData/callLog 共享数据值。函数: `ChatSessionData1774200000000.up` 创建表和索引; `ChatSessionData1774200000000.down` 删除表。keywords: chat-session-data, webmcp, session-data
- `1774700000000-AddAiCallLogDataType.ts` — 扩展 `chat_sessions_data.data_type` 约束, 支持 `ai_call_log` 调用日志类型。函数: `AddAiCallLogDataType1774700000000.up` 添加类型; `AddAiCallLogDataType1774700000000.down` 清理并回滚类型。keywords: ai-call-log, data-type
- `1774800000000-WidenChatSessionDataVal.ts` — 放宽 `chat_sessions_data.data_val` 大文本容量, MySQL/MariaDB 使用 `LONGTEXT`, 保障 call log 完整保存 payload/result。函数: `WidenChatSessionDataVal1774800000000.up` 放宽字段; `WidenChatSessionDataVal1774800000000.down` 回滚字段。keywords: longtext, call-log, payload-result
- `1779069600000-DefaultFixedAvatars.ts` — 为 `azure-ai` 与 `ai-notify` 固定入口写入专属默认头像，覆盖 principal/agent/chat_session 中的固定入口记录。函数: `DefaultFixedAvatars1779069600000.up` 写入头像路径; `DefaultFixedAvatars1779069600000.down` 清空固定入口头像路径。keywords: default-avatar, fixed-entry, azure-assistant, system-notify
- `1779070400000-ResourceSessionId.ts` — 为 `resources` 表增加可选 `session_id` 字段和索引, 支持聊天文件列表按会话读取。函数: `ResourceSessionId1779070400000.up` 增加字段/索引; `ResourceSessionId1779070400000.down` 移除字段/索引。keywords: resources, session-id, chat-files
- `1779070500000-TodoSessionId.ts` — 为 `todos` 表增加可选 `session_id` 字段和索引, 支持聊天待办列表按会话读取。函数: `TodoSessionId1779070500000.up` 增加字段/索引; `TodoSessionId1779070500000.down` 移除字段/索引。keywords: todos, session-id, chat-todos
- `历史建表迁移` — `1737200000001-CoreAI.ts`, `1737200000002-ChatIM.ts`, `1737200000003-Identity.ts`, `1737200000004-Agent.ts`, `1737200000005-LangGraph.ts`, `1737200000006-Plugin.ts`, `1737200000007-Todo.ts`, `1769890000000-Resources.ts`, `1769950000000-ImContactGroups.ts`, `1769951000000-Apps.ts`, `1773300000000-Runners.ts`, `1773942000000-PluginTable.ts`, `1773951000000-StorageNodes.ts`, `1773971000000-SolutionPurchases.ts`, `1773980000000-RedesignTodos.ts`, `1774000000000-AddRunnerProxyTables.ts`, `1774000000002-RewardRecords.ts`, `1774100000000-KnowledgeModule.ts`, `1774200000000-ChatSessionData.ts` 等建表/补字段迁移统一使用 `VARCHAR(36)` 承载 ID 与引用字段。keywords: fixed-id, varchar-id, schema-default
- `1779070600000-UseVarcharForFixedIds.ts` — 将 PostgreSQL 既有 schema 内的 `CHAR(36)` 固定标识字段转换为 `VARCHAR(36)`, 并清理历史右侧空格。函数: `UseVarcharForFixedIds1779070600000.up` 转换字段并重建外键; `UseVarcharForFixedIds1779070600000.down` 保留可变长度定义避免回滚重新引入 padding。keywords: fixed-id, varchar-id, trim-padding

函数清单（Function Index）

- UseVarcharForFixedIds1779070600000.up(queryRunner) — 转换 `CHAR(36)` 标识字段为 `VARCHAR(36)` 并清理右侧空格 | keywords: fixed-id, varchar-id, trim-padding
- UseVarcharForFixedIds1779070600000.down(_queryRunner) — 保留 `VARCHAR(36)` 定义以避免回滚重新引入 padding | keywords: fixed-id, varchar-id, rollback-guard

关键词索引（中文 / English Keyword Index）

固定标识 -> 1779070600000-UseVarcharForFixedIds.ts
可变长度 -> 1779070600000-UseVarcharForFixedIds.ts
清理空格 -> 1779070600000-UseVarcharForFixedIds.ts
fixed-id -> 1779070600000-UseVarcharForFixedIds.ts
varchar-id -> 1779070600000-UseVarcharForFixedIds.ts
trim-padding -> 1779070600000-UseVarcharForFixedIds.ts
rollback-guard -> 1779070600000-UseVarcharForFixedIds.ts
schema-default -> 历史建表迁移

模块功能描述（Description）

本模块集中维护 TypeORM 数据库迁移。历史建表迁移默认使用 `VARCHAR(36)` 承载 ID 与引用字段; 新增固定 ID 迁移用于消除既有 PostgreSQL `CHAR(36)` 对短固定 ID 的右侧空格填充, 让 `azure-ai` 等语义化 ID 以原始字符串长度保存和读取。
