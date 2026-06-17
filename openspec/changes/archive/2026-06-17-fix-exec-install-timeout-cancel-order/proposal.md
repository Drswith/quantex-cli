## Why

PR #365 added a late-success grace window to exec install timeout handling, but `runInstallForRunWithTimeout` still calls `cancelCliContextOperations()` before the grace window. Managed installers register cancellation handlers, so real installs are killed before late success can be recognized. The existing regression test mocks `installAgent` and does not exercise cancellation.

A related management-command bug masks concrete install failures as `TIMEOUT` when the deadline fires while `run()` is returning `ok: false`.

## What Changes

- Defer exec/shortcut install cancellation until after the late-success grace window expires without success.
- Preserve the concrete failure result in `runUntilTimeoutCancellation` instead of substituting `TIMEOUT` after cancellation is marked.
- Add regression tests that fail when cancellation is applied before late-success recognition.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: exec and shortcut install late-success after `--timeout` must work with managed installers that honor cancellation.
- `cli-idempotency`: management commands must preserve concrete failure codes when the primary work returns `ok: false` after the deadline fires.

## Impact

- Affected code: `src/commands/run.ts`, `src/command-runtime.ts`, `test/commands/run.test.ts`, `test/command-runtime.test.ts`.
- No CLI flags, schema version, or command catalog changes.
