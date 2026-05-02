# 小蓝 (Azure AI) 演进计划

> 截止 2026-05-01。产品定位:**面向超级个体的 AI 生成 + 自托管运行 PaaS**。
> 基础设施(Docker 化 / Runner 面板 / Knowledge / Solution 市场 / FRP 自动公网化 / Storage 去重 / OTel debug 协议 / Terminal Unit Core)已完整,当前核心缺口是 **三层 Agent 架构 → 代码生成闭环**。

---

## 零、现状认知

### ✅ 已完成(不再列入计划)

- **Docker 一键部署**:SaaS(pgvector + Redis + Caddy + frps)、Runner(mongo + redis + app + Caddy),Dockerfile 内置 FRPC
- **Runner 控制面板**:5 Tab(Performance / Domain / AppDomain / App / Solution),Token 鉴权,WebSocket FRP 控制
- **Knowledge 模块**:pgvector + LM 必读 + 本地预置(skill/lore)+ Hook 暴露
- **Solution 市场**:CRUD / 市场 / 购买 / 安装 / 卸载 / 标签
- **Storage 网盘**:目录树 + 分享链接(永久/临时/密码)+ MD5 跨租户引用计数
- **FRP 自动公网化**:frpc 启停 + `frpc.toml` 动态生成 + 子域名分配
- **HookBus + Unit Core**:装饰器注册 + 生命周期拦截 + system-unit 原语(ast/file/mongo)
- **WebMCP**:前端操作协议 + SDK + Demo 验证
- **身份权限**:RBAC + CASL + 多主体
- **OTel in-band trace**(原 Phase 0.1):双端 `event.log` 接口 + `BasicTracerProvider + InMemorySpanExporter` + 随 WS 回传 `debugLog`,提交 `5189158`
- **Terminal Unit Core**(LLM 通道地基):Runner 侧 `system-unit/terminal/` 已落地,提交 `b309b4e`。**这是 Phase 1 的关键前置 — LLM 直接玩 git/shell 的入口**

### 🎯 真正的缺口(本计划覆盖范围)

核心闭环:**三层 Agent 架构(群管 / Dialogue / Graph)→ 代码生成流水线 → SaaS 签名分发 → Runner 热加载**

产品差异化:**对话记忆分层 / 主动 AI / 语音链路 / LangGraph 编排**

---

## 一、总体节奏

```
Phase 0  协议与契约            (地基,大部分完成)
  ↓
Phase 1  三层 Agent 架构        (核心架构层,2-3 周) ★ 新增
  ↓
Phase 2  代码生成流水线落地     (核心闭环,4-6 周)
  ↓
Phase 3  对话与记忆            (体验质变,2 周)
  ↓
Phase 4  产品差异化            (主动 AI + 语音 + 编排,4-6 周)
  ↓
Phase 5  长期优化              (按需推进)
```

> **设计哲学:限制的艺术** — 用 prompt 约束 LLM 行为,系统层只管全局不可越界的状态(归属/锁/视野),其他能力通过 **terminal 单一通道**开放给 LLM。LLM 当成会用 shell 的开发者,复用其训练里的 git / 文件系统 / shell 知识,不教私有 API。

---

## Phase 0:协议与契约(地基层)

**目标**:把代码生成流水线的跨模块契约定下来。产出物是**类型定义 + 协议文档**,不求功能完整。

### 0.1 call_hook debug 协议 + OTel in-band trace

**核心决策**:
- **OTel API-only**:Runner 启动仅装 `@opentelemetry/api` + `sdk-trace-node`,Hook 代码调薄 API `log.event(name, attrs)`;span 命名 / 属性遵循 OTel Semantic Conventions,未来可零改造接任意后端(Jaeger / Tempo / DataDog)
- **信号选型**:一次 `call_hook` = 一个 **Span**,`log.event()` 产出挂在当前 active span 的 **SpanEvent**(不用独立 LogRecord,QA Agent 读 trace 一次拿全,时间戳自动跟 span 对齐)
- **in-band 导出**:`InMemorySpanExporter` 替代 OTLPExporter,请求末尾按 traceId flush 当次 spans,塞进 `CallHookResult.trace` 随 WS 响应回传。**Runner 零外部 collector**
- **Context 承载**:`AsyncLocalStorage` 传递 `{ debug, traceId, spanBuffer, sandbox }`,`log.event()` 无需显式传参
- **采样 / 开销**:debug=false 走 `NoopTracerProvider`,`log.event()` 是 ~ns 级 no-op;debug=true 走 `AlwaysOnSampler`(头采样 100%)。关闭态无 span 产生,不占 TTL
- **异常自动挂载**:`log.event` 封装内部调用 `Span.recordException` + `Span.setStatus(ERROR)`,业务代码只抛异常即可

**协议草案**:
```ts
interface CallHookOptions {
  debug?: {
    enabled: boolean;
    sandbox: 'shadow' | 'mock' | 'full-mock';
    traceId?: string;     // 调用链串联
  };
  timeout?: number;
}

// 响应附带(仅 debug 时)
interface CallHookResult<T> {
  result: T;
  trace?: {
    traceId: string;
    spans: OTLPSpan[];     // 标准 OTLP JSON
  };
}
```

**改动位置**:
- [src/core/hookbus/](src/core/hookbus/) 新增 `types/call-hook-protocol.ts`
- [src/core/agent-runtime/tools/call-hook.tools.ts](src/core/agent-runtime/tools/call-hook.tools.ts) 扩参
- [runner/src/modules/hookbus/](runner/src/modules/hookbus/) 新增 `tracing/in-band-processor.ts`
- Runner 启动时初始化 OTel SDK

**验收**:
- [x] call_hook 传 debug 参数运行时激活 trace buffer
- [x] 响应含完整 trace(SpanEvent 投影 → `debugLog`)
- [ ] debug=false 零开销验证(benchmark)

> **状态**:已完成主体(提交 `5189158`),双端 `hook-log.factory` + `event.log` 接口落地;benchmark 还没跑,补一下就完全 done。

---

### 0.2 Design Agent 产出 JSON Schema 规范

**核心决策**:Design Agent 产出的不是代码,是**完整领域描述**。Dev Agent 基于此并行生成。

**Schema 结构**:
```json
{
  "domain": "order",
  "entities": {
    "Order": {
      "fields": { ... JSON Schema ... },
      "storage": "mongodb",
      "collection": "orders"
    }
  },
  "hooks": {
    "inventory.lock": {
      "payload": { ...JSON Schema... },
      "result": { ...JSON Schema... },
      "idempotent": false
    }
  },
  "service": {
    "OrderService": {
      "state": {},
      "methods": {
        "createOrder": {
          "payload": { ...JSON Schema... },
          "result": { ...JSON Schema... },
          "calls": ["this.validate", "hook:inventory.lock"],
          "description": "...",
          "keywords": ["order", "create"]
        }
      }
    }
  },
  "tests": [
    {
      "name": "create then update",
      "steps": [
        { "call": "createOrder", "input": {...}, "expect": { "status": "pending" } }
      ]
    }
  ]
}
```

**关键字段**:
- `calls`:**显式声明依赖**,Integrator 用此做 AST 规则审计(不能调未声明项)
- `tests`:集成测试场景,Design Agent 同步产出(避免 Dev Agent 自测自验)
- JSON Schema 工业标准,兼容 OpenAPI,便于未来接客户端 SDK

**改动位置**:
- [src/agents/](src/agents/) 新增 `design-agent/`
- [src/core/prompt/](src/core/prompt/) 新增 `design-agent.prompt.ts`

**验收**:
- [ ] 给需求"订单服务",Design Agent 产出符合 schema 的 JSON
- [ ] `calls` 字段覆盖率 100%(人工抽查)
- [ ] 产出能通过 JSON Schema validator

---

### 0.3 Dev Agent prompt 约束(JS + Zod + log.event + AST 规则清单)

**核心决策**:
- **纯 JS**(ES modules),Runner 热加载零编译成本
- **Zod schema 由 Integrator 从 JSON Schema 自动生成**(`json-schema-to-zod`),Dev Agent 只 import 使用,**不写 schema**
- Dev Agent 每次调用只生成一个方法,输入是完整 design JSON + 目标方法名
- AST 规则作为 Integrator 闸门

**AST 规则清单**(初版 5 条):
1. 方法入口必须 `inputSchema.parse(arg)`
2. 只能调 `design.methods[x].calls` 中声明的依赖
3. 每次 Hook 调用前后必须有 `log.event()`
4. 禁止 `eval` / `new Function` / 动态 require
5. 禁止访问 `design.state` 之外的类字段

**改动位置**:
- [src/agents/](src/agents/) 新增 `dev-agent/`
- [src/core/prompt/](src/core/prompt/) 新增 `dev-agent-codegen.prompt.ts`
- 约束示例(放进 prompt):
```js
export class OrderService {
  async createOrder(payload) {
    const input = createOrderPayloadSchema.parse(payload);
    log.event('order.create.start', { userId: input.userId });
    const lock = await callHook('inventory.lock', {...});
    log.event('inventory.locked', { lockId: lock.lockId });
    return orderSchema.parse({...});
  }
}
```

