## Why

Grouped managed updates call `updateAgentsByType` with deduplicated package specs. When every spec lacks a usable `packageName`, several installers’ `updateMany` helpers treat an empty list as success without running any install command. The update command then marks every agent in that bucket as `updated`, which misrepresents reality and can leave users believing they upgraded when nothing ran.

## What Changes

- Treat “zero resolvable package names after filtering” as batch failure so the update command falls back to per-agent update handling instead of claiming a no-op batch succeeded.
- Lock the behavior in package-manager unit tests and record the contract in the agent-update spec.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: grouped managed batch updates must not report success from an empty installer work list.

## Impact

- Affected code: `src/package-manager/index.ts` (`updateAgentsByType`), `openspec/specs/agent-update/spec.md`, tests under `test/package-manager/`.
- Dependencies: none.
