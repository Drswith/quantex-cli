## Why

Idempotency replay currently matches only the action name, so reusing the same `--idempotency-key` for a different agent replays the wrong successful result without installing the requested agent. Separately, when a mutating command finishes successfully just after the timeout deadline fires, the runtime reports `TIMEOUT` even though the mutation succeeded, breaking automation retries and leaving durable side effects untracked by idempotency.

## What Changes

- Require idempotency replay to match the stored target as well as the action; mismatched targets execute fresh work instead of replaying.
- Honor successful command results even when the timeout cancellation flag was set after the primary work completed.
- Add regression tests for both failure modes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cli-idempotency`: require target-aware replay matching and document timeout-success precedence over stale cancellation.

## Impact

- Affected code: `src/command-runtime.ts`, `test/command-runtime.test.ts`, `openspec/specs/cli-idempotency/spec.md`.
- No CLI flags, schema version, or command catalog changes.
