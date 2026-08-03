## Why

GitHub Releases currently attach complete standalone executable files directly. Those assets are substantially larger than necessary to download and store, even though each release target can be losslessly compressed.

## What Changes

- Publish each standalone platform binary as a compressed `.tar.gz` archive instead of a raw executable.
- Make the release manifest, checksums, release-candidate staging, and asset verification describe the compressed files.
- Preserve binary self-upgrade by verifying the downloaded archive, extracting its expected executable safely, and retaining the existing replacement and rollback behavior.
- Update release and self-upgrade contracts and operator documentation for the archive format.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: GitHub Release standalone assets change from raw binaries to compressed archives.
- `self-upgrade`: standalone binary upgrades consume verified compressed release archives.

## Impact

- Release artifact generation and candidate staging scripts.
- GitHub Release upload workflow and generated `manifest.json` / `SHA256SUMS.txt`.
- Standalone binary self-upgrade download, integrity, extraction, and smoke tests.
- Release runbook.
