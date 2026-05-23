## Context

Discussion #69 split the Windows binary alias concern out of README work because it affects self-upgrade behavior. On Windows, `install.ps1` downloads the release asset to `quantex.exe` and copies it to `qtx.exe`; unlike the POSIX installer's symlink model, those are two independent files.

The current binary self-upgrade path replaces only `plan.facts.executablePath`. If the user runs `qtx upgrade`, `qtx.exe` can move forward while `quantex.exe` remains old; if they run `quantex upgrade`, the opposite can happen.

## Goals / Non-Goals

**Goals:**

- Keep the Windows standalone `quantex.exe` and `qtx.exe` files consistent after binary self-upgrade.
- Preserve delayed replacement semantics for the locked running executable.
- Document manual recovery and uninstall cleanup as a two-file Windows operation.
- Add focused regression coverage around alias path derivation and delayed replacement script generation.

**Non-Goals:**

- Do not switch Windows installs to symlinks or junctions.
- Do not change npm/Bun shim behavior.
- Do not add a dedicated Quantex self-uninstall command.
- Do not change release asset naming.

## Decisions

1. Treat the executable basename as the source for deriving the peer alias.

   On Windows, if the running path ends with `qtx.exe`, the peer is `quantex.exe` in the same directory. If it ends with `quantex.exe`, the peer is `qtx.exe`. Other executable names have no peer alias. This keeps the behavior local to the standalone installer's known layout.

   Alternative considered: persist install metadata with both paths. That would add migration and state drift concerns for a path relationship that is already deterministic from `install.ps1`.

2. Reuse the same downloaded binary for both Windows files.

   The release artifact is the same executable content regardless of entrypoint name, so the delayed PowerShell script can move the downloaded temp file to the running target, verify that target, then copy the verified target to the peer alias when present.

   Alternative considered: schedule two independent downloads/replacements. That would add network and checksum work without improving correctness.

3. Verify the running target before syncing the peer alias.

   The existing Windows path can only report that replacement was scheduled, because the current process must exit before replacement occurs. The scheduled script still performs version verification when an expected version exists. The peer alias should only be overwritten after that verification passes so rollback preserves both files as much as possible.

4. Keep manual uninstall as documentation, not a new command.

   Issue #76 asks for uninstall behavior consistency with the chosen model. Quantex currently has no self-uninstall command; the actionable behavior is to document that manual Windows binary uninstall removes both `quantex.exe` and `qtx.exe`.

## Risks / Trade-offs

- [Peer alias copy fails after target verification] -> The scheduled script exits with failure and leaves the verified running target in place; manual recovery guidance points users at both files.
- [Only one of the two files exists before upgrade] -> The scheduled script recreates the missing peer alias from the verified target when the running file name is one of the known Windows entry points.
- [Users run a renamed standalone binary] -> No peer alias is inferred, preserving current single-file behavior for custom names.
