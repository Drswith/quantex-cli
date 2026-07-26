## Context

`README.md` documents `irm .../install.ps1 | iex` as the Windows standalone install path. Current `install.ps1` sets `$targetPath` to `$InstallDir\quantex.exe` and runs:

```powershell
Invoke-WebRequest -Uri $downloadUrl -OutFile $targetPath
Copy-Item $targetPath $aliasPath -Force
```

POSIX `install.sh` downloads into `mktemp` storage and only `mv`s into `$INSTALL_DIR/quantex` after success. In-repo binary self-upgrade (`src/self/binary.ts`) also stages to a temp path before replacement. `install.ps1` is the outlier that mutates the live entry point while bytes are still arriving.

## Goals / Non-Goals

**Goals:**

- Preserve any existing working `quantex.exe` until a complete staged download succeeds.
- Keep installing both `quantex.exe` and `qtx.exe` as independent peer copies.
- Fail closed when the staged file is missing or empty.

**Non-Goals:**

- Do not add checksum / `manifest.json` verification in this slice (broader integrity work remains separate).
- Do not change Windows deferred self-upgrade success-before-verify semantics.
- Do not teach `install.ps1` to write Quantex state.json (detection from standalone executable path already works).
- Do not alter POSIX `install.sh` beyond what is already correct for staging.

## Decisions

### Decision: stage to a disposable temp directory, then Move-Item into place

Download to `$env:TEMP\quantex-install-<guid>\<asset>`, require a non-empty file, `Move-Item -LiteralPath` onto `quantex.exe`, then `Copy-Item` to `qtx.exe`. Always remove the temp directory in `finally`.

Why this over downloading beside the install dir:

- Temp staging matches `install.sh` and avoids leaving partial `.download` siblings in PATH directories.
- `Move-Item` after a completed download keeps the live path untouched on network failure.

Why not wait for checksum work:

- Overwrite-in-place corruption is independently severe and already has a narrow fix.
- Checksum absence was previously deferred as a broader integrity topic.

## Risks / Trade-offs

- [Risk] `Move-Item` can fail if `quantex.exe` is locked by a running process → Mitigation: failing closed without truncating is strictly safer than `-OutFile` onto the live path; users can stop the process and rerun.
- [Risk] Static tests do not execute PowerShell on Linux CI → Mitigation: assert the script structure (temp staging, no direct `-OutFile $targetPath`) the same way release workflow structure tests guard YAML ordering.

## Migration Plan

1. Land the installer fix and static regression test.
2. Archive this OpenSpec change after merge and spec sync.
3. Leave checksum verification and deferred Windows self-upgrade semantics as separate owners.

## Open Questions

- None for this narrow slice.
