# Runner 数据触点模块

**模块路径**: `runner/src/modules/data-touchpoint/`

## 模块功能描述

数据触点 (Data Touchpoint) 是用户视角的"数据探针": 用户对某个数据维度有持续关注 (如"最近 N 天订单是否大幅下降"), 创建数据触点绑定 session/agent, 源数据变动时触发器把它推进异步队列, 胶水代码判定是否回调, 通过 `SYSTEM_NOTIFIER` 主体 + `messageType=notification` 把数据塞回 session, UI 不渲染但 agent 下一轮回话能感知响应。

本模块当前已落地 **元数据 CRUD + BullMQ 异步队列 + 路径防护 + worker_threads 真 kill + notifyTargets 中间表通知 + createdByAgentId 业务鉴权 + SYSTEM_NOTIFIER 通知通道 + 沙箱 sendMsg 黑名单 + 跨服务 trace 关联 + OTel 运行历史 + Redis 多租户隔离** 完整闭环。胶水代码物理位置由 `filePath` / `configPath` 字段相对当前 runner 进程 cwd 解析, 路径越根 / `..` 逃逸 / symlink 逃逸都会被 `touchpoint-paths.ts` 拒绝; 等 Phase 1.4 solution 物理结构落地后会迁移到 `solutions/<...>/touchpoints/<id>/`。

**多 source 合并通知** :: 一次业务操作影响多张表时, 直接 `trigger({ sources: ['user', 'auth'], payloadsBySource: { user: {...}, auth: {...} } })` 入队一次, mongo `$in` 查询自然去重 — 同时订阅 user 和 auth 的触点只跑一次, 胶水 ctx 拿到 `matchedSources: ['user','auth']` + `payloadsBySource` 切好的子集, 自己决定如何合并响应。

**胶水代码受限自治**: 业务 hook 自己用 `callHook(name, payload)` 调任何白名单内 hook (`saas.*` / `runner.*` 一视同仁), 由 hookBus 内部按前缀路由 — `saas.*` 自动跨进程转发到 SaaS, `runner.*` 走本地. **但通知派发不再交还胶水** — 沙箱硬黑名单 `saas.app.conversation.sendMsg`, 通知唯一路径走 `ret.success({ notify })`, 框架按 notifyTargets 中间表 forEach 派发。失败不回写元数据 status (status 字段已删), 健康度从 `data_touchpoint_runs` 运行历史链推算。

要发通知胶水只需 `return ctx.ret.success({ notify: { content: '...' } })`, 框架自动按 `notifyTargets` 中间表 (一个 sessionId ↔ 该 session 内要 @ 的 agentIds 子集) forEach 派发 sendMsg, 每个 session 一条消息合并 @ 该 session 关注的 agent; 自动填 ai-notify / messageType=notification; 胶水不接触 sendMsg payload, AI 生成无机会写错。沙箱已硬黑名单 `saas.app.conversation.sendMsg`, 胶水即便在 allowedHooks 里列了也会被拒绝, 通知唯一路径就是 ret.notify。

## 关键词索引

- 数据触点元数据 -> services/data-touchpoint.service.ts
- 数据触点类型 / TouchpointRet / TouchpointRetSentinel -> types/data-touchpoint.types.ts
- 数据触点 Hook 注册 -> hooks/data-touchpoint.hooks.ts (registerDataTouchpointHooks)
- 路径防护 / 越根拒绝 / symlink 逃逸 -> services/touchpoint-paths.ts (resolveTouchpointFile)
- 运行历史链表 / run log / TTL / 错误码 -> services/touchpoint-run-log.ts (RunnerTouchpointRunLog, TouchpointErrorCode)
- OTel session / SpanEvent drain / 运行 trace -> services/touchpoint-otel.ts (createTouchpointLogSession)
- worker_threads 真 kill / 触点执行隔离 -> services/touchpoint-executor.ts (runTouchpointInWorker) + services/touchpoint-worker.ts (子线程入口 + ctx.ret 工厂)
- 通知派发器 / 多 session / sendMsg / NOTIFY_TARGET_INVALID -> services/touchpoint-notifier.ts (dispatchTouchpointNotify)
- createdByAgentId 业务鉴权 / 沙箱 callHook / sendMsg 硬黑名单 -> services/touchpoint-loader.ts (createSandboxedCallHook, SANDBOX_NOTIFY_DENYLIST)
- notifyTargets 中间表 / sessionId ↔ agentIds 绑定 / 同 session 合并单条 -> types/data-touchpoint.types.ts (DataTouchpoint, notifyTargetsSchema)
- 多 agent 通知 / SYSTEM_NOTIFIER 通道 / traceId 串联 -> services/touchpoint-notifier.ts (dispatchTouchpointNotify)
- SYSTEM_NOTIFIER 跨群通知主体 -> src/app/identity/constants/system-principals.ts (SaaS 端)

