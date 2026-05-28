## Why

PR #312 made `state.json` fail closed on invalid JSON, but semantically invalid `installedAgents` records (for example unknown `installType` values) still load successfully and later crash lifecycle commands such as `list`, `inspect`, and `update`.

## What Changes

- Reject `state.json` that contains invalid `installedAgents` shape or unknown `installType` values with a state read error.
- Add regression tests for invalid install type and non-object `installedAgents`.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `quantex-state`: extend corrupt-state fail-closed behavior to semantically invalid installed agent records.

## Impact

- `src/state/index.ts`
- `test/state.test.ts`
- Commands that load persisted agent state will surface `StateFileError` instead of crashing mid-inspection.
