## Why

Windows delayed binary self-upgrade can proceed to overwrite the live executable even when creating the `.bak` backup never succeeds. If post-replace verification then fails, rollback tries to restore from a missing backup and can delete the only working binary.

## What Changes

- Require a successful `.bak` backup before Windows delayed replacement moves the downloaded binary into place.
- Abort the scheduled replacement (clean up temp artifacts, exit non-zero) when backup cannot be created after retries.
- Add regression coverage that the generated PowerShell replacement script enforces the backup guard.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `self-upgrade`: Windows delayed binary replacement MUST fail closed when backup creation does not succeed before swapping the live executable.

## Impact

- `src/self/binary.ts`
- `test/self-binary.test.ts`
- `openspec/specs/self-upgrade/spec.md` (via delta)