**验收**:
- [ ] 给定 design + 方法名,Dev Agent 产出通过所有 AST 规则
- [ ] 10 次生成测试,规则违反率 <5%

---

### 0.4 代码归属与版本协议(Runner 主权)

> **架构决策修订(对齐 Phase 1 三层架构)**:代码物理归属在 Runner 而非 SaaS。git 仓库与代码共置于 Runner 的 solution 目录(`runner/data/solutions/<solutionId>/.git`),**SaaS 不持有代码权威副本**。

**核心决策**:
- **代码 source of truth = Runner**(git 在 Runner,跟 plugin 代码物理共置)
- **版本号 = git tag**(`v<n>`),Runner 端 `runner_code_registry` 表 version 字段即 tag 名
- **审批/分发不传代码全文**,只传 patch(JSON 描述差异 + 文件内容片段),Runner 自己 apply
- **SaaS 用私钥签 patch,Runner 用公钥验**(防反向攻击)
- **SaaS 端可选灾备镜像**(用户在 Runner 控制面板勾选,默认关闭),勾上后每次 commit 完 Runner 主动推 tarball 到 SaaS
- **不存 git history 在 SaaS**,只可选存最新版本 tarball

**Runner 端结构**:
```
runner/data/solutions/<solutionId>/
  ├─ .git/                    ← 权威 history
  ├─ apps/<appA>/...
  ├─ shared/...
  └─ solution.manifest.json
```

**改动位置**:
- [src/app/runner/](src/app/runner/) 新增 `services/code-dispatch.service.ts` (只发 patch)
- [runner/src/modules/](runner/src/modules/) 新增 `code-install/` (apply patch + verify signature)
- 新增 system-unit:[runner/src/unit-core/system-unit/git/](runner/src/unit-core/system-unit/git/) (内部封装 simple-git)
- MySQL 表 `runner_code_registry`(solutionId / version=gitTag / commitSha / signedAt / approvedBy)
- Dockerfile 加 `apt install git`(几 MB)

**验收**:
- [ ] SaaS 能下发签名 patch 到 Runner,Runner 验签后 apply + commit + tag
- [ ] Runner 重启后,unit-core 从 git HEAD 自动恢复代码运行
- [ ] (可选)灾备镜像勾选打开,Runner 每次 commit 后推 tarball 到 SaaS
- [ ] 用户在 Runner 控制面板 unprovision 灾备 → SaaS 端清理对应 tarball

---

## Phase 1:三层 Agent 架构(群管 + Dialogue + Graph)

**目标**:建立全局视图的"群管 Agent",重新定义 dialogue 层职责,简化 code-agent 的 graph 结构。**这是后续所有代码生成和多会话协调的地基,不可跳过**。

**设计哲学**:**限制的艺术**
- 用 **prompt 约束** LLM 行为(规则写在 system prompt,不靠代码闸门)
- 用 **terminal 单一通道**给能力(LLM 复用训练里的 git/shell 知识,不教私有 hook)
- 系统层只管**全局不可越界的状态**(归属、锁、跨 session 视野),其他全交给 LLM

### 1.0 架构总览

```
┌──────────────── 群管 Agent (Director, 全局单例) ──────────────────────┐
│                                                                      │
│ 视野: 跨 session / group / solution / app                            │
│ 触发: 建群 / 对话提生成意图 / 起 graph 前 / graph 完成               │
│ 守门: 跨应用警告 + app 跨群修改检测 + solution↔group 1:1 强约束       │
│ 出口: 自有 IM 通道(messageType = system-notice)                      │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ 批准 + 提供 context
                               ▼
┌─────────────── Dialogue 层 (per session, N 实例) ────────────────────┐
│                                                                      │
│ 视野: 当前会话                                                       │
│ 收主管 context → 需求梳理 → 起 graph → 多 graph 路由                 │
│ 不再做 contextResolve(那是群管的事)                                 │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ 起 workflow (context 已就绪)
                               ▼
┌─────────────── Code-Agent Graph (per workflow) ──────────────────────┐
│                                                                      │
│ 视野: 单次代码生成                                                   │
│ 线性 6 节点(无 conditional edge 分叉):                               │
│   branchManagement → requirementsAnalysis → hookDesign →             │
│   codegen → qa → finalize                                            │
│ LLM 在节点内用 terminal hook 直接玩 git                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**三层各管各的视野,不越界**:
- 群管管"哪个 solution / app / 群"是绑定关系,不管对话内容
- Dialogue 管"这个会话当前在做什么",不管别的会话
- Graph 管"这次代码生成怎么走",不管 solution 是谁的

---

### 1.1 群管 Agent (Director Agent)

**定位**:与 [src/agents/azure-ai/](src/agents/azure-ai/) / [src/agents/code-agent/](src/agents/code-agent/) 同级的预定义 agent,新增 [src/agents/director-agent/](src/agents/director-agent/)。

**部署模式**:**无状态决策器 + DB 一致性**(不是"内存单例")。
- 业务状态全在 DB(4 张表),群管实例本身不存内存状态
- 多实例可并存,通过 DB 行锁 (`SELECT FOR UPDATE`) 保证一致性
- 路由层可选按 solutionId hash 到同一实例做缓存优化(非必需)
- **滚动部署不停服 / 故障域隔离**

**接口模型(关键架构):事件驱动 + HookBus 拦截器,无双向 RPC**

群管不通过"申请-批准"专用 hook 与 dialogue 对话,而是**通过 HookBus 拦截器订阅相关 hook 调用**:

```
       ┌─────────────────────── HookBus ────────────────────────┐
       │  各 hook 调用 (saas.app.solution.bind /                 │
       │              saas.app.codeagent.startWorkflow /         │
       │              saas.app.codeagent.workflow.finalized)     │
       └────────────────────┬───────────────────┬────────────────┘
                            │ 拦截器层(同步)   │ 事件总线(异步)
                            ▼                   ▼
                       ┌────────────────────────────┐
                       │   Director (无状态实例)     │
                       │                             │
                       │   ① 同步守门(拦截器内做)   │
                       │      不通过 → 抛 hook 错误   │
                       │      → 调用方拿到拒绝       │
                       │                             │
                       │   ② 异步介入(订阅事件)     │
                       │      → 通过自有 IM 出口     │
                       │        在相关 session 发    │
                       │        system-notice        │
                       └────────────────────────────┘
```

**触发模型**(全部由 hook 调用驱动,而非 dialogue 主动申请):

| 触发源 (hook) | 群管职能 | 实现层 |
|---|---|---|
| `saas.app.group.create` | 弹"新建 solution / 选已有 / 跳过" → 关联 | 事件订阅 |
| `saas.app.solution.bind` | 检查 1:1 强约束;违反则**拦截器抛错** | 拦截器(同步守门) |
| `saas.app.codeagent.startWorkflow` | 检查锁 + session_workflow 1:1;违反则拦截器抛错 | 拦截器(同步守门) |
| `saas.app.codeagent.workflow.finalized` | 释放锁 + 扫 `app_solution_ref` 广播 system-notice | 事件订阅(异步) |
| `saas.app.app.create` / `update` | 维护 `app_solution_ref` 表 | 事件订阅 |

**好处**:
- **dialogue 不感知群管**:dialogue 只调普通 hook(如 `startWorkflow`),hook 失败就处理失败 — 群管对它是透明的"基础设施"
- **不存在"申请-批准 RPC"**:守门逻辑收纳进 HookBus 拦截器,跟现有的 zod 校验 + ability 检查同层(参考提交 `7f03b58`)
- **故障隔离**:群管挂了,**异步事件**会暂存(事件总线/消息队列),恢复后追平;**同步守门**短暂不可用 → 拦截器降级策略可以选"全拦"或"全过",看产品决策
- **审计天然有**:HookBus 调用记录 + 事件流落 DB,出问题能 replay

**守门职责清单**:

| 类型 | 触发条件 | 处理 |
|---|---|---|
| **硬拦** | 试图把同 solution 关联第二个 group | 直接拒绝绑定,违反 1:1 |
| **硬拦** | 同 solution 试图起第二条 active workflow | 在 `requestApproval` 阶段拒绝,提示等待或取消当前 |
| **硬拦** | session 已挂 active workflow,试图起第二条 | 提示等待当前完成 |
| **软警告** | solution-1 修改共享 app,solution-2 也引用了 | 群管广播 `system-notice` 到 solution-2 的 group,不阻塞 |
| **软警告** | 二开导致 hook 签名变化 | 同上 |

**全局 state(DB schema 草案)**:

```sql
-- solution 与 group 的强 1:1 绑定
solution_group_binding (
  solutionId    VARCHAR PK,
  groupId       VARCHAR UNIQUE NOT NULL,    -- 1:1 强约束
  boundAt       TIMESTAMP,
  boundBy       VARCHAR                      -- userId
)

-- app 归属与共享(支持共享时一对多)
app_solution_ref (
  appId         VARCHAR PK,
  solutionId    VARCHAR NOT NULL,
  isShared      BOOLEAN DEFAULT FALSE,       -- 是否允许跨 solution 引用
  createdByWf   VARCHAR                      -- 哪条 workflow 创建的
)

-- session 当前活跃工作流
session_workflow (
  sessionId     VARCHAR PK,
  workflowId    VARCHAR,                     -- nullable
  status        VARCHAR,                     -- idle | gathering | tracking | suspended
  updatedAt     TIMESTAMP
)

