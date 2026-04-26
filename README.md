```
   ___  ___  __   __   __   __   ___
  /   /\  / /__  / /  /__/ /_   /__
 /___/--\/ /___ / /__/  / /___/___/

     小蓝 (Azure AI)  ::  v0.0.1
     AI 生成 + 租户自托管 PaaS  ·  面向超级个体
```

> `prod ::` AI 产代码 · 租户自托管运行 · FRP 自动公网化 · 多端天然适配

lang :: [English](/docs/readme/README.en.md) · [中文](/docs/readme/README.zh-CN.md)

---

## `# whoami`

**小蓝** != 聊天机器人 · != 无代码平台 · != 纯开发工具

是 **"AI 生成应用 → 托管在用户自己机器上运行"** 的 PaaS.

```
 target ::
   超级个体  ( 一人 / 小团队做多个产品的创业者 · 独立开发者 · 内容创作者 )

 value-loop ::
   自然语言/语音描述需求
        │
        ▼
   SaaS 端 AI Agent 团队  ( Design → Dev → QA )  产代码
        │
        ▼
   代码签名下发  →  用户自己的 Runner  ( Docker 一键部署 )
        │
        ▼
   FRP 自动分配子域名  →  公网可达  ( Web / 小程序 / 移动端 )
        │
        ▼
   AI 持续通过 HookBus + WebMCP 操作界面与数据
```

---

## `# vs`  —  跟业界的差异

| 对手                 | 它们的局限                       | 小蓝的不同                           |
|----------------------|----------------------------------|--------------------------------------|
| **Bubble · Webflow** | 无代码 · vendor lock-in · 逃不出来 | 产出**真代码** · 跑在你自己机器      |
| **Lovable · v0**     | 只生成前端 · 没运行时              | 前后端全栈 + 数据库 + 部署            |
| **Replit Agents**    | 代码跑在 Replit 云 · 成本高       | 跑在租户 Runner · 成本极低            |
| **n8n · Zapier**     | 自动化 · 非应用开发                | 能产**完整应用** · 不只是流程         |
| **传统 SaaS 工具**   | 企业导向 · 超级个体过重           | 专为超级个体 · 轻量                    |

```
 moat ::
   HookBus    (代码白名单)
 + WebMCP     (前端操作协议)
 + Runner+FRP (自托管 + 自动公网化)
 + Knowledge  (AI 可编程记忆)
```

---

## `# arch`  —  三端架构

```
 ┌───────────────────────────────────────────────────────────────────┐
 │                          小蓝 (Azure AI)                           │
 ├──────────────────┬────────────────────────┬──────────────────────┤
 │   web/            │     src/                │     runner/           │
 │   Astro + Vue     │     NestJS 后端         │     Fastify Runner    │
 │   管理后台        │     (稳定元平台)         │     (租户本机执行)     │
 │                   │                         │                       │
 │  > 对话入口        │  > AI Agent 团队         │  > 代码执行沙箱        │
 │  > 插件市场        │  > HookBus 调度          │  > Unit Core 基座     │
 │  > SaaS 控制台     │  > Knowledge 记忆         │  > FRP 公网化         │
 │                   │  > Runner 注册           │  > Docker 一键部署     │
 └──────────────────┴────────────────────────┴──────────────────────┘
                         ▲
                         │  Socket.IO 长连接
                         │  HTTP + 签名分发
                         │  FRP 反向代理
                         ▼
```

```
 role ::
   web      ─►  交互层  ·  超级个体操作入口
   saas     ─►  元平台  ·  AI 生成 + 调度  ·  **必须高可用**
   runner   ─►  租户自己的机器(本机/VPS/家用服务器)
                跑用户的应用与数据
                SaaS 不负责稳定性, 但保存代码镜像 → **一键恢复**
```

---

## `# design`  —  八大核心设计

### `[1]  HookBus`  ::  AI 代码的白名单入口

所有 AI 产出的能力收口到 Hook (`@HookHandler` 装饰器注册).
AI 不能自由 `import` · 不能碰文件系统 · 不能乱跑网络 — **只能调 HookBus 注册的 Hook**.
对 LLM 代码产出的强约束 · 审计基础.

```
 protocol   ::  call_hook(name, payload, options)
 interceptors ::  行级权限  ·  写操作审计  ·  debug 沙箱
 monitor    ::  WebSocket 实时查看 Hook 执行
```

