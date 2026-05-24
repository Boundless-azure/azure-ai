模块名称：runner/unit-core/system-unit/mongo（系统 Mongo 能力）

关键词索引（中文 / English Keyword Index）
Mongo能力Hook -> unit-core/system-unit/mongo/unit.hook.ts
Mongo能力映射 -> unit-core/system-unit/mongo/unit.core.ts
Mongo能力实现 -> unit-core/system-unit/mongo/unit-core/mongo.ops.ts
Mongo批量 -> unit-core/system-unit/mongo/unit-core/mongo.ops.ts
拒绝LLM -> unit-core/system-unit/mongo/unit.hook.ts
mongo-unit-hook -> unit-core/system-unit/mongo/unit.hook.ts
mongo-unit-core -> unit-core/system-unit/mongo/unit.core.ts
mongo-unit-ops -> unit-core/system-unit/mongo/unit-core/mongo.ops.ts
mongo-batch -> unit-core/system-unit/mongo/unit-core/mongo.ops.ts
deny-llm -> unit-core/system-unit/mongo/unit.hook.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- mongoOps.insert -> unit_mongo_insert_001
- mongoOps.find -> unit_mongo_find_002
- mongoOps.update -> unit_mongo_update_003
- mongoOps.delete -> unit_mongo_delete_004

Hook 清单 (统一批量, 写操作禁 LLM 直调)
- runner.unitcore.mongo.insert  payload: { db?, collection, docs: [...] }   -- 走 insertMany; denyLlm=true
- runner.unitcore.mongo.find    payload: { db?, collection, filter?, limit? } -- 只读, 允许 LLM 调用
- runner.unitcore.mongo.update  payload: { db?, collection, ops: [{filter, update, multi?, upsert?}, ...] } -- 走 bulkWrite; denyLlm=true
- runner.unitcore.mongo.delete  payload: { db?, collection, ops: [{filter, multi?}, ...] } -- 走 bulkWrite; denyLlm=true

模块功能描述（Description）
系统 Mongo 能力为 runner 与工作区提供基础 CRUD 能力，可指定数据库与集合，支持跨业务库访问。
写操作 (insert/update/delete) 统一批量化, 接收数组 (单条作为长度 1), 内部走 mongo 原生 bulk 路径 (insertMany / bulkWrite).
所有写操作均标 `denyLlm: true`: LLM 不允许直接调底层 mongo, 必须通过 AI 产代码或上层 runner.app.* 业务 hook 间接调.
RunnerHookAbilityMiddleware 在 source==='llm' + denyLlm=true 时直接软错返回 `llm-denied: hook "..." is internal-only (denyLlm=true)`.
