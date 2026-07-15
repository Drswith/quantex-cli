# Self-Upgrade Integration Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete OpenSpec tasks 9.1–9.5 by moving Quantex self-upgrade onto the shared invocation/runtime boundaries, eliminating passive network checks, and preserving managed-package and standalone-binary safety on every supported platform.

**Architecture:** Keep `src/self` as a sibling bounded context with its own facts, target, plan, outcome, recovery, and verification types. Add an invocation-scoped self-upgrade application service that consumes the existing shared runtime ports, then bind current Bun/npm, registry, release, state, lock, filesystem, and process behavior in a production composition root. Keep `src/commands/upgrade.ts` as the v1 result/presentation compatibility adapter. Passive notices consume a schema-validated, unexpired self-update metadata record written only by explicit fresh checks; they never call the fresh planner.

**Tech Stack:** Bun 1.3.x, strict TypeScript, Commander 14, Vitest, existing runtime ports and command-result presenters, OpenSpec, release-artifact tooling.

## Global Constraints

- Scope is OpenSpec tasks 9.1–9.5 only. Do not remove compatibility facades, reshape public exports, or begin Phase 10/11 work.
- Self-upgrade MUST NOT import `src/lifecycle` domain types or model Quantex as an agent. Shared runtime values are infrastructure contracts, not shared lifecycle business semantics.
- `upgrade --check`, `upgrade`, and explicitly network-aware diagnostics retain their declared fresh network effect. A successful ordinary command may read a valid cache entry but MUST NOT issue network I/O, refresh TTLs, or write cache/state while deciding whether to show a notice.
- Preserve stable human, JSON, and NDJSON result fields, warning/error codes, exit mappings, install-source detection, registry override precedence, stale-registry warnings, dry-run behavior, and recovery hints.
- Preserve Bun/npm global install commands and post-install verification against the managed CLI entry point with executable-path fallback.
- Preserve standalone checksum validation, same-directory temporary/backup replacement, executable verification, rollback, failure classification, and cleanup.
- Preserve Windows delayed replacement, backup restoration, `qtx.exe`/`quantex.exe` peer entry-point synchronization, custom-name exclusion, and hidden PowerShell launch semantics.
- All blocking port requests carry the invocation signal and bounded timeout. Lock release and rollback cleanup MUST remain possible after cancellation.
- Keep `redesign-lifecycle-engine` and `support-integration-branch-delivery` active. Check tasks 9.1–9.5 only after local, platform CI, sandbox, build, binary, release-artifact, and release-smoke evidence exists.
- Create granular recovery commits and retain the final granular head on `refs/quantex/recovery/redesign-self-upgrade-granular`. Normalize to one conventional commit only immediately before the PR.

Baseline note: static gates passed at integration `09fe7b1`; the first full test run had three existing concurrent signal/timing flakes, while the focused rerun passed 53/53. Treat any recurrence with systematic debugging and a bounded focused rerun; do not hide a deterministic regression as a flake.

---

### Task 1: Cache-Only Passive Self-Update Metadata

**Files:**
- Create: `src/self/update-metadata.ts`
- Create: `src/runtime/version-cache.ts`
- Modify: `src/runtime/index.ts`
- Modify: `src/self/planning.ts`
- Modify: `src/self/update-notice.ts`
- Test: `test/self-update-metadata.test.ts`
- Modify: `test/self-update-notice.test.ts`
- Modify: `test/commands/upgrade.test.ts`

**Interfaces:**
- `SelfUpdateMetadata` contains a schema version, current install source, channel, target version, `canAutoUpdate`, and explicit `fetchedAtMs`/`expiresAtMs` evidence.
- `parseSelfUpdateMetadata(value, now)` is pure and rejects malformed, expired, channel/source-mismatched, non-semver, or non-installable data.
- `createVersionCachePort()` implements the shared `CachePort` over the existing `~/.quantex/cache/versions.json` store without changing existing cache keys or network fallback behavior.
- Explicit target resolution writes the typed self metadata only after a fresh/cached explicit check resolves a valid target. Passive notice reads only that typed record and never calls `inspectSelfReadOnly`, a network port, or a cache write.

