## Why

`quantex update --all` stops processing remaining agents when the CLI context is cancelled, but it can still return `ok: true` when the agents processed so far succeeded. Automation that retries on failure or treats success as a completed fleet update can miss agents that were never updated.

## What Changes

- Return a non-success result from `update --all` when cancellation interrupts batch processing before every planned update completes.
- Add regression tests for cancellation during batch update and for timeout-wrapped `update --all`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: batch `update --all` must report cancellation failure instead of overall success when processing stops early due to timeout or signal cancellation.

## Impact

- Affected code: `src/commands/update.ts`, `test/commands/update.test.ts`.
- No CLI flags, schema version, or command catalog changes.
