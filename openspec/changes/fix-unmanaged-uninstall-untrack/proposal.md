## Why

Agents tracked with `script` or `binary` install types cannot be removed from Quantex state through `quantex uninstall`, leaving users stuck with permanent "installed" records and no supported recovery path except hand-editing `state.json`.

## What Changes

- When an agent is recorded with an install type that has no managed uninstall path, `quantex uninstall` removes the Quantex tracking entry instead of failing permanently.
- Managed uninstall behavior remains unchanged: package-manager uninstall must succeed before state is cleared.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: document uninstall behavior for tracked unmanaged (`script` / `binary`) installs.

## Impact

- Affected code: `src/package-manager/index.ts`, lifecycle tests.
- User impact: `quantex uninstall` succeeds for tracked script/binary agents by clearing state; binaries installed outside Quantex are not removed from disk.
