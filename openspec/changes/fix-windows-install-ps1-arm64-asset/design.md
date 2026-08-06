## Context

`README.md` documents `irm .../install.ps1 | iex` as the Windows standalone install path. Current `install.ps1` derives:

```powershell
$arch = switch ($env:PROCESSOR_ARCHITECTURE.ToLowerInvariant()) {
  'amd64' { 'x64' }
  'arm64' { 'arm64' }
  default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}
$asset = "quantex-windows-$arch.exe"
```

Release truth disagrees:

- `scripts/build-bin.ts` builds only `bun-windows-x64-modern` → `quantex-windows-x64`
- `REQUIRED_RELEASE_ASSET_NAMES` includes `quantex-windows-x64.exe` only
- `getBinaryReleaseAssetName()` always returns `quantex-windows-x64.exe` for Windows `.exe`
- Live `v1.1.3`: `quantex-windows-arm64.exe` → 404, `quantex-windows-x64.exe` → 302

## Goals / Non-Goals

**Goals:**

- Make the documented Windows installer succeed on ARM64 hosts by selecting the published x64 asset.
- Align installer asset selection with the release matrix and binary self-upgrade naming.
- Guard the mapping with a static regression test.

**Non-Goals:**

- Do not add a native `bun-windows-arm64` build or release asset in this slice.
- Do not change POSIX `install.sh` (Linux/macOS ARM64 assets are published).
- Do not fold in staged-download work owned by `fix-windows-install-ps1-staged-download` / PR #508.
- Do not change Windows deferred self-upgrade success-before-verify semantics.

## Decisions

### Decision: map Windows ARM64 → published x64 asset

On `PROCESSOR_ARCHITECTURE=ARM64`, download `quantex-windows-x64.exe`. Windows on ARM runs x64 binaries through built-in emulation, which matches how Quantex already treats Windows self-upgrade asset naming.

Why not fail with a clearer error instead:

- The README advertises a Windows installer without excluding ARM64.
- Failing closed still leaves ARM64 users without the documented install path; selecting the published asset restores installability.

Why not ship native ARM64 Windows binaries here:

- Broader than a critical correctness fix; requires build target, release artifact, and self-upgrade matrix changes.

## Risks / Trade-offs

- [Risk] Emulated x64 may be slower than a future native ARM64 binary → Mitigation: acceptable for installability; native build remains a separate product decision.
- [Risk] Static tests do not execute PowerShell on Linux CI → Mitigation: assert the architecture switch and asset template the same way other installer structure tests work.

## Migration Plan

1. Land the installer asset-mapping fix and static regression test.
2. Archive this OpenSpec change after merge and spec sync.
3. Leave native Windows ARM64 builds and deferred self-upgrade semantics as separate owners.

## Open Questions

- None for this narrow slice.
