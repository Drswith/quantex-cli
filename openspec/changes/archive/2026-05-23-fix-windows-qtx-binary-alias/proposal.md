## Why

Implementation requested work-intake classification: this change modifies observable Windows standalone binary self-upgrade and uninstall behavior, so it requires OpenSpec before file edits.

Windows `install.ps1` installs `quantex.exe` and copies it to `qtx.exe`, but binary self-upgrade currently replaces only the executable path that is running. That can leave the other Windows entry point stale after `qtx upgrade` or `quantex upgrade`.

## What Changes

- Define Windows standalone binary installs as a two-file model: `quantex.exe` is the canonical binary and `qtx.exe` is a copied alias in the same install directory.
- Update binary self-upgrade so Windows replacements refresh both `quantex.exe` and `qtx.exe`, no matter which entry point launched the upgrade.
- Document manual uninstall and recovery guidance for removing or replacing both Windows executable files.
- Add regression tests for the Windows delayed replacement script and alias path derivation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: Clarify Windows standalone binary alias consistency across self-upgrade, verification, rollback, and manual uninstall/recovery guidance.

## Impact

- Affected code: `src/self/binary.ts`, `src/self/providers/binary.ts`, and binary self-upgrade tests.
- Affected docs/specs: `openspec/specs/self-upgrade/spec.md` via change delta and `docs/runbooks/release-and-self-upgrade-debugging.md`.
- Affected user behavior: Windows standalone binary users get both `quantex.exe` and `qtx.exe` refreshed by self-upgrade and documented together for uninstall/recovery.
