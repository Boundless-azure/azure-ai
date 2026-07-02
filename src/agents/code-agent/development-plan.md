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
- [x] Each dependency-check step appends logs: start, hook-caller/AI-adapter preparation, hook probing, solution listing, LLM route decision, pause, complete, and fail.
- [x] If the node pauses for `waitChoose` / `waitChooseAction`, LangGraph `interrupt` persists the checkpoint and the resumed node continues the same `code_graph_log`.
- [x] The dependency-check node verifies that the Runner exposes `runner.app.solution.list` through `runner.system.hookbus.getInfo`.
- [x] The dependency-check node reads all Runner solutions through `runner.app.solution.list` and normalizes `id`, `runnerId`, `solutionId`, `name`, `summary`, `includes`, and initialization state.
- [x] The graph runtime context keeps `routePlan` as the route source of truth; `chooseSolution` / `chooseAction` are compatibility fields derived from the first resolved route.
- [x] If `context.solution_id` / `context.solutionId` / `context.solutionName` / `context.chooseSolution` matches a Runner solution and its `includes` fits the selected action, dependency-check uses it directly before asking the LLM.
- [x] Otherwise, the logic model receives the complete requirement plus Runner solution summaries and must return JSON with `waitChoose`, `useSolution`, `waitChooseAction`, `useAction`, `useActions`, `routePlan`, and optional `requiresNewSolution/newSolutionOption/newSolutionReason`.
- [x] Even when only one Runner solution exists, dependency-check no longer deterministically reuses it after an invalid LLM response; fallback pauses for explicit reuse confirmation and includes a `newSolutionOption`.
- [x] When the node can choose solution/action routes, it fills `routePlan` first and derives compatibility `chooseSolution` / `chooseAction` / `chooseActions`; concrete app/unit/data-point dependency analysis is deferred to the next node.
- [x] When the node cannot choose, it calls LangGraph `interrupt(payload)`; the background graph sender reads the state snapshot, sends `saas.app.conversation.codeAgentDependencyChoice` through `saas.app.conversation.sendMsg`, and persists `waiting_for_selection` with candidates plus `threadId/checkpointId/interruptId`.
- [x] The dependency choice card submits to `saas.app.conversation.codeAgentChoiceSubmit`, which writes `chat_sessions.metadata.codeAgent.dependencyChoice`, syncs the agent principal's `currentSession`, and schedules the same LangGraph thread resume with `Command({ resume })`.
- [x] No separate pseudo-checkpoint layer is maintained in session metadata; checkpoint ownership stays in LangGraph/`lg_checkpoints`.

## Next Code Graph Steps

- [x] Define the frontend selection card payload for `waitChoose` and `waitChooseAction`.
- [x] Add session metadata persistence for selected `routePlan`, deriving compatibility `chooseSolution` / `chooseAction` while keeping checkpoint ids in the card payload and LangGraph tables.
- [x] Resume dependency-check from the LangGraph checkpoint after the user submits the selection.
- [x] Add the second dependency node (target-resolution) that analyzes the selected solution's app/unit list and decides concrete reuse/create per target.
- [x] Add the third node (target-bootstrap) that ensures initial Solution/App metadata for create decisions.

## Change-Plan Node (file processing analysis, create-only)

- [x] Runner provides a dedicated `code-agent-plan` module: `runner.app.codeAgentPlan.{ensurePlan,upsertTasks,searchTasks,upsertTodos,listTodos,getSnapshot}`. A `RunnerCodeAgentPlanService` owns three Mongo collections (`code_agent_plans` / `code_agent_change_tasks` / `code_agent_plan_todos`) via the raw `Db` — the legitimate business path around the `denyLlm` mongo write hooks. All ops are planId-scoped; requiredAbility reuses the `solution` subject.
- [x] The change plan lives in the assigned Runner's Mongo (per-tenant physical isolation), never in SaaS process memory; it supports partial upsert + local search so a large plan is only read back as slices.
- [x] `change-plan` node runs after `target-bootstrap` (CREATE-ONLY: every change is `op:'create'`; modify/delete deferred; module.md outline reading dropped here).
- [x] A code-driven todo state machine drives the loop: seed one `plan-target` todo per target, then each turn feed the LLM the open todos + relevant task slices + existing hooks found, take one strict-JSON action turn (tasks / todoUpdates / todoAdds / searchRequests / notice), persist via the store, fulfill scoped existing-hook searches, run deterministic edge validation, repeat until no open todos or `maxIterations`.
- [x] Completion is decided ONLY by the todo table (`getSnapshot.openTodos`), not by the LLM claiming done. The LLM may only close `plan-target` todos; `resolve-edge` todo status is code-authoritative.
- [x] One LLM session plans the whole routePlan (cross-solution) into an action tree: each new hook inlines `calls` / `compatibleWith` out-edges; code derives `edges` and classifies them new / existing / unresolved.
- [x] Self-correction: unresolved edges become `resolve-edge` todos (re-opened if the LLM wrongly closed them, closed by code once resolved), forcing the model to add a defining task, search an existing hook, or drop the edge. `new→existing` edges resolve via `searchSolutionHooks` scoped to the routePlan solutions' apps/units; existing hooks cannot change (create-only) so the new side adapts.
- [x] The node never blocks the pipeline: hitting the iteration cap with open todos still returns `ready` (warn + `reason` + `openTodos` in the result envelope).
- [x] Action-aware planning: `app` / `data-point` targets plan FILES ONLY (no hooks/edges — a page has no hooks); only `unit` targets build the hook-contract action tree. Paths are full solution/app-relative (code joins the target basePath under a scope fence). Persisted run artifact is slimmed (node log deduped, requirement not duplicated in input).
- [x] Knowledge-driven planning (先选书): a local "前端开发手册" book (`local_frontend_dev_handbook`) defines project archetypes (one per chapter; default Astro) and cross-archetype rules (minimal module chunking, separated resource dirs, separated page JS/CSS). change-plan first selects books by routePlan (LLM pick via `saas.app.knowledge.search`, load via `getChapter`) and feeds the manual into every generation turn; selected `bookIds` recorded on the result. SaaS HookBus threaded into the node.
- [ ] Verify end-to-end on a mounted runner (LLM tool-loop turn behavior, Mongo store round-trips, edge convergence, manual-driven multi-file output) — needs the live system.
- [ ] Next: consume `changeTasks` in real create/generate/integrate nodes after change-plan.
