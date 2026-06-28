## Why

The 0.25.2 lifecycle persistence cancellation fix correctly rolls back managed installs and removes just-written state when cancellation races `setInstalledAgentState()`. `updateAgent()` reuses the same removal path even though the managed package update has already succeeded and the persisted state still describes the valid install source. Removing that state leaves the agent updated on disk but untracked in Quantex, which breaks future `update --all` routing.

## What Changes

- Stop removing installed-agent state when a managed update is cancelled after persistence completes.
- Keep reporting update failure to callers when cancellation is observed after persistence.
- Add regression tests for cancellation during update state persistence.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: distinguish update cancellation from install cancellation after state persistence.

## Impact

- Affected code: `src/package-manager/index.ts`, `test/package-manager/index.test.ts`.
- No CLI flags, schema version, or command catalog changes.
