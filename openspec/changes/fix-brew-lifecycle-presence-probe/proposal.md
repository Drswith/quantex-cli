## Why

After the lifecycle redesign, Homebrew provider observation hardcodes presence as `unknown`. Install verification and uninstall reconciliation both require conclusive provider observation, so brew-backed agents fail closed even when `brew` commands succeed. Ghost uninstall recovery also never confirms brew package absence.

## What Changes

- Add Homebrew formula/cask presence probing with `present`, `absent`, and `unknown` outcomes.
- Wire brew `probePackagePresence` and `getInstalledVersion` into the brew provider adapter and managed-installer compatibility projections.
- Add regression tests for confirmed absence, still-present, and inconclusive brew probe paths.
- Extend uninstall ghost-recovery contract coverage to Homebrew.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: ghost uninstall recovery must confirm brew package absence before clearing state and must fail closed when brew presence probing is inconclusive.
- `agent-uninstall`: uninstall reconciliation must use conclusive brew provider presence when available rather than treating brew observation as permanently indeterminate.

## Impact

- Affected code: `src/package-manager/brew.ts`, `src/providers/adapters/brew.ts`, `src/package-manager/installers.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
- Work-intake classification: observable lifecycle behavior and provider presence probing require OpenSpec.
