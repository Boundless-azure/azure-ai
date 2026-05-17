# Migrations 模块

数据库结构迁移目录, 按时间戳文件名顺序执行 TypeORM `MigrationInterface`。

## 文件列表

- `1774200000000-ChatSessionData.ts` — 创建 `chat_sessions_data` 表, 存储 WebMCP/sessionData/callLog 共享数据值。函数: `ChatSessionData1774200000000.up` 创建表和索引; `ChatSessionData1774200000000.down` 删除表。keywords: chat-session-data, webmcp, session-data
- `1774700000000-AddAiCallLogDataType.ts` — 扩展 `chat_sessions_data.data_type` 约束, 支持 `ai_call_log` 调用日志类型。函数: `AddAiCallLogDataType1774700000000.up` 添加类型; `AddAiCallLogDataType1774700000000.down` 清理并回滚类型。keywords: ai-call-log, data-type
- `1774800000000-WidenChatSessionDataVal.ts` — 放宽 `chat_sessions_data.data_val` 大文本容量, MySQL/MariaDB 使用 `LONGTEXT`, 保障 call log 完整保存 payload/result。函数: `WidenChatSessionDataVal1774800000000.up` 放宽字段; `WidenChatSessionDataVal1774800000000.down` 回滚字段。keywords: longtext, call-log, payload-result
