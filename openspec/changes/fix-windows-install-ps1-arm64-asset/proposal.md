## Why

Windows `install.ps1` maps host architecture `ARM64` to release asset `quantex-windows-arm64.exe`, but the Quantex release matrix only builds and publishes `quantex-windows-x64.exe`. The documented PowerShell installer therefore hard-fails with HTTP 404 on Windows ARM64 hosts even when a healthy release (for example `v1.1.3`) has a working x64 asset. In-repo self-upgrade already selects `quantex-windows-x64.exe` for every Windows `.exe` install.

## What Changes

- Map Windows ARM64 hosts in `install.ps1` to the published `quantex-windows-x64.exe` asset (Windows x64 emulation).
- Keep rejecting unknown Windows architectures.
- Add a static regression test that asserts ARM64 no longer requests a never-shipped `quantex-windows-arm64.exe` asset.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `self-upgrade`: Windows standalone installer (`install.ps1`) MUST select a release asset that exists in the published Windows binary matrix.

## Impact

- `install.ps1` architecture → asset mapping
- Static regression coverage under `test/`
- OpenSpec change `fix-windows-install-ps1-arm64-asset`
- Does not add a native Windows ARM64 build target, checksum verification, or Windows deferred self-upgrade success-before-verify changes

## Work-intake classification

Observable install path behavior for the documented Windows standalone installer → OpenSpec required before implementation.
