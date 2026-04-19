# MongoDB Explorer Module（MongoDB 浏览器模块）

## 功能描述

通过 Runner 代理提供 MongoDB 数据库/集合查询和 Schema 查看功能。

## 目录结构

```
src/app/mongo-explorer/
├── controllers/
│   └── mongo-explorer.controller.ts
├── services/
│   └── mongo-explorer.service.ts
├── types/
│   └── mongo-explorer.types.ts
└── mongo-explorer.module.ts
```

## 核心文件与函数

### mongo-explorer.module.ts

| 属性 | 描述 |
|------|------|
| imports | RunnerModule |
| providers | MongoExplorerService |
| controllers | MongoExplorerController |
| exports | MongoExplorerService |

### MongoExplorerService

| 函数名 | 关键词描述 |
|--------|-----------|
| `listDatabases` | 列出数据库 |
| `listCollections` | 列出集合 |
| `getSchema` | 获取集合 Schema |
| `findDocuments` | 查询文档 |

### MongoExplorerController

| 路由 | 描述 |
|------|------|
| GET /mongo/explorer/databases | 获取数据库列表 |
| GET /mongo/explorer/collections/:db | 获取集合列表 |
| GET /mongo/explorer/schema/:db/:collection | 获取 Schema |
| POST /mongo/explorer/find/:db/:collection | 查询文档 |

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `MongoExplorerService.listDatabases` | `mongo_explorer_list_db_001` |
| `MongoExplorerService.listCollections` | `mongo_explorer_list_coll_002` |
| `MongoExplorerService.getSchema` | `mongo_explorer_schema_003` |
| `MongoExplorerService.findDocuments` | `mongo_explorer_find_004` |
