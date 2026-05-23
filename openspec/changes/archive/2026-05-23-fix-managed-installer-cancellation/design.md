## Context

Quantex runs managed lifecycle installers through `spawnWithQuantexStdio`, often with inherited stdio in human mode so tools like Cargo, npm, Bun, uv, and mise can render their own progress. The current cancellation handler sends `SIGTERM` to the direct child and the command runtime races command execution against a signal result. On Windows, Cargo can survive that direct-child termination path and continue emitting progress after PowerShell receives a prompt again.

## Goals / Non-Goals

**Goals:**

- Keep cancellation sticky once a user signal or command timeout has been observed.
- Give registered child-process cleanup a chance to finish before Quantex returns a cancelled result.
- Use process-tree termination on Windows for managed installer children when a PID is available.
- Preserve the existing install/update/uninstall command surfaces and output schemas.

**Non-Goals:**

- Replace the managed installer abstraction or introduce workflow orchestration.
- Guarantee rollback of third-party installers that already modified the host before cancellation completed.
- Add a native Windows job-object dependency in this change.

## Decisions

1. Cancellation handlers may return promises.

   The CLI context remains the central registry for in-flight managed operations. Making handlers awaitable lets command runtime cancellation join child cleanup without every installer implementation growing its own signal logic.

2. Managed process cancellation is sticky.

   If cancellation is requested while a managed process is running, `waitForSpawnedCommand` returns a non-zero exit code even when the child later exits `0`. This prevents success-after-cancel paths from persisting installed state or printing normal success messages.

3. Windows process-tree termination uses `taskkill /T /F` as a bounded fallback.

   `SIGTERM` against a direct child is not reliable enough for Windows console process trees. `taskkill` is available on supported Windows hosts and reaches descendants without adding a new dependency. The fallback is bounded so cancellation cannot hang indefinitely.

## Risks / Trade-offs

- [Third-party installer races to completion] -> Quantex reports cancellation/failure rather than normal success; later inspection can reconcile any external state the installer left behind.
- [taskkill is unavailable or denied] -> Quantex still attempts the direct-child kill path and treats the cancelled managed command as unsuccessful.
- [Long cleanup delays] -> Cleanup waits are bounded so the CLI does not hang indefinitely after cancellation.
