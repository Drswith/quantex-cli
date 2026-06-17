## Context

`executeCommandWithRuntime` defers `cancelCliContextOperations()` until after `waitForLateSuccessfulCompletion()` fails. `runInstallForRunWithTimeout` added the same grace wait but still cancels in the timeout timer callback, defeating late success for real managed installs.

## Goals / Non-Goals

**Goals**

- Align exec/shortcut install timeout cancellation order with management commands.
- Keep concrete `ok: false` results when primary work finishes with a terminal failure after the deadline fires.
- Add tests that observe the `cancelled` flag during late-success windows.

**Non-Goals**

- Changing grace duration or adding late-success grace to spawned agent execution.
- Reworking concurrent idempotency locking.

## Decisions

- Move the timeout error message to after grace failure, matching management-command emission order.
- In `runUntilTimeoutCancellation`, return the terminal failure result from `run()` even when `cancelled` is already set; reserve timeout substitution for thrown errors during cancelled execution.

## Risks / Trade-offs

- Installs that genuinely exceed the deadline wait an additional `min(timeoutMs, 250)` ms before subprocess cancellation, matching management-command behavior.
