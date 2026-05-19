## Why

`quantex update --all` can repeatedly report managed Bun agents such as GitHub Copilot CLI and Pi as updated even after Bun has already installed the latest package version. This makes the batch summary noisy and hides the real update state.

## What Changes

- Ensure managed Bun update results refresh or persist the installed package/version state after a successful update.
- Ensure later `quantex update --all` runs compare against the refreshed state so already-current managed Bun agents report as up to date.
- Recover stale lifecycle locks left behind by interrupted Quantex processes so a later update run is not permanently blocked.
- Cover the regression with focused tests for managed Bun agents whose package manager updates to a newer version.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Managed Bun updates must not keep reporting an agent as updated after the requested package is already at the installed latest version.

## Impact

- Affected specs: `openspec/specs/agent-update/spec.md`.
- Affected code: agent update planning/execution, install-state persistence around managed Bun package updates, and lifecycle lock acquisition.
- Affected tests: focused agent update tests for repeated managed Bun update runs and stale lock recovery.
