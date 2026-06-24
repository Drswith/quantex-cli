## Why

The 0.25.1 lifecycle cancellation hardening checks `cancelled` only before `setInstalledAgentState()` begins. Timeout or signal cancellation can still fire while the state write is in flight, leaving `state.json` updated while callers observe `TIMEOUT` or `CANCELLED`. `trackInstalledAgent()` also bypasses the cancellation guard entirely, so adopt/track paths can persist state after cancellation.

## What Changes

- Re-check cancellation after installed-agent state persistence completes and roll back the write when cancelled.
- Route `trackInstalledAgent()` through the same cancellation-aware persistence helper.
- Treat cancelled adopt/track persistence as a non-success outcome for install and ensure callers.
- Add regression tests for cancellation during slow state persistence.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: cancelled managed install, update, and adopt/track operations must not leave normal installed-agent state behind.

## Impact

- Affected code: `src/package-manager/index.ts`, `src/commands/install.ts`, `src/commands/ensure.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