-- solution 级别锁
solution_lock (
  solutionId    VARCHAR PK,
  workflowId    VARCHAR,                     -- 持锁 workflow
  sessionId     VARCHAR,                     -- 持锁会话
  lockedAt      TIMESTAMP,
  status        VARCHAR                      -- active | suspended
)
```

**IM 出口约定**:
- 群管以**系统身份**在相关 group 发消息,发件人 UI 显示"系统/群管 Agent"
- messageType 新增 `system-notice` 类型
- dialogue 层**不应该**把 `system-notice` 作为 LLM 对话上下文(避免污染),前端用差异化 UI 标识
- 跟现有 `chat-session-data` 的 messageType 体系对齐,扩展枚举即可

**改动位置**:
- 新增 [src/agents/director-agent/](src/agents/director-agent/)
  - `agent.desc.ts`(定义,与 azure-ai/code-agent 同构)
  - `agent.handle.ts`(IM 出口工具)
  - `services/director.service.ts`(无状态决策服务)
  - `interceptors/director-guard.interceptor.ts`(HookBus 拦截器,挂在守门 hook 上)
- 4 张 DB 表 + 对应 entity / repository / migration
- **不引入"申请-批准"专用 hook**;守门复用现有 HookBus 拦截器机制(参考 `7f03b58`)
- 订阅事件(在 HookBus 事件总线层):
  - `group.created` / `solution.bound` / `workflow.started` / `workflow.finalized` / `app.created` / `app.updated`
- 扩展 `ChatMessageType` 枚举 → 加 `SYSTEM_NOTICE`

**验收**:
- [ ] 建群事件触发,群管发起 solution 关联交互(IM 内消息可见)
- [ ] 已绑 solution 的 group 试图重复绑 → 被拒绝
- [ ] dialogue 申请起 graph 时锁冲突 → 收到拒绝带清晰理由
- [ ] workflow 完成,锁自动释放
- [ ] 跨应用软警告广播到对应 group(可在前端看到 system-notice 消息)
- [ ] system-notice 消息不进入 LLM 对话 context(查 prompt 输入)

---

### 1.2 Dialogue 层职责重定义

**不再做的事(从 dialogue 移走给群管)**:
- ~~contextResolve(找 solution / 找 app)~~
- ~~跨应用决策~~
- ~~锁管理~~

**保留 + 强化的事**:
- 单 session 内的对话编排
- 收到群管批准 + context → 需求梳理(可能多轮 interrupt 反问)
- 起 graph + 维护 `Map<workflowId, graphState>`
- IM 出入桥接:用户消息 → 路由到对应 graph 的 resume / graph `__interrupt__` → IM 文本

**State 机(per session)**:

```
                ┌────────┐  普通话题
                │  idle  │ ◄────────────────────────┐
                └────┬───┘                          │
       明确生成意图 → 需求梳理                     │
                ▼                                   │
           ┌──────────┐                              │
           │gathering │ ◄── 反问/补充 ──────────────┤
           │需求/澄清 │                              │
           └────┬─────┘                              │
   信息齐 → 调  │                                    │
   startWorkflow│  hook 被拦截器拒绝(群管硬拦)     │
   hook         │  → 把错误翻译成自然语言告知用户    │
                ▼  ────────────────────────────────► idle/gathering
           ┌──────────┐  graph end (workflow.finalized 事件)
           │tracking  ├──────────────────────────────┘
           │N 条 graph│
           └────┬─────┘
   graph        │            user reply
   __interrupt__│           (按 wfId 路由)
                ▼
           ┌──────────┐
           │relaying  ├─── resume graph ──► tracking
           │问→IM      │
           └──────────┘
```

**关键不变量**:
- dialogue **不感知群管存在** — 它只调普通 hook,hook 失败就处理失败,守门是 HookBus 拦截器层的事
- `tracking` 不阻塞 `gathering`(用户在等 graph A 时可起 B,但 B 调 hook 时拦截器层会按 1:1 规则拒)
- `gathering` 阶段就要拿到 solution context(从当前 session 的 `solution_group_binding` 读),不能在 graph 内才发现
- graph interrupt 期间用户发新意图 → 不打断当前等待,起新 gathering(尝试调 hook 大概率被拦截器拒,然后 dialogue 翻译成"当前 session 已有进行中工作流,请等待完成")

**私聊场景特殊处理**:

私聊 session 默认**不关联 solution**(没有 `solution_group_binding` 记录),纯聊天属性。用户表达 codegen 意图时,按"硬限制不留逃生口"原则,**禁止在私聊里直接起 graph**,引导用户转到专属群:

```
私聊 session (无 solution 绑定)
   │
   │ 用户: "帮我做个订单系统"
   ▼
意图分类 → 检测到生成意图
   │
   ▼
dialogue 检查 session 没绑 solution
   │
   ▼
不进 gathering,改发系统提示:
   ┌──────────────────────────────────────────────────────────┐
   │ 代码生成需要在专属群里进行(每个 solution 一个群)。      │
   │ 要现在为你建一个吗?                                       │
   │   [建群 + 转移此需求] [稍后]                             │
   └──────────────────────────────────────────────────────────┘
   │
   ▼ 用户点 [建群 + 转移此需求]
   ▼
dialogue 调 saas.app.group.create hook
   ├─ 群管在拦截器里弹"新建 solution / 选已有"交互
   ├─ 创建完后:把私聊里这条需求摘要作为首条消息塞进新群
   └─ 前端跳转到新群

私聊 session 保持原状(不变成绑定状态),用户后续仍可纯聊天。
```

**决策依据**:
- 私聊里没群就不让 codegen,符合 "硬限制不留逃生口"
- 但**不让用户感觉被拒** — 给一键建群 + 上下文转移的顺滑路径
- 建群是产品级一等公民操作(像 Slack 的 "Create channel from this thread"),不绕开 1:1 约束
- 用户拒绝建群 → 私聊里就是聊天,LLM 不会再追着提 codegen(降频策略)

**改动点**:
- dialogue 意图分类后加分支:绑定状态检查
- 新增 hook `saas.app.group.createFromSession(sessionId, requirementDigest)` — 建群 + 转移需求摘要
- 前端处理"建群跳转"指令

**意图分类**(轻量分流):
- 用户消息进来 → dialogue 层先用便宜模型(deepseek-chat / Haiku)分类:
  - `普通对话`:直接 LLM 回复,不动状态机
  - `生成意图`:进 gathering
  - `跟随某条 active graph 的回复`:resume 对应 graph
  - `补充信息`:同上 resume,LLM 内部消化(参考 Phase 1 的 agentic interrupt 模式)
- **第一版偷懒**:把"补充"全当 resume 喂回去,LLM 自己消化;真要重开就用 `/restart` 字符串硬切

**改动位置**:
- [src/app/conversation/services/](src/app/conversation/services/) 新增 `dialogue-state.service.ts`
- [src/app/conversation/services/send-msg.hook-handler.service.ts](src/app/conversation/services/send-msg.hook-handler.service.ts) 接入 state 机
- 新增意图分类 LLM 调用(轻量)
- DB 加 `session_workflow` 表(也由群管共享读)

**验收**:
- [ ] 普通对话不进 gathering
- [ ] 提生成意图 → 自动进 gathering 并申请群管
- [ ] 群管驳回 → 用户看到清晰原因
- [ ] graph interrupt 期间用户发新意图 → 起新 gathering(可能被群管拒)
- [ ] graph 结束自动通知群管释放锁
- [ ] 多 graph 并存(不同 solution)互不干扰

---

### 1.3 Code-Agent Graph 简化(线性 6 节点)

**取消 conditional edge 分叉(new vs refactor)**,所有差异收进 LLM 在节点内的策略判断。

```
START
  ↓
[1] branchManagement       ← LLM 用 terminal 探索 solution 现状
  │                          产出 strategy: new-app | modify-app |
  │                                         cross-app-refactor | shared-extract
  │  (interrupt: 跟用户对齐策略)
  ↓
[2] requirementsAnalysis   ← agentic interrupt 模式做需求澄清
  │  (interrupt: 信息不足时反问)
  ↓
[3] hookDesign             ← 锁定契约
  │  (interrupt: 重要 hook 让用户 review)
  ↓
[4] codegen                ← LLM 用 terminal 直接写文件 + 自由 git 操作
  │   * 复用 LLM 训练里的 git/shell 知识
  │   * 不调精细 hook,只调 terminal.exec
  ↓
[5] qa                     ← 影子环境跑测试 + 读 OTel trace + LLM 评判
  ↓
[6] finalize               ← AST 审计 + 系统统一 commit + tag + 通知群管
  ↓
