# 小蓝（项目概览 · 中文）

语言切换：[中文](/docs/readme/README.zh-CN.md) · [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [Deutsch (Österreich)](/docs/readme/README.de-AT.md) · [עברית](/docs/readme/README.he.md) · [ไทย](/docs/readme/README.th.md)

## 定位与目标

1. 项目叫「小蓝」。
2. 作为新一代交互入口，用 AI 替代旧时代的 Web 点击式操作，让用户通过自然语言直接进行界面交互或数据管理。
3. 具备“自增长能力”：由 AI 自动生成代码插件，回流并接入到本平台，形成持续增强的能力闭环。
4. 通过“生成限定 + 事务总线（HookBus）”机制，约束 AI 产出为低依赖、低嵌套的可企用代码，保证接入与上线可控。
5. 提供“前端组件 AI 执行规范”，让 AI 可以直接操控前端组件完成可预测、可审计的交互流程。

## 目前项目进展（What works now）

- 对话与流式响应
  - 非流式：`ConversationService.chat()`
  - 流式：`ConversationService.chatStream()`（SSE 风格）

- 原生 function-call 集成（由服务类提供句柄）
  - 函数描述位于 `src/core/function-call/descriptions/`；各服务通过 `getHandle()` 暴露 `description/validate/execute`。
  - 对话层基于启用的服务自动注入 `toolDescriptions` 到模型请求（模型原生 function-call）。

- 已提供的函数服务（Function-Call Services）
  - `PluginOrchestratorService` → 函数：`plugin_orchestrate`
    - 用于“先规划（plan）后生成（generate）”的插件生成入口。
    - 模型只需给 `input`；系统会补齐 `phase/modelId/temperature`。
  - `MysqlReadonlyService` → 函数：`db_mysql_select`
    - 只读查询，参数校验：`params` 必须是原始值（string/number/boolean/null）数组，必须带 `limit`；返回统一为 `Record<string, unknown>[]`。
  - `ContextFunctionService` → 函数：`context_window_keyword`
    - 兼容别名：`context_keyword_window`（沿用同一校验与执行器）。

- 按“服务类”开关注册函数（推荐）
  - 配置位置：`src/app/conversation/conversation.module.ts`
  - 示例：只启用 MySQL 只读查询
    - `includeFunctionServices: [MysqlReadonlyService]`

- 对话层执行逻辑（`ConversationService`）
  - 解析函数调用：按名称找到对应句柄（兼容别名），先 `validate` 后 `execute`。
  - 特殊处理 `plugin_orchestrate`：系统补齐 `phase/modelId/temperature`，模型只需提供 `input`。

- 质量与协作
  - ESLint 规则已支持“下划线前缀变量免提示未使用”，便于在函数调用上下文中标记保留变量。
  - 文档与结构说明补充：`src/core/function-call/module.tip`。

## 前端组件 AI 执行规范（概要）

- 组件动作命名：明确、稳定、可回放，例如 `openModal` / `updateTable` / `navigate`。
- 参数校验：定义各动作的参数类型与必填项，拒绝含有副作用的未审计参数。
- 幂等要求：同一动作多次执行不导致不一致状态，支持事务化回滚。
- 超时与重试：每次执行包含超时、重试与失败回退策略。
- 安全与审计：所有执行均产生日志与上下文快照，便于审计与追踪。
- 事务总线（HookBus）对接：前端与后端动作统一接入总线，保证事件顺序与一致性。

## 未来计划（Roadmap）

- 数据库语句直接执行（写操作）
  - 安全 SQL 入口：白名单、占位符数量校验、敏感操作隔离。
  - 与权限管理打通：角色/租户控制与审计留痕。

- 数据库安全与权限管理
  - 库/表/列级别细粒度访问控制。
  - 行为审计与风控：告警与回滚策略。

- 智能生成插件（自增长能力强化）
  - 完整闭环：计划 → 代码生成 → 测试 → 发布。
  - 生成限定策略：控制依赖数量、版本与许可，避免深度嵌套。

- 根据现有表自动生成页面能力
  - 自动生成 CRUD 页面，绑定路由与权限策略。
  - 与 HookBus/插件生态（如 `plugins/customer-analytics`）打通。

## 开始使用（Quick Start）

1. 安装依赖并编译

```bash
npm install
npm run build
```

2. 配置函数服务开关（如上 `includeFunctionServices` 示例）

3. 启动开发服务器（如有）

```bash
npm run start:dev
```

提示：数据库相关的本地开发，可参考 `docker/mysql/init` 与 `.env`；优先使用 `MysqlReadonlyService` 完成只读查询，在启用写操作前做好权限与审计。