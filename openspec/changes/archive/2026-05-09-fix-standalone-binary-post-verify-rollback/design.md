# Design

## Context

Unix standalone binary self-upgrade now keeps a `rollbackAvailable` guard so a failed swap can restore the previous executable. After PR 206, that guard stayed enabled until the `.bak` cleanup completed.

## Decision

Treat post-verify backup cleanup as a separate cleanup phase rather than part of the swap-critical section.

- Keep `rollbackAvailable = true` only through the steps where the live executable may still need restoration:
  - moving the current executable to `.bak`
  - moving the replacement into place
  - running post-install verification
- Clear `rollbackAvailable` immediately after verification succeeds.
- Let `rm(backupPath)` failures surface as upgrade errors without invoking `restoreStandaloneBinary(...)`.

## Consequences

- A verified new binary remains live even if backup cleanup fails.
- Cleanup failures are still reported, so operators can remove the stale `.bak` manually if needed.
- Swap-time failures and verify failures continue to restore the previous executable.