END
```

**节点共有特征**:
- 入参假设 solution context 已就绪(由 dialogue 层填好,缺则 fail-fast)
- 任何节点都可能 `interrupt` 跟用户对齐(agentic 模式)
- LLM 自主判断要不要发问 → 用 zod discriminated union 闭死决策(`ask` | `commit`)
- 节点内多轮循环兜底(max round = 4)防失控

**`branchManagement` 节点的核心**(取代之前设计的 contextResolve + impactAnalysis + diffDesign 三节点):

```ts
async function branchManagementNode(state, ai, terminalTool) {
  const decision = await ai.callStructured({
    systemPrompt: `
      cwd: ${state.solutionDir}
      你可用 terminal 调 git log / cat / find / ls 查 solution 现状,
      判断这次任务的执行策略,产出 strategy。
    `,
    schema: z.object({
      strategy: z.enum([
        'new-app',           // 新增一个 app 到 solution
        'modify-app',        // 改某 app 内代码
        'cross-app-refactor',// 跨 app 改动(如改共享 hook)
        'shared-extract',    // 抽公共代码到 shared/
      ]),
      affectedPaths: z.array(z.string()),
      rationale: z.string(),
    }),
    tools: [terminalTool],   // ← LLM 自主探索
  });
  return decision;
}
```

**这一个节点取代了之前 contextResolve / impactAnalysis / diffDesign 三个节点**,因为它们本质是同一件事 — LLM 一次决策搞定,不需要拆。

**LLM 行为约束**(写在每个节点的 system prompt):

```
你工作在 solution 仓库 /solutions/<id>/。规则:
1. 所有代码修改用 terminal 工具,cwd=该目录
2. 仅在系统通过 finalize 节点统一 commit,你不要主动 commit
3. 出错时用 git checkout -- . 清理工作树,然后向系统报告失败
4. 不要 git push,不要操作远程,不要碰 .git/ 内部
5. 不要新建分支,所有改动落在 main
6. interrupt 反问用户时,只在缺关键信息时问,常识能补的不要问
```

**LangGraph 工程要点**:
- `compileCodeGenGraph().compile({ checkpointer: typeormCheckpointSaver })` — 已有 saver,接入即可
- `graph.stream(init, { configurable: { thread_id: workflowId } })` — workflowId 作 thread_id
- 任意节点 `interrupt({ kind, ...payload })` → dialogue 层拿到 `__interrupt__` event 后用 IM 转发给用户
- 用户回复 → `graph.invoke(new Command({ resume: msg.content }), { configurable: { thread_id } })`

**改动位置**:
- 重构 [src/agents/code-agent/dialogues/graph/code-gen.graph.ts](src/agents/code-agent/dialogues/graph/code-gen.graph.ts)
- 现有 5 节点(requirementsAnalysis / splitModules / hookDesign / loadPlugins / generateModules)替换为新 6 节点
- 节点实现位置 [src/agents/code-agent/dialogues/nodes/](src/agents/code-agent/dialogues/nodes/)
- 旧 `splitModules` / `loadPlugins` 节点弃用(功能进 branchManagement + LLM 自主探索)

**验收**:
- [ ] 给定 solution context,branchManagement 节点能产出合理 strategy(覆盖 4 种 strategy)
- [ ] codegen 节点 LLM 能用 terminal 完成"读现有代码 → 改文件 → git diff 检查"
- [ ] 全流程任意节点出错,工作树能用 `git checkout -- .` 干净恢复
- [ ] graph 内 LLM 自主 interrupt → dialogue 层正确桥接到 IM,resume 后流程继续
- [ ] graph 用 checkpointer 持久化,SaaS 重启后能 resume 进行中的 workflow

---

### 1.4 Solution 物理结构 + Git 模型

**Runner 端物理结构**:

```
runner/data/solutions/<solutionId>/
  ├─ .git/                        ← solution 级一个 repo
  ├─ apps/
  │   ├─ <appA>/src/...
  │   ├─ <appB>/src/...
  │   └─ <appC>/src/...
  ├─ shared/                      ← 多 app 合并时共享代码
  └─ solution.manifest.json
```

**Git 模型规则(简化版)**:

| 规则 | 说明 |
|---|---|
| solution 级一个 repo | `runner/data/solutions/<id>/.git`,跟代码物理共置 |
| 单 worktree,无分支 | 只用 main,不开 wf 分支(锁住串行就够) |
| **per-solution 锁(强串行)** | 同 solution 同时只允许 1 条 active workflow |
| **workflow 期间用 git stash 做节点 checkpoint** | 节点完成时 `git stash push -m "wf:<id> [<node>]"`;不污染 commit history |
| **一 workflow 一 commit** | finalize 节点 `git stash pop` 取最后 stash → `git add . && commit + tag v<n+1>` |
| 失败 / abort | `git stash list \| grep wf:<id>` → 全部 drop + `git checkout -- .` |
| **崩溃恢复** | LangGraph checkpoint 给"当前在哪个节点",对应的 stash 给"当时的代码状态",`git stash apply` 恢复 |
| 回滚就用 git revert | 串行 history,无 rebase 冲突 |

**节点 checkpoint 流程**:

```
workflow start  → record startSha = HEAD
hookDesign  完  → git stash push -m "wf:abc-123 [hookDesign]" --keep-index
codegen     完  → git stash push -m "wf:abc-123 [codegen]"
qa          完  → git stash push -m "wf:abc-123 [qa]"
finalize        → 取最后 stash → pop → git add . && commit + tag
失败            → git stash list | grep wf:abc-123 → drop 全部 + git checkout -- .
进程崩溃恢复    → 读 LangGraph checkpoint 知当前节点 → 找对应 stash → apply → 续跑
```

**为什么不用 commit 做 checkpoint**:commit 进 history 不可逆(要 reset 才能丢);stash 是"暂存抽屉",pop/drop/apply 干净利落,**完美匹配"workflow 完成才落地"的语义**。

---

**Terminal 安全边界(LLM 唯一能力通道)**:

> **现有基础**(已落地于 `b309b4e`):
> - ✅ cwd 初始锁定到 `workspacePath`
> - ✅ 进程池上限(maxPoolSize = 8)
> - ✅ 超时(sync 30s / async 5min)
> - ✅ 输出 buffer 上限(1MB)
> - ✅ 进程记录持久化到 `.terminal-records/`

**还需要补加的物理闸门**(不补则 prompt 约束 = 空中楼阁):

| 闸门 | 当前 | 风险点 | 改进 |
|---|---|---|---|
| **shell 模式越界** | `shell: true` 直接拼字符串 | LLM 写 `cd .. && rm -rf ~` 可越狱 cwd | spawn 前对 command 字符串扫描:禁含 `cd /` / `cd ..` / 绝对路径(除允许的)/ `&& cd`;或改 `shell: false` + 命令解析 |
| **命令白名单** | 任意命令 | LLM 跑 `curl evil.com` / `rm -rf /` | 加白名单:`git`/`node`/`pnpm`/`cat`/`ls`/`find`/`grep`/`head`/`tail`/`wc`/`diff`/`echo` |
| **git 子命令子白名单** | 任意 git 子命令 | `git push --force` / `git remote add` 出网 | 子命令白名单:`log`/`show`/`diff`/`status`/`branch`/`checkout --`/`add`/`commit`/`tag`/`stash`;**禁** `push`/`remote`/`fetch`/`clone`/`submodule`/`config --global` |
| **env 隔离** | `env: { ...process.env }` 全继承 | LLM 通过 env 看到 secrets / tokens | 白名单 env(只透 `PATH` / `HOME` 等基础);敏感 var 屏蔽 |
| **网络** | 子进程能直连外网 | 渗透 / 数据外发 | network namespace 隔离;有真需要走专用 hook (如 `runner.npm.install` 走白名单 registry) |
| **磁盘 quota** | 无 | LLM 写无限大文件填满磁盘 | per-solution 目录大小上限(100MB?) |

**改进位置**:[runner/src/unit-core/system-unit/terminal/unit-core/terminal.pool.ts](runner/src/unit-core/system-unit/terminal/unit-core/terminal.pool.ts) 在 `spawn` 前加一道命令安全检查器 `command-safety-check.ts`。

**这条提到 P0 优先级** — "限制的艺术"哲学的物理底线。

**LLM 操作通道**:
- **唯一通道 = `terminal.exec(cmd, cwd)`**(已在 b309b4e 落地)
- LLM 自主调用 `git log` / `cat` / `find` / `git diff` / `git checkout -- .` 等
- **不为 LLM 包装精细 git hook**(避免给它学习成本,用它训练里见过的标准命令)
- LLM 只在 finalize 节点之前才 commit(prompt 强约束 + finalize 节点统一执行)

**系统层 hook**(不暴露给 LLM,内部使用):

| Hook | 调用方 | 作用 |
|---|---|---|
| `runner.solution.create(solutionId)` | 群管 | 物理建仓 + 初始 commit + tag v0.0.0 |
| `runner.solution.acquireLock(solutionId, workflowId)` | 群管 | 拿锁(系统逻辑,锁状态在 SaaS DB) |
| `runner.solution.releaseLock(solutionId, workflowId)` | 群管 | 释放锁 |
| `runner.solution.heatReload(solutionId)` | finalize 节点 | commit 完后触发 unit-core 重载 |

**Runner 跑代码与 git 的同步**:
- finalize commit 完成后,Runner unit-core 触发热加载新代码
- 热加载失败 → 自动 `git revert` 回滚 + 通知群管告警 + 释放锁失败状态

**改动位置**:
- 新增 system-unit:[runner/src/unit-core/system-unit/git/](runner/src/unit-core/system-unit/git/)
  - `unit.core.ts` / `unit.hook.ts` / `unit-core/git.ops.ts`(simple-git 封装)
  - 跟 `system-unit/terminal/` 同构
  - **只暴露上述 4 个系统 hook,不暴露细粒度 git 命令**
- Solution 创建时机:dialogue 申请新建 → 群管批准 → 群管调 `runner.solution.create`
- Runner Dockerfile 加 `apt install git`

**验收**:
- [ ] 新建 solution,Runner 物理建仓 + 初始 commit + tag v0.0.0
- [ ] codegen 节点 LLM 自由 git 操作(log / cat / diff),不污染 history
- [ ] 节点完成时自动 `git stash` checkpoint,失败时全部 drop
- [ ] 进程崩溃后 SaaS 重启,LangGraph + git stash 联合恢复继续跑
- [ ] finalize 节点统一 commit,带正确的 wf:<id> 标识
- [ ] workflow 失败,工作树自动 clean(`git checkout -- .` + drop wf 相关 stash)
- [ ] revert 流程正常,版本号正确递增(v3 revert 后产 v4)
- [ ] 同 solution 第二条 workflow 试图启动 → 被锁拒绝
- [ ] LLM 在 terminal 试图 `cd .. && rm -rf` → 命令安全检查器拦截
- [ ] LLM 在 terminal 试图 `git push --force` → 子命令白名单拦截
- [ ] LLM 在 terminal 试图 `curl evil.com` → 命令白名单拦截
- [ ] env 中的敏感变量(API_KEY 等)不会泄漏给子进程

---

### 1.5 跨应用警告 / 跨群修改检测

**两种警告语义**:

| 类型 | 触发条件 | 处理 |
|---|---|---|
| **硬拦** | 试图把同 solution 关联第二个 group | 群管拒绝绑定 |
| **硬拦** | 同 solution 已有 active workflow,试图起第二条 | 群管在 `requestApproval` 阶段拒绝 |
| **硬拦** | session 已挂 active workflow,试图起第二条 | 同上 |
| **软警告** | solution-1 修改共享 app,solution-2 也引用了 | 广播 system-notice 到 solution-2 的 group,不阻塞 |
| **软警告** | 二开导致 hook 签名变化,影响其他 solution 调用方 | 同上 |

**实现机制**:
- 群管订阅 graph finalize 事件(通过 `releaseLock` hook 入口)
- 查 `app_solution_ref` 表 → 找出受影响 group → 发 system-notice
- 受影响 group 的 dialogue 层标记"上游变更未确认",下次该 session 起新 graph 时主动询问用户

**软警告内容模板**(渲染成自然语言):

```
[群管] 你引用的 apps/order 在另一个 solution 中已更新 (v3 → v4)。
       变更摘要: 新增 refund 支持,hook order.create 增加 refundable 字段。
       要不要同步更新?
       [一键合并] [稍后] [忽略此次]
