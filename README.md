# 小蓝 (Azure AI)

语言版本：[English](/docs/readme/README.en.md) · [中文](/docs/readme/README.zh-CN.md)

## 🚀 项目定位与愿景

**"小蓝"** 是新一代的 AI 交互入口，旨在通过自然语言替代旧时代的 Web 点击式操作。用户可以直接通过对话进行界面交互、数据管理和业务处理。

核心特性：
- **自增长能力**：由 AI 自动生成代码插件，回流并接入到本平台，形成持续增强的能力闭环。
- **可控生成**：通过"生成限定 + 事务总线（HookBus）"机制，确保 AI 产出的代码低依赖、低嵌套、可审计。
- **AI 执行规范**：标准化的前端组件控制协议，让 AI 精确操控界面。

---

## 🏗️ 技术架构

本项目采用 **三端分离架构**：

```
┌─────────────────────────────────────────────────────────────┐
│                        小蓝 (Azure AI)                        │
├─────────────┬─────────────────────┬─────────────────────────┤
│   Web 前端   │     NestJS 后端      │    Fastify Runner      │
│  (Astro+Vue) │    (模块化服务)       │    (轻量执行器)         │
└─────────────┴─────────────────────┴─────────────────────────┘
```

### 技术栈详情

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **Web 前端** | Astro 5 + Vue 3 + TypeScript | 管理后台，响应式多模块 |
| **状态管理** | Pinia | 前端状态管理 |
| **样式** | Tailwind CSS | 原子化 CSS |
| **后端** | NestJS 11 + TypeScript | 模块化业务服务 |
| **AI 集成** | LangChain/LangGraph | Agent 运行时 |
| **AI 模型** | OpenAI / Anthropic / Google GenAI / Azure OpenAI / DeepSeek | 多模型支持 |
| **数据库** | MySQL (TypeORM) + PostgreSQL (LangGraph Checkpoint) | 业务 + 状态存储 |
| **缓存** | Redis (ioredis) | 会话与状态缓存 |
| **数据探索** | MongoDB | Runner 管理与数据浏览 |
| **实时通信** | Socket.IO | 前端-后端-Runner 三角通信 |
| **Runner** | Fastify + TypeScript | 轻量级任务执行节点 |
| **任务执行** | zx (Google Chrome Labs) | 脚本执行 |
| **验证** | Zod + class-validator | 端到端类型校验 |

---

## 📦 模块总览

### Web 前端模块 (`web/src/modules/`)

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| [Agent](web/src/modules/agent/) | `modules/agent/` | AI Agent 核心工作区，聊天、对话、线程、会话分组、快捷工具 |
| [IM](web/src/modules/im/) | `modules/im/` | 即时通讯 Socket 服务，房间管理、输入状态、已读回执 |
| [Identity](web/src/modules/identity/) | `modules/identity/` | 主体、组织、成员、角色、权限管理 |
| [Auth](web/src/modules/auth/) | `modules/auth/` | 用户登录/登出，主体会话管理 |
| [Resource](web/src/modules/resource/) | `modules/resource/` | 统一资源上传，分片上传、断点续传、头像裁剪 |
| [Storage](web/src/modules/storage/) | `modules/storage/` | 文件/文件夹管理，分享链接（永久/临时/密码）、剪贴板 |
| [Todo](web/src/modules/todo/) | `modules/todo/` | 待办事项，CRUD、跟进记录、时间轴、评论 |
| [AI Provider](web/src/modules/ai-provider/) | `modules/ai-provider/` | AI 模型服务商配置，模型列表，连接测试 |
| [Runner](web/src/modules/runner/) | `modules/runner/` | Runner 执行节点管理，列表、表单 |
| [Mongo Explorer](web/src/modules/mongo-explorer/) | `modules/mongo-explorer/` | MongoDB 数据浏览，数据库/集合/查询执行 |
| [WebMCP](web/src/modules/webmcp/) | `modules/webmcp/` | 页面声明、Socket 握手、操作分发 |
| [HookBus Debug](web/src/modules/hookbus-debug/) | `modules/hookbus-debug/` | Hook 调试工具，连接调试、Payload 编辑、历史记录 |
| [Plugin](web/src/modules/plugin/) | `modules/plugin/` | 插件管理 |

