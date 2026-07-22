## Why

Tracked `script` and `binary` installs are intentionally state-only: Quantex cannot remove the upstream executable, but uninstall must still clear Quantex tracking. After the lifecycle redesign, the uninstall command always applies a managed postcondition that requires the executable to disappear from `PATH`. That makes `quantex uninstall` fail for healthy script/binary installs such as Grok Build, restores installed-agent state, and can leave a newly written lifecycle receipt behind.

## What Changes

- Treat tracked `script` / `binary` uninstall as state-only untracking when the recorded install type cannot be uninstalled by a package manager.
- Do not require provider/PATH absence after state-only uninstall success.
- Do not synthesize a managed lifecycle receipt solely to verify removal for uninstallable install types.
- Add command-level regression coverage for tracked script and binary uninstall while the executable remains on `PATH`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-uninstall`: tracked unmanaged (`script` / `binary`) uninstall must clear Quantex state and report success without requiring the live executable to vanish.
- `agent-update`: reinforce the existing tracked unmanaged uninstall requirement so command-level postconditions cannot override state-only removal.

## Impact

- Affected code: `src/commands/uninstall.ts`, `test/commands/uninstall.test.ts`, related OpenSpec deltas.
- No CLI flags, schema version, or command catalog changes.
- Work-intake classification: observable uninstall behavior and durable lifecycle contract require OpenSpec.
