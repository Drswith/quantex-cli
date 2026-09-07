## 1. Caller retarget

- [x] 1.1 Point `src/services/lifecycle-execution-production.ts` at `src/core/lifecycle/model` for `LifecycleOutcome`
- [x] 1.2 Point `src/idempotency/lifecycle-policy.ts` at Core-internal model, provider-binding, and provider-evidence modules
- [x] 1.3 Retarget related tests that imported `src/lifecycle` onto the matching Core-internal modules

## 2. Delete leftover barrel

- [x] 2.1 Delete `src/lifecycle/` (barrel `index.ts` and directory; no compatibility shim)
- [x] 2.2 Do not add `src/core/lifecycle/index.ts`

## 3. Ownership lock and memory

- [x] 3.1 Update `test/core/lifecycle-core-ownership.test.ts` for the L4 graph (`src/lifecycle/` absent, named callers retargeted, state leaf-only, SDK non-export, no Core lifecycle barrel)
- [x] 3.2 Add ADR 0014 recording barrel deletion and the prohibition on restoring `src/lifecycle/` or adding `src/core/lifecycle/index.ts`
- [x] 3.3 Extend the thin AGENTS.md lifecycle pointer to ADR 0014 and drop `src/lifecycle/`

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [ ] 4.2 Run `bun run test`
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 4.4 Commit, push, and open a **draft** PR with delete list, ownership locks, SDK non-export checklist, freeze checklist, and internal changelog framing
