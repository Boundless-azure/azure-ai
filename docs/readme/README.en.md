# Project Overview (Multilingual README · English)

Language switch: [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [中文](/docs/readme/README.zh-CN.md)

This repository provides a pragmatic AI conversation and function-call platform. The focus is on clear semantics, easy extension, and controllability. We aim to ship useful capabilities first, in a way that’s straightforward to use and adapt.

## What’s implemented

- Conversation with non-streaming and streaming responses
  - Non-streaming: `ConversationService.chat()`
  - Streaming (SSE-like): `ConversationService.chatStream()`

- Native function-call integration via service-provided handles
  - Descriptions live under `core/function-call/descriptions`; each service exposes `getHandle()` with `description/validate/execute`.
  - The conversation layer injects `toolDescriptions` into the model request based on which services are enabled.

- Function-call services
  - `PluginOrchestratorService` → function: `plugin_orchestrate`
    - Entry point for “plan first, generate later” plugin orchestration.
    - The model only provides `input`; the system enriches `phase/modelId/temperature` automatically.
  - `MysqlReadonlyService` → function: `db_mysql_select`
    - Read-only queries. Validation rules: `params` must be an array of primitive values (string/number/boolean/null) and `limit` is required. Output is normalized to `Record<string, unknown>[]`.
  - `ContextFunctionService` → function: `context_window_keyword`
    - Alias supported: `context_keyword_window`.

- Service-based function registration switch (preferred)
  - Configure at `src/app/conversation/conversation.module.ts`.
  - Example: enable only MySQL read-only querying

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

- Execution flow in the conversation layer
  - Resolve the function by name (with alias fallback), run `validate`, then `execute`.
  - Special case for `plugin_orchestrate`: the system enriches `phase/modelId/temperature` so the model only needs to provide `input`.

- Helpful code and docs
  - Module tips: `src/core/function-call/module.tip`
  - Function-call module: `src/core/function-call/function-call.module.ts`
  - Function descriptions: `src/core/function-call/descriptions/`
  - Conversation service: `src/app/conversation/services/conversation.service.ts`
  - Conversation module: `src/app/conversation/conversation.module.ts`
  - AI module options (with `includeFunctionServices`): `src/core/ai/types/module.types.ts`

## Roadmap / What’s next

- Direct database statement execution (write operations)
  - A secure SQL execution entrypoint with whitelisting, placeholder checks, and sensitive operation isolation.
  - Integrated with permission management for tenant/role-based controls and audit trails.

- Database security and permission management
  - Fine-grained access control at schema/table/column level.
  - Auditing and risk control with alerting and rollback strategies.

- Intelligent plugin generation
  - Strengthen `plugin_orchestrate` to cover plan → code generation → testing → publish.
  - Use prompt Tip mechanisms to produce business-semantic plugin scaffolds and configurations.

- Generate pages from existing tables
  - Auto-generate CRUD screens with routing and permission bindings.
  - Integrate with HookBus/plugins (e.g., `plugins/customer-analytics`) for easier extension.

## Quick start

1) Install and build

```bash
npm install
npm run build
```

2) Configure enabled function services (`includeFunctionServices` as shown above)

3) Start the dev server (if applicable)

```bash
npm run start:dev
```

> Tip: For local DB development, check `docker/mysql/init` and `.env` configs. Prefer `MysqlReadonlyService` during initial integration; enable write operations only after permission and auditing are in place.