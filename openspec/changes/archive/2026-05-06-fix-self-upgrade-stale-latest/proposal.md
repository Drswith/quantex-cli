## Why

Implementation requested work-intake classification: this change modifies observable self-upgrade and doctor behavior, so it requires OpenSpec before file edits.

Quantex currently treats any `latestVersion` that differs from `currentVersion` as an available self-update. When cached or mirrored registry data falls behind the installed version, Quantex can attempt a managed self-upgrade toward an older target and then report failure after the package manager correctly installs a newer version.

## What Changes

- Prevent self-upgrade surfaces from treating a lower `latestVersion` as an available update.
- Make `quantex upgrade`, `quantex doctor`, and passive self-update notices use semantic version comparison instead of simple inequality.
- Add regression coverage for stale cached latest-version data so Quantex no longer attempts or advertises self downgrades.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: managed self-upgrade planning and user-facing self-update surfaces must reject stale or lower latest-version data instead of entering a downgrade path.

## Impact

- Affected code: `src/commands/upgrade.ts`, `src/commands/doctor.ts`, `src/self/update-notice.ts`, `src/utils/version.ts`.
- Affected tests: self-upgrade command, doctor command, and self-update notice regression coverage.