## 模块文件

- `types/data-touchpoint.types.ts` - DataTouchpoint 接口 + zod schema (Create/Update/Delete/List/Trigger/TouchpointConfig) + TouchpointHandler 类型
- `services/data-touchpoint.service.ts` - mongo collection `data_touchpoints` 元数据 CRUD
- `services/touchpoint-paths.ts` - 路径解析 + traversal/symlink 防护; 越根直接抛 TouchpointPathDeniedError
- `services/touchpoint-loader.ts` - 路径校验 + 读 config + 主线程预读胶水元数据 (highFrequency / schedule) + 受限 callHook 工厂 (运行时白名单 + sendMsg 硬黑名单 + createdByAgentId 业务鉴权主体)
- `services/touchpoint-worker.ts` - worker_thread 子线程入口: 动态 import 胶水, ctx.ret (skip/success/error) 工厂, callHook/log 通过 parentPort RPC 转主线程
- `services/touchpoint-executor.ts` - 主线程侧 worker 包装: spawn worker + 60s 强 kill + 识别 ret sentinel + 调通知派发器 + outcome+errorCode 归一
- `services/touchpoint-notifier.ts` - 通知派发器: forEach notifyTargets 中间表 entry 调 sendMsg (sessionId + mentions=entry.agentIds), 每条独立 try/catch, 失败入 failedSessions[], OTel 全程打点
- `services/touchpoint-otel.ts` - 触点专用 OTel log session 工厂 (BasicTracerProvider + InMemorySpanExporter, 与 hook-log.factory 同构)
- `services/touchpoint-run-log.ts` - mongo collection `data_touchpoint_runs` 运行历史写入器, TTL 30 天自动清理, 静默错误
- `services/touchpoint-state.store.ts` - 双 store: MongoStateStore (持久) / RedisStateStore (高频, 多租户 key 前缀)
- `services/touchpoint-lock.ts` - 触点级 redis 锁 (SET NX PX + Lua 释放), runnerId 前缀
- `services/touchpoint-schedule.ts` - schedule zod schema + BullMQ Repeatable 操作 (cron / interval / once, runnerId 前缀)
- `services/touchpoint-trigger.service.ts` - BullMQ Queue + Worker + 运行编排: load → 锁 → executor → state + runLog (attempts=1, 不重试, 永不抛)
- `hooks/data-touchpoint.hooks.ts` - HookBus 注册函数 (在 app.ts 启动时调用)

## 跨进程 hook 调用机制 (基础设施)

数据触点能调 SaaS hook 不靠模块自己接 RPC, 靠 hookBus 入口的 **前缀路由**:

```
hookBus.emit('saas.app.conversation.sendMsg', {...})
                      │
              name 以 'saas.' 开头?
                      │
             ┌────────┴────────┐
             是                否
             │                 │
             ▼                 ▼
      forwardToSaaS         本地 registrations
      (跨进程 socket RPC)   (本地 worker 池)
```

`forwardToSaaS` 句柄由 `attachHookRpc` 在 socket connect 时调用 `hookBus.setForwardToSaaS(callSaaSHook)` 注入。SaaS 端收到 `hook:call` 后由其 hookBus 处理, 找不到直接报错, 不会反向回弹给 runner (前缀语义已固定路由), 不会死循环。

实现见 [hookbus.service.ts forwardSaaSHook](../hookbus/services/hookbus.service.ts) + [hook-rpc.client.ts attachHookRpc](../hookbus/ws/hook-rpc.client.ts)。

## HookBus Hook

| Hook 名 | 描述 | payload |
|---------|------|---------|
| runner.app.dataTouchpoint.create | 创建数据触点元数据 (createdByAgentId 从 context.principalId 自动注入, LLM 不能 fake) | { solutionId, name, description?, sources[], notifyTargets: [{ sessionId, agentIds[] }], filePath, configPath, enabled? } |
| runner.app.dataTouchpoint.update | 更新数据触点 (id 必填, 其他字段可选). **LLM 鉴权**: 只允许创建者改自己的触点; 不可改字段软过滤 | { id, ...partial } |
| runner.app.dataTouchpoint.delete | 删除数据触点 (含 mongo state + redis state + 运行历史 + schedule 联动清理). **LLM 鉴权**: 只允许创建者删自己的触点 | { id } |
| runner.app.dataTouchpoint.list | 列出数据触点. **LLM 鉴权**: 强制限定可见范围"我创建的 + 通知到我的" (createdByAgentId=self OR notifyTargets.agentIds=self); system/http 链路无限定 | { solutionId?, sessionId?, agentId?, createdByAgentId?, source?, sourceIn?, enabled? } |
| runner.app.dataTouchpoint.trigger | 触发器: 异步派发到队列, 命中触点逐个执行胶水代码. **LLM 拒绝** (防伪造业务事件); 仅 system/http/runner 调用 | { sources: string \| string[], payload?, payloadsBySource?: { [source]: any }, solutionId? } |

