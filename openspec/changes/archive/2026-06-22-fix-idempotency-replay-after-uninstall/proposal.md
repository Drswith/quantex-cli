## Why

Successful `install`, `ensure`, or `update` idempotency records survive `uninstall` and manual agent removal. A later retry with the same `--idempotency-key` replays the stored success without re-running lifecycle work, so automation believes an agent is installed when it is not.

## What Changes

- Skip idempotency replay when a stored agent lifecycle success no longer matches the current installed state.
- Apply the same stale-state guard for successful `uninstall` replays when the agent is present again.
- Add regression tests for install replay after uninstall and uninstall replay after reinstall.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cli-idempotency`: define stale-state invalidation rules for agent lifecycle replay.

## Impact

- Affected code: `src/command-runtime.ts`, `test/command-runtime.test.ts`, `openspec/specs/cli-idempotency/spec.md`.
- No CLI flags, schema version, or command catalog changes.
