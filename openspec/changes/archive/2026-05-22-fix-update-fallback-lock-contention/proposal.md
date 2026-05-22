## Why

When a grouped managed update cannot complete and Quantex falls back to per-agent updates, the current fallback runs those updates concurrently. Each per-agent update acquires the same lifecycle lock, so one fallback can proceed while the rest are reported as locked even though they are in the same Quantex process.

## What Changes

- Execute grouped managed update fallback work one agent at a time after the grouped installer path returns failure.
- Preserve existing grouped update success behavior, dry-run behavior, and external lock handling.
- Add regression coverage for multi-agent fallback so agents are not skipped or falsely reported as locked because of local lock contention.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Clarify that grouped update fallback must produce per-agent outcomes without self-inflicted lifecycle lock contention.

## Impact

- Affected code: `src/commands/update.ts`.
- Affected tests: `test/commands/update.test.ts`.
- No new dependencies or breaking changes.
