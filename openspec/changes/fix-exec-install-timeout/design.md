## Context

Management commands route through `executeCommandWithRuntime`, which races the full command body against `--timeout` and calls `cancelCliContextOperations()` on expiry. Managed installers register cancellation handlers through `spawnWithQuantexStdio`, so subprocess trees are terminated.

`runCommand` bypasses that runtime wrapper. It already enforces timeout while waiting for the spawned agent binary, but `tryInstallForRun()` awaits `installAgent()` without a deadline.

## Decision

Reuse the same timeout semantics as `runSpawnedAgentProcess()` inside `runCommand` for install work:

- When `timeoutMs` is set, race install work against a timer.
- On expiry, call `cancelCliContextOperations()` and return exit code `10` (`TIMEOUT`).
- When `timeoutMs` is unset, preserve current behavior.

## Non-Goals

- Sharing one timeout budget across install and spawn in this change.
- Changing timeout behavior for commands that already use `executeCommandWithRuntime`.
