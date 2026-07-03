## Context

`waitForSpawnedCommand()` intentionally returns exit code `1` when the CLI context is cancelled, even if the child already exited `0`. Managed installers such as Bun use this helper, so a timed-out or cancelled install can leave a package on disk while `executeMethod()` returns `false`.

`installAgent()` already rolls back when `executeMethod()` returns `true` and cancellation is observed before persistence. It does not handle the case where cancellation makes a successful install look like a failed method attempt.

## Goals / Non-Goals

- Goals: prevent duplicate global installs and orphaned packages when cancellation races a successful managed install subprocess exit.
- Non-Goals: redesign cancellation semantics, change batch command orchestration, or alter update/uninstall flows in this change.

## Decisions

- Check `getCliContext().cancelled` at the start of each install-method loop iteration and return failure immediately.
- When `executeMethod()` returns `false` and the context is cancelled, call `rollbackManagedInstall()` for the current method and return failure without trying later methods.
- Mirror the existing rollback helper used for post-success cancellation paths.

## Risks / Trade-offs

- Best-effort rollback on cancellation may call uninstall for a method whose install never completed; existing uninstall commands are already tolerant of absent packages.

## Migration Plan

- Patch release only; no migration required.

## Open Questions

- None.
