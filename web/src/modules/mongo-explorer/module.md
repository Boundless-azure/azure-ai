# MongoExplorer Module（MongoDB 浏览器模块）

## 功能描述

MongoDB 浏览器模块提供数据库结构浏览、数据查询与管理能力。

## 目录结构

```
src/modules/mongo-explorer/
├── components/
│   └── MongoExplorer.vue          # MongoDB 浏览器主组件
├── hooks/
│   └── useMongoExplorer.ts        # MongoDB 操作 Hook
├── pages/
│   └── MongoExplorerPage.vue      # MongoDB 浏览器页面
├── types/
│   └── mongo-explorer.types.ts    # TypeScript 类型定义
└── mongo-explorer.module.ts        # 模块定义
```

## 核心文件与函数

### hooks/useMongoExplorer.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `connect` | 连接 MongoDB |
| `listDatabases` | 列出所有数据库 |
| `listCollections` | 列出指定数据库的集合 |
| `query` | 执行查询 |

### components/MongoExplorer.vue

主要区域：
- `database-selector` - 数据库选择器
- `collection-tree` - 集合树形结构
- `query-editor` - 查询编辑器
- `result-view` - 查询结果展示

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useMongoExplorer.connect` | `web_mongo_explorer_connect_001` |
| `useMongoExplorer.listDatabases` | `web_mongo_explorer_list_databases_002` |
| `useMongoExplorer.listCollections` | `web_mongo_explorer_list_collections_003` |
| `useMongoExplorer.query` | `web_mongo_explorer_query_004` |
| `MongoExplorer.init` | `web_mongo_explorer_init_005` |
