## Context

Windows binary self-upgrade cannot replace the running executable synchronously. Quantex schedules a detached PowerShell script that waits for the current process to exit, backs up the live binary, swaps in the downloaded replacement, optionally verifies `--version`, and refreshes peer entry points.

The backup guard already prevents swapping when backup creation never succeeds. The gap is the unguarded move from the temp download to the live path.

## Goals / Non-Goals

**Goals**

- Keep the live executable path populated when the delayed swap fails after `.bak` was created.
- Preserve existing delayed-replacement semantics and peer-alias refresh behavior on success.

**Non-Goals**

- Change the optimistic CLI success return for scheduled Windows replacement.
- Rework Windows upgrade verification or reporting in this change.

## Decisions

- Wrap the temp-to-target `Move-Item` in `try/catch`.
- On catch, restore `$backupPath` to `$targetPath` when the backup exists, clean up the temp directory, and `exit 1`.
- Assert the generated script contains the rollback branch in unit tests rather than executing PowerShell in CI.

## Risks / Trade-offs

- If both swap and restore fail, the user may still need manual recovery from `.bak`; this change only closes the common single-failure gap.