### `[2]  WebMCP`  ::  前端操作协议

AI 用**结构化指令** (非视觉点击) 操作界面.
组件声明"我支持什么操作" → AI 调 `web_control` Hook 派发.

`use-case ::` 主动 AI 像导购一样操作网站 · 帮用户填表 · 切 Tab · 打开详情.

### `[3]  Unit Core`  ::  Runner 侧能力基座

Runner 的 **"标准库"**. `system-unit` 提供原子能力 (ast · file · mongo ...) .
AI 产代码调这些 Unit · 不碰底层 API.

```
 [+] 能力扫描  →  HookBus 注册
 [+] 热加载 unit.core
 [+] 持久化能力清单
```

### `[4]  Knowledge`  ::  AI 可编程记忆

非普通文档系统 —— **AI 的可编程记忆体系**.

```
 books     ::  skill  (技能手册, 教 AI 用 Hook)
               lore   (领域知识)
 prompt    ::  LM 必读章节  →  每次查章节自动附带
 search    ::  pgvector 语义搜索
 hooks     ::  saas.app.knowledge.getToc · saas.app.knowledge.getChapter · saas.app.knowledge.search
 source    ::  本地预置 (代码声明, 只读)  +  用户扩展 (数据库)
```

### `[5]  Solution 市场`  ::  超级个体商店

应用模板 (含 app + unit + workflow + agent) 可**购买 → 安装 → 卸载**.
超级个体做的 Solution 上架 → 其他用户装到自己 Runner 直接用.

`biz ::` **被动收入支柱之一**.

### `[6]  FRP 自动公网化`  ::  零运维部署通道

```
 Runner 启动  →  frpc.toml 自动生成  →  连入 SaaS frps  →  分配子域名  →  应用公网可达
```

解决超级个体最头疼的部署问题 :: 不用买服务器 · 配 DNS · 装 Nginx · 申 SSL.
一行 `docker-compose up` 搞定.

```
 [x] frps   内置于 SaaS Docker compose
 [x] frpc   内置于 Runner 镜像
 [ ] 自定义域名 CNAME 绑定  (Phase 4 完善)
```

### `[7]  Storage 网盘`  ::  跨租户 MD5 去重

完整网盘能力 :: 目录树 · 分享链接 (永久/临时/密码) · 拖拽 · 断点续传.

`highlight ::` MD5 跨租户引用计数  →  同文件全平台只存一份物理副本  →  显著省存储.

### `[8]  AI 代码生成流水线  [WIP]`

三层 Agent + 确定性工具 + 影子环境 · 保证 AI 产出可控.

```
 Design Agent  (产 JSON Schema)
      │
      ▼
 Dev Agent     (并行 · 一方法一次 LLM 调用)
      │
      ▼
 Integrator    (Babel AST + json-schema-to-zod + 规则审计)
      │
      ▼
 集成测试      (影子 MongoDB + Hook mock + OTel trace)
      │
      ▼
 QA Agent      (读 trace 判断)
      │
      ▼
 人工 approval
      │
      ▼
 签名分发  →  Runner 热加载
```

详见 [`PLAN.md`](PLAN.md).

---

## `# stack`  —  技术栈

```
 layer              ::  choice                                                    note

 web frontend       ::  Astro 5 + Vue 3 + Pinia + Tailwind                       模块化管理后台
 saas backend       ::  NestJS 11 + TypeScript                                    模块化 AI 服务
 ai orchestration   ::  LangChain · LangGraph                                     Agent 运行时 + Checkpoint
 ai providers       ::  OpenAI · Anthropic · Google GenAI · Azure OpenAI · DeepSeek
 primary db         ::  MySQL (TypeORM)                                           业务数据
 vector db          ::  PostgreSQL + pgvector                                     Knowledge 语义搜索
 cache              ::  Redis (ioredis)                                           会话 / 状态
 runner db          ::  MongoDB                                                   应用数据 + 影子调试表
 realtime           ::  Socket.IO                                                 三端长连接
 runner rt          ::  Fastify + zx                                              轻量节点
 runner codegen lang::  纯 JavaScript (ES Modules)                                零编译 · 热加载友好
 runtime validation ::  Zod  (schema 由工具自动生成)                              AI 不写 schema · 幻觉隔离
 tunneling          ::  FRP 0.61.1                                                Runner 公网化
 https              ::  Caddy 2                                                   自动 Let's Encrypt
 observability      ::  OpenTelemetry + in-band trace                             随 WS 回传 SaaS · 零外部 collector
 code AST           ::  Babel parser · traverse                                    Integrator 工具链
```

