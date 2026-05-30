# Hook Component Runtime — `ctx` 能力注入 + 快照缓存 设计文档

> status :: draft · 决策已收敛, 待落地
> scope :: `web/src/modules/agent/components/chat/*` · `src/app/conversation/*` · `src/core/hookbus/*`
> 关联 :: [HookComponent 装饰器](decorators/hook-component.decorator.ts) · [hook-invoke 端点](controllers/hook-invoke.controller.ts) · [HookBus 队列](services/hook.bus.service.ts) · [CLAUDE.md `# core [1/7][6/7][7/7]`](../../../CLAUDE.md)

---

## 1. 背景与问题

当前 Web Component Hook 组件(`@HookComponent` 声明的 JS,经 [GET /hook-component](../../app/runner/controllers/hook-component.controller.ts) 下发,由 [HookComponentRenderer](../../../web/src/modules/agent/components/chat/HookComponentRenderer.vue) 挂进 Shadow DOM)存在四个问题:

1. **自己拼 API URL** — 组件内 `fetch('/api/todo?...')` 硬编码 REST 路径;hook 是 `<platform>.<app>.<module>.<action>` 4 段、按插件/平台/应用/solution 分,前缀不固定,组件不该感知。
2. **直接读 token** — 组件 `localStorage.getItem('token')` 拿用户 JWT,鉴权裸露。
3. **无隔离接缝** — 组件能力等于整个 `window`,将来要沙箱化无从下手。
4. **无可追溯** — 每次渲染都实时拉;回看历史消息里的组件显示最新数据而非生成当时的数据,对话记录不可复现、不可审计。

## 2. 目标 / 非目标

**目标**
- 给组件注入统一 `ctx` 能力对象,组件不碰 URL / token / 全局事件。
- 快照缓存:按**消息**锚定冻结数据,实现可追溯 + 避免重复拉取。
- `ctx` 接口"可序列化 + 全异步",作为未来 iframe 沙箱的前置接缝。

**非目标(明确划清)**
- **本设计不做 JS 隔离。** 注入 `ctx` 不是沙箱:组件仍在主页面同 realm,仍能摸 `window`/`localStorage`。它解决人体工学 + 缓存 + 可追溯 + 接缝,**不是安全**。不可信组件的真正隔离仍需 iframe + postMessage(后续阶段,§10)。

## 3. 两条数据通道 + 两级信任(核心决策)

| 通道 | 路径 | 落库方 | 信任级别 |
|------|------|--------|----------|
| **callHook** | `ctx.callHook` → [POST /hook-invoke](controllers/hook-invoke.controller.ts) → [HookBus 队列](services/hook.bus.service.ts) 路由到 SaaS/Runner | **服务端权威落库**(服务端取到什么就存什么) | **审计级**, 防篡改 |
| **http** | 组件客户端**直连** fetch(不经系统转发) + `ctx.report` 主动上报 | **前端上报**(组件决定存什么) | **便利级**, 与客户端同信任 |

> **为何 http 不走系统转发**:让 SaaS 代理并持久化每个组件的任意外部请求,资源开销大。http 数据量大/频繁,客户端直连更合理。代价是这部分快照由前端上报、不防篡改——**这是有意识的取舍**:快照作用域仅限单条 messageId,且由组件作者决定上报内容,可接受。
> **缓存/实时标记与信任正交**:右上角 badge(§6)表达的是"新鲜度"(冻结 vs 实时),不表达"可信度"。审计级 vs 便利级是通道属性,不在 badge 里体现。

## 4. `ctx` 契约

```
render(container: ShadowRoot, payload: unknown, ctx: HookComponentCtx): void | { unmount(): void }

interface HookComponentCtx {
  // —— callHook 通道:服务端路由 + 权威落库,支持单条/批量 ——
  // 单条
  callHook(hookName: string, payload?: unknown, opts?: { live?: boolean }): Promise<unknown>;
  // 批量(数组形参,沿用 call_hook 既有约定:结果按 hookName 对齐回带)
  callHook(calls: Array<{ hookName: string; payload?: unknown }>, opts?: { live?: boolean }):
    Promise<Array<{ hookName: string; ok: boolean; data?: unknown; errorMsg?: string }>>;

  // —— http 通道:客户端直连 + 前端上报,组件自管 ——
  // 写一次 cache-aside:命中返回冻结值;未命中→fetcher() 取数 + 写快照(首写为准)。live 时每次拉不缓存。
  cachedFetch(key: string, fetcher: () => Promise<unknown>, opts?: { live?: boolean }): Promise<unknown>;
  // 显式上报一个客户端算得的快照值(http 通道写路径);写一次,同 key 不覆盖
  report(key: string, value: unknown): void;

  // —— 通用 ——
  navigate(tab: string, label?: string, props?: Record<string, unknown>): void; // 取代 window.dispatchEvent
  refresh(): Promise<void>;            // 显式重拉并刷新当前视图
  readonly messageId: string;
  readonly sessionId: string;
}
```

