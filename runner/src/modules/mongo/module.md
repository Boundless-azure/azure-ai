模块名称：runner/modules/mongo（Mongo 客户端模块）

关键词索引（中文 / English Keyword Index）
Mongo客户端 -> modules/mongo/mongo.client.ts
连接检测 -> modules/mongo/mongo.client.ts
数据库实例 -> modules/mongo/mongo.client.ts
mongo-client -> modules/mongo/mongo.client.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- RunnerMongoClient.connect -> runner_mongo_connect_001
- RunnerMongoClient.ping -> runner_mongo_ping_002
- RunnerMongoClient.getDb -> runner_mongo_getdb_003
- RunnerMongoClient.close -> runner_mongo_close_004

模块功能描述（Description）
封装 runner 侧 MongoDB 的连接、心跳检测与关闭能力，供配置检测和后续业务模块复用。
