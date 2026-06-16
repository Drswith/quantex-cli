## Why

When a mutating command completes successfully shortly after the `--timeout` deadline, Quantex currently emits a `TIMEOUT` structured result (and `cancelled` ndjson event) while returning `ok: true` and exit code `0`. Automation that parses stdout sees failure while the shell sees success, breaking retry and orchestration contracts.

## What Changes

- Defer timeout cancellation side effects (context cancellation, ndjson `cancelled` event, and structured `TIMEOUT` result emission) until after the late-success grace window.
- When the primary work finishes successfully within the grace window, emit only the successful result and persist idempotency as today.
- Add regression tests that assert stdout, exit code, and returned result stay consistent for late-success timeout paths.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `cli-idempotency`: Clarify that late-success timeout completions must not emit transient `TIMEOUT` or `cancelled` output before the final successful result.

## Impact

- `src/command-runtime.ts`
- `test/command-runtime.test.ts`
- `openspec/specs/cli-idempotency/spec.md` (via archive follow-up after merge)
