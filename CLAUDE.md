# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

```
 ╭─────────────────────────────────────────────────────────────╮
 │   小蓝 (Azure AI)   ::   AI 生成 + 租户自托管 PaaS          │
 │   target :: 超级个体   vs :: Replit Agents / Lovable / v0   │
 │                                                              │
 │     SaaS 产代码  ──►  签名分发  ──►  Runner 本机执行        │
 │                                         └──►  FRP 自动公网化 │
 ╰─────────────────────────────────────────────────────────────╯
```

> roadmap → [`PLAN.md`](PLAN.md)  ·  panorama → [`README.md`](README.md)

---

## `# arch` — 三进程拓扑

单仓 · pnpm workspace · 三个 `package.json` 各自 build & 部署.

```
 ┌──────────────┐   HTTP     ┌───────────────┐  Socket.IO   ┌──────────────┐
 │   web/       │ ◄────────► │    src/       │ ◄──────────► │   runner/    │
 │ Astro + Vue3 │            │  NestJS 11    │  HTTP+sign   │  Fastify 5   │
 │ Pinia + TW   │            │  SaaS 元平台  │  ──────────► │  Socket.IO   │
 │ 管理后台     │            │  高可用 [*]   │              │  Mongo · zx  │
 └──────────────┘            └──────┬────────┘              │  ESM · 本机  │
                                    │                       └──────┬───────┘
                                    │ frps             frpc        │
                                    └────────►  FRP  ◄─────────────┘
                                                  ▼
                                       公网  ·  <sub>.domain
```

| pid      | root        | role                                                                  |
|----------|-------------|-----------------------------------------------------------------------|
| `web`    | `web/`      | 管理后台 · 对话入口 · Runner 5-Tab 面板 · WebMCP Demo                  |
| `saas`   | `src/` (根) | AI Agent 编排 · Runner 注册 · Knowledge · Solution · 鉴权 · **高可用** |
| `runner` | `runner/`   | 跑 AI 产出代码 · **SaaS 不担其稳定性, 但保留镜像可一键恢复**           |

---

## `# cmd` — 常用命令

### `saas @ /` — NestJS 根目录

```bash
$ pnpm install                  # 触发 patchedDependencies
$ pnpm start:dev                # nest watch
$ pnpm start:debug              # + --inspect
$ pnpm build                    #  →  dist/
$ pnpm start:prod               # 生产 :: module-alias → dist/
$ pnpm lint                     # eslint --fix {src,apps,libs,test}
$ pnpm format                   # prettier --write

# jest roots = test/  (不是 src/)
$ pnpm test                     # *.spec.ts · 排除 *.e2e-spec.ts
$ pnpm test:watch
$ pnpm test:cov                 #  →  coverage-unit/
$ pnpm test:e2e                 # test/jest-e2e.json
$ pnpm test -- path/to/f.spec.ts       # 单文件
$ pnpm test -- -t "name pattern"       # 名字过滤

# TypeORM · DataSource :: src/config/data-source.ts
$ pnpm migration:generate       #  →  src/migrations/InitSchema
$ pnpm migration:run
$ pnpm migration:revert
```

### `runner @ /runner`

```bash
$ pnpm dev                      # tsx watch src/main.ts
$ pnpm build                    # tsc  →  dist/
$ pnpm start                    # node dist/main.js
$ pnpm lint                     # tsc --noEmit  (纯类型检查)
```

### `web @ /web`

```bash
$ pnpm dev                      # astro dev
$ pnpm build                    #  →  dist/
$ pnpm preview
```

### `infra :: docker`

```bash
$ docker-compose up -d                          # SaaS :: pgvector + redis + Caddy + frps (7000/7500/20000-20099)
$ cd runner && docker-compose up -d             # Runner :: mongo + redis + app + Caddy · Dockerfile 内置 frpc
```

---

## `# alias` — 路径映射

```
   @/*        →  src/*
   @core/*    →  src/core/*
   @plugin/*  →  plugins/*
```

TS + Jest 共用. 生产期由 `module-alias` 映射到 `dist/*` (见 `package.json._moduleAliases`).
Jest 额外 mock :: `^uuid$  →  test/mocks/uuid.ts`  (ESM uuid 需 mock).

---

## `# core` — 跨文件才能看懂的设计

### `[1/7]  HookBus`  ::  AI 代码白名单入口

```
 ┌──────────────────────────┐       ┌──────────────────────────┐
 │  SaaS  HookBus            │       │  Runner  HookBus           │
 │  src/core/hookbus/        │       │  runner/src/modules/hookbus/│
 │  @HookHandler 自动发现    │       │  独立实现,不依赖 Nest     │
 │  HookLifecycleInterceptor │       │  UnitCore.registerToHookBus│
 └──────────────────────────┘       └──────────────────────────┘
                    ▲                         ▲
                    │  tools auto-inject      │
                    │  ┌──────────────────┐   │
                    └──┤ call_hook         ├──┘
                       │ call_hook_async   │
                       │ call_hook_batch_sync
                       │ call_hook_batch   │
                       └──────────────────┘
             强制注入每个加载的 Agent tool set
```

source :: `src/core/agent-runtime/services/agent-runtime.service.ts` · `tools/call-hook.tools.ts`
**rule :: AI 能调的一切走 Hook · 禁止自由 `import`.**

### `[2/7]  Unit Core`  ::  Runner 侧能力基座(AI 的"标准库")

