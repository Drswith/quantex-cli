## Context

Unix standalone binary self-upgrade only swaps the live executable after moving it to `.bak`. Windows uses a delayed PowerShell script because the running process holds a file lock.

The current script retries backup creation up to 50 times, then unconditionally moves the downloaded temp binary onto the target path. Rollback on verify failure assumes `.bak` exists.

## Goals / Non-Goals

**Goals:**

- Mirror Unix fail-closed semantics: no in-place swap without a restorable backup.
- Keep the fix narrow to the generated PowerShell command; do not redesign delayed replacement UX.

**Non-Goals:**

- Holding the self-upgrade lock until PowerShell completes.
- Changing premature CLI success reporting for scheduled Windows replacements.

## Decisions

- Track `$backupReady` in the PowerShell script; set it when `Move-Item` to `.bak` succeeds.
- After the retry loop, if `$backupReady` is false, remove the temp dir and `exit 1` without touching the live executable.
- Only run temp-to-target replacement when `$backupReady` is true.

## Risks / Trade-offs

- Users with a persistently locked executable still cannot upgrade automatically, but they keep a working binary instead of a broken one.
