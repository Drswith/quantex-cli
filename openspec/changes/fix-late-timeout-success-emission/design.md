## Context

`executeCommandWithRuntime()` races primary work against a timeout promise. When the timeout wins, `resolveTimeoutCancellation()` immediately marks the CLI context cancelled and force-emits `TIMEOUT`. A short grace window can still upgrade the in-memory result to success, but structured output and cancellation state are already committed.

## Goals / Non-Goals

**Goals:**

- Keep stdout/ndjson output, returned result, exit code, and idempotency persistence aligned for late-success timeout completions.
- Preserve existing true-timeout and signal-cancellation behavior.

**Non-Goals:**

- Changing the grace-window duration.
- Unifying timeout semantics between `command-runtime` and `quantex <agent>` install-on-run paths.

## Decisions

1. **Split timeout resolution from emission.** Build a timeout error result when the deadline fires, wait through the grace window, then emit cancellation side effects only if the command still has not succeeded.
2. **Do not mark `cancelled` before the grace window ends** when evaluating late success, so command handlers can still emit their successful structured result normally.

## Risks / Trade-offs

- True timeouts are reported up to `min(timeoutMs, 250ms)` later than today. This matches the existing grace semantics and only affects already-slow commands.
