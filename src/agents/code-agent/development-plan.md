# Code Agent Development Plan

## Solution Hook Readiness

- [x] SaaS provides `saas.app.solution.searchRunner` for searching solutions on one or more runner ids. It returns `id`, `runnerId`, `solutionId`, `name`, `version`, and `summary`.
- [x] SaaS `saas.app.solution.list` now accepts both `runnerId` and `runnerIds`, so existing list callers can search across multiple mounted runners.
- [x] SaaS provides `saas.app.solution.getBatch` for batch solution detail lookup by ids. Returned details include associated `apps` and `units`, and each item carries `runnerId` plus runner-side `solutionId`.
- [x] SaaS provides `saas.app.solution.listApps` for batch application listing by solution ids. Each app item carries `runnerId`, `solutionId`, `solutionName`, and `appId`.
- [x] SaaS provides `saas.app.solution.listUnits` for batch unit listing by solution ids. Each unit item carries `runnerId`, `solutionId`, `solutionName`, and `unitId`.
- [x] Runner provides `runner.app.solution.list`, `runner.app.solution.search`, and expanded `runner.app.solution.get` as the base solution retrieval layer.
- [x] Runner provides `runner.app.solution.listApps` and `runner.app.solution.listUnits`, so SaaS batch hooks can fan out over runner hooks instead of reading runner storage directly.

### Notes

- SaaS accepts the existing synthetic solution id form `<runnerId>::<name>@<version>` and runner-native `solutionId`.
- Runner app associations come from `runner_apps`.
- Runner unit associations are solution-local only and are discovered under `workspace/solutions/<solution>/unit` or `workspace/solutions/<solution>/units`; global `workspace/unit` is not treated as belonging to every solution.

## Code Graph Tool Shell

- [x] `code_gen_orchestrate` accepts `full_requirement` as the complete requirement payload.
- [x] `code_gen_orchestrate` accepts `runner_id` as the required Runner assignment and keeps legacy `runnerId` compatibility.
- [x] `code_gen_orchestrate` accepts `context.session_id` and falls back to injected `WorkflowContext.sessionId`.
- [x] Missing `runner_id` returns a string telling the caller to fetch/select a Runner and pass `runner_id`.
- [x] Present `runner_id` schedules the real LangGraph workflow in the background and immediately returns an accepted shell to the LLM.
- [x] `AgentRuntime` injects `TypeOrmCheckpointSaver` through `handleCheckpointer`, and `code_gen_orchestrate` compiles the graph with that checkpointer.
- [x] Code-agent graph thread ids are short (`code-agent:<hash>:<nonce>`) and stay within the checkpoint table `thread_id` limit.
- [x] The first node logs the full requirement through `CodeAgentHandle`.
- [x] Code-agent dialogue prompt is now demand-understanding only; execution limits and capability checks are left to graph nodes and hook results.
- [x] The dependency-check node carries a resumable `code_graph_log`, initialized from `context.code_graph_log` / `context.codeGraphLog` and returned both in context and as a top-level `log`.
- [x] Each dependency-check step appends logs: start, hook-caller/AI-adapter preparation, hook probing, solution listing, LLM decision, association listing, pause, complete, and fail.
- [x] If the node pauses for `waitChoose` / `waitChooseAction`, LangGraph `interrupt` persists the checkpoint and the resumed node continues the same `code_graph_log`.
- [x] The dependency-check node verifies that the Runner exposes `runner.app.solution.list`, `runner.app.solution.get`, `runner.app.solution.listApps`, and `runner.app.solution.listUnits` through `runner.system.hookbus.getInfo`.
- [x] The dependency-check node reads all Runner solutions through `runner.app.solution.list` and normalizes `id`, `runnerId`, `solutionId`, `name`, `summary`, `includes`, and initialization state.
- [x] The graph runtime context includes `chooseSolution`, defaulting to an empty string, and `chooseAction`, defaulting to an empty string.
- [x] If `context.solution_id` / `context.solutionId` / `context.solutionName` / `context.chooseSolution` matches a Runner solution and its `includes` fits the selected action, dependency-check uses it directly before asking the LLM.
- [x] Otherwise, the logic model receives the complete requirement plus Runner solution summaries and must return JSON with `waitChoose`, `useSolution`, `waitChooseAction`, `useAction`, and optional `requiresNewSolution/newSolutionOption/newSolutionReason`.
- [x] Even when only one Runner solution exists, dependency-check no longer deterministically reuses it after an invalid LLM response; fallback pauses for explicit reuse confirmation and includes a `newSolutionOption`.
- [x] When the node can choose both solution and action, it fills `chooseSolution` / `chooseAction` and fetches `runner.app.solution.listApps` or `runner.app.solution.listUnits` for the selected solution.
- [x] When the node cannot choose, it calls LangGraph `interrupt(payload)`; the background graph sender reads the state snapshot, sends `saas.app.conversation.codeAgentDependencyChoice` through `saas.app.conversation.sendMsg`, and persists `waiting_for_selection` with candidates plus `threadId/checkpointId/interruptId`.
- [x] The dependency choice card submits to `saas.app.conversation.codeAgentChoiceSubmit`, which writes `chat_sessions.metadata.codeAgent.dependencyChoice`, syncs the agent principal's `currentSession`, and schedules the same LangGraph thread resume with `Command({ resume })`.
- [x] No separate pseudo-checkpoint layer is maintained in session metadata; checkpoint ownership stays in LangGraph/`lg_checkpoints`.

## Next Code Graph Steps

- [x] Define the frontend selection card payload for `waitChoose` and `waitChooseAction`.
- [x] Add session metadata persistence for selected `chooseSolution` / `chooseAction` while keeping checkpoint ids in the card payload and LangGraph tables.
- [x] Resume dependency-check from the LangGraph checkpoint after the user submits the selection.
- [ ] Add the second dependency node that analyzes the selected solution's app/unit list and decides concrete downstream dependencies.
