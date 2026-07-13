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
