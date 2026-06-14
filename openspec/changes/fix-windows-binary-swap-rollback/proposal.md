## Why

Windows deferred binary self-upgrade moves the live executable to `.bak` before swapping in the downloaded replacement. If the final swap fails after backup creation, the PowerShell script can exit without restoring the backup, leaving the expected executable path missing.

## What Changes

- Wrap the Windows delayed swap step in rollback logic that restores `.bak` when the replacement move fails.
- Add regression coverage that asserts the generated replacement script restores the backup on swap failure.
- Extend the self-upgrade spec with an explicit rollback scenario for this failure mode.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: require backup restoration when the Windows delayed swap step fails after backup creation.

## Impact

- Affected code: `src/self/binary.ts`, `test/self-binary.test.ts`.
- No CLI flags, schema version, or command catalog changes.
