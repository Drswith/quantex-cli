# Design: fix-windows-upgrade-helper-parse

## Context

`upgradeStandaloneBinary` on Windows writes the new binary into a sibling `.quantex-upgrade-*` directory, then schedules `powershell.exe` to wait for the CLI PID, move the live file to `.bak`, move the new file into place, verify `--version`, refresh the peer `qtx.exe`/`quantex.exe` copy, and clean up. The CLI reports success when that helper is scheduled.

The helper script is currently an array of PowerShell lines joined with `"; "`. That puts a statement terminator between `try { ... }` and `catch { ... }`. Windows PowerShell 5.1 treats `try { ... }; catch { ... }` as a parse error, so the helper exits immediately. Stdio is ignored, so the CLI still returns `success: true`.

A rust-rewrite Windows contract run against published v1.13.5 confirmed the user-visible failure: `upgrade` reported updated, `--version` stayed 1.13.5, and the staged directory remained. The same rewrite later named the semicolon join as the parse-time cause.

## Goals / Non-Goals

**Goals:**

- Schedule a helper script that Windows PowerShell can parse.
- Preserve newlines across Windows process-argument serialization.
- Keep success-on-schedule, backup-before-swap, verify-and-rollback, and peer-copy behavior.

**Non-Goals:**

- Change Unix in-place replacement or managed bun/npm self-upgrade.
- Add `detached: true` / `DETACHED_PROCESS`. A later rust-rewrite probe found that flag makes `powershell.exe` exit before running the command.
- Make already-published 1.13.6 Windows binaries apply this helper fix via `quantex upgrade`. Those installs still need `install.ps1` (or an equivalent reinstall) because the old helper owns the swap.
- Tighten peer-alias creation to "copy only if the peer already exists".

## Decisions

- Join helper statements with newlines, not `"; "`.
  - Alternative: keep `; ` and rewrite `try`/`catch` as single-line statements. Rejected because other multi-line blocks (`for`, nested `if`) have the same class of terminator bug.
- Pass the script with `-EncodedCommand` as UTF-16LE base64.
  - Alternative: keep `-Command` and rely on `child_process` to preserve embedded newlines. Rejected because Windows argument serialization can flatten or quote a multiline `-Command` payload.
- Keep `windowsHide: true`, `stdio: ignore`, and `unref()`. Do not add `detached: true`.
- Export a small builder for the script and its encoded form so tests can decode the spawned argv and assert `try`/`catch` adjacency without running Windows.

## Risks / Trade-offs

- [Already-published 1.13.6 Windows binaries cannot self-apply this fix] → Document recovery as rerun `install.ps1`. The next published binary install can upgrade later versions.
- [Encoded command is opaque in process lists] → Tests decode UTF-16LE base64 and assert the plaintext script.
- [Helper still has to outlive the CLI process] → `windowsHide` + `unref` stay; this change only removes the parse-time abort. A remaining Windows-verified owner can follow up if job-object lifetime still kills a parseable helper.

## Migration Plan

1. Ship the helper-script fix on main; release-please prepares the next patch.
2. Windows 1.13.6 binary users recover with `install.ps1`, not `quantex upgrade`.
3. Rollback is a revert of the helper builder; Unix and managed upgrade paths are untouched.
