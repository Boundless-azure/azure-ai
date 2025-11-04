# 项目概览（中文）

语言版本：[
English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [中文](/docs/readme/README.zh-CN.md)

这是一个面向业务落地的 AI 对话与函数调用平台，强调“语义化、易扩展、可控”。我们优先把有用的能力稳定地交到你手上，并且让使用方式清晰易懂。

—— 不写“官方白皮书语气”，只讲现在能做什么、怎么用、以及下一步要做什么。

## 已实现（What works now）

- 对话与流式响应
  - 非流式：`ConversationService.chat()`
  - 流式：`ConversationService.chatStream()`（SSE 风格）

- 原生 function-call 集成（由服务提供句柄）
  - 函数描述来自 `src/core/function-call/descriptions/`；各服务通过 `getHandle()` 暴露 `description/validate/execute`。
  - 对话层基于启用的服务自动注入 `toolDescriptions` 到模型请求（模型原生 function-call）。

- 函数服务（Function-Call Services）
  - `PluginOrchestratorService` → 函数：`plugin_orchestrate`
    - 用于“先规划（plan）后生成（generate）”的插件生成入口。
    - 模型只需给 `input`；系统会补齐 `phase/modelId/temperature`。
  - `MysqlReadonlyService` → 函数：`db_mysql_select`
    - 只读查询，参数校验：`params` 必须是原始值（string/number/boolean/null）数组，必须带 `limit`，返回统一为 `Record<string, unknown>[]`。
  - `ContextFunctionService` → 函数：`context_window_keyword`
    - 兼容别名：`context_keyword_window`（沿用同一校验与执行器）。

- 按“服务类”开关注册函数（优先于旧的按名称开关）
  - 配置位置：`src/app/conversation/conversation.module.ts`
  - 示例：只启用 MySQL 只读查询

  ```ts
  import { AICoreModule } from '@core/ai';
  import { MysqlReadonlyService } from '@core/function-call';

  @Module({
    imports: [
      AICoreModule.forRoot({
        includeFunctionServices: [MysqlReadonlyService],
      }),
    ],
  })
  export class ConversationModule {}
  ```

- 对话层执行逻辑（`ConversationService`）
  - 解析函数调用：按名称找到对应句柄（兼容别名），执行 `validate` 后调用 `execute`。
  - 特殊处理 `plugin_orchestrate`：在传参时系统补齐 `phase/modelId/temperature`，仅要求模型提供 `input`。

- 相关文档与代码入口
  - 功能模块结构与说明：`src/core/function-call/module.tip`
  - 函数模块：`src/core/function-call/function-call.module.ts`
  - 函数描述目录：`src/core/function-call/descriptions/`
  - 对话服务：`src/app/conversation/services/conversation.service.ts`
  - 对话模块：`src/app/conversation/conversation.module.ts`
  - 模块配置类型（含 `includeFunctionServices`）：`src/core/ai/types/module.types.ts`

## 下一步（Roadmap / 近期计划）

- 数据库语句直接执行（非只读）
  - 提供安全的 SQL 执行入口（白名单、占位符数量校验、敏感操作隔离）。
  - 与权限管理打通，确保不同角色/租户的隔离与审计。

- 数据库安全与权限管理
  - 细粒度权限策略：库/表/列级别访问控制。
  - 行为审计与风控：记录关键操作，支持告警与回滚策略。

- 智能生成插件
  - 强化 `plugin_orchestrate`：计划→代码生成→测试→发布的闭环能力。
  - 结合现有 prompts 与 Tip 机制，生成更符合业务语义的插件骨架与配置。

- 根据现有表自动生成页面能力
  - 基于表结构生成 CRUD 页面，自动绑定路由与权限策略。
  - 与 HookBus/插件生态打通（如 `plugins/customer-analytics`），形成低成本扩展路径。

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

提示：数据库相关的本地开发，可参考 `docker/mysql/init` 与 `.env` 中的配置；建议在只读查询阶段使用 `MysqlReadonlyService`，并在启用写操作前完成权限与审计机制。
