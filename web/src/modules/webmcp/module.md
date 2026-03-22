# WebMCP Module（WebMCP 模块）

## 功能描述

WebMCP 前端模块提供页面声明、Socket 握手与操作分发的能力。

## 目录结构

```
src/modules/webmcp/
├── constants/
│   └── webmcp.constants.ts       # WebMCP 常量
├── description/
│   └── module.tip.ts              # 模块提示（开发用）
├── hooks/
│   └── useWebMCP.ts              # WebMCP Hook
├── types/
│   └── webmcp.types.ts           # 类型定义
└── webmcp.module.ts               # 模块定义
```

## 核心文件与函数

### hooks/useWebMCP.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `declarePage` | 声明页面 |
| `connect` | 连接 |
| `registerCurrentPage` | 注册当前页面 |
| `useWebMCP` | 主入口 |

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `declarePage` | `hash_hook_declarePage_001` |
| `connect` | `hash_hook_connect_002` |
| `registerCurrentPage` | `hash_hook_registerCurrentPage_003` |
| `useWebMCP` | `hash_hook_use_webmcp_004` |
