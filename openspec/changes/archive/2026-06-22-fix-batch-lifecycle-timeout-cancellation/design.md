## Context

Management commands wrap lifecycle work in `executeCommandWithRuntime`, which races the primary `run()` promise against a timeout deadline. When the deadline wins, Quantex emits a forced `TIMEOUT` result and marks the CLI context as cancelled, but the original `run()` promise is not awaited to completion. Batch install and update paths iterate sequentially and were written to continue after per-agent failures, not after global cancellation.

## Goals / Non-Goals

**Goals**

- Prevent later batch lifecycle items from running after timeout or signal cancellation.
- Prevent cancelled operations from persisting normal installed-agent state.
- Keep the fix narrow and reuse the existing `cancelled` context flag.

**Non-Goals**

- Reworking concurrent idempotency locking.
- Changing exec/shortcut spawn semantics beyond existing cancellation behavior.
- Adding process-group termination for script installs.

## Decisions

1. **Check `getCliContext().cancelled` in batch loops** before starting the next install/update item and after each awaited item completes.
2. **Guard `persistInstalledState` and `trackInstalledAgent`** so a late-finishing installer cannot write state after cancellation; roll back managed installs when package work already succeeded.
3. **Leave the runtime timeout race unchanged** and stop side effects in lifecycle code paths instead of trying to abort arbitrary in-flight promises.

## Risks / Trade-offs

- Partial batch results may remain in memory while the forced timeout result is what callers observe. This is acceptable because post-cancellation structured output is already suppressed unless forced.
- A long-hanging install can still hold the lifecycle lock until it unwinds. That is a separate follow-up and not introduced by this change.
