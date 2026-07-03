## Why

When a managed install subprocess exits successfully but the CLI context is already cancelled, `waitForSpawnedCommand()` reports failure. `installAgent()` treats that as a failed method attempt and continues to the next install method without rolling back the package that was just installed on disk, leaving duplicate globals and inconsistent state.

## What Changes

- Stop install method fallback when the CLI context is cancelled.
- Roll back the current managed install method when cancellation turns a successful subprocess exit into a reported failure.
- Add regression tests covering cancellation after a successful managed install subprocess exit.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: cancelled managed installs must not fall through to later install methods and must roll back packages installed by the cancelled attempt.

## Impact

- Affected code: `src/package-manager/index.ts`, `test/package-manager/index.test.ts`.
- No CLI flags, schema version, or command catalog changes.