**前向兼容硬约束**:所有方法全异步、参数与返回值 `structuredClone` 可序列化。满足后,未来把组件搬进 iframe 时把 `ctx` 改成 postMessage 转发即可,组件代码零改动。

## 5. callHook 链路 + 批量 + 队列

- 前端工具类把 `ctx.callHook` 转成 `POST /hook-invoke`(或其批量变体),Authorization 由工具类统一附加(token 不经组件)。
- **批量沿用既有范式**:[call_hook 工具的 `calls` 数组 + `Promise.all` 分发 + 结果按 hookName 回带](../agent-runtime/tools/call-hook.tools.ts#L490-L499)("不再单独声明 batch 工具",见 [call-hook.tools.ts:55](../agent-runtime/tools/call-hook.tools.ts#L55))。前端工具类照抄。
- **两层队列**:
  1. 前端把同一 microtask 内的多个 miss **合批**成一次请求(减 HTTP 往返)。
  2. 服务端把这批塞 [HookBus 并发受限队列](services/hook.bus.service.ts#L151)(`while activeWorkers < concurrency`)执行。
- 鉴权:`/hook-invoke` 经全局 `JwtAuthGuard + AbilityGuard`;hook 侧 `@CheckAbility` 兜底(CLAUDE.md `# core [1/7]`)。
- 路由:`HookBus.emit` 按名分发 SaaS handler 或在线 Runner,组件无感。

## 6. 快照模型(可追溯)

**锚定级别 :: 按消息。** 存 `message.metadata.hookSnapshots`(`MessageMetadata` 已是开放 `[key:string]:any`,见 [conversation.types.ts:21](../../app/conversation/types/conversation.types.ts#L21)),不新增表/列。

**快照 key :: `${hookName或'http'}#${canonical(payload/key)}`**,`canonical` = 规范化序列化(键排序、剔除 undefined),否则 `{a,b}` 与 `{b,a}` 会算成两键。

**缓存规则 :: 写一次的 cache-aside(无 sealed / 无终结事件)。**
- `live:true`(组件声明或单次 `opts.live`)→ 每次实时拉,**不读不写缓存** → badge 标 **实时**。
- 否则 cache-aside:
  - **hit** → 返回冻结快照 → badge 标 **缓存**。
  - **miss** → 拉取(此刻实时)+ **写快照** → 返回,此后冻结,**下次不再请求**。
- **不区分"生成轮"与"回看"**:谁第一个请求到某 `(messageId, hookName, payload)`,就在那一刻冻结。回看时首次触达的分页页同理 —— 其快照时间戳即首触时刻(非消息创建时刻),带 traceId,透明可查。
- **写一次(不覆盖)**:同 key 首写为准,`ctx.report` 亦然;改写只能经 `ctx.refresh()`。历史稳定性由"不覆盖"保证 —— 这取代了 sealed 标记的作用。

**冻结策略 :: 默认冻结(cache-aside)+ live 是唯一实时逃逸阀。** `@HookComponent` meta 新增 `live?: boolean`(如"当前 Runner 状态"组件)。

**失效 :: 不失效**(冻结即终态)。新数据走新消息 / `ctx.refresh()`。无 invalidation 逻辑。

**可追溯 tie-in ::** callHook 快照体保存原始调用 `traceId`(对齐 CLAUDE.md `# core [7/7]` OTel),可从冻结视图反查 trace。

**缓存/实时 badge ::** 渲染器统一在组件右上角渲染角标 —— `live` 型标 **实时**,cache-aside 标 **缓存**(可附快照时间戳)。表新鲜度,与 §3 信任级别正交;组件无需自管。

## 7. 存储(SaaS 侧)

- **位置**:SaaS 侧,落 `message.metadata.hookSnapshots`。
- **淘汰**:**不淘汰,持续存**(量不大)。
- **超阈值**:单条快照序列化超阈值(建议 ~8KB)→ **拒绝快照**,该 key 回退实时拉(badge 标实时)。不做大 blob 的 spill/侧表——避免复杂度,也回应"分页大不了不让存"。
- **勿复用** [ai-session-data](../../app/conversation/services/ai-session-data.service.ts#L16):那是 handbook/directive 语义(10KB/200KB/50 硬限),与快照无关。

## 8. 模块归属

- **conversation 模块**:拥有快照/缓存层。新建"带快照"的 hook 调用入口,内部调 HookBus,读写 `message.metadata`。hookbus 保持纯路由,不认识"消息"。
- **hookbus 模块**:`/hook-invoke` + `HookBus` 保持纯路由,不改。
- **web/agent 模块**:`ctx` 工具类 + 改 `render` 三参 + badge + markdown env 透传 messageId。

## 9. 组件迁移

- `todo` / `storage` 等:删 `fetch('/api/...')` + `localStorage.getItem('token')`;数据走 `await ctx.callHook(...)`;外部 http 走 `ctx.cachedFetch(key, () => fetch(...))`;删 `window.dispatchEvent('hookComponent:navigate')` → `ctx.navigate(...)`。
- [renderMarkdown](../../../web/src/modules/agent/components/chat/ChatMessageList.vue#L777):改 `renderMarkdown(content, messageId)` → `md.render(content, { messageId })` → [fence renderer](../../../web/src/modules/agent/components/chat/ChatMessageList.vue#L558) 从 `env` 写 `data-message-id` 到 slot。⚠️ [markdownCache](../../../web/src/modules/agent/components/chat/ChatMessageList.vue#L777-L781) 的 key 必须带 messageId,否则同内容消息复用错的 id。
- [mountHookComponents](../../../web/src/modules/agent/components/chat/ChatMessageList.vue#L719):读 `slot.dataset.messageId`,连同 `actionHook`/`payload` 传入构造 `ctx`。
- [HookComponentRenderer.fetchAndMount](../../../web/src/modules/agent/components/chat/HookComponentRenderer.vue#L123):构造 `ctx`,作为第三参传入 `render`;`onNavigate` 改消费 `ctx.navigate`。
- [HookComponent 装饰器](decorators/hook-component.decorator.ts):JSDoc + `HookComponentMeta` 新增 `live?: boolean`。
- 同步回写各 `module.md`(R8)。

## 10. 与未来 JS 沙箱的关系

本设计是 iframe 沙箱的**前置接缝**而非替代:组件能力收口成 `ctx` 后,沙箱化 = iframe 内把 `ctx` 换成 postMessage 转发,父页代理调用并注入鉴权,组件代码不动。token 已先行退出组件可达范围。iframe 同时自带 CSS 隔离,届时 Shadow DOM 在该路径下二选一。

## 11. 待定 / 风险

- **写一次的并发**:同 key 并发首写(同一消息同一 hook 被并发触达)需服务端原子化"不存在才写",避免双写。
- **canonical 序列化**:键序、默认值、`live` 调用是否参与 key(建议 live 不写快照故不参与)。
- **messageId 首渲可得性**:已确认可经 markdown env 透传(§9);需验证流式渲染中 fence 首渲时该消息 id 已就绪。
- **多 handler hook**:`/hook-invoke` 取 `results[0]`,组件场景是否够用。
- **badge 交互**:实时(live)态是否提供"冻结此刻"按钮 → 等价于一次 `report` 写一次(可选增强)。

## 12. 落地阶段

1. 前端 `ctx` 工具类 + 改 `render` 三参 + markdown env 透传 messageId(打通 callHook/navigate,token 收口,无快照)。
2. conversation 快照入口:`message.metadata` 读写(写一次/不覆盖,原子化)+ 默认冻结 + `live` + `refresh` + 缓存/实时 badge。
3. callHook 批量(数组形参)+ 前端合批 + 复用 HookBus 队列。
4. http 通道:`ctx.cachedFetch` + `ctx.report`(前端上报,写一次不覆盖)+ 超阈值拒存。
5. 迁移 todo/storage 等组件,回写 module.md。
6. (后续阶段)iframe 沙箱:`ctx` 换 postMessage,面向不可信组件。
