### Task 2: Complete deterministic planning over observation states (OpenSpec 5.2)

**Files:**
- Modify: `src/lifecycle/mutation-planner.ts`
- Modify: `src/lifecycle/model.ts`
- Modify: `test/lifecycle/mutation-planner.test.ts`
- Create: `test/lifecycle/observation-planning.test.ts`

**Interfaces:**
- Consumes: `LifecycleObservation`, requested `LifecycleIntent`, exact provider binding, and registry-derived capabilities.
- Produces: deterministic `LifecycleMutationPlanningResult` with decisions for satisfied, install, adopt, preserve-unmanaged, clear-ghost, uninstall, unsupported, and blocked.

- [ ] **Step 1: Add failing planner matrix tests**

  Use one row for every required state: already-satisfied, absent, tracked, untracked, ghost, conflicting, unsupported, and indeterminate. Repeat each row to prove stable plan ids, step ordering, effects, and postconditions.

- [ ] **Step 2: Verify unsupported and contradictory rows fail**

  Run: `bun run test -- test/lifecycle/mutation-planner.test.ts test/lifecycle/observation-planning.test.ts`

  Expected: FAIL until capability-aware decisions exist.

- [ ] **Step 3: Extend the pure planner only**

  Add no filesystem, process, provider, console, output-envelope, or Commander imports. An absent required provider capability returns `unsupported`; conflicting/indeterminate observations return `blocked`; read-only callers may consume the plan without executing it.

- [ ] **Step 4: Run focused tests and checkpoint**

  Run:

  ```bash
  bun run test -- test/lifecycle/mutation-planner.test.ts test/lifecycle/observation-planning.test.ts test/lifecycle/shadow-planning.test.ts test/commands/ensure.test.ts test/commands/install.test.ts test/commands/uninstall.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `refactor(lifecycle): plan from live observations`