---

## `# modules`  —  模块清单

### `saas :: src/`

`src/core/`  —  核心能力

```
 agent-runtime   ::  Agent 加载 · 工具注入 · 对话流
 ai              ::  LLM 调用 · 上下文构建
 hookbus         ::  事务总线 · 生命周期拦截
 plugin          ::  插件编排 (规划中, 可能并入 Solution)
 langgraph       ::  Checkpoint 持久化 (StateGraph 编排层 Phase 3 补)
 prompt          ::  Prompt 工程中心
 tip             ::  AI 提示管理
 function-call   ::  函数调用协议
```

`src/app/`  —  业务模块

```
 agent           ::  Agent 元信息管理
 conversation    ::  会话 · IM · SSE 流
 identity        ::  多主体 · RBAC · CASL
 knowledge       ::  知识书本 · 章节 · 语义搜索
 solution        ::  Solution 市场
 runner          ::  Runner 注册与管理
 storage         ::  网盘 + MD5 去重
 resource        ::  资源库
 todo            ::  待办
 ai-models       ::  AI 模型配置
```

### `web :: web/src/modules/`

```
 agent           ::  AI 对话工作区
 runner          ::  Runner 5-Tab 控制面板 (Performance · Domain · AppDomain · App · Solution)
 webmcp          ::  前端操作 SDK + Demo
 hookbus-debug   ::  Hook 调试工作台
 storage         ::  网盘界面
 todo            ::  待办管理
 identity        ::  身份权限
 knowledge       ::  知识库浏览
 solution        ::  Solution 市场
 ai-provider     ::  AI 模型服务商
 mongo-explorer  ::  MongoDB 浏览
 im              ::  即时通讯 (服务层)
```

### `runner :: runner/src/modules/`

```
 registration    ::  Socket 握手 + FRP 自启
 runner-control  ::  控制面板后端 API (Token 鉴权)
 frpc            ::  FRP 客户端生命周期
 hookbus         ::  Hook 注册与发布
 webmcp          ::  页面声明缓存与派发
 mongo           ::  MongoDB 连接
 solution        ::  Runner 本地 Solution 管理
 task            ::  zx 任务执行
 proxy           ::  代理层
```

### `unit-core :: runner/src/unit-core/`

AI 生成代码的**运行时原语库**:

```
 ast             ::  代码 AST 操作
 file            ::  文件系统
 mongo           ::  MongoDB 访问
```

---

## `# status`  —  开发进度

### `[OK]` 已完成 :: 基础设施

```
 [x]  Docker 一键部署           (SaaS + Runner 双 compose · Dockerfile 内置 FRPC)
 [x]  Runner 5-Tab 控制面板     (Performance · Domain · AppDomain · App · Solution)
 [x]  Knowledge 模块             (pgvector + LM 必读 + 本地预置 + Hook 暴露)
 [x]  Solution 市场              (CRUD / 市场 / 购买 / 安装 / 卸载)
 [x]  Storage 网盘               (MD5 跨租户去重)
 [x]  FRP 自动公网化             (frpc 自启 · Caddy HTTPS)
 [x]  HookBus + Unit Core        (装饰器 + system-unit 原语)
 [x]  WebMCP                     (SDK + Demo)
 [x]  身份权限 RBAC / CASL
 [x]  AI 对话 + 流式 SSE + 多模态输入
 [x]  Runner 注册 + 密钥管理
```

### `[WIP]` 进行中 :: AI 核心闭环

```
 [ ]  Phase 0  协议契约         call_hook debug + Design Agent JSON + Dev Agent prompt + 代码分发
 [ ]  Phase 1  代码生成流水线    Design / Dev / Integrator / QA Agent + 影子环境 + 人工 approval
 [ ]  Phase 2  对话记忆         定长分块 + 双层向量索引 + Session tool + Hook 历史独立 section
 [ ]  写操作行级权限 + 审计拦截
 [ ]  Runner 零信任验证
```

### `[TODO]` 未来 :: 差异化能力

