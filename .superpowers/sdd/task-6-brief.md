### Task 6: Derive capabilities and doctor diagnostics from registries (OpenSpec 5.5–5.6)

**Files:**
- Create: `src/services/provider-observations.ts`
- Create: `test/services/provider-observations.test.ts`
- Modify: `src/commands/capabilities.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `test/commands/capabilities.test.ts`
- Modify: `test/commands/doctor.test.ts`

**Interfaces:**
- Consumes: `firstPartyProviderRegistry.list()`, `getCapabilities(id)`, provider `availability`, agent observations, and existing explicitly network-aware self inspection.
- Produces: a typed provider availability/capability snapshot projected into the unchanged nine v1 installer fields and current doctor issue model.

- [ ] **Step 1: Add provider snapshot tests**

  Prove each registry adapter is queried once, capabilities come from implemented operations, cancellation/timeout/unavailable outcomes stay typed, and script/binary providers are not added to the strict v1 `installers` projection.

- [ ] **Step 2: Add command route tests**

  Make direct `isBunAvailable`/`isNpmAvailable`/etc. calls fail if used. Assert unchanged platform reasons, feature fields, self-upgrade projection, doctor installer booleans, issue codes, blocking flags, remediation commands, and explicitly network-aware self checks.

- [ ] **Step 3: Route capabilities and doctor through shared snapshots**

  Preserve exact v1 fields. Do not infer provider capabilities from duplicated command tables. Doctor agent issues consume live drift classifications but continue to emit only established issue/result fields.

- [ ] **Step 4: Run focused gates and checkpoint**

  Run:

  ```bash
  bun run test -- test/services/provider-observations.test.ts test/commands/capabilities.test.ts test/commands/doctor.test.ts test/providers/conformance.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `refactor(readonly): derive capabilities and diagnostics`