```

**改动位置**:
- [src/agents/director-agent/services/director.service.ts] 加 finalize 事件订阅
- 每次 finalize 后扫描 `app_solution_ref` 表
- IM messageType 加 `SYSTEM_NOTICE` 类型(若现有未支持)
- 前端展示差异化(系统通知不混入 user/assistant 消息流)

**验收**:
- [ ] 同 solution 第二个 group 绑定 → 被拒绝,有清晰错误
- [ ] 共享 app 改动 → 受影响 group 收到 system-notice
- [ ] 受影响 group 下次起 graph,dialogue 层主动提示"上游变更"
- [ ] 软警告不阻塞当前 workflow 执行

---

### 1.6 与原 Phase 1(现 Phase 2)的关系映射

新架构落地后,原 Phase 1(现 Phase 2)的子项重新定位:

| 原 Phase 1 子项 | 在新架构下的归宿 |
|---|---|
| 1.1 Design Agent 实现 | **取消独立 agent**,功能归 graph 节点 `hookDesign`,LLM 直接出契约 |
| 1.2 Dev Agent 并行方法生成 | **取消独立 agent**,功能归 graph 节点 `codegen`,LLM 用 terminal 写文件 |
| 1.3 Integrator(确定性工具链) | **保留**,作为 finalize 节点的 AST 审计 + 拒收闸门 |
| 1.4 影子 MongoDB + 副作用沙箱 | **保留**,在 qa 节点内启用 |
| 1.5 QA Agent | **保留**,作为 qa 节点的 LLM 评判逻辑 |
| 1.6 人工 approval UI | **保留**,作为 finalize 前的 interrupt review 节点 |
| 1.7 写操作行级权限 + Hook 审计 | **保留**,与 graph 解耦,HookBus 拦截器层 |
| 1.8 Runner 零信任验证 | **保留**,与 graph 解耦,签名分发握手层 |

**减少 2 个独立 agent 实现成本**(Design / Dev 退化为节点 + LLM 直接做),但 Integrator/AST 审计/影子 mongo/approval/行级权限/零信任等关键能力都保留。

---

### 1.7 Todo 系统 + 消息关联(用户视角的产品外壳)

**设计哲学**:**主对话连贯放群里,todo 是反查索引不是分流容器,workflow 是 todo 的执行引擎之一**。

**关键认知**:不做 task thread / 子 session 物理分流。多 agent 协同就在群里(senderAgent 区分),消息通过 tag 跟 todo 关联,todo 是反查视图。这跟"限制的艺术"+ YAGNI 哲学一致 — 超级个体场景不需要团队协作的 thread 分流。

**Todo 跟 Workflow 关系(粒度互补)**:

| 概念 | 时间尺度 | 必要性 | 例子 |
|---|---|---|---|
| **workflow (graph)** | 几分钟到几小时 | 一次代码生成必有 | "把退款功能改完这一次" |
| **todo** | 几分钟到几周 | 用户想跟踪才有 | "订单系统 v2 完整迭代"(可能含 N 次 workflow) |

**关系**:0 / 1 / N — 一个 todo 可含 0 个 workflow(纯备忘)、1 个(简单需求)、N 个(大型迭代)。一个 workflow 也可以不挂 todo(快速生成跑完即弃)。

---

**实体最简形态**(基于现有 [src/app/todo/](src/app/todo/) 模块扩展):

```sql
todo (
  id              UUID PK,
  title,          -- 用户视角的任务标题
  description,
  ownerUserId,
  status,         -- pending | in-progress | awaiting-user | done | failed | abandoned

  -- 弱关联(可空,多对多)
  relatedSolution VARCHAR,   -- 跟哪个 solution 有关
  relatedSession  VARCHAR,   -- 在哪个 session 产生
  workflowId      VARCHAR,   -- 自动关联的当前 workflow(可空)

  -- 来源
  createdBy       VARCHAR,   -- 'user' | 'agent'
  createdByAgent  VARCHAR,   -- 哪个 agent 帮你建的(可空)

  -- 时间
  createdAt, updatedAt, completedAt, dueAt
)

todo_message_link (
  todoId, messageId, taggedAt,
  PRIMARY KEY (todoId, messageId)
)
```

---

**消息关联机制(三种来源)**:

| 来源 | 机制 |
|---|---|
| **用户手动 tag** | UI 上消息后边 "📌 关联到 todo" 按钮,选择 / 新建 todo |
| **agent 自动 tag** | agent 发消息时携带 `relatedTodoId`(在它心智里这条消息属于哪个 todo);对话里识别意图也能"agent 帮你开个 todo" |
| **workflow 自动 tag** | workflow 启动 / 中间状态 / 完成时,把进度消息自动 tag 到关联 todo |

**Todo 状态自动驱动**(沿用 director 事件订阅,跟跨应用警告同一套机制):

| 事件 | 关联 todo 状态 |
|---|---|
| `workflow.started` | → `in-progress` |
| `graph.__interrupt__` | → `awaiting-user` |
| `graph.resume` | → `in-progress` |
| `workflow.finalized` | → `done` |
| `workflow.failed` | → `failed` |
| 用户 abort | → `abandoned` |

**用户 / agent 完全不用手动维护 todo 状态**,事件流自动驱动。

---

**多 agent 协同 = 群里同处,不另开 thread**:

- 群里照常对话,不同 agent 通过 `senderAgent` 字段区分(前端差异化 UI)
- agent 之间用 @mention 协调(自然语言)
- director 守门:agent 加入群 / 调跨域 hook 时检查权限边界
- 协作产物的对话仍在主流,关联到同一 todo 通过消息 tag 反查聚合

```
solution group session (主对话,不被切碎)
├─ msg #1   user: "帮我加个退款"             [tagged → todo "v2 退款"]
├─ msg #2   code-agent: "好的,先看现有结构"  [tagged → todo "v2 退款"]
├─ msg #3   code-agent: "[workflow 启动]"     [tagged → todo "v2 退款"]
├─ msg #4   user: "另外提醒我周三发周报"      [tagged → todo "周报提醒"]
├─ msg #5   code-agent: "@qa-agent 该测哪些?"  [tagged → todo "v2 退款"]
├─ msg #6   qa-agent: "建议覆盖 X / Y / Z"    [tagged → todo "v2 退款"]
├─ msg #7   code-agent: "[workflow 完成]"     [tagged → todo "v2 退款"] ← 自动 done
└─ ...

