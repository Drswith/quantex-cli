## Why

Ghost uninstall recovery for bun, mise, and uv still treats `getInstalledVersion` returning `undefined` as confirmed package absence. Those probes return `undefined` on non-zero exit codes or probe failures without distinguishing inconclusive results, so uninstall can clear tracked state while the agent package remains installed—the same correctness class fixed for npm in 0.25.5.

## What Changes

- Harden bun, mise, and uv managed package presence probing for ghost uninstall recovery.
- Distinguish confirmed absence from inconclusive probe results before clearing state.
- Add regression tests for inconclusive probe and confirmed-absence paths.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: ghost uninstall recovery must not clear state when bun, mise, or uv presence probing is inconclusive.

## Impact

- Affected code: `src/package-manager/bun.ts`, `src/package-manager/mise.ts`, `src/package-manager/uv.ts`, `src/package-manager/installers.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
