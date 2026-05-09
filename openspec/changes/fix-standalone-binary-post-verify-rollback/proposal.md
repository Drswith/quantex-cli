# Fix standalone binary rollback flag after successful verification

## Problem

After PR 206, `rollbackAvailable` stayed true until backup removal completed. If removing the `.bak` file failed after the new binary was verified in place, the catch path treated the situation as a failed swap and restored the old binary—deleting the working upgrade.

## Proposal

Clear the swap-rollback flag immediately after successful verification and before backup cleanup, so cleanup errors surface without undoing a verified replacement.