todo 视图反向聚合:
  "v2 退款"     → msg #1, #2, #3, #5, #6, #7 + workflow wf-abc
  "周报提醒"    → msg #4
```

---

**azure-ai 元层视图**:

azure-ai 私聊里"看我所有任务"通过查询 todo 表聚合,而不是翻所有群对话:

| 只读 hook | 用途 |
|---|---|
| `saas.app.todo.listMine` | 当前用户全部 todo |
| `saas.app.todo.listBySolution(solutionId)` | 某 solution 下的 todo |
| `saas.app.todo.getRelatedMessages(todoId)` | 反查消息聚合 |

azure-ai 在私聊回答"我有几个项目在做" / "订单退款做完了吗" 等问题时,直接调这些只读 hook,**不查共享 session 库**(那个本来就不需要做)。

---

**改动位置**:
- 现有 todo 模块([src/app/todo/](src/app/todo/))扩展实体字段 + 新增 `todo_message_link` 表
- IM 消息 entity 加可选 `taggedTodoIds` 字段(查询性能起见冗余存,以 `todo_message_link` 为权威)
- `agent_runtime` 给 agent 发消息接口支持携带 `relatedTodoId`
- director 事件订阅扩展:订阅 workflow 状态事件 → 自动更新关联 todo 状态
- 新增只读 hook:`saas.app.todo.listMine` / `listBySolution` / `getRelatedMessages`
- 前端 IM UI:消息 hover 出"📌 关联 todo"操作 + todo 详情页"相关消息"反查 tab

**验收**:
- [ ] 用户能手动给消息打 todo tag(选已有 / 新建)
- [ ] agent 自动建 todo 时,用户能看到系统通知 "AI 帮你开了一个 todo: <title>"
- [ ] workflow 启动 / 完成 → 关联 todo 自动状态更新(不需手动)
- [ ] 在 todo 详情页能看到所有相关消息(按时间序)+ 关联的 workflow 进度
- [ ] azure-ai 私聊调 `listMine` 能拿到全局聚合视图,做到"我手头有 5 个 todo,3 个进行中"
- [ ] 多 agent 在同一 group 通过 senderAgent 区分,UI 差异化显示

**优先级:P1**(Phase 1 内做,因为它是用户视角"项目管理"的必备外壳 — 否则 workflow 跑了用户在哪看进度?)

---

### Phase 1 落地优先级

| 优先级 | 子项 | 理由 |
|---|---|---|
| **P0** | 1.4 Terminal 物理安全闸门(命令白名单 / shell 越界检测 / env 隔离) | "限制的艺术"哲学的物理底线;不补则 prompt 约束是空中楼阁 |
| **P0** | 1.1 群管 Agent 骨架 + 4 张 DB 表 + HookBus 拦截器 | 后续所有事的地基 |
| **P0** | 1.4 Solution 物理结构 + git system-unit + git stash checkpoint | 代码归属层 + 崩溃恢复能力 |
| **P0** | 1.2 Dialogue State 机(无群管申请协议) | 决定整个 session 怎么走;dialogue 透明使用普通 hook |
| **P1** | 1.3 Code-Agent Graph 简化(branchManagement + 6 节点骨架) | 把现有 graph 重构对齐(可暂用 mock LLM 跑通拓扑) |
| **P1** | 1.5 跨应用警告(硬拦在拦截器先做,软警告事件订阅后做) | 硬拦保产品安全,软警告后续 |
| **P1** | 1.7 Todo 系统 + 消息关联(扩展现有 todo 模块) | 用户视角项目管理外壳,workflow 跑完用户在哪看进度 |
| **P2** | 跨 solution 共享 app 模型(`isShared` 字段及对应交互) | 早期可不支持共享,等需求出现再做 |

**开工建议(Phase 1 首三周)**:
- 第 1 周:1.4 Terminal 安全 + 1.1 群管骨架 + DB — 物理底座
- 第 2 周:1.4 Solution 物理结构 + git system-unit + 1.2 Dialogue State 机
- 第 3 周:1.3 Graph 6 节点骨架(可暂用 mock LLM)+ 1.7 Todo 关联骨架(消息 tag + 自动状态)+ 1.5 硬拦拦截器

Phase 1 不做完不进 Phase 2(代码生成流水线落地)。**Phase 1 是"把架构对齐",Phase 2 是"把节点内的 LLM/AST/QA 实现填满"**。

---

## Phase 2:代码生成流水线落地(节点填充)

> **前置说明**:本 Phase 在 Phase 1 三层架构落地的前提下进行。原计划中的"Design Agent / Dev Agent 独立实现"已退化为 graph 节点 `hookDesign` / `codegen` 内 LLM 直接做,详见 Phase 1.3 的节点定义。本 Phase 聚焦 **节点内的 LLM 调用 / AST 审计 / 影子环境 / QA 评判 / approval UI / 行级权限** 等具体能力填充。

**目标**:让 Phase 1 搭起来的 graph 真正跑通,从需求 → 代码 → QA → approval → 落 Runner。**这是产品核心价值**。

### 2.1 hookDesign 节点 LLM 实现(原 1.1 Design Agent)

**改动位置**:[src/agents/design-agent/](src/agents/design-agent/)

**流程**:
```
需求描述
  ↓
Design Agent (1 次 LLM 调用)
  → 读 Knowledge(saas.app.knowledge.getToc + saas.app.knowledge.search)查相关技能手册
  → 产出完整 JSON(entities + hooks + service + tests)
  ↓
人工 review(可选,重大 service 建议)
```

**验收**:
- [ ] 3 个需求(订单/待办/评论)都能产出结构合规的 JSON
- [ ] JSON 里 `calls` 字段准确覆盖依赖

---

### 2.2 codegen 节点 LLM 实现(原 1.2 Dev Agent)

**改动位置**:[src/agents/dev-agent/](src/agents/dev-agent/)

**关键**:
- 并发调用(`Promise.all`),一方法一次 LLM 调用
- 每次调用上下文 = 完整 design + 目标方法名 + schema 文件路径
- 产出是**单个方法代码片段**(class body 内部的一段)

**验收**:
- [ ] 10 个方法的 service 能 10 次并行生成完
- [ ] 跨方法的类字段假设一致(不出现冲突)

---

### 2.3 Integrator(finalize 节点的 AST 审计)

**改动位置**:[src/core/code-pipeline/](src/core/code-pipeline/) 新增

**工具链**:
1. `json-schema-to-zod` 自动生成 Zod schema 文件
2. `@babel/parser` + `@babel/traverse` 解析每个方法代码
3. **AST 规则审计**(Phase 0.3 的 5 条规则)
4. `ts-morph` 风格的 AST 合并(其实用 babel 就行,我们没 TS)把方法合并进 class
5. 语法检查 + ESLint
6. 失败项**退回 Dev Agent 只重生成对应方法**(不全量重来)

**验收**:
- [ ] 10 个方法独立生成,Integrator 能合并成完整 class.js
- [ ] 违规方法被精准定位并回退
- [ ] 合并后文件通过 ESLint + 语法检查

---

### 2.4 影子 MongoDB + 副作用沙箱(qa 节点内启用)

**改动位置**:
- [runner/src/modules/runner-db/](runner/src/modules/runner-db/) 新增 `shadow-db.service.ts`
- [src/core/hookbus/](src/core/hookbus/) 新增 `sandbox/` 子目录

**功能**:
- debug 模式下 MongoDB 操作自动重定向到 `shadow_<runnerId>_<collection>`
- `snapshot-from-prod` 命令(带简单脱敏:email/phone 哈希化)
- TTL 自动清理影子集合
- 外部 HTTP / Socket 调用走 mock 适配器(debug 态不真发)
- 跨 Hook 调用透传 traceId + sandbox 标志

**验收**:
- [ ] 一个 Hook 在 debug 模式跑不污染生产集合
- [ ] 外部 API 调用在 debug 模式返回 mock

---

### 2.5 qa 节点 LLM 评判(原 1.5 QA Agent)

**核心决策**:**不做单元测试**。AI 生成的 service 方法间真实互调(update 真调 findOne),只 mock 外部 Hook。

**流程**:
```
Integrator 产出 service.js bundle
  ↓
部署到影子环境(staging Runner + 影子 MongoDB + Hook mock)
  ↓
按 design.tests 场景执行
  ↓
收集 OTel in-band trace
  ↓
QA Agent 读 trace + expect 对比 + 不变量检查
  ↓
