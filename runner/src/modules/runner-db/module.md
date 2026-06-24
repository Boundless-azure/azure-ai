模块名称：runner/modules/runner-db（Runner 管理库模块）

关键词索引（中文 / English Keyword Index）
Runner管理库服务 -> modules/runner-db/services/runner-db.service.ts
Runner迁移服务 -> modules/runner-db/services/runner-db.migration.service.ts
Runner集合枚举 -> modules/runner-db/enums/runner-db.enums.ts
Runner管理库类型 -> modules/runner-db/types/runner-db.types.ts
Runner管理库模块 -> modules/runner-db/runner-db.module.ts
runner-db-service -> modules/runner-db/services/runner-db.service.ts
runner-db-migration -> modules/runner-db/services/runner-db.migration.service.ts
runner-db-enums -> modules/runner-db/enums/runner-db.enums.ts
runner-db-types -> modules/runner-db/types/runner-db.types.ts
runner-db-module -> modules/runner-db/runner-db.module.ts
code-agent-target-indexes -> modules/runner-db/services/runner-db.migration.service.ts
find-app-by-solution -> modules/runner-db/services/runner-db.service.ts
initialization-state -> modules/runner-db/types/runner-db.types.ts
app-index -> modules/runner-db/services/runner-db.migration.service.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- RunnerDbService.getCollection -> runner_db_collection_001
- RunnerDbService.upsertCapabilities -> runner_db_upsert_cap_002
- RunnerDbService.findAppBySolution -> runner_db_find_app_solution_005
- RunnerDbMigrationService.run -> runner_db_migration_run_003
- RunnerDbMigrationService.bootstrapCollections -> runner_db_migration_bootstrap_004
- RunnerDbMigrationService.ensureCodeAgentTargetIndexes -> runner_db_target_indexes_006

模块功能描述（Description）
Runner 管理库模块为独立 Mongo 库提供集合访问与迁移初始化能力，覆盖连接历史、Hook 失败、应用/能力/资源/WebMCP/MCP/Skill 等核心数据集合。Solution 元数据唯一源表已收敛到 Runner Solution 模块的 `solutions` collection；runner-db 不再创建或维护 `runner_solutions` 投影。code-agent 目标确保链路只在 runner-db 中维护 `runner_apps` 初始化状态与 Solution 关联索引。
