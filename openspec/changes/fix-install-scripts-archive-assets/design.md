## Context

`src/release-artifacts/index.ts` derives published asset names from binary names:

```ts
export const REQUIRED_RELEASE_ASSET_NAMES = REQUIRED_RELEASE_BINARY_NAMES.map(getReleaseArchiveName)

export function getReleaseArchiveFormat(binaryName: string): ReleaseArchiveFormat {
  return parseBinaryTargetName(binaryName)?.platform === 'win32' ? 'zip' : 'tar.gz'
}
```

`scripts/release/release-artifacts.ts` compresses each required binary, then writes `SHA256SUMS.txt` over the files that `getReleaseBinaryName()` accepts — that is, over the **archives**, not the raw binaries. `manifest.json` carries the same archive names and checksums.

The archives are produced by hand-rolled writers (`createTarArchive`, `createZipArchive`). Their compatibility with system extraction tools was verified against the real `v1.9.3` assets rather than assumed:

- `shasum -a 256 -c` verifies both downloaded archives against the published `SHA256SUMS.txt`.
- `tar -tzvf quantex-darwin-arm64.tar.gz` lists exactly one entry, `quantex-darwin-arm64`, mode `-rwxr-xr-x`.
- `unzip -l quantex-windows-x64.exe.zip` lists exactly one entry, `quantex-windows-x64.exe`.
- Extracted payloads are `Mach-O 64-bit executable arm64` and `PE32+ executable (console) x86-64`.

So the archive entry name is always the binary name, the executable bit survives the tar path, and standard `tar` / `Expand-Archive` are sufficient. No custom extractor is needed in the shell installers.

## Goals / Non-Goals

**Goals:**

- Restore a working documented standalone install on macOS, Linux, and Windows including Windows ARM64.
- Verify what was downloaded before it becomes the installed executable.
- Preserve any existing working executable when an install fails partway.
- Keep both installers structurally parallel so the next release-format change is caught in one place.

**Non-Goals:**

- Native Windows ARM64 builds.
- `install.ps1` state recording.
- Consuming `manifest.json`; `SHA256SUMS.txt` is smaller, already archive-named, and enough for a single-asset check.
- TLS protocol pinning in `install.ps1`; modern Windows PowerShell negotiates TLS 1.2 by system default, and forcing it is unrelated hardening.

## Decisions

### Decision: request archive names, derived the same way the release pipeline derives them

`install.sh` builds `quantex-$platform-$arch.tar.gz`; `install.ps1` builds `quantex-windows-$arch.exe.zip`. Both keep the underlying binary name in a separate variable because it is also the archive entry name to extract.

Why not consume `manifest.json`: it needs a JSON parser in `sh`, and the installers only ever need one asset and one checksum. `SHA256SUMS.txt` is two fields per line and parses with `awk` and with a two-token PowerShell split.

### Decision: verify SHA-256 before the download becomes the installed executable

Both scripts fetch `SHA256SUMS.txt` from the same release URL prefix, look up the archive by name, and abort on a missing entry or a mismatch. This closes the gap PR #508 left open: a non-empty check passes for a truncated download, a proxy error page, or a GitHub 404 body, while a checksum does not.

POSIX hashing tries `sha256sum`, then `shasum -a 256`, then `openssl dgst -sha256`, and fails closed when none exists — matching the script's existing behavior of failing closed when neither `curl` nor `wget` exists. Windows uses `Get-FileHash`, available since PowerShell 4.0.

Why the checksum lookup tolerates a leading `*`: `parseChecksums()` in `src/release-artifacts/index.ts` strips it, so the installers accept the same binary-mode marker rather than diverging from the in-repo parser.

### Decision: extract only the expected entry, into temp storage, then replace

`tar -xzf "$archive" -C "$tmp_dir" "$binary"` and `Expand-Archive` into a temp subdirectory both keep extraction away from `INSTALL_DIR`. Naming the tar member explicitly means an archive carrying extra or unexpected entries cannot write them, which mirrors the "only extract the expected executable entry" rule the self-upgrade spec already applies to `quantex upgrade`.

Replacement is `mv` / `Move-Item` from staged storage, so the live executable is only touched once verified bytes exist. This preserves the intent of PR #508 while extending it to cover the POSIX script, which previously staged the download but never verified it.

### Decision: resolve the Windows host architecture before mapping it

`PROCESSOR_ARCHITECTURE` describes the *process*, not the host. A 32-bit PowerShell on a 64-bit host reports `x86` and exposes the real architecture in `PROCESSOR_ARCHITEW6432`. Reading `PROCESSOR_ARCHITEW6432` first and falling back to `PROCESSOR_ARCHITECTURE` means:

- ARM64 host, native PowerShell → `ARM64` → x64 asset (Windows x64 emulation).
- x64 host, 32-bit PowerShell → `AMD64` via `PROCESSOR_ARCHITEW6432` → x64 asset, instead of today's `Unsupported architecture: x86` throw.
- Genuine 32-bit host → `x86` with no `PROCESSOR_ARCHITEW6432` → still throws, because no 32-bit binary is published.

This is PR #509's mapping plus the emulation cases it did not cover.

### Decision: silence the PowerShell progress bar around the download

`Invoke-WebRequest` in Windows PowerShell 5.1 renders a per-chunk progress bar that dominates wall-clock on large transfers. The Windows archive is ~40 MB, so `$ProgressPreference = 'SilentlyContinue'` is set for the download and restored afterward. Without it the installer looks hung.

## Risks / Trade-offs

- [Risk] With `QUANTEX_VERSION=latest`, the archive and `SHA256SUMS.txt` are two separate requests against `releases/latest/download/`. A release published between them yields a checksum mismatch → Mitigation: fail closed, and say in the error that a mid-install release is a possible cause and a re-run resolves it. Pinning the tag first would need a redirect-resolution path that diverges between `curl` and `wget`, for a race measured in seconds.
- [Risk] `Move-Item` fails when `quantex.exe` is locked by a running process → Mitigation: not a regression — the previous `-OutFile` onto the live path could not open a locked file either — and failing closed after verification is strictly safer than a partial overwrite.
- [Risk] `Copy-Item` to `qtx.exe` can fail after `quantex.exe` was replaced, leaving the alias stale → Mitigation: pre-existing ordering, and `quantex.exe` is the primary entry point; the alias refreshes on the next successful install.
- [Risk] Requiring a SHA-256 tool fails installs on minimal images that lack all three → Mitigation: those installs are already broken by the 404, and silently installing an unverified executable is the worse failure.
- [Risk] Static tests still do not execute either script; CI has no PowerShell installer harness → Mitigation: the archive contract was verified by hand against real `v1.9.3` assets and recorded above, and the static assertions pin the structural properties that regressed here (asset suffix, checksum step, staged replacement).

## Migration Plan

1. Land both installer rewrites with the static regression coverage.
2. Close PR #508 and PR #509 as superseded; their `install.ps1` slices are contained here and their premises predate `v1.8.0`.
3. Archive this change after merge and spec sync.
4. Leave native Windows ARM64 builds and `install.ps1` state recording as separate owners.

## Open Questions

- Whether a release-time smoke check should exercise the documented installers end to end, so an asset-naming change cannot silently break them again. Out of scope here; `scripts/release/verify-release-smoke.ts` covers the binaries but not the install scripts.
