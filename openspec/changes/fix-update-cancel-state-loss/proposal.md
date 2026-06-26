## Why

The 0.25.2 lifecycle cancellation hardening applied install-parity rollback when managed install persistence is cancelled, but `updateAgent()` still removes tracked install state after a successful managed update when cancellation fires during persistence. That leaves the package updated on disk while Quantex forgets the install source, breaking later `update --all`, `uninstall`, and doctor flows. The no-recorded-state update fallback path also skips managed rollback when persistence is cancelled.

## What Changes

- Keep recorded install state when a managed update succeeds but cancellation is observed after re-persisting the preferred state.
- Roll back managed updates on the catalog fallback path when cancellation prevents state persistence, matching install semantics.
- Add regression tests for both update cancellation paths.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: cancelled managed update operations must not leave agents untracked after the package update already succeeded.

## Impact

- Affected code: `src/package-manager/index.ts`, `test/package-manager/index.test.ts`.
- No CLI flags, schema version, or command catalog changes.
