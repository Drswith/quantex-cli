# Task 2 Report: Deterministic Observation Planning

## Result

Implemented OpenSpec `redesign-lifecycle-engine` task `5.2` only. The pure lifecycle planner now consumes an exact provider/target binding with a registry-derived capability snapshot and deterministically produces `satisfied`, `install`, `adopt`, `preserve-unmanaged`, `clear-ghost`, `uninstall`, `unsupported`, or `blocked` without executing the plan.

The provider planning context is optional only for compatibility with the already-migrated Phase 6 ensure/install/uninstall paths. Supplying the context enables fail-closed capability checks; an explicit empty capability list means the registry has confirmed that no mutation operation is supported.

## RED evidence

- Initial command: `bun run test -- test/lifecycle/mutation-planner.test.ts test/lifecycle/observation-planning.test.ts`
- Expected result: exit `1`; 2 of 20 tests failed because an absent target with an explicit empty capability snapshot still selected `install` and emitted a `bun-install` effect instead of selecting `unsupported` with no steps.
- Uninstall capability RED: `bun run test -- test/lifecycle/mutation-planner.test.ts -t 'tracked uninstall lacks'` exited `1`; the planner selected `uninstall` and emitted a `bun-uninstall` effect even though the provider snapshot exposed only `observe`.
- Exact-binding RED: `bun run test -- test/lifecycle/mutation-planner.test.ts -t 'different observed provider target'` exited `1`; the planner combined a Bun capability snapshot with an npm observation and emitted an npm uninstall step instead of blocking the contradictory inputs.

## GREEN and regression evidence

- Initial GREEN: planner focused tests passed, 2 files and 20 tests.
- Uninstall capability GREEN: targeted test passed, followed by 2 planner files and 21 tests passing.
- Exact-binding GREEN: targeted test passed, followed by 2 planner files and 22 tests passing.
- Pre-report focused gate: 6 files and 83 tests passed before the two self-review cases were added.
- Final focused gate: 6 files and 85 tests passed.
- Final `bun run format:check`, `bun run lint`, and `bun run typecheck` all passed; `git diff --check` also passed.

## Modified files

- `src/lifecycle/model.ts`
- `src/lifecycle/mutation-planner.ts`
- `test/lifecycle/mutation-planner.test.ts`
- `test/lifecycle/observation-planning.test.ts` (new)
- `.superpowers/sdd/task-2-report.md` (new)
- `.superpowers/sdd/progress.md`
- `.superpowers/sdd/task-2-brief.md` (approved Task 2 brief already present at task start)

## Deterministic matrix

The repeated table covers already-satisfied, absent, tracked, untracked with exact provider evidence, ghost, conflicting, unsupported, indeterminate, and untracked without provider evidence. Every row compares two complete results and asserts the plan ID, ordered steps, effects, and postconditions.

## Self-review

- The planner imports only lifecycle model types. It has no filesystem, process, provider adapter, console, output-envelope, or Commander dependency.
- Conflicting and indeterminate observations return `blocked` with no steps.
- A provider planning context that disagrees with observed provider ID, target ID, or target kind returns `blocked` rather than borrowing capabilities from another binding.
- Missing install or uninstall capability returns `unsupported` with no effects or postconditions.
- Provider mutation effects and package postconditions use one resolved provider/target pair, preventing mixed-provider plans.
- Existing Phase 6 callers continue to use their legacy provider ID/target fields and retain the previous mutation decisions when no capability snapshot is supplied.
- No command migration, plan execution, provider call, filesystem/process access, or OpenSpec checkbox change is included.

## Checkpoint

- Planned commit: `refactor(lifecycle): plan from live observations`
- Review state: implementation complete; independent review pending.
- OpenSpec state: `redesign-lifecycle-engine` remains active; task `5.2` checkbox intentionally unchanged.

## Important review fix: exact target kinds

Review found that `LifecyclePlanningProvider.targetKind` was optional and runtime comparison only considered kind when both observation and planning snapshot supplied it. A complete `brew/cask/demo` observation could therefore borrow an uninstall capability from a malformed `brew/demo` snapshot with no target kind.

### Review-fix RED evidence

- Command: `bun run test -- test/lifecycle/mutation-planner.test.ts -t 'target kind|legacy provider fields'`
- Expected result: exit `1`; the missing-kind runtime case selected `uninstall` and emitted a `brew-uninstall` effect instead of returning `blocked`. The explicit kind-mismatch and legacy compatibility rows already passed.
- Command: `bun run typecheck`
- Expected result: exit `2`; TypeScript reported an unused `@ts-expect-error`, proving that a new planning snapshot without `targetKind` was still accepted by the type.

### Review-fix GREEN evidence

- `LifecycleProviderTargetKind` is now derived from the present observation's canonical `providerTargetKind` field, and `LifecyclePlanningProvider.targetKind` is required.
- Runtime comparison now blocks whenever an observation declares a kind that differs from the snapshot, including malformed JS/cast input whose kind is missing.
- Targeted command: 1 file, 3 tests passed; 13 unrelated tests skipped.
- `bun run typecheck` passed, proving the missing-kind fixture is now rejected at compile time while the intentional `@ts-expect-error` is consumed.
- Legacy `providerId` / `providerTargetId` fields remain an independent compatibility path and do not require a planning target kind.
- Planned fix commit: `fix(lifecycle): require exact planning target kinds` (new commit; no amend).
- Independent re-review approved Task 2 with no Critical, Important, or Minor findings.
- The controller reran the full 6-file / 88-test focused gate. Its first run exposed two transient `install.test.ts` timing/order failures; the complete install file and both individual cases passed immediately in isolation, and the full 6-file gate then passed 88/88 with format, lint, and typecheck green. No planner-linked causal path or reproducible product regression was found.