- [ ] **Step 1: Add failing metadata and passive-I/O tests**

  Cover valid newer metadata, equal/older versions, expiration boundary, malformed schema, wrong channel/source, unavailable auto-update, cache miss, cache read failure, and `--no-cache`. Instrument network, cache writes, and state writes and assert all stay at zero during passive evaluation.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- test/self-update-metadata.test.ts test/self-update-notice.test.ts test/commands/upgrade.test.ts`

  Expected: FAIL because the typed metadata contract/cache port do not exist and the notice still invokes the fresh self planner.

- [ ] **Step 3: Implement the cache adapter and pure metadata parser**

  Keep the existing response-cache document readable. Validate every cache boundary as `unknown`; never trust a type assertion from JSON. A passive read returns `miss` for expired or invalid values and performs no cleanup write.

- [ ] **Step 4: Write metadata from explicit planning only**

  Have explicit fresh `planSelfUpgrade` calls record the resolved target metadata through an injected cache port/composition. Do not write metadata for cancellation, unresolved target, manual-only source, or passive/read-only evaluation.

- [ ] **Step 5: Convert passive notice to cache-only projection**

  Resolve local self facts read-only, read the exact source/channel metadata key, validate it, and render through the existing human output helper. Keep the existing throttle comparison but do not persist new notice state in this milestone.

- [ ] **Step 6: Verify GREEN and checkpoint**

  Run:

  ```bash
  bun run test -- test/self-update-metadata.test.ts test/self-update-notice.test.ts test/commands/upgrade.test.ts
  bun run lint
  bun run format:check
  bun run typecheck
  ```

  Then commit: `refactor(self): make update notices cache only`.

### Task 2: Invocation-Scoped Self-Upgrade Application Service

**Files:**
- Create: `src/self/application.ts`
- Create: `src/services/self-upgrade-production.ts`
- Modify: `src/self/index.ts`
- Modify: `src/services/index.ts`
- Modify: `src/commands/upgrade.ts`
- Test: `test/self/application.test.ts`
- Modify: `test/commands/upgrade.test.ts`
- Modify: `test/runtime/invocation-context.test.ts`

**Interfaces:**
- `SelfUpgradeApplication` owns `inspect`, `check`, and `execute` use cases over a per-invocation `InvocationContext`.
- Injected self ports resolve/persist local facts, resolve the explicit target, execute the selected self provider, and verify the postcondition. The service itself coordinates the shared cache, lock, persistence, clock, and cancellation contracts and returns typed self outcomes only.
- `createProductionSelfUpgradeInvocation()` bridges current CLI cancellation/options into a fresh invocation context and binds production runtime ports. It is the only production composition used by `upgradeCommand`.
- `src/commands/upgrade.ts` maps typed outcomes to the unchanged v1 `CommandResult` and `renderUpgradeHuman`; it does not acquire locks, select providers, spawn processes, or fetch releases.

- [ ] **Step 1: Add failing service decision/order tests**

  Cover check, dry-run, up-to-date, manual-only, update, target-resolution failure, lock conflict, cancellation before/after lock, provider failure, verification failure, cache write failure tolerance, persistence failure, and idempotent lock release. Assert execution cannot occur without a resolved update plan and that verification always follows successful mutation.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- test/self/application.test.ts test/commands/upgrade.test.ts test/runtime/invocation-context.test.ts`

- [ ] **Step 3: Implement the application service and production composition**

  Keep the service free of Commander, console, command-result, agent catalog, and lifecycle-domain imports. Map `RuntimeOutcome` failures to self error kinds at the composition boundary and preserve stable command errors in the presenter.

- [ ] **Step 4: Route the explicit command through one invocation**

  Replace direct `planSelfUpgrade`/`upgradeSelf` orchestration in `upgradeCommand`. Guarantee `dispose()` in `finally`, preserve CLI cancellation and timeout, and ensure explicit checks own their network/cache effects.

- [ ] **Step 5: Preserve compatibility wrappers**

  Keep exported `inspectSelf`, `inspectSelfReadOnly`, `planSelfUpgrade`, and `upgradeSelf` signatures as compatibility facades backed by the new production service where safe. Do not remove exports in Phase 9.

