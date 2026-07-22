# Task 1 Report: Live Agent Lifecycle Observer

## Result

Implemented OpenSpec `redesign-lifecycle-engine` task `5.1` only. The new read-only observer combines PATH/version facts, installed-state provenance, lifecycle receipts, exact provider evidence, registry-derived capabilities, and normalized catalog bindings into `LifecycleObservation` without importing or invoking a state mutator.

## RED evidence

- Command: `bun run test -- test/lifecycle/agent-observation.test.ts`
- Expected failure: exit `1`; Vitest reported `Cannot find module '../../src/lifecycle/agent-observation'` at the observer import because the observer module/API did not exist.
- Test-load correction: after production implementation began, the table fixture exposed a test-only TDZ (`Cannot access 'receipt' before initialization`). The constants were moved above the table without changing production code, then the behavior matrix ran normally.
- Review RED cycles:
  - 3 failures reproduced missing conflict handling for multiple live candidates with PATH absent, an unresolvable persisted receipt binding, and recorded executable-path drift.
  - 1 failure reproduced acceptance of provider evidence for a different target identity.
- Important review-fix RED cycles were rerun against isolated checkpoint `2a7218d` with only the new tests applied:
  - `-t "keeps conclusive multiple-live conflict ahead of another candidate failure"` failed because the observer returned `indeterminate` instead of the already-conclusive `present` / `conflicting-source` result.
  - `-t "normalizes a persisted provider adapter rejection to indeterminate"` failed with an escaped `Error: bun adapter rejected`.
  - `-t "normalizes a catalog candidate adapter rejection to indeterminate"` failed with the same escaped adapter rejection on the no-state candidate path.
  - `-t "fails closed for an unresolved"` failed for both brew and winget because each unresolved candidate was silently filtered and the observer returned `present` instead of `indeterminate`.

## GREEN and regression evidence

- Observer matrix: `bun run test -- test/lifecycle/agent-observation.test.ts` -> 1 file, 17 tests passed.
- Final focused gate: `bun run test -- test/lifecycle/agent-observation.test.ts test/lifecycle/provider-evidence.test.ts test/state.test.ts` -> 3 files, 38 tests passed.
- Review-fix GREEN: observer matrix -> 1 file, 22 tests passed.
- Review-fix final focused gate: `bun run test -- test/lifecycle/agent-observation.test.ts test/lifecycle/provider-evidence.test.ts test/state.test.ts` -> 3 files, 44 tests passed.
- Equivalent catalog candidates are explicitly covered: duplicate bindings deduplicate to one binding and do not create a false unresolved-candidate signal.
- `bun run format:check` -> passed.
- `bun run lint` -> 0 warnings, 0 errors.
- `bun run typecheck` -> passed.

## Modified files

- `src/lifecycle/agent-observation.ts` (new)
- `test/lifecycle/agent-observation.test.ts` (new)
- `src/lifecycle/model.ts`
- `src/lifecycle/index.ts`
- `src/lifecycle/provider-evidence.ts`
- `test/lifecycle/provider-evidence.test.ts`

## Checkpoint commit

- `2a7218d7122ad7936e5f73b117598bbfcfd40273` — `feat(lifecycle): observe live agent evidence`
- Review-fix delivery uses a new commit, `fix(lifecycle): fail closed on incomplete provider evidence`; it does not amend the checkpoint.

## Self-review

- Scope is limited to Task 1 / OpenSpec 5.1; no planner, command migration, OpenSpec checkbox, or Task 2+ file was changed.
- Persisted state and receipts are provenance only; invalid bindings fail closed and never fall back to invented provider ownership.
- Exact provider ID, target ID/kind, executable name/path, PATH presence, and typed provider outcomes participate in drift classification.
- With no persisted binding, every platform catalog candidate is observed: one live candidate can establish untracked ownership, multiple live candidates conflict, and any unresolved probe is indeterminate.
- Conclusive target mismatch and multi-provider conflict take precedence over other failed candidate probes; only unresolved evidence that prevents a conclusion becomes `indeterminate`.
- Provider adapter rejection is caught at the observer boundary and normalized into a typed `failed` provider outcome plus domain `indeterminate` observation on both persisted-binding and no-state candidate paths.
- Unresolvable managed candidates remain explicit evidence and fail closed without confusing legitimate duplicate bindings with missing normalization.
- The ports expose reads only. The test supplies a throwing `mutateState` sentinel and proves it is never called in every table row.
- Drift kinds remain exhaustive: `none`, `untracked`, `recorded-absent`, `conflicting-source`, and `indeterminate`.

## Concerns and closure

