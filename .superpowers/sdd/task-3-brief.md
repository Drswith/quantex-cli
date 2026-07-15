### Task 3: Deterministic `update --all` Composition

**Files:**
- Modify: `src/services/lifecycle-updates.ts`
- Modify: `src/commands/update.ts`
- Modify: `src/services/update.ts`
- Test: `test/services/lifecycle-updates.test.ts`
- Test: `test/commands/update.test.ts`

**Interfaces:**
- Consumes: the single-target planning/execution API from Task 2.
- Produces: `planRegisteredAgentUpdates(ports): Promise<LifecycleUpdateBatchPlan>` with targets sorted by canonical agent name and stable provider buckets.
- Produces: `executeLifecycleUpdateBatch(plan, ports): Promise<LifecycleUpdateBatchOutcome>` with ordered per-target typed results, partial-success state, and explicit cancellation remainder.

- [ ] **Step 1: Add failing deterministic batch tables**

  Build the same catalog in different input orders and assert identical target order, plan IDs, provider buckets, public result order, and fingerprints. Add mixed updated/up-to-date/manual/failed/locked results and cancellation before and during a bucket.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `bun run test -- test/services/lifecycle-updates.test.ts test/commands/update.test.ts`

  Expected: FAIL because current ordering follows discovery/bucket control flow and does not expose a typed batch plan.

- [ ] **Step 3: Implement stable plan composition**

  Observe and plan all registered targets before mutation, sort by canonical name, group only compatible provider update operations, and retain per-target verification requirements. A provider `updateMany` optimization may execute a stable bucket, but every target still receives its own fresh verification and receipt decision.

- [ ] **Step 4: Implement typed partial execution and cancellation**

  Stop scheduling new targets after cancellation, preserve completed target outcomes, mark the command non-success when failures/locks/cancellation occur, and do not collapse partial results to a boolean. Preserve provider-specific manual hints.

- [ ] **Step 5: Verify GREEN and v1 batch mapping**

  Run: `bun run test -- test/services/lifecycle-updates.test.ts test/commands/update.test.ts test/command-runtime.test.ts`

  Expected: PASS with the existing `results`/`scope` v1 shape and deterministic event/result order.

- [ ] **Step 6: Review and checkpoint**

  Request an independent batch/cancellation review, then commit:

  ```bash
  git add src/services/lifecycle-updates.ts src/services/update.ts src/commands/update.ts test/services/lifecycle-updates.test.ts test/commands/update.test.ts
  git commit -m "refactor(update): compose deterministic batch plans"
  ```