## 核心函数

### services/data-touchpoint.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `create` | 生成 UUID, 写入 mongo, 默认 enabled=true; 入参类型扩展 `CreateDataTouchpointInput & { createdByAgentId: string }` — createdByAgentId 必须由 hook handler 从 context 注入 |
| `update` | 按 _id 局部更新, 返回更新后的完整文档 |
| `delete` | 按 _id 硬删 |
| `getById` | 按 _id 取单条 |
| `list` | 按 solutionId / sessionId (notifyTargets $elemMatch) / agentId (notifyTargets.agentIds $elemMatch) / createdByAgentId (等值) / source / sourceIn / enabled 过滤; sessionId+agentId 同传走单一 $elemMatch (entry 内同时满足) |
| `ensureIndexes` (static) | 幂等建索引 :: { solutionId } / { enabled, sources } / { notifyTargets.sessionId } / { notifyTargets.agentIds } / { createdByAgentId } |
| `IMMUTABLE_FIELDS` | update 软过滤集合 :: _id / solutionId / createdByAgentId / createdAt; 外部直接调 svc.update 也防漏 |
| `list(filter, visibleToAgentId?)` | 可选第二参 visibleToAgentId 加 $or 限定可见范围 (createdByAgentId=self OR notifyTargets.agentIds 含 self); hook handler LLM 链路强制注入 |
| `deleteBySolution` | 联动清理: solution 卸载时删除其所有触点; **不暴露为 hook**, 仅供模块内部 / solution 卸载流程 import 调用 |

### services/touchpoint-paths.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `resolveTouchpointFile` | 解相对路径并校验未逃出 rootDir; 拒绝绝对路径 / null byte / `..` 逃逸 / symlink 逃逸 |
| `TouchpointPathDeniedError` | 路径被拒异常, 含 reason 字段 |

### services/touchpoint-loader.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadTouchpoint` | 路径校验 + 读 config + 主线程预读胶水元数据 (highFrequency / schedule); handler 由 executor 在 worker 里 import 跑 |
| `createSandboxedCallHook` | 受限 callHook 工厂: SANDBOX_NOTIFY_DENYLIST 硬拒 + config.allowedHooks 白名单; 主体身份用 touchpoint.createdByAgentId (触点创建者 agent, principalType='agent'); saas 端 system 链路放行, 真防越权靠白名单+黑名单 |
| `SANDBOX_NOTIFY_DENYLIST` | 通知专用 hook 黑名单 (硬拒); 当前包含 `saas.app.conversation.sendMsg`, 即便胶水在 allowedHooks 列了也拒绝, 通知唯一路径走 ret.notify |
| `TouchpointHookDeniedError` | 沙箱拒绝异常, executor 翻译为 outcome='denied' |

### services/touchpoint-worker.ts (子线程)

| 函数名 | 关键词描述 |
|--------|-----------|
| `main` | 动态 import 胶水 + 注入 ctx (callHook/log 走 parentPort RPC), return 即 newState; 异常 postMessage error |
| `callHook` | 子线程内的 callHook, 通过 parentPort id 关联请求/响应 |
| `makeLog` | 子线程内的 log, 写到 parentPort 转主线程 OTel session |

### services/touchpoint-executor.ts (主线程)

| 函数名 | 关键词描述 |
|--------|-----------|
| `runTouchpointInWorker` | 起 Worker + 60s 后 worker.terminate() 真 kill; callHook RPC 转 sandboxedCallHook; 统一返回 TouchpointRunResult |

### services/touchpoint-otel.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `createTouchpointLogSession` | 一次触点执行对应一次性 BasicTracerProvider + InMemorySpanExporter; finalize drain HookLogEntry[] + traceId |

