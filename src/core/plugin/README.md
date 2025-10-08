# Plugin 模块目录结构（方案A）

该目录采用按职责分层的结构，提升可维护性与可扩展性。

## 结构说明

- `plugin.module.ts`
  - Nest 模块声明，汇总控制器与服务，导出 `PluginService` 给其他模块使用。

- `controllers/`
  - `plugin.controller.ts`：REST 控制器，提供插件的查询、注册、更新、删除接口。

- `services/`
  - `plugin.service.ts`：核心业务服务，负责插件的增删改查、通过目录注册与配置加载。
  - `plugin.keywords.service.ts`：关键词生成服务，调用 AI 模型生成中英文关键词并做容错解析。

- `entities/`
  - `plugin.entity.ts`：TypeORM 实体定义（表名 `plugins`，唯一约束 `name + version`）。

- `types/`
  - `index.ts`：插件相关类型定义（`PluginConfig`、`HookDescriptor` 等）。

- `index.ts`
  - 目录出口文件（barrel），统一导出上述符号，建议外部仅从 `src/core/plugin` 路径引用。

## 引用约定

- 外部模块统一从 `src/core/plugin` 引用，例如：
  ```ts
  import { PluginModule, PluginService, PluginEntity } from 'src/core/plugin';
  ```
  这样可降低对子目录的耦合，后续重构仅需维护本目录的 `index.ts`。

## 可选扩展（按需引入）

- `dto/`
  - `plugin-register.dto.ts`、`plugin-update.dto.ts`：用于控制器的请求体验证（`class-validator`），提升入参规范性。

- `utils/`
  - `config-loader.ts`：将 `plugin.service.ts` 中的 `loadConfig` 抽出为工具函数，进一步强化单一职责与可测试性。

## 测试与构建

- 重构后需运行 `npm run build` 与相关测试（`npm run test`/`npm run test:e2e`）确保编译与用例均正常。