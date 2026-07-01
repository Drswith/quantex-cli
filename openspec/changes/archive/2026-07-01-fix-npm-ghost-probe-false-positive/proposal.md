## Why

The recent ghost-state uninstall recovery path treats npm `getInstalledVersion` returning `undefined` as confirmed package absence. npm's global `list` probe returns `undefined` on any non-zero exit code without parsing stdout, so a broken global dependency tree or probe failure can clear tracked state while the agent package remains installed.

## What Changes

- Harden npm managed package presence probing for ghost uninstall recovery.
- Distinguish confirmed absence from inconclusive probe results before clearing state.
- Add regression tests for npm probe failure and confirmed-absence paths.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: ghost uninstall recovery must not clear state when npm presence probing is inconclusive.

## Impact

- Affected code: `src/package-manager/npm.ts`, `src/package-manager/installers.ts`, `src/package-manager/index.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