### NestJS 后端模块 (`src/`)

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| **Core: AI** | `core/ai/` | AI 核心能力，LLM 调用、Prompt 工程 |
| **Core: HookBus** | `core/hookbus/` | 事务总线，生产者-消费者队列 |
| **Core: Plugin** | `core/plugin/` | 插件编排服务 |
| **Core: LangGraph** | `core/langgraph/` | 状态机工作流，Checkpoint 持久化 |
| **Core: Auth** | `core/auth/` | 认证模块，JWT + Passport |
| App: Agent | `app/agent/` | Agent 创建、编辑、配置管理 |
| App: Conversation | `app/conversation/` | 会话与 IM 消息 |
| App: Identity | `app/identity/` | 身份与权限 (RBAC + CASL) |
| App: AI Models | `app/ai-models/` | AI 模型配置管理 |
| App: Resource | `app/resource/` | 统一资源管理 |
| App: Storage | `app/storage/` | 文件存储管理 |
| App: Todo | `app/todo/` | 待办事项 |
| App: Runner | `app/runner/` | Runner 注册与管理 |
| App: Solution | `app/solution/` | 解决方案市场 |
| App: Mongo Explorer | `app/mongo-explorer/` | MongoDB 探索器 |

### Runner 执行节点模块 (`runner/src/modules/`)

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| [Configuration](runner/src/modules/configuration/) | `modules/configuration/` | 配置读取、Mongo/Redis 连接检测 |
| [Data Auth](runner/src/modules/data-auth/) | `modules/data-auth/` | 数据权限节点解析、Fastify + Zod DTO 验证 |
| [HookBus](runner/src/modules/hookbus/) | `modules/hookbus/` | Hook 注册与发布 |
| [Mongo](runner/src/modules/mongo/) | `modules/mongo/` | MongoDB 客户端连接、心跳检测 |
| [Redis](runner/src/modules/redis/) | `modules/redis/` | Redis 连接、心跳检测 |
| [Registration](runner/src/modules/registration/) | `modules/registration/` | Runner 注册握手、状态查询 |
| [Task](runner/src/modules/task/) | `modules/task/` | zx 任务执行器封装 |
| [WebMCP](runner/src/modules/webmcp/) | `modules/webmcp/` | 页面声明缓存与操作分发 |
| [Runner-DB](runner/src/modules/runner-db/) | `modules/runner-db/` | Runner Mongo 库访问与迁移 |
| [Solution](runner/src/modules/solution/) | `modules/solution/` | Runner 本地 Solution 管理 |

---

## ✨ 核心功能特性

### 1. AI 对话与交互
- 流式响应 (SSE)
- Markdown 实时渲染
- 多模态输入（语音、文本、图片、文件）
- 会话管理与线程分组
- Agent 快捷工具
- 检查点管理（Checkpoint）

### 2. 即时通讯 (IM)
- 实时消息推送 (Socket.IO)
- 输入状态同步
- 已读回执
- 增量消息拉取
- 智能通讯录分组（AI智能体/群聊/联系人）
- 中文拼音首字母排序

### 3. 身份与权限
- 多主体 (Principal) 支持
- 组织层级管理
- RBAC 角色权限模型
- CASL 能力控制
- 成员管理

### 4. 资源管理
- 统一上传（分片、断点续传、拖拽）
- 文件夹目录树管理
- 分享链接（永久/临时/密码）
- 头像裁剪

### 5. Runner 执行节点
- WebSocket 注册握手
- 在线/离线状态管理
- 插件能力注册
- Hook 占位处理器
- zx 脚本任务执行

### 6. AI 模型支持
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google GenAI (Gemini)
- Azure OpenAI
- DeepSeek

### 7. HookBus 事务总线
- 生产者-消费者队列
- 声明式中间件
- 方法绑定缓存
- HTTP + Socket.IO 调试入口

