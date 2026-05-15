# Runner 数据触点模块

**模块路径**: `runner/src/modules/data-touchpoint/`

## 模块功能描述

数据触点 (Data Touchpoint) 是用户视角的"数据探针": 用户对某个数据维度有持续关注 (如"最近 N 天订单是否大幅下降"), 创建数据触点绑定 session/agent, 源数据变动时触发器把它推进异步队列, 胶水代码判定是否回调, 通过 `SYSTEM_NOTIFIER` 主体 + `messageType=notification` 把数据塞回 session, UI 不渲染但 agent 下一轮回话能感知响应。

本模块当前已落地 **元数据 CRUD + BullMQ 异步队列 + 路径防护 + worker_threads 真 kill + bindAgentId 鉴权主体 + OTel 运行历史 + Redis 多租户隔离** 完整闭环。胶水代码物理位置由 `filePath` / `configPath` 字段相对当前 runner 进程 cwd 解析, 路径越根 / `..` 逃逸 / symlink 逃逸都会被 `touchpoint-paths.ts` 拒绝; 等 Phase 1.4 solution 物理结构落地后会迁移到 `solutions/<...>/touchpoints/<id>/`。

**多 source 合并通知** :: 一次业务操作影响多张表时, 直接 `trigger({ sources: ['user', 'auth'], payloadsBySource: { user: {...}, auth: {...} } })` 入队一次, mongo `$in` 查询自然去重 — 同时订阅 user 和 auth 的触点只跑一次, 胶水 ctx 拿到 `matchedSources: ['user','auth']` + `payloadsBySource` 切好的子集, 自己决定如何合并响应。

**胶水代码完全自治**: 自己用 `callHook(name, payload)` 调任何白名单内 hook (`saas.*` / `runner.*` 一视同仁), 由 hookBus 内部按前缀路由 — `saas.*` 自动跨进程转发到 SaaS, `runner.*` 走本地。推送决策完全交还胶水, trigger.service 不接管推送语义, 只负责加载执行 + 单触点失败回写 `status=broken`。

要发隐藏通知, 胶水代码自己调 `saas.app.conversation.sendMsg`, 用 `senderPrincipalId: 'ai-notify'` (SYSTEM_NOTIFIER) + `messageType: 'notification'`, 详见末尾示例。

## 关键词索引

- 数据触点元数据 -> services/data-touchpoint.service.ts
- 数据触点类型 -> types/data-touchpoint.types.ts
- 数据触点 Hook 注册 -> hooks/data-touchpoint.hooks.ts (registerDataTouchpointHooks)
- 路径防护 / 越根拒绝 / symlink 逃逸 -> services/touchpoint-paths.ts (resolveTouchpointFile)
- 运行历史 / run log / TTL 自动清理 -> services/touchpoint-run-log.ts (RunnerTouchpointRunLog)
- OTel session / SpanEvent drain / 运行 trace -> services/touchpoint-otel.ts (createTouchpointLogSession)
- worker_threads 真 kill / 触点执行隔离 -> services/touchpoint-executor.ts (runTouchpointInWorker) + services/touchpoint-worker.ts (子线程入口)
- bindAgentId 鉴权主体 / 沙箱 callHook -> services/touchpoint-loader.ts (createSandboxedCallHook)
- 主动推送 / 隐藏通知 / sendMsg notification -> 见 PLAN.md 1.8 节
- SYSTEM_NOTIFIER 跨群通知主体 -> src/app/identity/constants/system-principals.ts (SaaS 端)

## 模块文件

- `types/data-touchpoint.types.ts` - DataTouchpoint 接口 + zod schema (Create/Update/Delete/List/Trigger/TouchpointConfig) + TouchpointHandler 类型
- `services/data-touchpoint.service.ts` - mongo collection `data_touchpoints` 元数据 CRUD
- `services/touchpoint-paths.ts` - 路径解析 + traversal/symlink 防护; 越根直接抛 TouchpointPathDeniedError
- `services/touchpoint-loader.ts` - 路径校验 + 读 config + 主线程预读胶水元数据 (highFrequency / schedule) + 受限 callHook 工厂 (运行时白名单, bindAgentId 主体)
- `services/touchpoint-worker.ts` - worker_thread 子线程入口: 动态 import 胶水, callHook / log 通过 parentPort RPC 转主线程
- `services/touchpoint-executor.ts` - 主线程侧 worker 包装: spawn worker + 60s 强 kill + callHook 转发 + outcome 归一
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
| runner.app.dataTouchpoint.create | 创建数据触点元数据 | { solutionId, name, description?, sources[], bindSessionId, bindAgentId, filePath, configPath, enabled? } |
| runner.app.dataTouchpoint.update | 更新数据触点 (id 必填, 其他字段可选) | { id, ...partial } |
| runner.app.dataTouchpoint.delete | 删除数据触点元数据 | { id } |
| runner.app.dataTouchpoint.list | 列出数据触点 (可过滤) | { solutionId?, bindSessionId?, source?, sourceIn?, enabled? } |
| runner.app.dataTouchpoint.trigger | 触发器: 异步派发到队列, 命中触点逐个执行胶水代码 | { sources: string \| string[], payload?, payloadsBySource?: { [source]: any }, solutionId? } |

