## 1. Core-internal modules

- [x] 1.1 Move `agent-observation.ts`, `update-planner.ts`, `agent-execution.ts`, and `uninstall-postcondition.ts` to `src/core/lifecycle/` and fix relative imports (agents, providers, state, model leaf, utils, siblings)
- [x] 1.2 Point the remaining `src/lifecycle` barrel at the Core-internal modules
- [x] 1.3 Delete the old `src/lifecycle/` copies of those four files (no compatibility shims)
- [x] 1.4 Do not add `src/core/lifecycle/index.ts`

## 2. Importer retarget

- [x] 2.1 Update Core production-observation, update-production, update-executor, execution-executor, and uninstall-executor imports to `./lifecycle/{agent-observation,update-planner,agent-execution,uninstall-postcondition}`
- [x] 2.2 Update `src/planning/updates.ts` and lifecycle services that imported those engines
- [x] 2.3 Update tests that imported `src/lifecycle/agent-observation`, `update-planner`, `agent-execution`, or `uninstall-postcondition`

## 3. Ownership lock and memory

- [x] 3.1 Update `test/core/lifecycle-core-ownership.test.ts` for the L3 graph (Core-internal modules present, old paths absent, state leaf-only, barrel still outside, SDK non-export)
- [x] 3.2 Update `test/architecture/core-boundary.test.ts` so `agent-observation` is no longer an allowed outside-Core eager dependency
- [x] 3.3 Add ADR 0013 recording Core-internal non-leaf engines vs the model leaf, and that L4 still owns barrel deletion
- [x] 3.4 Extend the thin AGENTS.md lifecycle pointer to include ADR 0013

## 4. Validation and delivery

- [ ] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [ ] 4.2 Run `bun run test`
- [ ] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 4.4 Commit, push, and open a **draft** PR with before/after import map, SDK non-export checklist, freeze checklist, and internal changelog framing
