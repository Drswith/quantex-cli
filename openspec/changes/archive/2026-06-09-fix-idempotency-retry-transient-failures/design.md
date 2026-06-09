## Context

Idempotency replay is implemented in `executeCommandWithRuntime()` via `storeIdempotentResult()`. Today it writes every emitted result, including errors surfaced by timeout and cancellation paths.

## Decision

Only call `saveIdempotencyRecord()` when `result.ok === true`.

Action-mismatch protection for an existing key remains unchanged. Successful completions continue to replay for the TTL window.

## Alternatives Considered

- Store failures with a `retryable` flag: rejected as extra contract surface without a consumer.
- Shorten TTL for failures: rejected because it still blocks near-term retries and contradicts documented usage.

## Risks

- Clients that relied on replaying stored failures will now re-execute the command. That behavior was undocumented and conflicts with automation playbooks; the fix aligns implementation with docs.
