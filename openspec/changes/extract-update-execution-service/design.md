## Context

`src/services/update.ts` already classifies inspections into up-to-date, manual, untracked, grouped managed, and fallback entries. The command then executes that plan while reading global CLI state, invoking package-manager operations, interpreting lifecycle locks, verifying self-updates, and emitting progress events. This mixes lifecycle execution with public output mapping and makes the execution contract difficult to test directly.

## Goals / Non-Goals

**Goals:**

- Move update-plan execution into a focused, directly testable service.
- Preserve grouped execution order, fallback behavior, cancellation, dry-run, lock details, failure hints, and self-update verification.
- Keep public output construction and rendering in the command.

**Non-Goals:**

- Changing update planning or agent update strategy selection.
- Changing package-manager adapter return types, concurrency, lifecycle lock scope, or installer behavior.
- Changing command schemas, result shapes, messages, or exit behavior.
- Refactoring the self-upgrade subsystem or catalog loading in this change.

## Decisions

### Consume the existing plan without introducing another planner

Create `executePlannedUpdates(plan, options, dependencies)` in `src/services/update-execution.ts`. The service consumes `PlannedAgentUpdates` and returns ordered results plus a failure flag. `src/services/update.ts` remains the sole owner of plan construction.

### Make runtime policy explicit

The command passes `dryRun`, `isCancelled`, and an optional `onProgress` callback. The service does not read CLI context, output mode, or user-output globals. This keeps cancellation and dry-run behavior testable without changing when the command observes them.

### Keep output transport in the command

The service returns domain result items and may include existing domain guidance such as manual-update messages and failure hints. It does not create `CommandResult` values or NDJSON events. The command maps progress callbacks and terminal execution state to the existing public contract.

### Preserve dynamic default dependencies

Default dependencies are resolved when `executePlannedUpdates` is called rather than captured at module initialization. This preserves the existing test seams and keeps direct injection available for service tests.

## Risks / Trade-offs

- **Risk: Ordered results or cancellation checkpoints drift during extraction.** → Add direct tests for initial classifications, grouped execution, fallback, and cancellation before moving implementation.
- **Risk: Output events change when progress moves behind a callback.** → Keep event construction in the command and retain command-level structured-output tests.
- **Risk: Self-update verification changes success classification.** → Test both unchanged and changed verified versions in the service.
- **Trade-off: Adapter operations still return booleans.** → Rich adapter errors remain a later, separately specified concern.

## Migration Plan

1. Add failing direct tests for execution outcomes and explicit options.
2. Implement the service using the existing planner and package-manager contracts.
3. Replace command-local execution functions with service invocation and progress mapping.
4. Run focused command/service tests and full repository validation.

Rollback restores command-local execution and deletes the service; no state or data migration is involved.

## Open Questions

None.
