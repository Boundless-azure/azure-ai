# Xiaolan (Project Overview · English)

 Language switch: [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [中文](/docs/readme/README.zh-CN.md) · [עברית](/docs/readme/README.he.md) · [ไทย](/docs/readme/README.th.md) · [Deutsch (Österreich)](/docs/readme/README.de-AT.md)

## Positioning & Goals

1. The project is called “Xiaolan”.
2. A next‑gen interaction entrypoint: replace the old click‑heavy web model with AI. Users manage UIs or data via natural language.
3. Self‑growth capability: AI generates code plugins that are fed back into the platform, forming a continuously growing capability loop.
4. Generation constraints + a transaction bus (HookBus): ensure AI outputs low‑dependency, low‑nesting, enterprise‑ready code that’s controlled and auditable.
5. A front‑end component execution spec for AI: AI can directly drive UI components in a predictable, traceable way.

## Current progress (What works now)

- Conversation and streaming
  - Non‑streaming: `ConversationService.chat()`
  - Streaming (SSE‑like): `ConversationService.chatStream()`

- Native function‑call via service handles
  - Descriptions under `src/core/function-call/descriptions/`; each service exports `getHandle()` with `description/validate/execute`.
  - The conversation layer injects `toolDescriptions` based on enabled services (native model function‑call).

- Available function‑call services
  - `PluginOrchestratorService` → function: `plugin_orchestrate`
    - “Plan first, generate later” entrypoint for plugin orchestration.
    - The model only provides `input`; the system enriches `phase/modelId/temperature`.
  - `MysqlReadonlyService` → function: `db_mysql_select`
    - Read‑only queries. Validation: `params` must be an array of primitive values (string/number/boolean/null) and `limit` is required. Output: `Record<string, unknown>[]`.
  - `ContextFunctionService` → function: `context_window_keyword`
    - Alias supported: `context_keyword_window`.

- Service‑based registration switch (recommended)
  - Configure at `src/app/conversation/conversation.module.ts`.
  - Example: enable only MySQL read‑only
    - `includeFunctionServices: [MysqlReadonlyService]`

- Execution flow (`ConversationService`)
  - Resolve by name (with alias), run `validate`, then `execute`.
  - Special case: `plugin_orchestrate` → system enriches parameters; model provides only `input`.

- Quality & collaboration
  - ESLint configured to ignore underscore‑prefixed unused vars; helpful in function‑call contexts.
  - Module tips: `src/core/function-call/module.tip`.

## Front‑end component AI execution spec (overview)

- Action naming: stable, replayable, e.g., `openModal` / `updateTable` / `navigate`.
- Parameter validation: typed, required fields defined; reject unaudited side‑effect params.
- Idempotency: repeated actions won’t diverge state; support transactional rollback.
- Timeout & retry: each execution has timeout, retry, and fallback.
- Security & audit: every run is logged with context snapshots.
- Transaction bus (HookBus): unify front/back actions on the bus to guarantee order & consistency.

## Roadmap / What’s next

- Direct DB statement execution (writes)
  - Secure SQL entrypoint: whitelisting, placeholder checks, sensitive operation isolation.
  - Permission integration: role/tenant controls with auditing.

- DB security & permission management
  - Fine‑grained controls at schema/table/column level.
  - Auditing & risk management with alerts and rollback.

- Intelligent plugin generation (strengthen self‑growth)
  - Plan → generate → test → publish loop.
  - Generation constraints: control dependency count, versions, licenses; avoid deep nesting.

- Generate pages from existing tables
  - Auto CRUD screens with routing & permissions.
  - Integrate with HookBus/plugins (e.g., `plugins/customer-analytics`).

## Quick start

1) Install & build

```bash
npm install
npm run build
```

2) Configure enabled services (`includeFunctionServices`)

3) Start dev server (if any)

```bash
npm run start:dev
```

Tip: For local DB dev, check `docker/mysql/init` and `.env`. Prefer `MysqlReadonlyService` initially; enable writes only after permissions and auditing are ready.