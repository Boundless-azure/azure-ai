# Tip 模块目录结构（方案A）

该目录采用按职责分层的结构，提升可维护性与可扩展性。

## 结构说明

- `tip.module.ts`
  - Nest 模块声明，汇总控制器与服务，导出 `TipService` 与 `TipGeneratorService` 给其他模块使用。

- `controllers/`
  - `tip.controller.ts`：REST 控制器，提供 Tip 的检索、诊断、生成接口。

- `services/`
  - `tip.service.ts`：核心服务，负责 .tip 文件的扫描、解析与诊断，以及 AST 索引构建。
  - `tip.generator.ts`：生成器服务，结合 AST 与 AI 生成各模块的 `module.tip` 文件。

- `types/`
  - `index.ts`：Tip 相关类型定义（`TipModuleOptions`、`TipGenerateOptions` 等）。
  - `tokens.ts`：注入令牌常量（`TIP_OPTIONS`）。

- `index.ts`
  - 目录出口文件（barrel），统一导出上述符号，建议外部仅从 `src/core/tip` 路径引用。

## 引用约定

- 外部模块统一从 `src/core/tip` 引用，例如：
  ```ts
  import { TipModule, TipService, TipGeneratorService } from 'src/core/tip';
  ```
  这样可降低对子目录的耦合，后续重构仅需维护本目录的 `index.ts`。

## 测试与构建

- 重构后需运行 `npm run build` 与相关测试（`npm run test`/`npm run test:e2e`）确保编译与用例均正常。