- [ ] **Step 6: Verify GREEN and checkpoint**

  Run focused self/command/runtime tests plus `test/compatibility/v1-baseline.test.ts`, then commit: `refactor(self): add invocation scoped upgrade service`.

### Task 3: Shared Process and Network Ports for Managed Upgrades

**Files:**
- Create: `src/runtime/child-process.ts`
- Create: `src/runtime/fetch-network.ts`
- Modify: `src/runtime/index.ts`
- Modify: `src/utils/network.ts`
- Modify: `src/utils/version.ts`
- Modify: `src/self/planning.ts`
- Modify: `src/self/release.ts`
- Modify: `src/self/providers/bun.ts`
- Modify: `src/self/providers/npm.ts`
- Modify: `src/self/planning.ts`
- Test: `test/runtime/child-process.test.ts`
- Test: `test/runtime/fetch-network.test.ts`
- Modify: `test/self.test.ts`
- Modify: `test/network-cancellation.test.ts`

**Interfaces:**
- `createChildProcessPort()` implements `ProcessPort` with direct argv, requested stdio, bounded timeout, cancellation, exact exit code, captured pipe output, process-tree termination, and listener cleanup.
- `createFetchNetworkPort()` implements `NetworkPort` with method/headers/body, timeout, abort propagation, bounded response consumption, and normalized response headers.
- Fresh version/release resolution consumes the injected network port while retaining the existing retry, ETag, response validation, and selected-registry cache policy.
- Bun/npm self providers construct the same global install argv and use `ProcessPort`; managed verification uses the same port with the managed entry-point probe followed by executable-path fallback.

- [ ] **Step 1: Add failing port conformance tests**

  Cover success/non-zero exit, inherited and piped stdio, spawn failure, cancellation race, timeout, no late completion, response headers/body, HTTP errors, body cancellation, and cleanup.

- [ ] **Step 2: Add failing managed self-upgrade tests**

  Assert exact Bun/npm argv, dist tag, registry override/default, cancellation, timeout, install failure, verification success, wrong version, unresolved version, and probe fallback. Assert no agent lifecycle provider or catalog module is imported by the self application/domain path.

- [ ] **Step 3: Implement production process/network ports and inject them**

  Preserve current retry/cache semantics above `NetworkPort`; the port performs one request and does not decide caching. Preserve transparent install stdio and exact version probe parsing above `ProcessPort`.

- [ ] **Step 4: Verify managed behavior and checkpoint**

  Run runtime, network, self, upgrade-command, cancellation, and compatibility tests; commit: `refactor(self): migrate managed upgrades to runtime ports`.

### Task 4: Port-Driven Standalone Binary Replacement and Windows Recovery

**Files:**
- Create: `src/runtime/node-file-system.ts`
- Create: `src/runtime/resource-lock.ts`
- Create: `src/runtime/state-persistence.ts`
- Modify: `src/runtime/index.ts`
- Modify: `src/self/binary.ts`
- Modify: `src/self/lock.ts`
- Modify: `src/self/facts.ts`
- Modify: `src/self/providers/binary.ts`
- Test: `test/runtime/node-file-system.test.ts`
- Test: `test/runtime/resource-lock.test.ts`
- Test: `test/runtime/state-persistence.test.ts`
- Modify: `test/self-binary.test.ts`
- Modify: `test/self-binary-rollback.test.ts`
- Modify: `test/self-state.test.ts`
- Modify: `test/self.test.ts`

**Interfaces:**
- Binary execution consumes `NetworkPort`, `FileSystemPort`, and `ProcessPort`; the binary module owns checksum/replacement/rollback semantics but no direct `fetch`, `Bun.spawn`, or `node:fs/promises` calls.
- The self-upgrade lease consumes `LockPort`; release is idempotent and independent of the acquisition signal.
- Self install-source evidence consumes a narrow self persistence projection backed by `PersistencePort`; the self bounded context does not import lifecycle receipts or agent state types.

- [ ] **Step 1: Add failing port and fault-injection tests**

  Inject failure at download, checksum, temp write, chmod/permission mapping where applicable, backup rename, install rename, verification spawn, backup removal, rollback rename, and cleanup. Assert the original executable survives every pre-commit failure and recovery diagnostics retain the download URL.