### services/touchpoint-run-log.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `RunnerTouchpointRunLog.ensureIndexes` | 幂等创建 (touchpointId,startedAt) + (runnerId,startedAt) + (createdByAgentId,startedAt) + TTL 索引 (30 天) |
| `RunnerTouchpointRunLog.write` | **链表写入**: 查同 touchpointId 最新 _id → 拼 previousRunId → insertOne; 异常静默 |
| `RunnerTouchpointRunLog.removeByTouchpoint` | 触点 delete 时联动清理 |
| `summarizePayload` | 任意值压成 { bytes, preview }, 超 512 字节截断, 防文档膨胀 |

### services/touchpoint-trigger.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `start` | 创建 BullMQ Queue + Worker + 锁 + 双 state store + runLog 索引 (queue prefix = `tp:{runnerId}`) |
| `stop` | 关闭 Queue + Worker + redis 连接 (优雅退出) |
| `trigger` | 主入口: 规范化 sources → 去重 → 入队立即返回; attempts=1 不重试 |
| `removeState` | 联动清理 mongo + redis state + 运行历史 (delete hook 调用) |
| `reloadSchedule` | 加载胶水读 schedule 元数据; 有则 upsert, 无则 remove; 加载失败写一条 error run 记录 |
| `removeSchedule` | 触点 delete 时移除 schedule (含 runnerId 前缀) |
| `bootstrapSchedules` | Runner 启动期批量重载所有 enabled 触点 schedule (兜底 redis 数据丢失) |
| `consumeTrigger` | 业务事件触发: $in 查命中触点, 按触点切 payloadsBySource, 逐个 runOne (永不抛, 失败仅写 run 记录) |
| `consumeSchedule` | 时间调度触发: 对指定触点 runOne; once 类型完成自动 enabled=false |
| `runOne` | 单触点编排: load → OTel session → 抢锁 → read prev → executor 跑 worker → 写 state + run log + 释放锁; **永不抛** |
| `normalizeTriggerSources` | 归一 sources (单/数组) 为去重 string[] |

### hooks/data-touchpoint.hooks.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `registerDataTouchpointHooks` | 把 5 个 hook 挂到 HookBus (trigger 仅在 triggerService 传入时注册), 重复挂载安全 |

## DataTouchpoint 数据结构

```typescript
interface DataTouchpoint {
  _id: string;            // UUID v4
  solutionId: string;
  name: string;
  description: string;
  sources: string[];      // 触发器调用时携带的 source 名 (1-32 个)
  notifyTargets: Array<{    // 通知中间表: sessionId → 该 session 内要 @ 的 agent 子集; 1-64 个 entry, 每个 entry.agentIds 1-32 个
    sessionId: string;
    agentIds: string[];
  }>;
  createdByAgentId: string; // 创建该触点的 agent principal id; 胶水 callHook 业务 hook 用这个身份; 由 hook handler 从 context 注入, LLM 不能 fake
  filePath: string;       // 胶水代码相对 cwd 路径 (路径越根会被 paths 防护拒绝)
  configPath: string;     // 受限 hook 白名单配置文件相对路径
  enabled: boolean;       // 用户主动启停; 健康度看 data_touchpoint_runs 运行历史
  createdAt: string;      // ISO 8601
  updatedAt: string;
}
```

## ctx.ret API — 统一返回器

胶水代码通过 `return ctx.ret.xxx(...)` 声明执行结果, 框架据此做后续处理:

| 调用 | outcome | state | 通知 | runLog |
|------|---------|-------|------|--------|
| `return ret.success({ state, notify })` | success | 写 state | forEach notifyTargets 发 sendMsg (一 session 一条, mentions=entry.agentIds) | 写 |
| `return ret.success({ state })` | success | 写 state | 不发 | 写 |
| `return ret.success({ notify })` | success | 保留上次 | 发 | 写 |
| `return ret.success()` / `return undefined` | success | 保留上次 | 不发 | 写 |
| `return ret.skip()` | skip | 保留上次 | 不发 | **不写** |
| `return ret.skip({ record: true, reason })` | skip | 保留上次 | 不发 | 写 (skipReason 入库) |
| `return ret.error({ message, code? })` | error | 保留上次 | 不发 | 写 (含 code, 默认 HANDLER_THROW) |
| `throw new Error(...)` | error | 保留上次 | 不发 | 写 (code=HANDLER_THROW, message=e.message, stack=e.stack) |

注意:
- **单次执行 = 单次 ret**, 不支持一次跑发多次通知 (要多次通知就拆多个触点)
- **通知任一 session 失败 → 整条 run 翻 outcome=error + code=NOTIFY_TARGET_INVALID**, 失败的 sessionId 不存独立字段, 完整轨迹在 `log[]` 时间轴 (`touchpoint.notify.send.failed` 事件含 sessionId + message)
- `extras` 透传到 sendMsg payload, 核心字段 (sessionId/sender/messageType/mentions/content) 由框架覆盖, 防胶水误覆盖