- CodeGraph was not initialized in this worktree, so structural exploration used narrow source reads instead; no index initialization was performed.
- The checkpoint commit intentionally contains the five implementation/test files. This report and the shared SDD progress file were updated after commit so the report could contain the actual immutable commit SHA.
- The review-fix commit includes the controller-maintained `.superpowers/sdd` brief, progress, and report updates so coordination evidence is preserved with the fix.
- OpenSpec remains active at 30/74 by instruction; task checkbox unchanged. No push, PR, release, merge, or archive action was requested for this checkpoint.
- Independent re-review approved Task 1 with no Critical or Important findings. The controller reran the 44-test focused gate plus format, lint, and typecheck successfully.
- The controller checked first-party provider observation paths: they perform local executable/package presence and installed-version probes; latest-version network resolution is a separate operation and is not invoked by this observer.

## Task 1A: Update v1 Compatibility Goldens

### Result

- Captured deterministic current-base update output for single-agent and `--all` in JSON and NDJSON.
- JSON locks the single result envelope; NDJSON locks `started`, `progress`, and `result` ordering and payloads.
- All four fixtures lock exit code `0`, stdout payloads, and empty stderr routing.
- Normalization is limited to run ID, timestamp, and the Quantex self version; installed/latest agent versions remain exact.
- Production source is unchanged from milestone base `d2d2275` (`git diff --quiet d2d2275 -- src` exited `0`).

### Validation

- `bun run test -- test/compatibility/v1-baseline.test.ts` -> 1 file, 13 tests passed.
- `bun run format:check` -> passed.
- `bun run lint` -> 0 warnings, 0 errors.
- `bun run typecheck` -> passed.

### Checkpoint commit

- `54c456b` — `test(update): capture v1 compatibility goldens`
- Commit scope is exactly `test/compatibility/v1-baseline.test.ts` plus the four `test/fixtures/compatibility/v1/update-*` files.

### Concerns

- CodeGraph is not initialized in this worktree; narrow reads of the known output implementation confirmed structured JSON/NDJSON uses `console.log` for stdout. No CodeGraph initialization was performed.
- `.superpowers/sdd/task-1-brief.md` and this report remain outside the golden commit by instruction.

## Task 1B: Pure Semantic Update Planner

### Result

- Added the pure `planLifecycleUpdate` decision model with `upgrade`, `up-to-date`, `blocked-downgrade`, `indeterminate`, `manual-required`, and `blocked-source` outcomes.
- Automatic upgrade plans require exact observed provider ID, provider target ID/kind, and matching provider capability evidence; no provider source is guessed from a PATH-only observation.
- Upgrade plans declare the reconciled provider's observe, update, and verify capabilities, target the provider-bound package identity, and require the resolved semantic version postcondition.
- Adapted the v1 update-availability projection to semantic ordering when both versions are available, preventing stale lower and unparseable targets from being treated as updates without routing commands through the Task 2 lifecycle executor.
- Step 1 goldens from `54c456b` were not modified, command production routing was not changed, and OpenSpec checkboxes remain unchanged.

### RED evidence

- Initial planner RED: `bun run test -- test/lifecycle/update-planner.test.ts test/utils/version.test.ts` -> planner file 16/16 failed with `TypeError: planLifecycleUpdate is not a function`; version file 29/29 passed.
- Legacy semantic projection RED: `bun run test -- test/lifecycle/update-planner.test.ts` -> stale lower, unparseable target, and missing target cases demonstrated the old inequality/fallback behavior.
- Review-fix RED: `bun run test -- test/lifecycle/update-planner.test.ts` -> 6 failures proved missing provider identity was accepted, observe/verify effects were undeclared, and the provider capability projection API did not exist.

### GREEN and validation evidence

- Final focused gate: `bun run test -- test/lifecycle/update-planner.test.ts test/utils/version.test.ts test/commands/update.test.ts test/agent-update.test.ts` -> 4 files, 85 tests passed.
- Planner review-fix matrix: `test/lifecycle/update-planner.test.ts` -> 25 tests passed, including exact provider identity and `validateLifecyclePlan` capability projection.
- `bun run lint` -> 0 warnings, 0 errors.
- `bun run format:check` -> passed.
- `bun run typecheck` -> passed.
- `bun run openspec:validate` -> 16 items passed, 0 failed.
- Full suite reached 1111/1112 twice; the same unrelated `test/command-runtime.test.ts` fake-timer throttle test timed out only under full-suite concurrency. Its exact focused rerun passed 1/1.

### Checkpoint commit

- `41ce213` — `refactor(update): add semantic lifecycle planning`
- Commit scope is exactly the five Task 1B production/test files; this controller-owned report and brief remain outside the production commit.

### Review and concerns

