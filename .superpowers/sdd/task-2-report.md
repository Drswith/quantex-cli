# Phase 7 Task 2 Report

## Status

DONE

Implemented the verified single-agent lifecycle update application service and routed only the single-agent `update` facade through it. `update --all` remains on the legacy batch path for Task 3. No Task 4 idempotency work or OpenSpec checkbox edits were made.

## Commits

- `76fd58e` `refactor(update): add verified lifecycle update service`
- `2435975` `refactor(update): bind verified single-agent updates`
- `9b4c2f7` `test(update): bind v1 goldens to recorded source`
- `a78aa03` `fix(update): preserve lifecycle update locking`
- `70676b8` `fix(update): close verified update invariants`

Base: `50f16105569de6c6b1c7ef5f9cc5bd85fb15c0f5`.

## RED / GREEN Evidence

### RED

1. `bun run test -- test/services/lifecycle-updates.test.ts test/commands/update.test.ts`
   - Failed because `src/services/lifecycle-updates.ts` did not exist.
2. Command postcondition regression test
   - Failed because `src/services/lifecycle-updates-production.ts` did not exist.
3. Fresh conflicting-source verification test
   - Failed because a target-version match was accepted despite `conflicting-source` drift.
4. V1 compatibility suite
   - Failed because the old single-update fixture did not provide confirmed recorded provider evidence.
5. Production lifecycle lock test
   - Failed because the production provider binding did not preserve `withAgentLifecycleLock`.
6. Reviewer follow-up RED cases
   - Persisted/live binding mismatch was planned instead of blocked.
   - `respect-semver` update options were not passed to the provider.
   - Cancellation after provider success continued into fresh observation.
   - The lifecycle lock did not cover fresh observation and receipt persistence.

### GREEN

- Focused service and command tests: 42/42 passed.
- Expanded update, observation, compatibility, and reconciliation tests: 91/91 passed.
- Brief compatibility command:
  - `bun run test -- test/services/lifecycle-updates.test.ts test/commands/update.test.ts test/compatibility/v1-baseline.test.ts test/lifecycle/reconcile.test.ts`
  - Passed before reviewer fixes; expanded equivalent passed after fixes.
- Full suite after all review fixes:
  - `bun run test`
  - 108 test files passed, 1141 tests passed.
- Static validation:
  - `bun run lint` passed.
  - `bun run format:check` passed.
  - `bun run typecheck` passed.

One earlier full-suite run timed out in the unrelated fake-timer reminder test (`command-runtime.test.ts`). The exact test passed 1/1 in isolation, and two later full-suite runs passed completely (1137 tests before review fixes and 1141 tests after fixes). No unrelated test file was changed.

## Files

- Added `src/services/lifecycle-updates.ts`.
- Added `src/services/lifecycle-updates-production.ts`.
- Added `test/services/lifecycle-updates.test.ts`.
- Added `test/services/lifecycle-updates-production.test.ts`.
- Modified `src/commands/update.ts`.
- Modified `src/services/update.ts`.
- Modified `src/lifecycle/model.ts`.
- Modified `src/lifecycle/index.ts`.
- Modified `src/lifecycle/agent-observation.ts` to expose normalized persisted binding evidence.
- Modified `src/state/index.ts` and `src/state.ts` to expose the lifecycle receipt store binding.
- Modified `test/commands/update.test.ts`.
- Modified `test/compatibility/v1-baseline.test.ts` without changing golden payloads.

## Self-review

- The core service imports domain/provider types and pure version comparison only. It does not import concrete state, first-party providers, CLI context, output, commands, or presenters.
- Production-only bindings own first-party provider registry, observation service, config, lifecycle lock, receipt store, clock, dry-run, cancellation, and timeout wiring.
- Planning requires normalized persisted binding, live binding, and observation provider identity to agree before target resolution.
- Execution invokes only the planned binding and retains the configured npm/Bun update strategy.
- The lifecycle lock covers provider mutation, fresh observation, semantic target-or-newer verification, and receipt persistence.
- Cancellation is checked before mutation, after provider success, and after fresh observation. No receipt is written on cancellation, timeout, provider failure, source conflict, stale/downgraded version, or verification failure.
- Receipt creation uses the same provider/target binding and happens only after successful verification.
- Single-command mapping preserves v1 statuses, envelopes, events, dry-run behavior, lock mapping, and goldens. Managed provider failures no longer receive the manual-install homepage hint.
- Batch update code remains unchanged in behavior and routing.

## Independent review

The initial read-only review found no Critical issues and four Important issues: incomplete lock scope, missing npm/Bun update strategy, insufficient independent persisted-binding comparison, and a cancellation-to-receipt race. It also found one Minor managed-failure hint regression. All five findings were addressed in `70676b8`. The follow-up read-only review confirmed zero remaining Critical or Important issues and returned `Ready`.

### Critical lock composition follow-up

- A later production-composition review found that `withAgentLifecycleLock` was wired twice: once around the provider adapter's `update` operation and again as the application service's outer `withMutationLock`. Because the lifecycle lock is non-reentrant, the outer lock could self-deadlock when provider update tried to acquire it again.
- RED: the production composition regression failed with `non-reentrant lifecycle lock acquired twice` before fresh observation or receipt persistence.
- Fix: the production composition now injects the first-party provider registry directly and retains only the application service's outer lock, which covers provider mutation, fresh observation, verification, and receipt persistence.
- GREEN: the regression completed with one lock acquisition and the ordered trace `update -> fresh observation -> receipt` inside that lock.

## Concerns and Closure

- CodeGraph was not initialized in this worktree. Per repository instructions it was not initialized without approval; exploration used only the Task 1 commit diff and explicit known file paths.
- The parent-owned dirty `.superpowers/sdd/task-2-brief.md` was preserved and excluded from every commit.
- OpenSpec remains active and unchanged; Task 2 checkboxes were intentionally not edited.
- Repository delivery is complete locally with checkpoint commits and a clean implementation diff apart from the parent dirty brief and this report before its report commit.
- Remote push, PR, merge, release, and OpenSpec archive closure were not requested for this delegated task and remain pending at the parent integration level.
