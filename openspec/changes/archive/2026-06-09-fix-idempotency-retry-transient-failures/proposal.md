## Why

`--idempotency-key` is documented for safe automation retries on mutating commands, often combined with `--timeout`. The runtime currently persists every command result—including `TIMEOUT`, `CANCELLED`, and other failures—for 24 hours. A transient failure therefore blocks legitimate retries with the same key, breaking the advertised retry contract.

## What Changes

- Persist idempotency records only for successful (`ok: true`) command results.
- Leave transient failures (`TIMEOUT`, `CANCELLED`, install/update errors, lock contention) retryable with the same key.
- Add regression coverage for timeout + idempotency replay behavior.

## Capabilities

### New Capabilities

- `cli-idempotency`: define when mutating commands persist and replay idempotency records.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/command-runtime.ts`, `test/command-runtime.test.ts`.
- Affected docs/skills: behavior now matches existing automation guidance that pairs `--idempotency-key` with `--timeout`.
- No schema version, command catalog, or dependency changes are intended.