pass → 进入人工 approval 队列
fail → trace 定位到具体方法 → 回退 Dev Agent 重生成
```

**Hook mock 自动生成**:用 `@anatine/zod-mock` 基于 Zod schema 产出符合结构的假数据。

**改动位置**:
- [src/agents/qa-agent/](src/agents/qa-agent/)
- [src/core/code-pipeline/](src/core/code-pipeline/) 新增 `integration-test-runner.service.ts`

**验收**:
- [ ] 完整 Service(CRUD)能从 Design→部署走通闭环
- [ ] QA Agent 能识别"update 没传 user_id 过滤"这种逻辑漏洞

---

### 2.6 人工 approval UI(finalize 前 interrupt review)

**改动位置**:
- [web/src/modules/](web/src/modules/) 新增 `code-approval/`
- [src/app/](src/app/) 新增 `code-approval/`

**UI 要素**:
- Service 代码 diff 视图(跟历史版本对比)
- QA Agent 结论 + trace 摘要(关键 span 高亮)
- 集成测试结果(pass/fail + 哪一步失败)
- 一键批准 / 驳回 / 附修改建议回 Dev Agent

**验收**:
- [ ] 租户管理员能在 UI 审批一个 Service 上线
- [ ] 批准后自动走 Phase 0.4 分发协议

---

### 2.7 写操作行级权限 + Hook 审计拦截

**核心决策**:AI 不能直接操作数据库,**必须走 HookBus**。HookBus 拦截器:
- 自动注入 `session.principalId` 作为 where 条件(行级权限)
- 审计写操作(谁在什么时间改了什么)

**改动位置**:
- [src/core/hookbus/](src/core/hookbus/) 新增 `interceptors/row-level-auth.interceptor.ts`
- [src/core/hookbus/](src/core/hookbus/) 新增 `interceptors/write-audit.interceptor.ts`

**验收**:
- [ ] 一个 Hook 试图改别人的数据 → 被拦截并记录
- [ ] 审计日志可查询

---

### 2.8 Runner 零信任验证

**改动位置**:[src/app/runner/](src/app/runner/) 注册握手增强

**内容**:
- Runner → SaaS 的所有响应必须带签名(用 Runner 私钥)
- SaaS 用对应公钥验证
- 伪造/重放响应被拒绝并告警

**验收**:
- [ ] 伪造 Runner 响应被拒绝

---

## Phase 3:对话与记忆(体验质变)

**目标**:解决 AI"失忆"问题。**定长分块 + 向量/关键词 + 原文返回**,拒绝摘要(避免 LLM 偏差)。

### 3.1 对话分块入库(定长软对齐)

**核心决策**:
- 目标约 2000 字 / chunk,**按消息边界软对齐**,不硬切
- 实际字数 1500-2200 浮动,不切断消息/Hook 调用链
- 相邻 chunk **15% 重叠**(避免答案切在边界)

**改动位置**:
- [src/app/conversation/](src/app/conversation/) 新增 `services/chunk.service.ts`

**实现**:消息写入时累积,超阈值且到消息边界时 flush。

**验收**:
- [ ] 长对话(200 条消息)被分成连续 chunk,无切断现象

---

### 3.2 双层向量索引 + 元数据

**索引结构**:
- **chunk-level**:整块 embedding,用于粗筛"这个话题在哪"
- **message-level**:单条 embedding,用于精搜"具体哪条"
- chunk 元数据:`startTime` / `endTime` / `participantIds` / `involvedHooks` / `entityRefs`

**改动位置**:
- 新增 pgvector 表 `session_chunks`(chunkId, vector, keywords, meta, rawContent)
- 新增 `session_messages_vec`(messageId, vector)

**关键词抽取**:用小模型(`deepseek-v3` 或 `gpt-4o-mini`)批量抽,不做语义压缩只抽关键词。

**验收**:
- [ ] 对话写入时触发 embedding + 关键词抽取 + 元数据落库
- [ ] 查询命中率 >80%(人工抽测)

---

### 3.3 query_session_history tool

**Tool Schema**:
```json
{
  "name": "query_session_history",
  "params": {
    "query": "string (向量语义查询)",
    "keywords": ["string (AND 过滤)"],
    "timeRange": { "from": "ISO8601", "to": "ISO8601" },
    "involvedHooks": ["string"],
    "entityIds": ["string"],
    "limit": "number (默认 3)"
  },
  "returns": "完整 chunk 内容,不压缩"
}
```

**改动位置**:
- [src/core/agent-runtime/tools/](src/core/agent-runtime/tools/) 新增 `query-session-history.tool.ts`

**验收**:
- [ ] 给定"上次订的餐厅名",能召回对应 chunk
- [ ] 时间/Hook/实体过滤生效

---

### 3.4 热上下文 token 预算裁剪

**核心决策**:**不用固定 N 轮,用 token 预算**。

**实现**:
- 用 `tiktoken` 算 token
- 从最新消息往前累加,超预算(默认 4000)则停止
- 保证至少最近 2 条完整

**改动位置**:[src/core/ai/](src/core/ai/) 增加 `services/context-builder.service.ts`

**验收**:
- [ ] 长/短消息混合下,预算裁剪正确,不切断消息

---

### 3.5 Hook 调用历史独立 Section

**核心决策**:Hook 调用**结构化呈现**,不跟自然语言对话混。

**Context 结构**:
```
[最近 N 次 hook 调用](独立 1K token 预算)
- t-3min: call_hook('create_order', {...}) → {orderId: 'o1'}
- t-2min: call_hook('inventory.lock', {...}) → error: sold_out

