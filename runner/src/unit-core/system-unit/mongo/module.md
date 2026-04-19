模块名称：runner/unit-core/system-unit/mongo（系统 Mongo 能力）

关键词索引（中文 / English Keyword Index）
Mongo能力Hook -> unit-core/system-unit/mongo/unit.hook.ts
Mongo能力描述 -> unit-core/system-unit/mongo/unit.desc.ts
Mongo能力映射 -> unit-core/system-unit/mongo/unit.core.ts
Mongo能力实现 -> unit-core/system-unit/mongo/unit-core/mongo.ops.ts
mongo-unit-hook -> unit-core/system-unit/mongo/unit.hook.ts
mongo-unit-core -> unit-core/system-unit/mongo/unit.core.ts
mongo-unit-ops -> unit-core/system-unit/mongo/unit-core/mongo.ops.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- mongoOps.insertOne -> unit_mongo_insert_001
- mongoOps.find -> unit_mongo_find_002
- mongoOps.updateOne -> unit_mongo_update_003
- mongoOps.deleteOne -> unit_mongo_delete_004

模块功能描述（Description）
系统 Mongo 能力为 runner 与工作区提供基础 CRUD 能力，可指定数据库与集合，支持跨业务库访问。