## 错误码 (TouchpointErrorCode)

内定枚举, 跟 outcome 配合可快速分类筛选:

| Code | 触发场景 |
|------|---------|
| `HANDLER_THROW` | 胶水 throw / ret.error 未传 code |
| `HOOK_DENIED` | 沙箱白名单拒绝 (outcome='denied') |
| `TIMEOUT` | 60s 超时 worker.terminate kill (outcome='timeout') |
| `LOAD_FAILED` | 路径越根 / import 失败 / config 解析失败 |
| `NOTIFY_TARGET_INVALID` | 通知派发任一 session 失败: session 不存在 / **mention 的 agent 不是会话成员** (notifier 强制传 strictMention=true 触发 saas 严格校验) / sendMsg handler 抛错; error.message 含 `principalId=<x> sessionId=<y>` 方便纠错机制 parse |
| `INTERNAL_ERROR` | 框架异常 (lock 抢不到 / worker exit 异常 / mongo 断连) |

## 运行历史 (data_touchpoint_runs) — 单向链表

每次触点执行 (success / error / timeout / denied / skip+record=true) 都写一条 run 记录, **同 touchpointId 下多条记录构成一条按 startedAt 单向链表**:

```
 [run#3 (latest)]  ──previousRunId──►  [run#2]  ──previousRunId──►  [run#1 (head)]  ──►  null
                                                                                            (链断点 / 首次)
```

- 拿任意一条 run 都能通过 `previousRunId` 反向追溯整条历史
- skip + record=false 不写记录 → **不进链** (高频静默检查不污染历史)
- skip + record=true 进链, outcome='skip' 也是链上一环
- 30 天 TTL 会让链头被清, 链自动短截 (历史本就该有保留窗口)
- 写入由 `RunnerTouchpointRunLog.write` 权威填 previousRunId, 调用方不要自己传 — 触点锁保证同 touchpointId 不并发, 无 race

| 字段 | 含义 |
|------|------|
| `_id` | randomUUID |
| `touchpointId` / `runnerId` / `createdByAgentId` | 索引, 多租户隔离 + 创建者维度反查 |
| `previousRunId` | **链表指针**: 上一条 run 的 _id; 首次 / 链断点 = null |
| `startedAt` / `durationMs` | 运行时间 (startedAt 带 30 天 TTL) |
| `firedBy` | `source` (业务事件) / `schedule` (定时) |
| `matchedSources` | 命中的 source 交集 (schedule 触发为 []) |
| `outcome` | `success` / `skip` / `error` / `timeout` / `denied` |
| `payloadSummary` | `{ bytes, preview }` 前 512 字节截断, 防文档膨胀 |
| `result` | 同上, newState 摘要 (outcome=success 时填) |
| `error` | `{ code, message, stack?, hookName?, allowedHooks? }`; code 必填, 见错误码表 |
| `skipReason` | outcome=skip 且 record=true 时入库, 胶水声明的跳过原因 |
| `traceId` | OTel trace id, 关联运行 span |
| `log` | `HookLogEntry[]`, 完整链路: load → worker → ret 解析 → notify forEach → done; 由 InMemorySpanExporter drain 出 |

**skip vs return undefined 区别** ::
- `return undefined` → outcome='success', state 保留, **仍写一条 success run 记录** (适合"跑了但 newState 不变")
- `return ret.skip()` → outcome='skip', state 保留, **默认不写 run 记录** (适合高频检查 + 数据不满足条件, 不刷 collection)
- `return ret.skip({ record: true, reason: '...' })` → 写一条 outcome='skip' + skipReason 记录, 调试 / 留痕用

UI 后续查 runs 时间轴判断触点健康度; 不再依赖元数据 status 字段。

## 已落地

