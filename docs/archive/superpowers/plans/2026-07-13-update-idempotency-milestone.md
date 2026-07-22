# Update and Idempotency Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete OpenSpec tasks 7.1–7.6 by routing agent updates through semantic, source-aware, verified lifecycle plans and by binding idempotent replay to canonical request meaning plus live postconditions without changing the v1 CLI protocol.

**Architecture:** Add a pure update planner beside the existing mutation planner, then coordinate observation, provider execution, verification, receipt persistence, and deterministic batch composition in an application service. Keep `src/commands/update.ts` as the v1 compatibility presenter. Replace the current action/target-only idempotency record with a schema-versioned record and command-specific replay validation; do not introduce workflow orchestration or change self-upgrade behavior.

**Tech Stack:** Bun 1.3.x, strict TypeScript, Vitest, existing provider registry/lifecycle observation/state stores, Node `crypto`, OpenSpec.

## Global Constraints

- Preserve `update [agent]`, `update --all`, alias `u`, JSON/NDJSON v1 envelopes, error codes, exit mapping, stdout/stderr routing, dry-run behavior, locks, cancellation, and non-interactive behavior.
- Preserve the recorded provider and provider target identity when live evidence agrees; never guess another provider when evidence conflicts or is indeterminate.
- Compare normalized versions by semantic precedence, including prereleases; unparseable ordering is indeterminate and an older target never triggers an implicit downgrade.
- A provider success is not an `updated` result until a fresh live observation satisfies the planned provider, executable, and version postconditions.
- `update --all` remains deterministic batch composition inside one command, not a workflow graph or orchestration surface.
- Dry runs and failures are never replayable. A mismatched idempotency key returns stable `INVALID_ARGUMENT` and never overwrites the existing record.
- Keep `redesign-lifecycle-engine` active. Check only tasks whose full wording is implemented and verified; do not sync current specs or archive during this milestone.
- Create granular checkpoint commits for interruption recovery, preserve them on a recovery ref, and normalize the PR branch to one commit before delivery to `codex/redesign-lifecycle-integration`.

---

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

### Task 4: Schema-Versioned Idempotency Records and Fingerprints

**Files:**
- Create: `src/idempotency/canonical.ts`
- Create: `src/idempotency/schema.ts`
- Modify: `src/idempotency.ts`
- Test: `test/idempotency/canonical.test.ts`
- Test: `test/idempotency/schema.test.ts`
- Modify: `test/idempotency.test.ts`

**Interfaces:**
- Produces: `CanonicalMutationRequest`, `IdempotencyPostcondition`, `IdempotencyReceiptSnapshot`, and `VersionedIdempotencyRecord` with explicit schema version, expiry, canonical request payload, resolved-plan payload, receipt payload, postcondition payload, and a fingerprint beside each payload.
- Produces: `canonicalizeMutationRequest`, `fingerprintCanonicalValue`, `parseIdempotencyRecord`, and clock-injectable load/save functions. Loading returns a discriminated result: `missing`, `expired`, `invalid`, or `valid`, so corrupt evidence cannot be confused with absence.
- Keeps hashed filenames based on the raw caller key so distinct keys remain collision-resistant.

- [ ] **Step 1: Add failing canonicalization and schema tests**

  Cover reordered equivalent batch targets, duplicate target normalization, target/option differences, `latest` resolved-plan changes, stable recursive key ordering, receipt/version changes, corrupt files, unsupported schema versions, expiration, and legacy unversioned records. Assert fingerprints never include output mode, color, quiet, or run ID. Assert the canonical postcondition and receipt payloads remain available to the live validator and match their stored fingerprints.

- [ ] **Step 2: Run storage tests to verify RED**

  Run: `bun run test -- test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts`

  Expected: FAIL because current records contain only action, target, result, and timestamps.

- [ ] **Step 3: Implement canonical values and deterministic SHA-256 fingerprints**

  Canonicalize command-specific mutation meaning before serialization: sort object keys recursively, sort/deduplicate set-like target arrays, preserve order where order is semantic, and encode absent optional values consistently. Hash the canonical UTF-8 JSON.

- [ ] **Step 4: Implement strict record parsing and durable storage**

  Parse only the current schema into trusted records, delete only expired records, and write through a temporary file plus rename. Return corrupt, unsupported-schema, and legacy unversioned records as `invalid` with their original file retained; never silently treat them as a cache miss. Inject clock/TTL in tests while retaining the 24-hour production default.

- [ ] **Step 5: Verify GREEN and compatibility**

  Run: `bun run test -- test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts test/state/schema.test.ts`

  Expected: PASS; lifecycle `state.json` schema remains unchanged because idempotency has its own versioned record boundary.

