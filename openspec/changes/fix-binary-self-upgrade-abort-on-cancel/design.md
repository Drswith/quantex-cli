## Context

`upgradeStandaloneBinary()` uses `fetch(downloadUrl)` with no `AbortSignal`. Command runtime timeout emits TIMEOUT and calls `cancelCliContextOperations()`, which only affects handlers registered via `registerCliCancellationHandler`. Managed installers already register that way; binary download does not. A hung download therefore keeps the event loop alive after TIMEOUT and may still complete checksum/replace work after the user-facing failure.

## Goals / Non-Goals

**Goals**

- Abort binary release download (and body read) when CLI cancellation fires.
- Allow the process to exit promptly after TIMEOUT/signal cancellation during binary upgrade download.
- Preserve existing checksum, backup, and Windows delayed-swap behavior when download completes without cancellation.

**Non-Goals**

- Thread AbortSignal through every self-upgrade provider API.
- Change managed bun/npm self-upgrade cancellation (those already use cancellable child processes).
- Redesign command-runtime timeout grace windows.

## Decisions

- Inside `upgradeStandaloneBinary`, create an `AbortController`, register `controller.abort` with `registerCliCancellationHandler`, and pass `signal` to `fetch`.
- Unregister the handler in `finally` after download/body read completes or fails.
- Treat abort as an existing network failure path (`createBinaryFailure('network', ...)`), matching other fetch failures.
- Prefer local cancellation registration (same pattern as `child-process.ts`) over expanding provider function signatures.

## Risks / Trade-offs

- [Risk] Abort during `arrayBuffer()` leaves temp directory cleanup to existing try/finally. → Acceptable; current cleanup already covers post-download failures.
- [Risk] Cancellation after successful download but before swap is not a new download abort. → Acceptable for this narrow fix; file swap is fast relative to download stall.
