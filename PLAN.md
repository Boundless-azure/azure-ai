# 小蓝 (Azure AI) 演进计划

> 截止 2026-04-22。产品定位:**面向超级个体的 AI 生成 + 自托管运行 PaaS**。
> 基础设施(Docker 化 / Runner 面板 / Knowledge / Solution 市场 / FRP 自动公网化 / Storage 去重)已完整,当前核心缺口是 **AI 代码生成闭环**。

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

### 🎯 真正的缺口(本计划覆盖范围)

核心闭环:**Design Agent → Dev Agent 并行 → Integrator → QA Agent → 人工 approval → SaaS 签名分发 → Runner 热加载**

产品差异化:**对话记忆分层 / 主动 AI / 语音链路 / LangGraph 编排**

---

## 一、总体节奏

```
Phase 0  协议与契约    (地基,2 周)
  ↓
Phase 1  代码生成流水线 (核心闭环,4-6 周)
  ↓
Phase 2  对话与记忆    (体验质变,2 周)
  ↓
Phase 3  产品差异化    (主动 AI + 语音 + 编排,4-6 周)
  ↓
Phase 4  长期优化      (按需推进)
```

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
- [ ] call_hook 传 debug 参数运行时激活 trace buffer
- [ ] 响应含完整 trace(OTLP 格式)
- [ ] debug=false 零开销验证(benchmark)

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

### 0.4 代码分发协议(SaaS → Runner)

**核心决策**:
- HTTP 通道(不走 Socket,大文件稳定)
- 每个 Service 有 `name@version`,Runner 本地 lock
- **SaaS 用私钥签,Runner 用公钥验**(防反向攻击)
- **SaaS 保存所有源码镜像 + 版本历史**(Runner 挂了能重建)

**改动位置**:
- [src/app/runner/](src/app/runner/) 新增 `services/code-dispatch.service.ts`
- [runner/src/modules/](runner/src/modules/) 新增 `code-install/`
- 新增 MySQL 表:`runner_code_registry`(runnerId / name / version / hash / signedAt / sourceRef)

**验收**:
- [ ] 能从 SaaS 推一个 JS bundle 到 Runner,Runner 验签后热加载
- [ ] Runner 重启后从本地 lock 恢复代码
- [ ] SaaS 能一键恢复丢数据的 Runner 到某版本

---

## Phase 1:代码生成流水线(核心闭环)

**目标**:给定需求,能完整产出可运行的 Service 并部署到 Runner。**这是产品核心价值**。

### 1.1 Design Agent 实现

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

### 1.2 Dev Agent 并行方法生成

**改动位置**:[src/agents/dev-agent/](src/agents/dev-agent/)

**关键**:
- 并发调用(`Promise.all`),一方法一次 LLM 调用
- 每次调用上下文 = 完整 design + 目标方法名 + schema 文件路径
- 产出是**单个方法代码片段**(class body 内部的一段)

**验收**:
- [ ] 10 个方法的 service 能 10 次并行生成完
- [ ] 跨方法的类字段假设一致(不出现冲突)

---

### 1.3 Integrator(确定性工具链)

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

### 1.4 影子 MongoDB + 副作用沙箱

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

### 1.5 QA Agent(集成测试 + trace 分析)

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

### 1.6 人工 approval UI

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

### 1.7 写操作行级权限 + Hook 审计拦截

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

### 1.8 Runner 零信任验证

**改动位置**:[src/app/runner/](src/app/runner/) 注册握手增强

**内容**:
- Runner → SaaS 的所有响应必须带签名(用 Runner 私钥)
- SaaS 用对应公钥验证
- 伪造/重放响应被拒绝并告警

**验收**:
- [ ] 伪造 Runner 响应被拒绝

---

## Phase 2:对话与记忆(体验质变)

**目标**:解决 AI"失忆"问题。**定长分块 + 向量/关键词 + 原文返回**,拒绝摘要(避免 LLM 偏差)。

### 2.1 对话分块入库(定长软对齐)

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

### 2.2 双层向量索引 + 元数据

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

### 2.3 query_session_history tool

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

### 2.4 热上下文 token 预算裁剪

**核心决策**:**不用固定 N 轮,用 token 预算**。

**实现**:
- 用 `tiktoken` 算 token
- 从最新消息往前累加,超预算(默认 4000)则停止
- 保证至少最近 2 条完整

**改动位置**:[src/core/ai/](src/core/ai/) 增加 `services/context-builder.service.ts`

**验收**:
- [ ] 长/短消息混合下,预算裁剪正确,不切断消息

---

### 2.5 Hook 调用历史独立 Section

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

### 2.6 LM 必读章节补"会话记忆"指南

**改动位置**:[src/app/knowledge/local/local-knowledge.seed.ts](src/app/knowledge/local/local-knowledge.seed.ts) 新增本地书本。

**教 AI**:
- 热上下文有限,遇到"上次/之前/那个/还记得吗"等回指词必须调 `query_session_history`
- 查不到就诚实说"没找到相关历史"
- 同时参考 Hook 调用历史 section,不要重复调用

**验收**:
- [ ] AI 遇到回指问题主动调 tool 比例 >90%

---

## Phase 3:产品差异化

### 3.1 LangGraph StateGraph 编排层