- [x] 元数据 CRUD (mongo collection + 4 个 hook; deleteBySolution **不**挂 hook, 仅 service 方法)
- [x] 触发器 `runner.app.dataTouchpoint.trigger` (主动触发 hook)
- [x] BullMQ 异步队列 (并发 4, **attempts=1 不重试**; 单触点失败仅写 run 记录, 不影响其他触点)
- [x] 沙箱 callHook (运行时白名单 + createdByAgentId 触点创建者主体 principalType='agent'; saas 端 system 链路放行, 防越权靠白名单+黑名单)
- [x] **createdByAgentId 字段** (create hook handler 从 context.principalId 注入, LLM 不能 fake, 一经创建不可改; update 软过滤 _id/solutionId/createdByAgentId/createdAt)
- [x] **LLM 链路鉴权** (update/delete: 只允许 createdByAgentId === principalId; list: 强制限定 "我创建的 + 通知到我的"; trigger: 拒绝 LLM 调用防伪造业务事件)
- [x] **saas 端 sendMsg 严格 mention 校验 (opt-in)** (sendMsg payload 加 `strictMention?: boolean`; 通用调用方默认 false 静默, 数据触点 notifier 永远传 true; 任一 mention 不是会话成员 → throw NotFoundException, 触发 outcome=error code=NOTIFY_TARGET_INVALID, error 含 principalId+sessionId 可被纠错机制 parse)
- [x] **saas 端 debugLog 回填 runLog** (notifier 消费 result.debugLog 转发到 session.log, 前缀 `saas.`, 跨服务诊断一站式)
- [x] **沙箱通知黑名单** (saas.app.conversation.sendMsg 硬拒, 通知唯一路径走 ret.notify, AI 生成无机会绕过)
- [x] **多 agent + 多 session 通知 (中间表)** (notifyTargets: Array<{ sessionId, agentIds[] }>; 每个 session 一条消息, mentions=该 entry.agentIds; sessionId↔agentIds 绑定关系由触点创建时声明, 保证 mention 落在该 session 实际成员里)
- [x] **SYSTEM_NOTIFIER 通知通道** (notifier 内 principal='ai-notify' principalType='official', saas 端跨群跳过成员校验; 跟胶水业务 callHook 主体分离)
- [x] **跨服务 trace 关联** (notifier 透传 session.traceId 给 saas sendMsg, saas 端写成 span attribute `hook.upstreamTraceId` 反查关联; 注意是 attribute 标记不是 OTel 标准 parent-child)
- [x] **路径防护** (touchpoint-paths 拒绝绝对路径 / `..` / symlink 逃逸; 越根抛 TouchpointPathDeniedError)
- [x] **worker_threads 真 kill** (60s 超时 worker.terminate(), 死循环胶水也能被杀干净)
- [x] **ctx.ret 统一返回器** (ret.skip / ret.success({state, notify}) / ret.error({message, code}); throw 自动捕获 = ret.error)
- [x] **通知派发** (按 notifyTargets 中间表 forEach 调 sendMsg; 框架填 ai-notify/notification/mentions=entry.agentIds)
- [x] **通知任一 session 失败 → 整条 error** (code=NOTIFY_TARGET_INVALID, 失败明细在 log[] 时间轴)
- [x] **错误码枚举** (HANDLER_THROW / HOOK_DENIED / TIMEOUT / LOAD_FAILED / NOTIFY_TARGET_INVALID / INTERNAL_ERROR)
- [x] **完整 OTel 链路 log** (load → worker.spawn → handler-returned → notify.start → notify.send.success/failed → notify.done → run.end)
- [x] **OTel 运行历史** (BasicTracerProvider + InMemorySpanExporter, load/run/error/callhook 各阶段 SpanEvent, finalize drain 进 mongo run log, TTL 30 天)
- [x] **Redis 多租户隔离** (lock/state/schedule key + BullMQ queue prefix 全部 `tp:{runnerId}`, 共享 redis 不互串)
- [x] hookBus saas.* 前缀路由 (跨进程透明转发到 SaaS hook)
- [x] 触点级线性锁 (redis SET NX PX + Lua 释放, 60s TTL)
- [x] state 双 store: MongoStateStore (默认) / RedisStateStore (高频, 24h TTL)
- [x] 胶水代码契约 prev → run → new (return 即 newState; return undefined 保留上次)
- [x] `export const schedule` 时间触发 (cron / interval / once); once 完成自动 enabled=false
- [x] `export const highFrequency` 切 redis state
- [x] Runner 启动期 bootstrapSchedules (兜底 redis 数据丢失)
- [x] SaaS sendMsg `mentions` explicit 字段
- [x] 多 source 合并触发 ($in 自然去重 + payloadsBySource 切片)

## 待补 (后续阶段)

- [ ] solution 卸载流程在 SaaS 侧直接 import 调用 `deleteBySolution` (Phase 1.4)
- [ ] Mongo change stream / Redis pub-sub 自动触发 (Phase 1.8 P1)
- [ ] 触点目录迁移到 solution 物理结构下 (待 Phase 1.4)
- [ ] 循环触发防护 (traceId 透传 + 同 traceId 内同触点 N 次拒绝)
- [ ] 跨 session 推送 (`reportTo`, Phase 5)
- [ ] 触点详情 / 运行历史 UI (查 data_touchpoint_runs + state 双 store 统一抽象)
- [ ] 通知方式形式化 (胶水自决 vs 字段化声明, 待定)