- Independent review found no Critical issues. Exact provider reconciliation and the raw provider-operation to qualified lifecycle-capability contract were fixed before final checkpointing.
- Independent re-review of `41ce213` returned Ready Yes with no Critical or Important findings.
- The pure planner classifies either missing version as `indeterminate` with no mutation steps. The legacy v1 projection preserves its pre-existing missing-version fallback because pip/uv/deno and self-update command routes intentionally resolve `latest` inside the provider; changing that fallback in Task 1B caused 10 command regression failures and would cross the explicitly deferred Task 2 production-route boundary.
- CodeGraph is not initialized in this worktree. Per repository instructions it was not initialized without approval; exploration used narrow reads of brief-specified files.
- Full-suite fake-timer timeout is retained as a validation concern; no unrelated command-runtime code was changed.
- OpenSpec `redesign-lifecycle-engine` stays active; 1.3/7.1 checkboxes were not changed. No push, PR, merge, release, or archive action belongs to this subtask checkpoint.

## Task 1B Reviewer Fix: Fail Closed on Indeterminate Versions

### Result

- Removed the legacy projection's missing-version `true` fallback. Either missing installed or target version now remains non-mutating, and command planning reports the case as `manual-required` instead of `up-to-date` or executing an update.
- Added lifecycle target reconciliation: an observation whose `targetId` differs from the update intent returns `blocked-source` with no plan steps.
- Narrowed compatibility fixture normalization to `meta.version`; business payload fields named `version` remain exact.
- The four update golden fixtures introduced by `54c456b` were not modified.

### RED evidence

- `bun run test -- test/lifecycle/update-planner.test.ts test/compatibility/v1-baseline.test.ts` -> 4 expected failures: one target mismatch was incorrectly planned as `upgrade`, two missing-version projections returned `true`, and the compatibility normalizer replaced `data.version`.
- Command-route RED for indeterminate provider targets showed pip, uv, and deno entries were rendered as `up-to-date` rather than `manual-required` before the planning classification fix.

### GREEN and validation evidence

- Reviewer-required gate: `bun run test -- test/lifecycle/update-planner.test.ts test/utils/version.test.ts test/commands/update.test.ts test/agent-update.test.ts test/compatibility/v1-baseline.test.ts` -> 5 files, 101 tests passed.
- `bun run lint` -> 0 warnings, 0 errors.
- `bun run format:check` -> passed.
- `bun run typecheck` -> passed.
- `bun run openspec:validate` -> 16 items passed, 0 failed.

### Commit

- `ba36b88fb114f42a2bdcedeb1ce35202f27a93ec` — `fix(update): fail closed on indeterminate versions`
- This is a new commit based on `41ce213`; it does not amend the checkpoint.
- The production commit contains only the five source/test files. This report remains outside the production commit.

### Concerns

- Full `bun run test` exposed the existing `test/command-runtime.test.ts` fake-timer reminder test timing out at its 5-second limit; the reviewer-required 101-test gate passes, and no command-runtime or self-update-notice production path was changed.
- CodeGraph was not initialized in this worktree. Initialization was explicitly declined, so the fix used narrow reads of the known files.
- OpenSpec `redesign-lifecycle-engine` remains active and unarchived; no push, PR, merge, release, or archive action was requested for this reviewer-fix checkpoint.

## Task 1B Reviewer Fix: Preserve Indeterminate Plan Outcomes

### Result

- `createUpdatePlan` now consumes the semantic update decision directly instead of collapsing it through the boolean availability projection.
- Non-empty but unparseable installed or target versions remain `indeterminate` and are routed to `skippedManualCheck`, producing `manual-required` command results with no mutation.
- Semantic `upgrade`, `up-to-date`, and blocked-downgrade behavior remains unchanged.
- The four update golden fixtures introduced by `54c456b` were not modified.

### RED and GREEN evidence

- RED: table-driven `createUpdatePlan` cases for installed `main` / target `1.0.0` and installed `1.0.0` / target `latest` both failed because `skippedManualCheck` was empty and the inspections landed in `upToDate`.
- Focused GREEN: both new classification cases passed after routing the semantic decision.
- Reviewer-required gate: `bun run test -- test/lifecycle/update-planner.test.ts test/utils/version.test.ts test/commands/update.test.ts test/agent-update.test.ts test/compatibility/v1-baseline.test.ts` -> 5 files, 103 tests passed.
- `bun run lint` -> 0 warnings, 0 errors.
- `bun run format:check` -> passed.
- `bun run typecheck` -> passed.

### Commit and concerns

- `bd33df7` — `fix(update): preserve indeterminate plan outcomes`; new commit after `ba36b88`, not an amend.
- Production commit scope is only `src/planning/updates.ts` and `test/lifecycle/update-planner.test.ts`; this report remains uncommitted.
- Existing `.superpowers/sdd/task-1-brief.md` trailing-whitespace warning remains outside the staged/committed scope.
- OpenSpec remains active and unarchived; no push, PR, merge, release, or archive action was requested.
