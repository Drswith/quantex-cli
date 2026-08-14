## Why

`install.sh` and `install.ps1` download raw binary asset names (`quantex-darwin-arm64`, `quantex-windows-x64.exe`). Since `feat(release): publish compressed standalone binaries (#556)` and `fix(release): publish Windows binaries as ZIP`, releases publish compressed archives only. The first tag containing that work is `v1.8.0`, so both documented installers have returned HTTP 404 on every platform for every release from `v1.8.0` through the current `v1.9.3`, while `README.md` still advertises them as the standalone install path.

Measured against `releases/latest/download/` (following redirects) at `v1.9.3`:

| Requested asset | Status | Requested by |
|---|---|---|
| `quantex-darwin-arm64` | 404 | current `install.sh` |
| `quantex-darwin-arm64.tar.gz` | 200 | published asset |
| `quantex-windows-x64.exe` | 404 | current `install.ps1` |
| `quantex-windows-x64.exe.zip` | 200 | published asset |
| `quantex-windows-arm64.exe` | 404 | current `install.ps1` on ARM64 hosts |

Two open PRs address narrower slices of the same file and are both built on the pre-`v1.8.0` asset matrix. PR #509 remaps Windows ARM64 to `quantex-windows-x64.exe`, which is still a 404 today. PR #508 stages the download into a temp file before replacing the live executable, which is correct but guards a request that always fails. Neither restores a working install, and both add `test/install-scripts.test.ts` as a new file that now conflicts with the copy already on `main`.

Binary self-upgrade already resolves archives, verifies SHA-256, and extracts the expected entry (`Standalone binary self-upgrade preserves verified archive safety`). The install scripts are the remaining entry point that never caught up.

## What Changes

- Both install scripts request the published archive asset: `quantex-<platform>-<arch>.tar.gz` for macOS/Linux, `quantex-windows-x64.exe.zip` for Windows.
- Both scripts download `SHA256SUMS.txt` from the same release and fail closed when the archive checksum is absent or does not match.
- Both scripts extract only the expected binary entry into temporary storage and replace the installed executable only after extraction succeeds, so a failed or interrupted install leaves any working executable intact.
- `install.ps1` resolves the host architecture through `PROCESSOR_ARCHITEW6432` before `PROCESSOR_ARCHITECTURE`, maps `AMD64` and `ARM64` to the published x64 asset, and keeps failing closed on genuine 32-bit hosts.
- Static regression coverage is added to the existing `test/install-scripts.test.ts` describe block.
- Not changed: the `README.md` install commands, the release asset matrix, native Windows ARM64 builds, `install.ps1` state recording, and Windows deferred self-upgrade semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade` — the documented standalone installers MUST request published release archives, MUST verify archive checksums before use, and MUST replace an installed executable only from verified staged content.

## Impact

- `install.sh` — asset resolution, checksum verification, archive extraction.
- `install.ps1` — host architecture resolution, asset resolution, checksum verification, archive extraction, staged replacement.
- `test/install-scripts.test.ts` — static regression coverage alongside the existing `install.sh` state-recorder tests.
- Supersedes PR #508 and PR #509, which target the same file against a stale asset matrix.
- No source, build, or release-pipeline changes; `README.md` install commands are unchanged.

## Non-Goals

- Adding a native `bun-windows-arm64` build target or a Windows ARM64 release asset.
- Teaching `install.ps1` to record `installSource` in `state.json`.
- Changing Windows deferred self-upgrade success-before-verify semantics.
- Reworking `manifest.json` consumption; the installers verify against `SHA256SUMS.txt`, which already lists archive names.

## Work-intake classification

Observable install-path behavior for both documented standalone installers, including download integrity verification → OpenSpec required before implementation.