## 核心函数

### services/data-touchpoint.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `create` | 生成 UUID, 写入 mongo, 默认 enabled=true (无 status, 健康度看运行历史) |
| `update` | 按 _id 局部更新, 返回更新后的完整文档 |
| `delete` | 按 _id 硬删 |
| `getById` | 按 _id 取单条 |
| `list` | 按 solutionId / bindSessionId / source / sourceIn / enabled 过滤 |
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
| `createSandboxedCallHook` | 受限 callHook 工厂, 仅放行 config.allowedHooks; 主体身份用 touchpoint.bindAgentId (principalType='agent') |
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
| `RunnerTouchpointRunLog.ensureIndexes` | 幂等创建 (touchpointId,startedAt) + (runnerId,startedAt) + TTL 索引 (30 天) |
| `RunnerTouchpointRunLog.write` | 写一条运行记录, 写入异常静默 (不因日志写不下去拖死触点) |
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
  bindSessionId: string;  // 创建时绑定的 session = 回调目标
  bindAgentId: string;    // 群聊艾特目标 + 沙箱 callHook 主体 (principalType='agent')
  filePath: string;       // 胶水代码相对 cwd 路径 (路径越根会被 paths 防护拒绝)
  configPath: string;     // 受限 hook 白名单配置文件相对路径
  enabled: boolean;       // 用户主动启停; 健康度看 data_touchpoint_runs 运行历史
  createdAt: string;      // ISO 8601
  updatedAt: string;
}
```

## 运行历史 (data_touchpoint_runs)

每次触点执行 (无论 success / error / timeout / denied) 都写一条 run 记录:

| 字段 | 含义 |
|------|------|
| `_id` | randomUUID |
| `touchpointId` / `runnerId` | 索引, 多租户隔离 |
| `startedAt` / `durationMs` | 运行时间 (startedAt 带 30 天 TTL) |
| `firedBy` | `source` (业务事件) / `schedule` (定时) |
| `matchedSources` | 命中的 source 交集 (schedule 触发为 []) |
| `outcome` | `success` / `error` / `timeout` (worker.terminate kill) / `denied` (白名单拒绝) |
| `payloadSummary` | `{ bytes, preview }` 前 512 字节截断, 防文档膨胀 |
| `result` | 同上, newState 摘要 (outcome=success 时填) |
| `error` | `{ message, stack?, hookName?, allowedHooks? }`; denied 时 hookName / allowedHooks 有值 |
| `traceId` | OTel trace id, 关联运行 span |
| `log` | `HookLogEntry[]`, 由 createTouchpointLogSession 的 InMemorySpanExporter drain 出 |

UI 后续查 runs 时间轴判断触点健康度; 不再依赖元数据 status 字段。

## 已落地

- [x] 元数据 CRUD (mongo collection + 4 个 hook; deleteBySolution **不**挂 hook, 仅 service 方法)
- [x] 触发器 `runner.app.dataTouchpoint.trigger` (主动触发 hook)
- [x] BullMQ 异步队列 (并发 4, **attempts=1 不重试**; 单触点失败仅写 run 记录, 不影响其他触点)
- [x] 沙箱 callHook (运行时白名单 + bindAgentId 主体 principalType='agent', saas 端按 agent 鉴权)
- [x] **路径防护** (touchpoint-paths 拒绝绝对路径 / `..` / symlink 逃逸; 越根抛 TouchpointPathDeniedError)
- [x] **worker_threads 真 kill** (60s 超时 worker.terminate(), 死循环胶水也能被杀干净)
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

export default async function ({ payload, prevState, callHook, log, touchpoint }) {
  log('triggered', { firedBy: payload?.firedBy ?? 'source' });

  const recent = await callHook('runner.unitcore.mongo.aggregate', {
    collection: 'orders',
    pipeline: [/* ... */],
  });

  // 跟上次比 (prevState 由 trigger.service 自动注入)
  const lastValue = prevState?.lastValue ?? recent.value;
  const dropPct = lastValue > 0 ? (lastValue - recent.value) / lastValue : 0;

  if (dropPct > 0.3) {
    // 自己决定推什么 — 直接调 saas hook, 由 hookBus 自动跨进程转发
    await callHook('saas.app.conversation.sendMsg', {
      sessionId: touchpoint.bindSessionId,
      senderPrincipalId: 'ai-notify',                  // SYSTEM_NOTIFIER, UI 隐藏 / agent 可见
      messageType: 'notification',
      mentions: [touchpoint.bindAgentId],              // ← 1.8.4: 显式 mention 绕过 @ 解析
      content: `[触点: ${touchpoint.name}] 近 7 天订单同比下降 ${(dropPct * 100).toFixed(1)}%`,
    });
  }

  // return 即 newState, 下次 prevState 就是这个
  return { lastValue: recent.value, lastCheckedAt: Date.now() };
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
export default async function ({ matchedSources, payloadsBySource, prevState, callHook, log, touchpoint }) {
  // matchedSources = ['user', 'auth']  ← 触点 sources ∩ 触发 sources
  // payloadsBySource = { user: {...}, auth: {...} }  ← 仅含 matchedSources 对应键

  const userDiff = payloadsBySource.user;
  const authDiff = payloadsBySource.auth;

  if (userDiff && authDiff) {
    await callHook('saas.app.conversation.sendMsg', {
      sessionId: touchpoint.bindSessionId,
      senderPrincipalId: 'ai-notify',
      messageType: 'notification',
      mentions: [touchpoint.bindAgentId],
      content: `账号 ${userDiff.id} 同时发生资料更新 + 权限变更, 请关注`,
    });
  }
  return { lastCheckedAt: Date.now() };
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

- `allowedHooks` 里 `saas.*` 和 `runner.*` 都可以列, 白名单语义统一; saas.* 由 hookBus 自动跨进程转发
- 想推送 hidden notification 必加 `saas.app.conversation.sendMsg` 白名单
- 推送身份固定 `senderPrincipalId: 'ai-notify'` + `messageType: 'notification'` (UI 不渲染, agent 可见)
- 群聊场景必传 `mentions: [agentPrincipalId]` 显式 mention, 否则 agent 不会被调度
- 沙箱 callHook 自动注入 `principalId = touchpoint.bindAgentId`, `principalType = 'agent'`; saas 端 ability 中间件按 agent 鉴权 (agent 自己能做的事它的触点也能做)
- `prevState` 首次执行 / mongo 没记录 / redis TTL 过期都是 `undefined`, 胶水代码必须容忍
- `return undefined` → state 不更新, 保留上次 (但 run 记录仍写)
- **超时强 kill**: handler 超时 (config.timeout, 默认 10s, 上限 60s) 由 `worker.terminate()` 强 kill; 胶水代码 **没有** finally 清理机会, 副作用要做好幂等
- **路径约束**: filePath / configPath 必须相对路径且不能逃出当前 runner cwd; 绝对路径 / `..` / symlink 逃出都会被 touchpoint-paths 拒绝并写 outcome='error' 的 run 记录
- **失败不影响调度**: attempts=1 不重试; 单触点失败仅写一条 outcome=error/timeout/denied 的 run 记录, 不回写元数据 status, 下次依旧执行
- **顶层副作用约束**: 胶水代码 top-level 只允许 export, 不允许有副作用 (主线程预读 highFrequency / schedule 时会 dynamic import 一次)
- **多 source 触发** ::
  - 业务侧一次原子变更影响多表 → 一次 `trigger({ sources: [...], payloadsBySource: {...} })`, 不要拆多次调用
  - 触点 `sources` 与触发 `sources` 的交集为空时不会被调度 (`$in` 已过滤)
  - 胶水 ctx `matchedSources` / `payloadsBySource` 必须容忍空 (`schedule` 触发时为 `[]` / `{}`)
- **多租户隔离**: runnerId 缺省时 trigger 服务不启动 (app.ts 守卫); 所有 redis key + BullMQ queue prefix 都带 runnerId, 多 runner 共享 redis 不串
