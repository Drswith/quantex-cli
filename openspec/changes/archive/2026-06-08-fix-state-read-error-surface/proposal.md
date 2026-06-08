## Why

Recent fail-closed `state.json` validation correctly throws `StateFileError` on corrupt or semantically invalid persisted state, but lifecycle commands still let that exception escape the CLI runtime. The result is an unhandled stack trace instead of a structured command error, which violates the `quantex-state` contract and breaks `--json` automation on corrupt state.

## What Changes

- Surface corrupt or invalid persisted state as a stable CLI error (`STATE_READ_ERROR`) instead of crashing.
- Centralize `StateFileError` handling in the command runtime and shortcut agent execution path.
- Add regression tests for human and JSON output when `state.json` is unreadable or invalid.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `quantex-state`: lifecycle commands that load persisted state must fail with a state read error instead of crashing.

## Impact

- `src/command-runtime.ts`
- `src/cli.ts`
- `src/errors.ts`
- `src/utils/lifecycle-errors.ts`
- `test/commands/state-read-error.test.ts`
