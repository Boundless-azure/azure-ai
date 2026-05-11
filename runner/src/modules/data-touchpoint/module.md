# Runner 数据触点模块

**模块路径**: `runner/src/modules/data-touchpoint/`

## 模块功能描述

数据触点 (Data Touchpoint) 是用户视角的"数据探针": 用户对某个数据维度有持续关注 (如"最近 N 天订单是否大幅下降"), 创建数据触点绑定 session/agent, 源数据变动时触发器把它推进异步队列, 胶水代码判定是否回调, 通过 `SYSTEM_NOTIFIER` 主体 + `messageType=notification` 把数据塞回 session, UI 不渲染但 agent 下一轮回话能感知响应。

本模块当前 (Phase 1.8) 已落地 **元数据 CRUD + 触发器 + BullMQ 异步队列 + 沙箱 callHook** 完整闭环。胶水代码物理位置目前由 `filePath` / `configPath` 字段绝对/相对路径直接指定, 等 Phase 1.4 solution 物理结构落地后会迁移到 `solutions/<...>/touchpoints/<id>/`。

**胶水代码完全自治**: 自己用 `callHook(name, payload)` 调任何白名单内 hook (`saas.*` / `runner.*` 一视同仁), 由 hookBus 内部按前缀路由 — `saas.*` 自动跨进程转发到 SaaS, `runner.*` 走本地。推送决策完全交还胶水, trigger.service 不接管推送语义, 只负责加载执行 + 单触点失败回写 `status=broken`。

要发隐藏通知, 胶水代码自己调 `saas.app.conversation.sendMsg`, 用 `senderPrincipalId: 'ai-notify'` (SYSTEM_NOTIFIER) + `messageType: 'notification'`, 详见末尾示例。

## 关键词索引

- 数据触点元数据 -> services/data-touchpoint.service.ts
- 数据触点类型 -> types/data-touchpoint.types.ts
- 数据触点 Hook 注册 -> hooks/data-touchpoint.hooks.ts (registerDataTouchpointHooks)
- 主动推送 / 隐藏通知 / sendMsg notification -> 见 PLAN.md 1.8 节
- SYSTEM_NOTIFIER 跨群通知主体 -> src/app/identity/constants/system-principals.ts (SaaS 端)

## 模块文件

- `types/data-touchpoint.types.ts` - DataTouchpoint 接口 + zod schema (Create/Update/Delete/List/Trigger/TouchpointConfig) + TouchpointHandler 类型
- `services/data-touchpoint.service.ts` - mongo collection 元数据 CRUD
- `services/touchpoint-loader.ts` - 加载 config + 动态 import 胶水代码 + 受限 callHook 工厂 (运行时白名单拦截) + 超时控制
- `services/touchpoint-trigger.service.ts` - BullMQ Queue + Worker (并发 4) + trigger 公共 API + 单触点失败兜底
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
| runner.app.dataTouchpoint.list | 列出数据触点 (可过滤) | { solutionId?, bindSessionId?, source?, enabled? } |
| runner.app.dataTouchpoint.trigger | 触发器: 异步派发到队列, 命中触点逐个执行胶水代码 | { sourceName, payload?, solutionId? } |

## 核心函数

### services/data-touchpoint.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `create` | 生成 UUID, 写入 mongo, 默认 status=ready / enabled=true |
| `update` | 按 _id 局部更新, 返回更新后的完整文档 |
| `delete` | 按 _id 硬删 |
| `getById` | 按 _id 取单条 |
| `list` | 按 solutionId / bindSessionId / source / enabled 过滤 |
| `deleteBySolution` | 联动清理: solution 卸载时删除其所有触点 |

### services/touchpoint-loader.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadTouchpoint` | 读 config + 动态 import 胶水代码, 返回带白名单沙箱 + 超时的执行器 |
| `createSandboxedCallHook` | 受限 callHook 工厂, 仅放行 config.allowedHooks 内的 hook 名, 否则抛 TouchpointHookDeniedError |
| `TouchpointHookDeniedError` | 沙箱拒绝异常 |

### services/touchpoint-trigger.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `RunnerTouchpointTriggerService.start` | 创建 BullMQ Queue + Worker (并发 4), 重复调用安全 |
| `RunnerTouchpointTriggerService.stop` | 关闭 Queue + Worker (优雅退出) |
| `RunnerTouchpointTriggerService.trigger` | trigger 公共 API: 入队后立即返回 jobId; attempts=3, 指数退避 |
| `consume` | Worker 消费: 按 source/solutionId 拉触点, 逐个 runOne |
| `runOne` | 加载胶水 → 跑代码 → 失败回写 status=broken (推送由胶水自己 callHook 决定) |

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
  bindAgentId: string;    // 群聊艾特目标 agent principal id
  filePath: string;       // 胶水代码相对 solution 根路径
  configPath: string;     // 受限 hook 白名单配置文件相对路径
  enabled: boolean;
  status: 'ready' | 'broken' | 'disabled';
  createdAt: string;      // ISO 8601
  updatedAt: string;
}
```

## 已落地 (Phase 1.8 完整闭环)

- [x] 元数据 CRUD (mongo collection + 4 个 hook)
- [x] 触发器 `runner.app.dataTouchpoint.trigger` (主动触发 hook)
- [x] BullMQ 异步队列 (并发 = 4, attempts=3 指数退避)
- [x] 沙箱 callHook (运行时白名单拦截, config 驱动)
- [x] 胶水代码动态加载 + 超时控制 + 失败回写 status=broken
- [x] hookBus saas.* 前缀路由 (跨进程透明转发到 SaaS hook)
- [x] **触点级线性锁 (redis SET NX EX + Lua 释放)**
- [x] **state 双 store: MongoStateStore (默认) / RedisStateStore (高频)**
- [x] **胶水代码契约 prev → run → new (return 即 newState)**
- [x] **`export const schedule` 时间触发 (cron / interval / once)**
- [x] **`export const highFrequency` 切 redis state**
- [x] **Runner 启动期扫表 bootstrapSchedules (兜底 redis 数据丢失)**
- [x] **SaaS sendMsg `mentions` explicit 字段 (1.8.4 命门修复)**

## 待补 (后续阶段)

- [ ] solution 卸载钩子调用 `deleteBySolution` 联动清理
- [ ] Mongo change stream / Redis pub-sub 自动触发 (Phase 1.8 P1)
- [ ] 触点目录迁移到 solution 物理结构下 (待 Phase 1.4)
- [ ] 循环触发防护 (traceId 透传 + 同 traceId 内同触点 N 次拒绝)
- [ ] 跨 session 推送 (`reportTo`,Phase 5)
- [ ] 触点详情 / 运行历史 UI (查 mongo state + redis state 统一抽象)

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

- `allowedHooks` 里 `saas.*` 和 `runner.*` 都可以列,白名单语义统一
- 想推送 hidden notification 必加 `saas.app.conversation.sendMsg` 白名单
- 推送身份固定 `senderPrincipalId: 'ai-notify'` + `messageType: 'notification'` (UI 不渲染, agent 可见)
- 群聊场景必传 `mentions: [agentPrincipalId]` 显式 mention,否则 agent 不会被调度
- `prevState` 首次执行 / mongo 没记录 / redis TTL 过期都是 `undefined`,胶水代码必须容忍
- `return undefined` → state 不更新,保留上次 (但 lastFiredAt / lastError 等元数据仍写)