`runner/src/unit-core/`. 启动时扫描 `workspace/` + `system-unit/{ast,file,mongo}` → 解析 Hook 清单 → 注册到 Runner HookBus → 落库 `RunnerDbService`.
**rule :: AI 产出的 Service 只能调 Unit Core + 用户声明 Hook · 不能直接访问 Node API.**

### `[3/7]  Knowledge`  ::  AI 可编程记忆

`src/app/knowledge/`. 非普通文档库:

```
 ├─ 书本类型  ::  skill (教 AI 用 Hook)  +  lore (领域知识)
 ├─ LM 必读   ::  每次 prompt 自动附带
 ├─ 存储     ::  独立 PostgreSQL + pgvector · 不混 MySQL
 ├─ Hook 出口 ::  get_knowledge_toc · get_knowledge_chapter · search_knowledge
 └─ 来源     ::  local seed (代码声明,只读) + db 扩展
                 →  src/app/knowledge/local/local-knowledge.seed.ts
```

### `[4/7]  WebMCP`  ::  AI → 前端操作协议

结构化指令 (**非**视觉点击) :: 组件声明操作 → AI 调 `web_control` Hook → Runner webmcp 派发.
demo :: `web/src/modules/webmcp/`

### `[5/7]  存储分层`  ::  别搞混

```
 MySQL        (TypeORM)      SaaS          业务数据
 PostgreSQL   (pgvector)     SaaS          Knowledge 向量 · 未来对话分块向量
 Redis        (ioredis)      SaaS+Runner   会话 · Hook 队列 · 状态缓存
 MongoDB                     Runner        应用数据 + Phase 1 影子调试集合
```

### `[6/7]  代码生成流水线  [WIP]`  ::  详见 PLAN.md

```
 Design Agent  (产 JSON Schema)
      │
      ▼
 Dev Agent     (并行 · 一方法一次 LLM 调用)
      │
      ▼
 Integrator    (babel AST + json-schema-to-zod + 规则审计)
      │
      ▼
 影子环境集成测试 + OTel in-band trace
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

**constraint :: LLM 不写 Zod schema** — 幻觉隔离, schema 由 Integrator 从 Design JSON 自动生成.
Dev Agent 每次**只生一个方法**, 并发, 单方法上下文小.

### `[7/7]  Debug / OTel`  ::  协议一等公民

```
 call_hook(name, payload, { debug: { enabled, sandbox, traceId } })
                                    │
       ┌────────────────────────────┴────────────────────────────┐
       │                                                         │
  debug=false                                              debug=true
       │                                                         │
       ▼                                                         ▼
  NoopTracerProvider                            @opentelemetry/api + sdk-trace-node
  ns 级 no-op                                   ├─ log.event(name, attrs)
  无 span 产生                                  │     ⇒  SpanEvent on active span
                                                └─ InMemorySpanExporter
                                                      ⇒  trace 随 WS 回传 CallHookResult
```

**forbidden :: `console.log`  ·  独立 LogRecord.**

---

## `# conv` — 模块索引惯例(强约束)

每模块 ← 同级 `module.md`  (不是 `module.tip`, 不能塞子目录).
content :: 文件列表 + 函数清单(带 `@keyword-en`) + 关键词索引.

reference :: `src/core/hookbus/module.md` · `src/core/agent-runtime/module.md`

```
 flow ::
   任务  →  并行 Grep/Read 相关 module.md  →  锁定代码位置
         →  读 JSDOC @keyword-en           →  按需读函数体
   新增  ::  必补 module.md
   修改  ::  同步更新 module.md
```

详细规范见全局 `~/.claude/CLAUDE.md`.

---

## `# style`

```
 [x] TS strict = true
     └─ 但 exactOptionalPropertyTypes = false  ·  strictFunctionTypes = false
 [x] SaaS 全局 Guard  ::  JwtAuthGuard  +  AbilityGuard (CASL RBAC)
 [x] Runner type = "module"  ·  纯 ESM  ·  别引 CJS
 [x] Prettier + ESLint + 3 patches
     └─  ts-api-utils  ·  eslint config-array  ·  eslint object-schema
```

---

## `# goto` — 入口速查

| 想改 ...                             | 目标路径                                                       |
|--------------------------------------|----------------------------------------------------------------|
| AI Agent 工具注入 / 对话流           | `src/core/agent-runtime/`                                      |
| Hook 注册·调度·拦截  (SaaS)          | `src/core/hookbus/`                                            |
| Hook 运行时          (Runner)        | `runner/src/modules/hookbus/`                                  |
| Runner 能力原语                      | `runner/src/unit-core/system-unit/{ast,file,mongo}/`           |
| 知识书本 / 向量搜索                  | `src/app/knowledge/`  ·  `src/app/knowledge/local/`            |
| Runner 5-Tab 前端面板                | `web/src/modules/runner/`                                      |
| Runner 后端控制 API + FRP            | `runner/src/modules/runner-control/`  ·  `…/frpc/`             |
| Solution 市场 / 安装                 | `src/app/solution/`  ·  `runner/src/modules/solution/`         |
| Storage · MD5 去重                   | `src/app/storage/`                                             |
| WebMCP SDK / Demo                    | `web/src/modules/webmcp/`  ·  `runner/src/modules/webmcp/`     |
| Prompt 中心                          | `src/core/prompt/`                                             |
| 多模型适配                           | `src/core/ai/`  ·  `src/app/ai-models/`                        |
