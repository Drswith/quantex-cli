## Why

Quantex has published the Windows standalone executable inside a `.tar.gz` archive since the first compressed release in `v1.8.1`, even though Windows release consumers expect a native `.zip` download. The archive naming, manifest, smoke test, and binary self-upgrade paths must agree on the platform-specific format before the next release is published.

## What Changes

- Publish macOS and Linux standalone binaries as `.tar.gz` archives and the Windows executable as a `.zip` archive containing the `.exe`.
- Make release asset naming, required-asset validation, checksums, and manifests platform-aware.
- Make release smoke verification and standalone binary self-upgrade extract either supported archive format while preserving entry-name and checksum safety checks.
- Add focused tests covering the Windows ZIP contract and the existing Unix tarball contract.
- **BREAKING**: the Windows release asset name changes from `quantex-windows-x64.exe.tar.gz` to `quantex-windows-x64.exe.zip`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: require platform-appropriate standalone archive formats and publish the Windows ZIP asset.
- `self-upgrade`: resolve, smoke-test, and safely extract the platform-appropriate release archive format.

## Impact

- Affected implementation includes `src/release-artifacts/`, `src/self/release.ts`, the binary self-upgrade path, release artifact generation, release smoke verification, and their tests.
- The GitHub Release asset matrix, `manifest.json`, and `SHA256SUMS.txt` will change for Windows on the first corrected release.
- No new runtime dependency is required; archive creation and extraction remain within the existing release/runtime code paths.