## 触点胶水代码示例

### 标准 (低频 + 状态对比 + 定时跑) 触点

```js
// touchpoints/<id>/index.js

// 时间触发: 每天 9:00 (Asia/Shanghai)
export const schedule = { cron: '0 9 * * *', timezone: 'Asia/Shanghai' };

export default async function ({ payload, prevState, callHook, log, ret, touchpoint }) {
  log('triggered', { firedBy: payload?.firedBy ?? 'source' });

  const recent = await callHook('runner.unitcore.mongo.aggregate', {
    collection: 'orders',
    pipeline: [/* ... */],
  });

  // 数据不足 → 跳过, 不写运行记录, prevState 保留
  if (!recent || recent.value == null) {
    return ret.skip({ reason: '聚合无数据' });
  }

  // 跟上次比 (prevState 由 trigger.service 自动注入)
  const lastValue = prevState?.lastValue ?? recent.value;
  const dropPct = lastValue > 0 ? (lastValue - recent.value) / lastValue : 0;

  if (dropPct <= 0.3) {
    // 没触发阈值 → 跳过但留痕方便排查
    return ret.skip({ record: true, reason: `降幅 ${(dropPct * 100).toFixed(1)}% 未达阈值` });
  }

  // 触发: 更 state + 框架按 notifyTargets 中间表自动 forEach 通知, 每 session 一条 mentions=entry.agentIds
  // sendMsg / ai-notify / messageType / mentions 全是框架填, 胶水代码无机会写错
  return ret.success({
    state: { lastValue: recent.value, lastCheckedAt: Date.now() },
    notify: {
      content: `[触点: ${touchpoint.name}] 近 7 天订单同比下降 ${(dropPct * 100).toFixed(1)}%`,
    },
  });
}
```

```json
// touchpoints/<id>/touchpoint.config.json
{
  "name": "订单量大幅下降监测",
  "allowedHooks": [
    "runner.unitcore.mongo.aggregate",
    "saas.app.conversation.sendMsg"
  ],
  "timeout": 10000
}
```

### 多 source 联动触点 (一次操作影响多张表)

业务方触发(注意 `sources` 数组 + `payloadsBySource` 按 source 切):

```js
await callHook('runner.app.dataTouchpoint.trigger', {
  sources: ['user', 'auth'],                   // 一次性告知影响了哪些 source
  payloadsBySource: {                          // 每个 source 各自的 diff
    user: { id: 'u_123', before: {...}, after: {...} },
    auth: { id: 'u_123', scopeDiff: ['admin->member'] },
  },
});
```

胶水触点声明 `sources: ['user', 'auth']`, 仅会被命中**一次**, ctx 拿到的入参形态:

```js
export default async function ({ matchedSources, payloadsBySource, ret, touchpoint }) {
  // matchedSources = ['user', 'auth']  ← 触点 sources ∩ 触发 sources
  // payloadsBySource = { user: {...}, auth: {...} }  ← 仅含 matchedSources 对应键

  const userDiff = payloadsBySource.user;
  const authDiff = payloadsBySource.auth;

  // 一次操作触发了双 source 联动, 通知所有绑定 session
  if (userDiff && authDiff) {
    return ret.success({
      state: { lastCheckedAt: Date.now() },
      notify: {
        content: `账号 ${userDiff.id} 同时发生资料更新 + 权限变更, 请关注`,
      },
    });
  }
  // 没满足联动条件 → 只更 state 不通知
  return ret.success({ state: { lastCheckedAt: Date.now() } });
}
```

### 高频触点 (state 切 redis, 锁仍开)

```js
// touchpoints/<id>/index.js
export const highFrequency = true;                  // ← state 走 redis, 不写 mongo
export const schedule = { interval: 5_000 };        // 每 5 秒

export default async function ({ payload, prevState, callHook, log, touchpoint }) {
  // 跟低频契约完全一致, 不感知存储差异
  // 注意: redis state 持久性弱, prevState 可能为 undefined (Runner 重启 / TTL 过期)
}
```

## 关键约定

