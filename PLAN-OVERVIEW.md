# 小蓝 (Azure AI) 演进速览

> 2026-05-01 · 给人读的精简版 · 详细版 → [PLAN.md](PLAN.md)

```
 ╭──────────────────────────────────────────────────────────╮
 │  超级个体  ─►  说话  ─►  AI 产代码  ─►  跑在你的机器上  │
 │              ▲                              │           │
 │              └────  公网链接 (FRP) ◄────────┘           │
 ╰──────────────────────────────────────────────────────────╯
   对手: Replit Agents / Lovable / v0 / Bubble
   差异: AI 生成 + 租户本机执行 + 公网化 + 多端接入
```

---

## 设计哲学:**限制的艺术**

| 原则 | 一句话 |
|---|---|
| 限制 > 灵活 | 给 LLM 越多自由度它越乱;边界越清越聪明 |
| 单一通道 | LLM 只用 `terminal` 一个口子,复用它训练里的 git/shell 知识 |
| 物理闸门 | 命令白名单 / cwd 锁 / 网络隔离 — 这些才是边界,**prompt 是文化不是法律** |
| 硬限制不留逃生口 | session ↔ solution = 1:1,想跨 → 建新群,绝不在代码里给绕路 |
| Runner 主权 | 代码物理在租户机器,SaaS 不持权威副本(可选加密灾备) |

---

## 三层 Agent 架构

```
   ┌──── 群管 Agent ────┐    全局守门:跨 session/group/solution 视野
   │  无状态 + DB 一致 │    通过 HookBus 拦截器同步守门
   │  挂在 IM 系统通道 │    通过事件订阅异步广播 (system-notice)
   └──────────┬─────────┘
              │
   ┌──────────▼─────────┐    会话编排:per session
   │   Dialogue 层      │    需求梳理 / 起 graph / 路由消息
   │  (不感知群管)      │    调普通 hook,被拦截器拒就翻译给用户
   └──────────┬─────────┘
              │
   ┌──────────▼─────────┐    单次代码生成:per workflow
   │  Code-Agent Graph  │    线性 6 节点,无分叉
   │   LLM 玩 terminal  │    branchManagement → reqAnalysis →
   │    (含 git 操作)   │    hookDesign → codegen → qa → finalize
   └────────────────────┘
```

**关键不变量**:
- 一群 = 一 solution = 一 session(强约束,不留口)
- 一 solution = 一 git repo,锁住串行,workflow 完成才一次性 commit
- 节点之间 git stash 做 checkpoint,崩溃可恢复
- 私聊里聊到要改东西 → 引导建群,不允许在私聊起 graph

---

## 路线图

```
Phase 0  协议地基       OTel / 签名分发协议            ← 主体已完成
Phase 1  三层架构       群管 + Dialogue + Graph 简化   ← 当前重心 ★
Phase 2  代码生成闭环   节点内 LLM / AST / QA / 审批
Phase 3  对话与记忆     分块 + 向量 + 原文召回
Phase 4  产品差异化     LangGraph 编排 / 主动 AI / 语音
Phase 5  长期优化       高可用 / SSL / 真并发 (YAGNI)
```

---

## 当前重心:Phase 1 三层架构(3 周)

### Week 1 — 物理底座
- Terminal 安全闸门(命令白名单 / shell 越界检测 / env 隔离)`P0`
- 群管 agent 骨架 + 4 张 DB 表 + HookBus 拦截器
- `system-unit/git/` 落地,跟 `system-unit/terminal/` 同构

### Week 2 — 会话层
- Dialogue State 机(idle / gathering / tracking / relaying)
- 意图分类(轻量 LLM)+ 私聊建群转移路径
- 端到端联调:建群 → 关联 solution → 群管批准 → 起 graph mock

### Week 3 — 流程层
- Code-Agent Graph 线性 6 节点重构(节点内可暂用 mock LLM)
- branchManagement 节点用 terminal 真探索 solution
- git stash checkpoint + 崩溃恢复联调

### 完成的标志
- [ ] 建群自动触发 solution 关联
- [ ] 私聊讲到 codegen → 引导建群 + 上下文转移
- [ ] 同 solution 第二条 workflow → 拦截器拒
- [ ] graph interrupt → IM 自然语言反问 → resume 续跑
- [ ] 进程崩溃恢复 → 接着上次断点跑

---

## 核心已落地能力(不做了的)

| 模块 | 能力 |
|---|---|
| 部署 | Docker compose 一键起 SaaS / Runner,内置 Caddy + FRP |
| Runner 面板 | 5-Tab(Performance / Domain / AppDomain / App / Solution) |
| Knowledge | pgvector + LM 必读 + skill/lore 双书本类型 |
| Solution 市场 | CRUD / 安装 / 卸载 / 标签 |
| Storage | 目录树 + 分享链接 + MD5 跨租户去重 |
| HookBus | 装饰器注册 + zod 校验 + ability 检查 + 拦截器链 |
| WebMCP | 前端操作协议 + SDK + Demo |
| OTel | 双端 `event.log` + in-band SpanEvent + debug=false 零开销 |
| Terminal | cwd 锁定 + 池上限 + 超时 + buffer + 记录持久化 (b309b4e) |

---

## 真正的咽喉

**不在基础设施,在 AI 代码生成闭环 + 三层架构。**

- 基础设施其实很完整
- 缺的是"AI 把代码生成出来 → 真跑起来 → 跨会话不乱套"这条
- Phase 1 把架构对齐,Phase 2 把节点填满 → 闭环成立
- 自此用户说话即编码,产品差异化才能堆叠 (Phase 3-4)

---

## 风险 P0(Phase 1 必须解决)

| 风险 | 解 |
|---|---|
| 三层架构未建立 | Phase 1.1-1.5 |
| session ↔ solution 归属机制空 | Phase 1.1 |
| Solution 物理结构 / git 模型 | Phase 1.4 |
| Terminal 安全闸门未补齐 | Phase 1.4(物理底线) |
| 代码归属与版本协议(Runner 主权) | Phase 0.4(改造) |

---

详细规范、DB schema、节点伪码、改动位置、验收清单 → 见 [PLAN.md](PLAN.md)。