- [ ] **Step 6: Review and checkpoint**

  Request an independent persistence/schema review, then commit:

  ```bash
  git add src/idempotency.ts src/idempotency/canonical.ts src/idempotency/schema.ts test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts
  git commit -m "refactor(idempotency): version replay evidence"
  ```

### Task 5: Command-Specific Replay Validation

**Files:**
- Create: `src/idempotency/replay.ts`
- Modify: `src/command-runtime.ts`
- Modify: `src/cli.ts`
- Modify: `src/commands/install.ts`
- Modify: `src/commands/ensure.ts`
- Modify: `src/commands/update.ts`
- Modify: `src/commands/uninstall.ts`
- Test: `test/command-runtime.test.ts`
- Test: `test/idempotency/replay.test.ts`

**Interfaces:**
- Extends `ExecuteCommandOptions` with a command-specific idempotency policy that supplies normalized request meaning, resolved-plan identity, evidence captured after successful execution, and a live replay validator.
- Produces validators for presence (`install`, `ensure`), verified update target/source (`update`), and absence (`uninstall`).
- Request mismatch produces one stable `INVALID_ARGUMENT` result with existing action, key, and fingerprint diagnostics; it never runs or overwrites the stored mutation.

**Replay decision table:**

| Loaded evidence | Request/live state | Decision |
| --- | --- | --- |
| valid | request fingerprint differs | `INVALID_ARGUMENT`; no mutation; no overwrite |
| valid | same request and postcondition holds | replay stored success |
| valid | same request and live state drifted | normal reconciliation; replace only after a new verified success |
| expired | any request | delete expired file; treat invocation as new |
| corrupt, unsupported, or legacy | any request | fail closed with `INVALID_ARGUMENT`; no mutation; no overwrite |

- [ ] **Step 1: Add failing runtime replay cases**

  Cover changed target, changed `--all`, reordered equivalent batch targets, changed latest resolved plan, matching live postcondition, drift, changed receipt/provider source, dry run, failed execution, expiry, corrupt record, and legacy/unsupported record. Assert every mismatch or invalid record preserves the original file byte-for-byte.

- [ ] **Step 2: Run replay tests to verify RED**

  Run: `bun run test -- test/command-runtime.test.ts test/idempotency/replay.test.ts`

  Expected: FAIL because current runtime compares only action and a comma-separated target and validates only PATH presence/absence.

- [ ] **Step 3: Implement replay policy dispatch**

  Build canonical requests at CLI command registration using normalized canonical agent names and mutation-relevant options. Resolve update plan identity before replay when `latest` depends on live observation. Keep read-only commands outside idempotency persistence.

- [ ] **Step 4: Verify live postconditions before replay**

  For install/ensure require compatible live presence and receipt evidence; for update require the recorded provider/target plus semantic version postcondition and current plan fingerprint; for uninstall require conclusive absence. Drift or unverifiable evidence continues through normal reconciliation instead of replaying.

- [ ] **Step 5: Preserve mismatch and persistence safety**

  Apply the replay decision table exactly. Return `INVALID_ARGUMENT` for different request meaning or invalid retained evidence. Persist only successful, non-dry-run outcomes after collecting canonical resolved-plan, receipt, and postcondition payloads and verifying their fingerprints.

- [ ] **Step 6: Verify GREEN and command regressions**

  Run: `bun run test -- test/command-runtime.test.ts test/idempotency/replay.test.ts test/commands/install.test.ts test/commands/ensure.test.ts test/commands/update.test.ts test/commands/uninstall.test.ts`

  Expected: PASS with existing public envelopes and no result replay after drift.

- [ ] **Step 7: Review and checkpoint**

  Request an independent review for canonical request coverage, no-overwrite behavior, and live validation, then commit:

  ```bash
  git add src/idempotency/replay.ts src/command-runtime.ts src/cli.ts src/commands/install.ts src/commands/ensure.ts src/commands/update.ts src/commands/uninstall.ts test/command-runtime.test.ts test/idempotency/replay.test.ts
  git commit -m "refactor(idempotency): validate command replays"
  ```

### Task 6: Milestone Contract, Compatibility, and Delivery Closure

