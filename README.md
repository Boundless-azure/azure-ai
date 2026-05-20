```
 __        _______ _______ ______          __  __
 \ \      / / ____|__   __|  ____|   /\   |  \/  |
  \ \ /\ / / |__     | |  | |__     /  \  | \  / |
   \ \/  \/ /|  __|    | |  |  __|   / /\ \ | |\/| |
    \  /\  / | |____   | |  | |____ / ____ \| |  | |
     \/  \/  |______|  |_|  |______/_/    \_\_|  |_|

     weteam  ::  v0.0.1
     AI 企业构建 PaaS  ·  应用 + Agent + 云 Runner

     " we  ::  are your AI team "
```

> `prod ::` AI 产应用 · 应用配套 Agent 同步导出 · 云 Runner 一站式自动运维

lang :: [English](/docs/readme/README.en.md) · [中文](/docs/readme/README.zh-CN.md)

---

## `# whoami`

**weteam** != 聊天机器人 · != 无代码平台 · != 纯 IDE 助手

是 **"AI 给企业产应用 + 同步产配套 Agent + 全托管在云 Runner 上运行"** 的 PaaS.

```
 target ::
   AI 企业构建  ( 想用 AI 替代部分团队 · 想给业务装 AI 控制层 · 想做内部应用工厂的中小企业 )

 product ::
   [+]  App Studio     ::  AI Agent 团队 (Design → Dev → QA) 产全栈应用代码
   [+]  Agent Export   ::  每个应用 同步产出 配套 Agent · 可独立导出 · 贴合应用任何控制
   [+]  Cloud Runner   ::  一站式自动运维 · 企业不碰 Docker · 按订阅付费

 value-loop ::
   企业用自然语言描述需求
        │
        ▼
   App Studio  →  产代码 (前后端 + DB)  +  同步产 应用 Agent (绑定该应用 Hook 清单)
        │
        ▼
   weteam 云 Runner  →  自动部署 · 自动域名 · 自动 SSL · 自动监控 · 自动备份
        │
        ▼
   企业拿到 ::  一个能用的应用  +  一个永远能操作该应用的 Agent
        │
        ▼
   Agent 可导出  →  接入企业 IM · 嵌入工作流 · 作为 API 调用 · 跨应用编排
```

---

## `# product`  —  三件商品

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                    │
 │   [1]  App Studio                                                  │
 │        ────────────                                                │
 │        AI Agent 团队产全栈应用 :: Design → Dev → QA                │
 │        客户:  企业 IT / 业务部门 / 数字化负责人                     │
 │        计费:  按生成次数 + 按存储 + 按 Runner 用量                  │
 │                                                                    │
 │   [2]  Agent Export                                                │
 │        ─────────────                                               │
 │        应用 = 代码 + 一个**永远能操作它**的 Agent                   │
 │        Agent 含 :: Hook 清单 · Prompt 模板 · WebMCP 声明 · 状态记忆 │
 │        出口:  接入企业 IM · 作为 API · 嵌入工作流 · 跨应用编排      │
 │                                                                    │
 │   [3]  Cloud Runner                                                │
 │        ─────────────                                               │
 │        weteam 全托管 · 企业不碰 Docker / 域名 / SSL / 监控          │
 │        SLA:  企业级 (起步 99.5%, 合规客户独立 VPS)                  │
 │        计费:  按月订阅 · 按 CPU/RAM 阶梯 · 按 Agent 调用次数        │
 │                                                                    │
 └──────────────────────────────────────────────────────────────────┘
```

`moat ::` 三件商品**绑成一根价值链** —— 单买 App Studio = Lovable, 单买 Agent = Manus, 单买 Cloud Runner = Vercel. **三个一起 + 同一份元数据驱动 = 当前市场无 1:1 对位**.

---

## `# vs`  —  跟业界的差异

| 对手                          | 它们的局限                                   | weteam 的不同                                  |
|-------------------------------|----------------------------------------------|------------------------------------------------|
| **Lovable Teams · v0**        | 只产代码 · 应用部署完 Agent 链路就断了        | 应用 + **配套 Agent** 同步产出 · Agent 持续控应用 |
| **Replit Teams**              | 云 IDE 强 · 但 Agent 不绑定具体应用            | Agent 与应用 1:1 绑定 · Hook 白名单即 capability  |
| **Manus 企业版 · Devin**      | 通用 Agent · 不产长期持有的"商品级应用"        | 产**可交付资产** :: 应用 + Agent + 运维三合一    |
| **火山引擎 · 阿里 Qwen 企业** | 卖模型 / API · 不卖"应用 + 运维"               | 卖**端到端交付物** · 企业拿到即可用             |
| **Bubble · Webflow · 钉钉宜搭** | 无代码 · vendor lock-in · 不开放 Agent 协议    | 产**真代码** · WebMCP 协议开放 · 可导出 Agent    |
| **n8n · Zapier**              | 自动化流程 · 非应用开发                       | 产**完整应用** + Agent 同时能跑流程            |

```
 moat ::
   HookBus           (Agent 的 capability 清单 = 商品定义)
 + WebMCP            (应用控制协议 = Agent 操作 UI 的标准)
 + Agent Export      (Agent 作为可交付资产)
 + Cloud Runner      (全托管运维 + 企业级 SLA)
 + 同源元数据驱动     (一处声明 → 应用 + Agent + 权限 + 审计 全自动对齐)
```

---

## `# arch`  —  三端架构

