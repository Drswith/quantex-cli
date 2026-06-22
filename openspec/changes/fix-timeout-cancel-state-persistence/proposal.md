## Why

The late-completion grace window for `--timeout` races the full `installAgent()` promise, but cancellation can fire while `persistInstalledState()` is still writing `state.json` after the managed subprocess has already exited. Quantex then returns `TIMEOUT` (exit 10) while the agent is recorded as installed, violating the managed cancellation contract and confusing automation.

## What Changes

- Guard managed install/update state persistence when CLI context is already cancelled.
- Roll back the managed install when persistence is skipped due to cancellation.
- Add regression tests for the post-subprocess persistence race.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: cancelled managed install/update operations must not persist normal installed-agent state.

## Impact

- Affected code: `src/package-manager/index.ts`, `test/package-manager/index.test.ts`, `test/commands/run.test.ts`.
- No CLI flags, schema version, or command catalog changes.