**Files:**
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`
- Modify: `test/compatibility/v1-baseline.test.ts`
- Modify: `test/commands/update.test.ts`
- Modify: `test/command-runtime.test.ts`

**Interfaces:**
- Consumes all Task 1–5 public and internal interfaces.
- Produces evidence for OpenSpec 1.3 and 7.1–7.6, one normalized milestone commit, and a PR to `codex/redesign-lifecycle-integration`.

- [ ] **Step 1: Add the complete Phase 7 integration matrix**

  Ensure tests explicitly cover target-option changes, reordered equivalent inputs, latest-target changes, batch targets, drift, dry run, failure, expiry, prerelease ordering, no downgrade, provider/source conflict, postcondition failure, cancellation, and typed partial success.

- [ ] **Step 2: Run focused cross-boundary tests**

  Run:

  ```bash
  bun run test -- test/lifecycle/update-planner.test.ts test/services/lifecycle-updates.test.ts test/commands/update.test.ts test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts test/idempotency/replay.test.ts test/command-runtime.test.ts test/compatibility/v1-baseline.test.ts
  ```

  Expected: PASS with no unreviewed v1 golden changes.

- [ ] **Step 3: Mark only genuinely completed OpenSpec tasks**

  Mark 1.3 and 7.1–7.6 complete only after their exact wording is satisfied. Leave all other pending tasks and archive state unchanged.

- [ ] **Step 4: Run the full local gate**

  Run:

  ```bash
  bun run lint
  bun run format:check
  bun run typecheck
  bun run test
  bun run openspec:validate
  bun run memory:check
  bun run build
  ```

  Expected: all commands exit 0; OpenSpec remains active and reports 44/74 only if 1.3 plus all six Phase 7 tasks are complete.

- [ ] **Step 5: Run exact platform smoke and independent whole-branch review**

  Run locally when Docker is available:

  ```bash
  QTX_ISOLATION_AGENTS=codex QTX_ISOLATION_SCENARIOS=managed,deno-managed,uv-managed bun run test:container
  ```

  Run Modal when the CLI and authenticated profile are available:

  ```bash
  QTX_ISOLATION_AGENTS=codex QTX_ISOLATION_SCENARIOS=managed,deno-managed,uv-managed bun run test:sandbox
  ```

  These scenarios must exercise managed/provider update and post-update observation without self-upgrading Quantex. If Docker is unavailable, record `docker info` evidence and require the trusted PR `sandbox-tests` Modal gate as the owner; if Modal is unavailable locally, the trusted PR `sandbox-tests` gate remains mandatory. Neither missing local tool permits merging with a failed or skipped relevant remote sandbox gate. Request a whole-branch review against `origin/codex/redesign-lifecycle-integration`, and resolve all Critical/Important findings before delivery.

- [ ] **Step 6: Synchronize the protected base without losing content**

  Create a recovery ref pointing to the granular commits, fetch `origin/codex/redesign-lifecycle-integration`, and compare its tip with the milestone's recorded base. If unchanged, proceed to normalization. If advanced, rebase the granular milestone commits onto the refreshed base (or cherry-pick them onto a fresh branch when rebase is unsafe), resolve conflicts without dropping base content, and rerun the focused matrix, full local gate, platform smoke, and whole-branch review on the rebased tree. Never soft-reset an old reviewed tree onto a newer base.

- [ ] **Step 7: Normalize only the refreshed feature range**

  After the base synchronization gate, record the current rebased feature tree, soft-reset only to that exact refreshed base, and create one conventional milestone commit. Verify the normalized commit has the refreshed base as its parent and its tree equals the immediately pre-normalization rebased feature tree. Do not compare against or restore the obsolete tree from an older base.

- [ ] **Step 8: Validate the PR body and deliver**

  Build the body from `.github/pull_request_template.md`, run `bun run pr:body:check`, push the normalized branch, and open a ready PR with base `codex/redesign-lifecycle-integration`. Do not enable auto-merge.

- [ ] **Step 9: Merge and verify closure**

  After all required CI, sandbox, and review gates pass, fetch both remote refs again. If the current integration tip differs from the refreshed base used by the normalized commit, do not merge: return to Step 6, rebase/cherry-pick onto the new base, rerun focused/full/smoke/whole-branch review, renormalize, force-push with lease, and wait for fresh CI.

  When both refs still match the approved review, atomically persist exactly three lines under `$(git rev-parse --git-path quantex/lifecycle-integration/update-idempotency-milestone.approved)`: approved integration base tip, approved feature head tip, and `git merge-tree --write-tree <base> <head>` expected result tree. In a fresh process immediately before merge, reload the ledger, fetch again, verify both remote refs and the recomputed expected tree still match, then run:

  ```bash
  gh pr merge "$PR_NUMBER" --rebase --match-head-commit "$approved_head_tip"
  ```

  Any compare-and-swap failure returns to Step 6; never fall through to merge or squash because of transient drift. After merge, fetch integration, verify its resulting tree equals the approved expected tree, confirm no Release workflow ran, keep `redesign-lifecycle-engine` active, and report local/repository/PR/merge/release/archive closure separately.