**核心决策**:LangGraph 仅保留 Checkpoint + 补充 StateGraph 编排层。**编排产出是 JSON**(Design Agent 兄弟格式),不是代码。

**改动位置**:
- [src/core/langgraph/](src/core/langgraph/) 新增 `graph/` 子目录
- `graph/types.ts` - Node / Edge / State 数据模型
- `graph/builder.service.ts` - JSON → StateGraph
- `graph/runtime.service.ts` - 执行 + Checkpoint

**验收**:
- [ ] 手写 2 节点 graph 能跑,支持中断恢复

---

### 3.2 编排 Agent(产出 graph JSON)

**改动位置**:[src/agents/orchestrator-agent/](src/agents/orchestrator-agent/)

**流程**:需求 → 读 Knowledge → 识别可用 Hook → 产出 StateGraph JSON

**验收**:
- [ ] "用户下单后发邮件 + 扣库存"能产出 2 节点 graph 并跑通

---

### 3.3 主动 AI 触发层

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

### 3.4 语音链路(ASR + TTS + 实时中断)

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

### 3.5 Runner 离线降级策略

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

## Phase 4:长期优化(按需推进)

- **4.1 多 frps 高可用**:多副本 + DNS 轮询 + Cloudflare Tunnel 作 fallback
- **4.2 自定义域名 SSL 自动化**:Caddy 自动 Let's Encrypt + 租户域名 CNAME 流程
- **4.3 实时 log 流**:WS gateway 推送 Runner 侧 log(用现有 HookBus WS 基础)
- **4.4 WebMCP 声明跟组件共处**:编译期检查漏更新
- **4.5 IM 前端 UI 补齐**(当前只有 service 层)
- **4.6 debug log TTL + 采样策略**
- **4.7 mongo-explorer 完成或移除**

---

## 二、风险仪表盘

| 风险项 | 严重度 | 状态 | 缓解 Phase |
|--------|--------|------|-----------|
| AI 代码生成流水线空缺(核心价值未实现) | P0 | 未开始 | 1.1-1.6 |
| 代码签名分发未实现 | P0 | 未开始 | 0.4 |
| 写操作行级权限缺失 | P0 | 未开始 | 1.7 |
| Runner 反向攻击风险 | P0 | 未开始 | 1.8 |
| AI 对话记忆失效 | P1 | 未开始 | 2.1-2.6 |
| LangGraph 编排层空 | P1 | 未开始 | 3.1-3.2 |
| 主动 AI / 语音未实现 | P1 | 未开始 | 3.3-3.4 |
| Runner 离线降级 | P1 | 未开始 | 3.5 |
| 多 frps 单点 | P2 | 未开始 | 4.1 |
| 自定义域名 SSL | P2 | 未开始 | 4.2 |

---

## 三、技术栈决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Runner 代码生成语言 | **纯 JS (ES modules)** | 热加载零编译成本 |
| 运行时校验 | **Zod** | JS 原生支持,schema 即契约 |
| Schema 来源 | **Design Agent JSON → json-schema-to-zod 自动生成** | LLM 不写 schema(幻觉隔离) |
| 可观测性 | **OTel API + Span / SpanEvent 单信号** | 标准 Semantic Conventions;Span + Event 一次 flush 全拿,不引入独立 LogRecord |
| Trace 回传 | **InMemorySpanExporter + in-band(随 WS 响应)** | Runner 零外部 collector;debug=false 用 NoopTracerProvider,近零开销按需激活 |
| 测试策略 | **集成测试主导,无单元测试** | Service 方法间真互调,Hook mock,trace 定位 |
| Workflow engine | **LangGraph(自造 JSON 编排)** | 跟热加载兼容,Temporal/n8n 的框架约束冲突 |
| 对话上下文 | **定长分块 + 原文返回,无 LLM 摘要** | 摘要 lossy 且偏差累积,原文 lossless |
| 代码合并 | **Babel AST 工具链(确定性)** | 不用 LLM 合并,避免二次幻觉 |
| 代码分发 | **HTTP + 签名 + 版本 lock** | 大文件稳定,防反向攻击 |

---

## 四、原则

1. **Phase 不跳序**:Phase 0 地基没打完不推进 Phase 1
2. **LLM 不写 schema,只用 schema**:schema 由工具生成,幻觉隔离
3. **debug 协议是红线**:新增代码必须 `log.event()`(挂 SpanEvent),禁止 `console.log` 与独立 LogRecord
4. **基础设施已完成,别重复造轮子**:Docker / Runner 面板 / Solution / Knowledge 都是已有,增量建设
5. **module.md 必维护**:同级目录,新增模块必补,修改需同步
6. **AI 产出必过 QA + approval**:哪怕自用阶段也走流程

---

## 五、开工建议(近 2 周)

**第 1 周**:完成 **0.1 + 0.2**
- call_hook debug + OTel in-band trace(2-3 天)
- Design Agent JSON schema 规范 + prompt 模板(2-3 天)

**第 2 周**:完成 **0.3 + 0.4**
- Dev Agent prompt + AST 规则清单实现(2-3 天)
- 代码签名分发协议(HTTP + 签名 + Runner lock)(2-3 天)

这四项跑通,后面 Phase 1 的闭环就能顺推。**Phase 0 不要省**,所有后续工作以此为基础。
