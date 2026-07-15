### Task 2: Verified Single-Agent Update Application Service

**Files:**
- Create: `src/services/lifecycle-updates.ts`
- Create: `src/services/lifecycle-updates-production.ts`
- Modify: `src/commands/update.ts`
- Modify: `src/services/update.ts`
- Modify: `src/lifecycle/model.ts`
- Modify: `src/state/index.ts`
- Test: `test/services/lifecycle-updates.test.ts`
- Test: `test/commands/update.test.ts`

**Interfaces:**
- `src/services/lifecycle-updates.ts` consumes only injected `LifecycleUpdateServicePorts`: observer, provider-registry, receipt-store, clock, cancellation, and timeout ports plus `planLifecycleUpdate`; it does not import concrete state, provider, CLI, or presenter modules.
- `src/services/lifecycle-updates-production.ts` is the composition root that binds `resolveAgentObservation`, `firstPartyProviderRegistry`, provider adapters, the lifecycle receipt store, and the invocation clock/context.
- Produces: `planSingleAgentLifecycleUpdate(agentName, ports)` and `executeSingleAgentLifecycleUpdate(planned, ports)` returning typed application outcomes that retain plan, before/after observations, provider outcome, verification, and receipt.
- The command layer maps typed outcomes to the existing `UpdateResultItem` and v1 error/result envelopes.

- [ ] **Step 1: Add failing source and postcondition tests**

  Cover confirmed recorded source, conflicting provider evidence, unsupported verification, provider failure, provider success with stale version, semantic downgrade after execution, verified target-or-newer success, dry run, cancellation, timeout, and receipt write failure. Assert no receipt change before successful verification.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `bun run test -- test/services/lifecycle-updates.test.ts test/commands/update.test.ts`

  Expected: FAIL because the update application service does not exist and the command currently trusts provider success for managed updates.

- [ ] **Step 3: Implement observation and planning orchestration**

  Resolve the agent through the injected observer port, require the observed provider/target binding to match persisted evidence, resolve the target version through the injected bound-provider port, and return a pure plan without importing production adapters or spawning from the command module.

- [ ] **Step 4: Implement execution, fresh verification, and receipt persistence**

  Invoke only the planned provider target. Re-observe through the same provider binding after success. Accept the result only when the provider/package and executable remain present and the observed version is the planned target or a newer semantic version. Persist a receipt for that same binding after verification.

- [ ] **Step 5: Preserve the v1 command facade**

  Route single-agent `update` through the application service while keeping existing human text categories, structured fields, error codes, lock mapping, events, dry-run warnings, and exit behavior. Do not expose internal plans in schema v1.

- [ ] **Step 6: Verify GREEN and compatibility**

  Run: `bun run test -- test/services/lifecycle-updates.test.ts test/commands/update.test.ts test/compatibility/v1-baseline.test.ts test/lifecycle/reconcile.test.ts`

  Expected: PASS; a successful provider exit with failed postcondition maps to `UPDATE_FAILED` and does not write success evidence.

- [ ] **Step 7: Review and checkpoint**

  Request an independent review for source binding, cancellation, verification, and receipt ordering, then commit:

  ```bash
  git add src/services/lifecycle-updates.ts src/services/lifecycle-updates-production.ts src/commands/update.ts src/services/update.ts src/lifecycle/model.ts src/state/index.ts test/services/lifecycle-updates.test.ts test/commands/update.test.ts
  git commit -m "refactor(update): verify single-agent lifecycle updates"
  ```