```
 [ ]  LangGraph StateGraph 编排层 + 编排 Agent
 [ ]  主动 AI 触发层             (行为埋点 + 规则引擎)
 [ ]  语音链路                   (ASR + TTS + 实时中断)
 [ ]  Runner 离线降级策略
 [ ]  多 frps 高可用 + 自定义域名 SSL 自动化
 [ ]  实时 log 流
```

详见 [`PLAN.md`](PLAN.md).

---

## `# principles`  —  设计理念

### `[1]`  LLM 不写 Schema · 只用 Schema

`axiom ::` 幻觉最容易发生在 LLM 自由度高的地方.

```
 Design Agent    →  JSON Schema   (结构化, 可校验)
       │
       ▼
 Integrator      →  Zod           (工具确定性, 非 LLM)
       │
       ▼
 Dev Agent       →  import Zod 做校验 · 不编写 schema
```

**→ LLM 的自由度被最大程度压缩.**

### `[2]`  拆小 · 并行 · 确定性合并

```
 [+]  Dev Agent 每次只生一个方法  (单方法上下文小, 幻觉率指数下降)
 [+]  多方法并行生成              (Promise.all)
 [+]  AST 工具合并 · 不是 LLM 合并
```

### `[3]`  集成测试主导 · 无单元测试

```
 [+]  Service 内部方法真互调  (update 真调 findOne, 不 mock)
 [+]  只 mock 外部 Hook       (签名自动生成)
 [+]  OTel in-band trace      随响应回传 · QA Agent 读 trace 定位问题
```

### `[4]`  定长分块 + 原文返回 · 拒绝摘要

对话记忆**不做 LLM 摘要** (lossy · 偏差累积).

```
 chunk   ::  约 2000 字 / 按消息边界软对齐 / 不硬切
 overlap ::  相邻 chunk 15% 重叠
 index   ::  双层向量  (chunk 粗筛 + message 精搜)
 recall  ::  返回完整原文 · 让 LLM 在 raw context 上自己推理
```

### `[5]`  SaaS 稳定 · Runner 可弃

```
 saas    ::  元平台 · AI Agent 团队的家 · 必须高可用
 runner  ::  租户的机器 · 稳定性租户自担
 backup  ::  SaaS 保存所有代码镜像 · Runner 挂了能一键恢复
```

### `[6]`  Debug 作为协议一等公民

```
 call_hook(..., { debug })
       │
       ├─  prod   ::  context 不激活 · SpanProcessor 直接丢弃 · 零开销
       ├─  debug  ::  DB 操作 → 影子表 · 外部调用 → mock
       └─  trace  ::  随响应回传 · 无需部署外部 collector
```

---

## `# quickstart`

```
 requires ::
   Node.js  >= 18
   pnpm     >= 8
   Docker + Docker Compose
```

### `saas ::`

```bash
$ pnpm install
$ cp .env.example .env

$ docker-compose up -d            # pgvector + redis + Caddy + frps
$ pnpm run start:dev              # backend
$ cd web && pnpm run dev          # frontend
```

### `runner ::` (租户侧)

```bash
$ cd runner
$ docker-compose up -d
```

首次启动 → 在 SaaS 的 Runner 管理页面创建 Runner → 拿 `runnerKey` 填入 Runner 配置.

### `build ::` 生产

```bash
$ pnpm run build
```

---

## `# tree`

```
 azure-ai/
   ├── web/                  # Astro + Vue 前端
   │    └── src/modules/      ::  功能模块
   ├── src/                  # NestJS 后端
   │    ├── app/              ::  业务模块
   │    ├── agents/           ::  AI Agent 定义  (Phase 1 扩展)
   │    ├── core/             ::  核心模块
   │    └── config/           ::  配置
   ├── runner/               # Fastify Runner
   │    ├── src/modules/      ::  通信与控制模块
   │    ├── src/unit-core/    ::  AI 代码运行时原语
   │    └── docker/           ::  Runner Docker 配置
   ├── plugins/              # 插件目录 (Solution 依赖)
   ├── docker-compose.yml    # SaaS 基础设施
   ├── PLAN.md               # 演进计划
   └── pnpm-workspace.yaml
```

---

## `# refs`

```
 →  PLAN.md         演进计划
 →  /docs           模块总览
 →  DEVELOPMENT.md  开发指南
 →  CLAUDE.md       Claude Code 导引
```

---

## `# license`

`UNLICENSED`  —  私有项目 · 保留所有权利.
