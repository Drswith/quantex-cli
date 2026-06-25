## Why

The 0.25.2 lifecycle cancellation hardening removes installed-agent state when cancellation is observed after `setInstalledAgentState()` completes. That rollback is correct for fresh installs and adopt/track writes, but `updateAgent()` re-persists pre-existing tracked state after a managed update already succeeded. Removing that entry drops install-source metadata while the agent binary remains upgraded, breaking future `update --all` planning and diagnostics.

## What Changes

- Preserve pre-existing installed-agent state when a cancelled managed update finishes package work but fails during or after state re-persistence.
- Keep install and adopt/track cancellation rollback behavior unchanged.
- Add regression tests for cancelled managed updates with recorded install state.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: cancelled managed updates with recorded install state must not delete the pre-existing installed-agent state entry.

## Impact

- Affected code: `src/package-manager/index.ts`, related package-manager tests.
- No CLI flags, schema version, or command catalog changes.
