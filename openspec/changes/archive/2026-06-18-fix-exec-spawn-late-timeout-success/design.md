## Context

`runInstallForRunWithTimeout` waits up to `min(timeoutMs, 250)` after the install deadline before cancelling managed installers. `runSpawnedAgentProcess` still calls `cancelCliContextOperations()` immediately when the spawn timeout fires, so a successful agent exit that lands just after the deadline is reported as `TIMEOUT`.

## Goals / Non-Goals

**Goals**

- Align exec and shortcut spawn timeout semantics with install and management-command late-success handling.
- Preserve immediate cancellation for signals and for spawns that genuinely exceed the deadline plus grace window.

**Non-Goals**

- Changing the grace duration globally.
- Reworking signal handling during the grace window.

## Decisions

- Reuse the same `min(timeoutMs, 250)` grace window as install and `command-runtime.ts`.
- Race spawn completion against a timeout marker, then wait for late terminal completion before cancelling.
- Clear the CLI cancellation flag when spawn succeeds after the deadline so the returned exit code reflects the agent process.

## Risks / Trade-offs

- A timeout error may still be emitted only after the grace window expires, matching install timeout behavior.
