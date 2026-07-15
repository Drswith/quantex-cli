### Task 1: Pure Semantic Update Planning

**Files:**
- Create: `src/lifecycle/update-planner.ts`
- Modify: `src/lifecycle/index.ts`
- Modify: `src/planning/updates.ts`
- Test: `test/lifecycle/update-planner.test.ts`
- Test: `test/utils/version.test.ts`
- Modify: `test/compatibility/v1-baseline.test.ts`
- Create: `test/fixtures/compatibility/v1/update-single.json`
- Create: `test/fixtures/compatibility/v1/update-all.json`
- Create: `test/fixtures/compatibility/v1/update-single.ndjson`
- Create: `test/fixtures/compatibility/v1/update-all.ndjson`

**Interfaces:**
- Consumes: `compareVersions(candidate: string, current: string): number | undefined`, `LifecycleObservation`, `LifecyclePlanningProvider`, and provider capability snapshots.
- Produces: `planLifecycleUpdate(input: LifecycleUpdatePlanningInput): LifecycleUpdatePlanningResult` with decisions `upgrade`, `up-to-date`, `blocked-downgrade`, `indeterminate`, `manual-required`, and `blocked-source`.
- Produces deterministic `LifecyclePlan` steps whose update effect targets the reconciled provider binding and whose version postcondition names the resolved semantic target.

- [ ] **Step 1: Capture update v1 goldens from the untouched base**

  From milestone base `d2d2275`, capture deterministic single-agent and `--all` JSON plus NDJSON started/progress/result output into the four named fixtures. Lock field names, requiredness, error codes, exit codes, and stdout/stderr routing. Normalize only run ID, timestamp, version, and documented host-dependent values. Commit these expected fixtures before changing update production behavior; never regenerate expected values from the new implementation merely to make tests pass.

  ```bash
  git add test/compatibility/v1-baseline.test.ts test/fixtures/compatibility/v1/update-single.json test/fixtures/compatibility/v1/update-all.json test/fixtures/compatibility/v1/update-single.ndjson test/fixtures/compatibility/v1/update-all.ndjson
  git commit -m "test(update): capture v1 compatibility goldens"
  ```

- [ ] **Step 2: Add failing semantic decision tables**

  Cover `2.10.0 -> 2.9.0`, `1.9.0 -> 1.10.0`, release versus prerelease, prerelease identifier ordering, equal versions, missing versions, unparseable versions, conflicting source, missing update capability, and repeated planning equality. Assert that downgrade/indeterminate/manual decisions contain no mutation steps.

- [ ] **Step 3: Run the planner and version tests to verify RED**

  Run: `bun run test -- test/lifecycle/update-planner.test.ts test/utils/version.test.ts`

  Expected: FAIL because `planLifecycleUpdate` and the complete decision model do not exist; the existing inequality planner also classifies older targets as updates.

- [ ] **Step 4: Implement the minimal pure planner**

  Normalize the input into one reconciled provider binding, use `compareVersions` exactly once for order, and build an `update-<targetId>` operation step only for a newer semantic target with required `update`, observation, and verification capabilities. Keep all I/O out of this module.

- [ ] **Step 5: Adapt legacy update availability projection**

  Replace raw `installedVersion !== latestVersion` in `src/planning/updates.ts` with a compatibility projection over the semantic decision so existing callers stop treating stale lower or indeterminate targets as automatic updates.

- [ ] **Step 6: Verify GREEN and regression scope**

  Run: `bun run test -- test/lifecycle/update-planner.test.ts test/utils/version.test.ts test/commands/update.test.ts test/agent-update.test.ts`

  Expected: PASS with no v1 fixture changes.

- [ ] **Step 7: Review and checkpoint**

  Request an independent spec/code review for OpenSpec 1.3 and 7.1, fix all Critical/Important findings, then commit:

  ```bash
  git add src/lifecycle/update-planner.ts src/lifecycle/index.ts src/planning/updates.ts test/lifecycle/update-planner.test.ts test/utils/version.test.ts
  git commit -m "refactor(update): add semantic lifecycle planning"
  ```
