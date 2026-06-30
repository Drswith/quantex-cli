## Why

`uninstallAgent()` only clears installed-agent state when the managed package-manager uninstall returns success. If the package is already removed but state persistence failed on a prior attempt—or the package manager reports failure because the package is gone—Quantex leaves permanent ghost state. That breaks `update --all`, `uninstall`, and doctor flows until users manually edit `state.json`.

## What Changes

- Recover ghost uninstall state when a managed package is no longer present on disk but Quantex still tracks it.
- Only perform recovery when the relevant package manager is available and can confirm absence.
- Add regression tests for the ghost-state recovery path.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: uninstall must clear tracked state when the managed package is already absent, even if the package-manager uninstall command reports failure.

## Impact

- Affected code: `src/package-manager/index.ts`, `test/package-manager/index.test.ts`.
- No CLI flags, schema version, or command catalog changes.
