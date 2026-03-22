# Web Module（前端模块总览）

## 功能描述

Web 前端是基于 Astro + Vue 3 的管理后台，提供多模块化的功能页面。各模块独立管理自己的组件、Hook、API 和类型定义。

## 目录结构

```
web/src/
├── api/                         # 统一 API 封装
│   ├── agent.ts                 # Agent 相关接口
│   ├── runner.ts                # Runner 相关接口
│   ├── storage.ts               # Storage 相关接口
│   └── ...
├── modules/                     # 功能模块目录
│   ├── agent/                   # Agent 管理模块
│   ├── ai-provider/             # AI 模型提供商模块
│   ├── auth/                    # 认证模块
│   ├── hookbus-debug/           # Hook 调试模块
│   ├── identity/                # 身份管理模块
│   ├── im/                      # 即时通讯模块
│   ├── mongo-explorer/          # MongoDB 浏览器模块
│   ├── plugin/                  # 插件管理模块
│   ├── resource/                # 资源管理模块
│   ├── runner/                  # Runner 管理模块
│   ├── storage/                 # 资源库模块
│   ├── todo/                    # 待办事项模块
│   └── webmcp/                  # WebMCP 模块
└── ...
```

## 核心模块清单

| 模块 | 文件路径 | 功能描述 |
|------|----------|----------|
| Agent | [modules/agent/](web/src/modules/agent/) | Agent 创建、编辑、配置管理 |
| AI Provider | [modules/ai-provider/](web/src/modules/ai-provider/) | AI 模型服务商配置 |
| Auth | [modules/auth/](web/src/modules/auth/) | 用户认证与权限 |
| Hook Debug | [modules/hookbus-debug/](web/src/modules/hookbus-debug/) | Hook 调试工具 |
| Identity | [modules/identity/](web/src/modules/identity/) | 用户和主体管理 |
| IM | [modules/im/](web/src/modules/im/) | 即时消息功能 |
| Mongo Explorer | [modules/mongo-explorer/](web/src/modules/mongo-explorer/) | MongoDB 数据浏览 |
| Plugin | [modules/plugin/](web/src/modules/plugin/) | 插件管理 |
| Resource | [modules/resource/](web/src/modules/resource/) | 统一资源管理 |
| Runner | [modules/runner/](web/src/modules/runner/) | Runner 执行节点管理 |
| Storage | [modules/storage/](web/src/modules/storage/) | 文件存储与分享 |
| Todo | [modules/todo/](web/src/modules/todo/) | 待办事项管理 |
| WebMCP | [modules/webmcp/](web/src/modules/webmcp/) | WebMCP 配置 |

## 模块规范

- 每个子模块应包含 `module.tip.ts` 或 `module.md` 文件
- `module.tip.ts` 使用 TypeScript 格式导出 `moduleTip` 对象
- `module.md` 使用 Markdown 格式描述模块
- 组件应使用 JSDOC 注释，标注区域描述和关键词