```
 ┌───────────────────────────────────────────────────────────────────┐
 │                              weteam                                │
 ├──────────────────┬────────────────────────┬──────────────────────┤
 │   web/            │     src/                │     runner/           │
 │   Astro + Vue     │     NestJS 后端         │     Fastify Runner    │
 │   管理后台        │     (元平台 · 高可用)    │     (云 Runner 容器)   │
 │                   │                         │                       │
 │  > 对话入口        │  > AI Agent 团队         │  > 应用代码执行        │
 │  > Agent 市场      │  > HookBus 调度          │  > Unit Core 基座     │
 │  > 控制台 + 计费   │  > Agent Export 引擎      │  > 自动域名 + SSL     │
 │                   │  > Runner 编排 + 隔离     │  > Docker + cgroup    │
 └──────────────────┴────────────────────────┴──────────────────────┘
                         ▲
                         │  Socket.IO 长连接
                         │  HTTP + 签名分发
                         │  FRP 反向代理
                         ▼
```

```
 role ::
   web      ─►  交互层  ·  企业客户操作入口  ·  控制台 + 计费 + Agent 商店
   saas     ─►  元平台  ·  AI Agent 团队 + HookBus + Agent Export 引擎
                **必须高可用** · 一切产出与计费的源头
   runner   ─►  weteam 云 Runner  ·  全托管 Docker 容器  ·  per-customer 隔离
                自动域名 + SSL + 监控 + 备份  ·  企业不碰底层
                SLA  ::  起步 99.5%  ·  合规客户升独立 VPS 至 99.9%
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

### `[5]  Solution Catalog + Agent Export`  ::  可交付资产引擎

```
 Solution (应用模板, 含 app + unit + workflow + agent)
      │
      ├─►  企业内部 Catalog  ::  本企业生成的应用模板 · 跨部门复用
      │
      └─►  公开市场 (后期)   ::  weteam 审核 · 厂商上架 · 抽佣
```

**Agent Export** 是这一层的核心新协议:

```
 Application  ──产出──►  Agent Bundle
                         ├─ Hook 清单         (capability)
                         ├─ Prompt 模板       (角色与上下文)
                         ├─ WebMCP 声明        (UI 控制协议)
                         ├─ 状态记忆 schema    (长期 context)
                         └─ 计费元数据         (按调用次数)

 出口 ::
   [+]  接入企业 IM        (钉钉 / 飞书 / 企业微信 / Slack)
   [+]  作为 HTTP API       (Agent-as-a-Service)
   [+]  嵌入工作流           (n8n / 内部 BPM 节点)
   [+]  跨应用编排           (多 Agent 协作)
```

`biz ::` Agent 调用次数计费  +  Solution Catalog 抽佣  +  应用部署订阅 = **三层叠加营收**.

### `[6]  Cloud Runner`  ::  一站式自动运维

```
 企业点 "部署"  →  weteam 调度  →  Docker 容器拉起  →  自动域名 + SSL + 监控  →  应用可达
```

企业**不碰任何底层**:: 不买服务器 · 不配 DNS · 不装 Nginx · 不申 SSL · 不写 Dockerfile.

```
 phase A  (0-50 客户)    ::  单机 Docker + cgroup + Caddy + FRP 内部反代
 phase B  (50-200)        ::  + gVisor runtime (容器逃逸防护)
 phase C  (200+)           ::  Docker Swarm / Nomad 横向扩
 phase D  (合规客户)       ::  per-customer 独立 VPS · 单独 SLA 协议

 capability ::
   [x] Caddy 自动 SSL (Let's Encrypt)        现有
   [x] FRP 反代 + 子域名分配                  现有
   [ ] 多客户 Docker 编排 + cgroup 限流        Phase 0.5
   [ ] 容器逃逸防护 (gVisor runtime 开关)      Phase 1
   [ ] 自动备份 + 一键恢复                    Phase 2
   [ ] 自定义域名 CNAME 绑定                  Phase 4
```

### `[7]  Storage 网盘`  ::  跨客户 MD5 去重

完整网盘能力 :: 目录树 · 分享链接 (永久/临时/密码) · 拖拽 · 断点续传.

`highlight ::` MD5 跨客户引用计数  →  同文件全平台只存一份物理副本  →  显著省存储成本.

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
 [x]  Storage 网盘               (MD5 跨客户去重)
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

### `[5]`  SaaS 高可用 · Cloud Runner 企业级 SLA · 客户零运维

```
 saas    ::  元平台 · AI Agent 团队 + Agent Export 引擎 · 必须高可用
 runner  ::  weteam 全托管 · per-customer 容器隔离 · weteam 担稳定性
 backup  ::  代码镜像 + Agent Bundle + 数据卷 三层备份 · 客户一键恢复
 SLA     ::  起步 99.5%  ·  独立 VPS 客户升 99.9%  ·  合规客户单签
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

## `# quickstart`  —  开发者本地起 weteam

> 本节面向 **weteam 开发者**, 不是面向客户. 客户使用 weteam 不需要装任何东西, 浏览器打开控制台即可.

```
 requires ::
   Node.js  >= 18
   pnpm     >= 8
   Docker + Docker Compose
```

### `saas ::` 元平台

```bash
$ pnpm install
$ cp .env.example .env

$ docker-compose up -d            # pgvector + redis + Caddy + frps
$ pnpm run start:dev              # backend
$ cd web && pnpm run dev          # frontend
```

### `runner ::` 云 Runner 容器  (开发态本地起一份)

```bash
$ cd runner
$ docker-compose up -d
```

首次启动 → SaaS 控制台创建 Runner 实例 → 拿 `runnerKey` 注入容器. 生产环境下 weteam 自动调度多客户容器, 开发态此步等价于"模拟一个客户"用于联调.

### `build ::` 生产

```bash
$ pnpm run build
```

---

## `# tree`

```
 weteam/                  # repo 内部代号: azure-ai
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
