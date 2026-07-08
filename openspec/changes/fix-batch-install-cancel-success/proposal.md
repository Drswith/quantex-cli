## Why

`quantex install <agent-a> <agent-b>` stops processing remaining agents when the CLI context is cancelled, but it can still return `ok: true` when the agents processed so far succeeded. Automation that treats success as a completed fleet install can miss agents that were never installed.

## What Changes

- Return a non-success result from batch `install` when cancellation interrupts processing before every requested agent completes.
- Add regression tests for cancellation during batch install and for timeout-wrapped batch install.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: batch `install` must report cancellation failure instead of overall success when processing stops early due to timeout or signal cancellation.

## Impact

- Affected code: `src/commands/install.ts`, `test/commands/install.test.ts`.
- No CLI flags, schema version, or command catalog changes.