### 8. LangGraph 工作流
- Checkpointed State Machine
- PostgreSQL 状态持久化
- 多节点工作流编排

---

## 📅 开发进度 (Roadmap)

### ✅ 已完成 (Phase 1: 基础交互与体验)

**前端基础**
- [x] Astro + Vue 3 模块化架构
- [x] Tailwind CSS 响应式布局
- [x] Pinia 状态管理
- [x] Socket.IO 实时通信

**AI 对话**
- [x] 流式消息渲染、Markdown 支持
- [x] 会话管理、线程分组
- [x] Agent 快捷工具
- [x] 检查点 (Checkpoint) 管理

**多模态输入**
- [x] 语音录制（实时音量波形）
- [x] Emoji 表情选择
- [x] 图片粘贴预览及文件上传
- [x] @提及建议

**IM 即时通讯**
- [x] Socket 连接与重连
- [x] 房间加入/离开
- [x] 输入状态、已读回执
- [x] 增量消息拉取

**智能通讯录**
- [x] "AI智能体 > 群聊 > 联系人"分组策略
- [x] 中文拼音首字母排序与搜索

**身份管理**
- [x] 用户管理（含头像编辑）
- [x] 组织管理
- [x] 角色权限管理
- [x] 成员管理

**资源管理**
- [x] 分片上传、断点续传
- [x] 目录树结构管理
- [x] 分享链接（永久/临时/密码）
- [x] 剪贴板功能

**待办事项**
- [x] CRUD 操作
- [x] 跟进记录与时间轴
- [x] 评论功能

**AI 配置**
- [x] 多模型服务商配置
- [x] 模型列表管理
- [x] 连接测试

**Runner 管理**
- [x] Runner 节点注册
- [x] 在线状态监控
- [x] 插件能力管理

**数据工具**
- [x] MongoDB 数据浏览
- [x] 查询执行

**调试工具**
- [x] HookBus 调试面板
- [x] Payload 编辑
- [x] 历史记录

### 🚧 进行中 (Phase 2: 核心 AI 能力)

- [ ] **数据库写操作**：实现基于白名单与审计的安全 SQL 执行引擎
- [ ] **权限精细化**：库/表/列级别的访问控制与风控策略
- [ ] **HookBus 对接**：完善前后端动作的统一总线接入
- [ ] **插件自增长闭环**：打通"规划 -> 代码生成 -> 测试 -> 部署"全流程

### 🔮 未来计划 (Phase 3: 深度集成)

- [ ] **自动 CRUD 生成**：根据表结构自动生成管理页面
- [ ] **多智能体协作**：复杂任务的 Agent 编排与协作
- [ ] **业务深度插件**：如客户分析、报表自动生成等
- [ ] **Tip 生成器**：AI 自动生成代码提示与文档

---

## 🚦 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker (用于 PostgreSQL, Redis, MongoDB)

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填写必要的配置
```

### 启动开发环境

```bash
# 启动所有服务 (后端 + 前端 + Runner)
npm run dev

# 或分别启动
npm run web:dev    # 前端
npm run server:dev  # 后端
npm run runner:dev  # Runner
```

### 构建生产版本

```bash
npm run build
```

### Docker 部署

```bash
docker-compose up -d
```

---

## 📁 项目结构

```
azure-ai/
├── web/                    # Astro + Vue 3 前端
│   ├── src/
│   │   ├── api/           # API 封装
│   │   ├── modules/       # 功能模块
│   │   ├── components/    # 公共组件
│   │   └── pages/         # 页面
│   └── package.json
├── src/                    # NestJS 后端
│   ├── app/               # 业务模块
│   ├── core/              # 核心模块
│   ├── config/            # 配置
│   └── ...
├── runner/                 # Fastify Runner
│   └── src/modules/       # Runner 模块
├── runners/               # Runners 管理
├── plugins/               # 插件目录
├── docker-compose.yml     # Docker 配置
└── pnpm-workspace.yaml    # PNPM 工作区
```

---

## 🔗 相关资源

- 文档：[/docs](/docs)
- API 文档：[/docs/api](/docs/api)