[最近对话](4K token 预算)
user: ...
assistant: ...
```

**为什么独立**:防止 AI 重复调 Hook,让 AI 清晰看到"我做过什么 / 什么失败了"。

**改动位置**:[src/core/ai/services/context-builder.service.ts](src/core/ai/services/context-builder.service.ts)

---

### 3.6 LM 必读章节补"会话记忆"指南

**改动位置**:[src/app/knowledge/local/local-knowledge.seed.ts](src/app/knowledge/local/local-knowledge.seed.ts) 新增本地书本。

**教 AI**:
- 热上下文有限,遇到"上次/之前/那个/还记得吗"等回指词必须调 `query_session_history`
- 查不到就诚实说"没找到相关历史"
- 同时参考 Hook 调用历史 section,不要重复调用

**验收**:
- [ ] AI 遇到回指问题主动调 tool 比例 >90%

---

## Phase 4:产品差异化

### 4.1 LangGraph StateGraph 编排层

**核心决策**:LangGraph 仅保留 Checkpoint + 补充 StateGraph 编排层。**编排产出是 JSON**(Design Agent 兄弟格式),不是代码。

**改动位置**:
- [src/core/langgraph/](src/core/langgraph/) 新增 `graph/` 子目录
- `graph/types.ts` - Node / Edge / State 数据模型
- `graph/builder.service.ts` - JSON → StateGraph
- `graph/runtime.service.ts` - 执行 + Checkpoint

**验收**:
- [ ] 手写 2 节点 graph 能跑,支持中断恢复

---

### 4.2 编排 Agent(产出 graph JSON)

**改动位置**:[src/agents/orchestrator-agent/](src/agents/orchestrator-agent/)

**流程**:需求 → 读 Knowledge → 识别可用 Hook → 产出 StateGraph JSON

**验收**:
- [ ] "用户下单后发邮件 + 扣库存"能产出 2 节点 graph 并跑通

---

### 4.3 主动 AI 触发层

**改动位置**:
- [web/src/modules/](web/src/modules/) 新增 `proactive-agent/`
- [src/app/](src/app/) 新增 `proactive/`

**前端埋点**:页面加载 / 停留时长 / 滚动位置 / 焦点离开 / 区域进入

**触发规则引擎**:JSON 规则(`trigger: { event: 'stay', duration: 10000, zone: '.product-card' }`)

**降频策略**:用户关闭对话 → N 分钟内不触发;已触发过的场景不重复触发

**验收**:
- [ ] 停留 3 秒触发问候
- [ ] 关闭对话后 10 分钟内不打扰

---

### 4.4 语音链路(ASR + TTS + 实时中断)

**技术选型**(需要定):
- ASR:Azure Speech / Deepgram / Whisper Realtime API
- TTS:Azure / ElevenLabs
- 实时音频:OpenAI Realtime API(一把梭)/ Livekit(自建)

**改动位置**:
- [web/src/modules/agent/](web/src/modules/agent/) 新增语音组件
- [src/app/conversation/](src/app/conversation/) 新增流式 ASR 适配器

**验收**:
- [ ] 说话 → 实时转文字 → AI 回 → TTS 播放
- [ ] 中途打断 AI,TTS 立即停止

---

### 4.5 Runner 离线降级策略

**改动位置**:
- [src/app/runner/](src/app/runner/) 增加离线任务队列
- [web/src/modules/runner/](web/src/modules/runner/) 状态可视化

**策略**:
- Runner 离线 → SaaS 端队列缓存任务
- 超时(默认 5 分钟)→ 告知用户"你的 Runner 离线,任务排队中"
- AI 对话降级:"我现在连不上你的执行节点,方案是..."

**验收**:
- [ ] Runner 离线时用户看到清晰状态,AI 回复不卡死

---

## Phase 5:长期优化(按需推进)

- **5.1 多 frps 高可用**:多副本 + DNS 轮询 + Cloudflare Tunnel 作 fallback
- **5.2 自定义域名 SSL 自动化**:Caddy 自动 Let's Encrypt + 租户域名 CNAME 流程
- **5.3 实时 log 流**:WS gateway 推送 Runner 侧 log(用现有 HookBus WS 基础)
- **5.4 WebMCP 声明跟组件共处**:编译期检查漏更新
- **5.5 IM 前端 UI 补齐**(当前只有 service 层)
- **5.6 debug log TTL + 采样策略**
- **5.7 mongo-explorer 完成或移除**
- **5.8 同 solution 真正并发改动**(开 wf 分支 + git worktree + rebase 冲突解决):**仅在用户明确呼喊"我要并行"时才做**,YAGNI 兜底

---

## 二、风险仪表盘

| 风险项 | 严重度 | 状态 | 缓解 Phase |
|--------|--------|------|-----------|
| **三层 Agent 架构未建立(群管 / Dialogue / Graph 职责未分离)** | **P0** | **未开始** | **1.1-1.5** |
| **session ↔ solution 归属机制缺失(跨群修改无守门)** | **P0** | **未开始** | **1.1** |
| **Solution 物理结构 + git 模型未落地** | **P0** | **未开始** | **1.4** |
| AI 代码生成流水线空缺(核心价值未实现) | P0 | 未开始 | 2.1-2.6 |
| 代码归属与版本协议(Runner 主权)未实现 | P0 | 未开始 | 0.4 |
| 写操作行级权限缺失 | P0 | 未开始 | 2.7 |
| Runner 反向攻击风险 | P0 | 未开始 | 2.8 |
| AI 对话记忆失效 | P1 | 未开始 | 3.1-3.6 |
| LangGraph 编排层空 | P1 | 未开始 | 4.1-4.2 |
| 主动 AI / 语音未实现 | P1 | 未开始 | 4.3-4.4 |
| Runner 离线降级 | P1 | 未开始 | 4.5 |
| 多 frps 单点 | P2 | 未开始 | 5.1 |
| 自定义域名 SSL | P2 | 未开始 | 5.2 |

---

## 三、技术栈决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **Agent 分层** | **三层:群管 (全局单例) / Dialogue (per session) / Graph (per workflow)** | 职责边界清晰,各管各的视野不越界 |
| **LLM 操作通道** | **唯一 = `terminal.exec`,不包精细 hook** | 复用 LLM 训练里的 git/shell 知识,避免私有 API 学习成本 |
| **代码归属** | **Runner 端,solution 级 git repo,SaaS 不持权威副本** | Runner 自托管哲学;SaaS 仅可选灾备 tarball |
| **session ↔ solution** | **强 1:1 绑定** | 限制的艺术 — 上下文边界明确,LLM 不迷失 |
| **同 solution 并发** | **per-solution 锁串行(单 worktree,无 wf 分支)** | 维护成本低;真要并发等 5.8 |
| **workflow 期间 commit** | **0 commit,finalize 节点统一 commit + tag** | 失败一键 `git checkout -- .`,history 干净 |
| **graph 拓扑** | **线性 6 节点,无 conditional edge 分叉** | new/refactor 差异由节点内 LLM 自主判断 |
| Runner 代码生成语言 | **纯 JS (ES modules)** | 热加载零编译成本 |
| 运行时校验 | **Zod** | JS 原生支持,schema 即契约 |
| Schema 来源 | **graph hookDesign 节点 → json-schema-to-zod 自动生成** | LLM 不写 schema(幻觉隔离) |
| 可观测性 | **OTel API + Span / SpanEvent 单信号** | 标准 Semantic Conventions;Span + Event 一次 flush 全拿,不引入独立 LogRecord |
| Trace 回传 | **InMemorySpanExporter + in-band(随 WS 响应)** | Runner 零外部 collector;debug=false 用 NoopTracerProvider,近零开销按需激活 |
| 测试策略 | **集成测试主导,无单元测试** | Service 方法间真互调,Hook mock,trace 定位 |
| Workflow engine | **LangGraph(StateGraph + Checkpoint + Interrupt)** | 跟热加载兼容,interrupt 模型直接支持 agentic 反问 |
| 对话上下文 | **定长分块 + 原文返回,无 LLM 摘要** | 摘要 lossy 且偏差累积,原文 lossless |
| 代码合并 | **Babel AST 工具链(确定性)** | 不用 LLM 合并,避免二次幻觉 |
| 代码分发 | **HTTP + 签名 patch(非全文)+ git tag = version** | Runner 主权,只发增量 |
| 主管 IM 出口 | **system-notice messageType,前端差异化** | 不污染 LLM 对话 context |

---

## 四、原则

1. **限制的艺术(总原则)**:用 prompt 约束 LLM 行为,系统层只管全局不可越界状态(归属/锁/视野);其他能力通过 terminal 单一通道开放,复用 LLM 训练知识。**不做"喂泥的精细 hook 包装"**
2. **三层职责分离**:群管 / Dialogue / Graph 各管各的视野;群管管归属与冲突,Dialogue 管会话编排,Graph 管单次代码生成。**任何一层不能越权另一层**
3. **硬限制不留逃生口**:产品边界 = 架构边界,不在代码里给"绕开限制的快捷"
   - 想讨论别 solution → **建新群**,不在当前 session 里跨 solution
   - 两个 solution 必须协同 → **真合并成一个 solution**,不在多 solution 间临时拼接
   - 同 solution 想并发改 → 等串行完成或主动 abort,**不开 wf 分支绕过锁**(P5 真有强需求再说)
4. **session ↔ solution 1:1 强约束**:杜绝模糊归属,杜绝 LLM"我属于哪个上下文"的迷失;约束本身就是产品体验的一部分
5. **prompt ≠ 物理约束**:LLM 的边界是命令白名单 / cwd 锁 / 网络隔离这些**物理闸门**,prompt 只是文化层。**有 prompt 没闸门 = 没限制**
6. **Phase 不跳序**:Phase 0 地基(已基本完成)→ Phase 1 三层架构 → Phase 2 节点填充。**Phase 1 不做完不进 Phase 2**
7. **LLM 不写 schema,只用 schema**:schema 由工具生成,幻觉隔离
8. **debug 协议是红线**:新增代码必须 `log.event()`(挂 SpanEvent),禁止 `console.log` 与独立 LogRecord
9. **基础设施已完成,别重复造轮子**:Docker / Runner 面板 / Solution / Knowledge / OTel / Terminal Unit 都是已有,增量建设
10. **module.md 必维护**:同级目录,新增模块必补,修改需同步
11. **AI 产出必过 QA + approval**:哪怕自用阶段也走流程
12. **YAGNI 兜底**:并发分支 / 跨 solution 共享 / 多 frps 高可用,这类只在用户明确需要时才做

---

## 五、开工建议

> **当前状态**:Phase 0.1(OTel)主体已完成,Phase 0.2/0.3/0.4 待补;Terminal Unit Core 已就绪。**下一阶段重心 = Phase 1 三层 Agent 架构**。

### 近期路线(Phase 1 优先,3 周)

**第 1 周(P0 - 群管骨架 + Solution 物理结构)**
- [src/agents/director-agent/](src/agents/director-agent/) 创建预定义 agent 骨架(参照 azure-ai / code-agent)
- 4 张 DB 表 migration + entity:`solution_group_binding` / `app_solution_ref` / `session_workflow` / `solution_lock`
- 群管 4 个内部 hook:`bindGroup` / `requestApproval` / `releaseLock` / `queryAppRefs`
- 新增 `system-unit/git/`,跟 `system-unit/terminal/` 同构
- 4 个系统 hook:`runner.solution.create` / `acquireLock` / `releaseLock` / `heatReload`
- 扩展 ChatMessageType 加 `SYSTEM_NOTICE`

**第 2 周(P0 - Dialogue State 机)**
- [src/app/conversation/](src/app/conversation/) 新增 `dialogue-state.service.ts` 实现 4 状态机
- 接入 [send-msg.hook-handler.service.ts](src/app/conversation/services/send-msg.hook-handler.service.ts)
- 轻量意图分类 LLM 调用(deepseek-chat 即可)
- 跟群管联调:gathering 阶段申请批准 → tracking 阶段释放锁
- 验证:建群 / 提生成意图 / 群管驳回 / graph end 释放锁 全链路打通

**第 3 周(P1 - Graph 简化拓扑)**
- 重构 [code-gen.graph.ts](src/agents/code-agent/dialogues/graph/code-gen.graph.ts) 为线性 6 节点
- 节点内 LLM 实现可暂用 mock(返回桩 state),只验证拓扑 + interrupt + checkpoint
- branchManagement 节点用 terminalTool 真跑 git log / cat
- 跑通一次 mock 端到端:用户提需求 → 群管批准 → graph 走完 6 节点 → finalize commit

### Phase 0 收尾(并行)

- 0.1 benchmark(debug=false 零开销验证)
- 0.4 SaaS → Runner 签名 patch 协议(对接 Phase 1 的 git system-unit)
- 0.2 / 0.3 在 Phase 2 进入时再补(它们是 Phase 2.1 / 2.2 的具体实现细节)

### 节奏要求

**Phase 1 不做完不进 Phase 2**:架构层没立稳,后续节点填充就是在沙地盖楼。三层职责一旦混淆,LLM 的行为边界就会被突破,后期纠正成本极高。

**Phase 1 完成的标志**:
- [ ] 建一个新群 → 群管自动发起 solution 关联
- [ ] 用户在群里说"帮我做个订单系统" → dialogue 意图分类 → 申请群管 → 批准 → 起 graph(节点用 mock)→ finalize 自动 commit + 释放锁
- [ ] 同 solution 第二条 workflow 启动 → 被群管硬拦
- [ ] graph 内任一节点 interrupt → IM 出现自然语言反问 → 用户回复 → graph 续跑