- **通知只能走 ctx.ret.success({ notify })**, 沙箱已**硬拒** `saas.app.conversation.sendMsg` (列 allowedHooks 也无效); sendMsg/ai-notify/messageType/mentions 全部由框架填; 推送目标走元数据 notifyTargets 中间表 (sessionId ↔ agentIds 子集), 每个 session 一条消息合并 @ 该 session 关注的 agent
- `allowedHooks` 只列**业务 hook** (mongo / ast / saas 业务 API), **不要列 sendMsg** (硬黑名单, 列了也拒绝)
- 沙箱 callHook 业务 hook 主体: `principalId = touchpoint.createdByAgentId` (创建该触点的 agent), `principalType = 'agent'`; 创建时由 hook handler 从 context.principalId 自动注入, LLM 不能 fake. **注意**: saas 端 HookAbilityMiddleware 在 `source='system'` 时跳过 ability 校验, 这个 principal 实际是**审计/追溯**作用, 不影响 saas 端实际放行 — 真正的越权防护是 `SANDBOX_NOTIFY_DENYLIST` 硬黑名单 + `config.allowedHooks` 白名单两道前置门
- 通知派发独立 principal: `principalId = 'ai-notify'` (SYSTEM_NOTIFIER, principalType='official_account' 跟 saas 端 PrincipalType.OfficialAccount 枚举一致); saas 端 im-message 跨群跳过 sender 成员校验, 专用通道
- **Mention 严格校验 (opt-in 模式)**: saas 端 sendMsg 默认静默允许 mention 退群成员 (通用场景); 数据触点 notifier 永远传 `strictMention: true`, saas 端启严格模式逐个校验 mention 是会话成员 (SYSTEM_NOTIFIER 跳过), 任一不是 → throw NotFoundException → 触点端 outcome='error' code='NOTIFY_TARGET_INVALID'. error.message 含具体 `principalId=<x> sessionId=<y>` 方便后续纠错机制定位错配并修复 notifyTargets 中间表
- **saas 端 debugLog 回填**: notifier 消费 hookBus.emit results 里的 `r.debugLog`, 转发到 session.log (前缀 `saas.`), 最终进 RunLogDoc.log[]. saas 端 sendMsg handler 内部细节 (session 不存在 / mention 校验失败堆栈) 在 runner 端运行历史里一站式可见
- **trace attribute 关联** (注意: 不是 OTel 标准 parent-child): trigger.service 调 notifier 时透传 session.traceId 到 context.traceId, saas 端 invoker 把它写成 span attribute `hook.upstreamTraceId`; 跨服务排查通过 attribute 反查关联, 不是直接同一个 trace 拓扑
- 通知派发**任一 session 失败 → 整条 run 翻 outcome='error' + code='NOTIFY_TARGET_INVALID'**; 完整失败列表在 log[] 时间轴里
- `prevState` 首次执行 / mongo 没记录 / redis TTL 过期都是 `undefined`, 胶水代码必须容忍
- `return undefined` / `return ret.success()` → state 不更新, 保留上次, 不通知, 仍写 outcome='success' run 记录
- `return ret.skip()` → 跳过本次, state 不动, **默认不写 run 记录**; `ret.skip({ record: true, reason })` 才写一条 outcome='skip' (高频静默检查的关键减负手段)
- **错误自动捕获**: 胶水 `throw` 等价 `ret.error({ message, code: HANDLER_THROW })`, 框架兜底; 胶水不需要手写 try/catch
- **单次执行 = 单次 ret**: 一次跑里只能发一次通知 / 写一次 state; 多通知场景拆多触点
- **超时强 kill**: handler 超时 (config.timeout, 默认 10s, 上限 60s) 由 `worker.terminate()` 强 kill; 胶水 **没有** finally 清理机会, 副作用要幂等
- **路径约束**: filePath / configPath 必须相对路径且不能逃出 runner cwd; 绝对路径 / `..` / symlink 逃出都会被 touchpoint-paths 拒绝, outcome='error' code='LOAD_FAILED'
- **失败不影响调度**: attempts=1 不重试; 单触点失败只写一条 run 记录, 不回写元数据, 下次依旧执行
- **顶层副作用约束**: 胶水代码 top-level 只允许 export, 不允许有副作用 (主线程预读 highFrequency / schedule 时会 dynamic import 一次)
- **多 source 触发** ::
  - 业务侧一次原子变更影响多表 → 一次 `trigger({ sources: [...], payloadsBySource: {...} })`, 不要拆多次调用
  - 触点 `sources` 与触发 `sources` 的交集为空时不会被调度 (`$in` 已过滤)
  - 胶水 ctx `matchedSources` / `payloadsBySource` 必须容忍空 (`schedule` 触发时为 `[]` / `{}`)
- **多租户隔离**: runnerId 缺省时 trigger 服务不启动 (app.ts 守卫); 所有 redis key + BullMQ queue prefix 都带 runnerId, 多 runner 共享 redis 不串
