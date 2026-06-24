模块名称
LangGraph Checkpoint（TypeORM Saver）

概述

- 提供自定义 `BaseCheckpointSaver` 的 TypeORM 实现，负责 LangGraph workflow checkpoint 与 pending writes 持久化。
- saver 只负责读写，不负责运行时建表或补列；`lg_checkpoints` / `lg_writes` schema 统一由 migrations 模块维护。
- checkpoint/write 表显式记录 `session_id`、`agent_id`、`agent_principal_id` 与 `ai_model_ids`，让 graph thread 能反查真实会话和 agent。
- checkpoint 内容使用 JSON + base64 保存 channel value，新解析逻辑兼容旧 raw JSON channel value。

文件清单

- services/typeorm-checkpoint.saver.ts
- entities/lg-checkpoint.entity.ts
- entities/lg-write.entity.ts
- checkpoint.module.ts

函数清单

- TypeOrmCheckpointSaver — 基于 TypeORM 的 LangGraph checkpoint saver | keywords: typeorm, langgraph, base-checkpoint-saver, checkpoint, writes
- TypeOrmCheckpointSaver.getTuple(config) — 读取指定线程和命名空间下最近或指定的 checkpoint | keywords: checkpoint-read, custom-saver, langgraph-checkpoint
- TypeOrmCheckpointSaver.list(config, options?) — 按线程和命名空间倒序列出 checkpoint | keywords: checkpoint-list, custom-saver, langgraph-checkpoint
- TypeOrmCheckpointSaver.put(config, checkpoint, metadata, newVersions) — 保存 LangGraph checkpoint 并返回可继续写入的 runnable config | keywords: checkpoint-write, custom-saver, langgraph-checkpoint
- TypeOrmCheckpointSaver.putWrites(config, writes, taskId) — 保存 checkpoint 关联的 pending writes；checkpoint 是 Agent 运行史，不同步到真实会话消息 | keywords: pending-writes, custom-saver, agent-run-history
- TypeOrmCheckpointSaver.deleteThread(threadId) — 软删除指定线程的 checkpoint 与 pending writes | keywords: checkpoint-delete, custom-saver, soft-delete
- TypeOrmCheckpointSaver.extractWorkflowContext(config) — 从 LangGraph configurable 中提取 workflow/session/agent 追踪上下文 | keywords: checkpoint-workflow-context, custom-saver, agent-link
- TypeOrmCheckpointSaver.toConfigurableWorkflowContext(context) — 将 workflow 上下文回写到下一步 configurable，避免 put 后丢失 session/agent 绑定 | keywords: checkpoint-workflow-context, configurable-context, agent-link
- TypeOrmCheckpointSaver.mergeWorkflowMetadata(metadata, context) — 将 workflow 上下文写入 checkpoint metadata，便于从 checkpoint 反查 agent/session | keywords: checkpoint-workflow-context, metadata, agent-link
- TypeOrmCheckpointSaver.readConfigString(config, key) — 从 configurable 读取字符串字段 | keywords: configurable-read, checkpoint-workflow-context, type-guard
- TypeOrmCheckpointSaver.readConfigStringArray(config, key) — 从 configurable 读取字符串数组字段 | keywords: configurable-read, checkpoint-workflow-context, type-guard
- TypeOrmCheckpointSaver.serializeCheckpoint(checkpoint) — 将 checkpoint 的 channel values 编码为可持久化 JSON | keywords: checkpoint-serialize, custom-saver, value-encoding
- TypeOrmCheckpointSaver.parseCheckpoint(json) — 解析持久化 checkpoint 并兼容旧 raw JSON channel value | keywords: checkpoint-parse, custom-saver, legacy-checkpoint
- TypeOrmCheckpointSaver.isEncodedCheckpointValue(value) — 判断 checkpoint channel value 是否为自定义 saver 编码格式 | keywords: checkpoint-value-compat, custom-saver, legacy-checkpoint
- TypeOrmCheckpointSaver.encodeValue(val) — 将写入值编码为 base64 JSON，并用 undefined sentinel 兼容空写入 | keywords: value-encoding, pending-writes, custom-saver
- TypeOrmCheckpointSaver.decodeValue(t, b64) — 从 base64 JSON 或 undefined sentinel 还原 pending write 值 | keywords: value-decoding, pending-writes, custom-saver
- LGCheckpointEntity — 存储 BaseCheckpointSaver 规范下的检查点快照与元数据 | keywords: langgraph, checkpoint, typeorm, snapshot, metadata
- LGWriteEntity — 存储与检查点关联的中间写入 pending writes | keywords: langgraph, writes, pending, typeorm
- LangGraphCheckpointModule.forRoot(options?) — 注册 checkpoint 实体、saver 与配置 provider | keywords: langgraph, checkpoint, typeorm, saver, module

关键词索引
检查点 -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts
保存器 -> services/typeorm-checkpoint.saver.ts
写入 -> services/typeorm-checkpoint.saver.ts, entities/lg-write.entity.ts
旧格式兼容 -> services/typeorm-checkpoint.saver.ts
表结构迁移 -> src/migrations/1779604000000-LangGraphCheckpointCustomSchema.ts, src/migrations/1779605000000-LangGraphCheckpointEnsureTables.ts
工作流上下文 -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts, entities/lg-write.entity.ts
Agent链接 -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts, entities/lg-write.entity.ts
checkpoint -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts
custom-saver -> services/typeorm-checkpoint.saver.ts
pending-writes -> services/typeorm-checkpoint.saver.ts, entities/lg-write.entity.ts
Agent运行史 -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts, entities/lg-write.entity.ts
workflow-context -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts, entities/lg-write.entity.ts
agent-link -> services/typeorm-checkpoint.saver.ts, entities/lg-checkpoint.entity.ts, entities/lg-write.entity.ts
legacy-checkpoint -> services/typeorm-checkpoint.saver.ts
schema-migration -> src/migrations/1779604000000-LangGraphCheckpointCustomSchema.ts, src/migrations/1779605000000-LangGraphCheckpointEnsureTables.ts, src/migrations/1779606000000-LangGraphCheckpointWorkflowContext.ts

类型导出

- CheckpointModuleOptions — checkpoint 模块启动配置占位类型 | keywords: checkpoint, module-options

模块功能描述
该模块实现 SaaS 侧自定义 LangGraph checkpoint saver。`TypeOrmCheckpointSaver` 只处理 `getTuple`、`list`、`put`、`putWrites`、`deleteThread` 等 BaseCheckpointSaver 行为；checkpoint 是 Agent 的运行史，pending writes 仅保存在 `lg_writes`，不再同步到真实会话消息。code-agent 这类后台 graph 使用 `thread_id` 保存 workflowId，同时通过 configurable 传入 `session_id`、`agent_id`、`agent_principal_id` 与 `ai_model_ids`；saver 会把这些字段写入 checkpoint/write 行，避免把 workflowId 误当会话 ID。表结构不再由 saver 在启动或首调用时自修，避免运行时代码和迁移脚本两套 schema 来源漂移；PostgreSQL 的 `lg_checkpoints` / `lg_writes` 建表、旧列 backfill、索引补齐统一交给 migrations 模块维护。