- [ ] **Step 2: Add failing Windows delayed-swap tests through ports**

  Cover backup creation timeout, install move failure with restoration, verified success cleanup, known peer alias synchronization from either entry point, custom-name exclusion, hidden PowerShell flags, and signal-safe scheduling. Assert exact quoting for paths containing spaces and apostrophes.

- [ ] **Step 3: Implement filesystem/lock/persistence adapters and binary migration**

  Keep atomic same-directory replacement and existing backup suffixes. Do not reuse agent mutation plans or lifecycle receipts. Preserve public binary helper signatures through optional/default production dependencies until Phase 10.

- [ ] **Step 4: Verify fault suites and checkpoint**

  Run all self binary/state/runtime tests and full typecheck; commit: `refactor(self): migrate binary replacement to runtime ports`.

### Task 5: Release, Cross-Platform, OpenSpec, Review, and PR Delivery

**Files:**
- Modify as needed: `scripts/test-self-upgrade-sandbox.ts`
- Modify as needed: release-smoke/build scripts only when a migrated-path defect is proven
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`
- Replace: `.superpowers/sdd/progress.md`

- [ ] **Step 1: Run focused and full local gates**

  ```bash
  bun run lint
  bun run format:check
  bun run typecheck
  bun run test
  bun run openspec:validate
  bun run memory:check
  bun run build
  bun run build:bin
  bun run package:check
  bun run release:artifacts
  bun run release:smoke
  ```

  Release commands create local artifacts only; they MUST NOT publish npm packages or trigger the Release workflow.

- [ ] **Step 2: Run managed self-upgrade sandbox evidence**

  Run the repository self-upgrade sandbox/container scenario for Bun and npm where supported. Use a bounded retry only for proven transient network acquisition failures; never retry a semantic assertion failure without diagnosis.

- [ ] **Step 3: Independent two-stage whole-branch review**

  Review `origin/codex/redesign-lifecycle-integration...HEAD` first for OpenSpec compliance, then for code quality. Fix every Critical/Important finding and rerun the affected fault and compatibility suites.

- [ ] **Step 4: Complete OpenSpec accounting only with remote evidence**

  After macOS, Ubuntu, Windows, sandbox, build, binary, artifact, and smoke checks pass, mark 9.1–9.5 complete and update progress to 53/74. Keep the change active and unarchived; Release remains not applicable.

- [ ] **Step 5: Preserve recovery history and normalize**

  ```bash
  git update-ref refs/quantex/recovery/redesign-self-upgrade-granular HEAD
  git fetch origin codex/redesign-lifecycle-integration
  # verify the branch still has the expected base/tree, then normalize to one commit
  ```

  Use `refactor(self): migrate self upgrade to runtime ports` for the normalized commit. Re-run at least lint, format check, typecheck, focused self suites, OpenSpec validation, memory check, build, and release smoke on the normalized tree.

- [ ] **Step 6: Create the milestone PR to integration**

  Build the PR body from `.github/pull_request_template.md`, run `bun run pr:body:check`, push with lease safety, and create a ready PR with base exactly `codex/redesign-lifecycle-integration`. Confirm auto-merge is disabled and no Release workflow starts.

- [ ] **Step 7: Gate and integrate**

  Wait for required lint/format/typecheck/test/OpenSpec/memory/platform/sandbox/governance checks and independent review. Merge with rebase first; use squash only if rebase is unavailable/unsafe and record why. Never create a merge commit. Verify the integration tree equals the reviewed PR tree and OpenSpec remains active at 53/74.

## Recovery and Stop Conditions

- Resume from the first incomplete progress row after checking `git status`, `git log`, CodeGraph pending sync, focused tests, and the recovery ref.
- If network, GitHub, or quota access interrupts delivery, preserve a reviewed granular commit plus the recovery ref before stopping. Split the next unit until each can finish inside one bounded execution window.
- If a deterministic compatibility, checksum, rollback, Windows, or release-smoke failure remains, do not mark the corresponding OpenSpec task complete and do not open a ready PR.
- If the runtime-port migration requires changing a public v1 schema or agent lifecycle semantics, stop and revise the active OpenSpec design instead of expanding Phase 9 implicitly.
