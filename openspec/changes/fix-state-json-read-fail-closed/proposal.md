## Why

`state.json` read failures currently fall back to an empty default state. The next mutate/write then overwrites a previously valid file, silently wiping all recorded `installedAgents` and `self` data. This can follow truncated writes, parse errors, or transient I/O failures.

## What Changes

- Treat a missing `state.json` as empty state (unchanged).
- Treat unreadable or invalid `state.json` as a hard read failure instead of empty state.
- Write `state.json` atomically via a temporary file and rename.
- Add regression tests for corrupt-state fail-closed behavior and atomic write.

## Capabilities

### New Capabilities

- `quantex-state`: durable local state read/write integrity for `state.json`.

### Modified Capabilities

- (none)

## Impact

- `src/state/index.ts`
- `test/state.test.ts`
- Commands that mutate state will surface errors when `state.json` is corrupt instead of wiping it.
