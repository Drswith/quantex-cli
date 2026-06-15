## Context

`executeCommandWithRuntime` races install work against `--timeout`, cancels managed subprocesses on expiry, then waits up to `min(timeoutMs, 250)` for a late successful completion before returning `TIMEOUT`. `runInstallForRunWithTimeout` in `src/commands/run.ts` races the same way but returns `'timeout'` immediately with no grace window.

## Goals / Non-Goals

**Goals**

- Align exec and shortcut install timeout semantics with management commands for late successful completions.
- Keep the existing cancellation behavior for installs that genuinely exceed the deadline.

**Non-Goals**

- Changing the grace duration or timeout cancellation model globally.
- Adding idempotency support to exec install flows.

## Decisions

- Reuse the same `min(timeoutMs, 250)` grace window as `command-runtime.ts` so behavior stays consistent across surfaces.
- After the timeout branch fires, wait for the in-flight install promise to resolve successfully within the grace window before returning exit code `10`.
- Clear the CLI cancellation flag when install succeeds after a timeout so the subsequent agent spawn is not treated as cancelled.

## Risks / Trade-offs

- A timeout error message may be printed before a late success is recognized, matching current management-command behavior.
