## Why

Managed agent lifecycle operations can misroute or leave the system inconsistent when `state.json` records a managed install source without a usable package name, or when install/update succeeds on disk but state persistence fails afterward.

## What Changes

- Resolve managed package names from the agent catalog when recorded state omits `packageName` but the install type is managed.
- Fail closed on single-agent update instead of falling back to self-update when a recorded managed source cannot be executed.
- Reject managed `installedAgents` entries whose `packageName` is an empty string on state read.
- Roll back a successful managed install when state persistence fails immediately afterward.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: recorded managed installs must not fall back to self-update when the managed path cannot run; managed installs must roll back when state cannot be persisted.
- `quantex-state`: managed installed-agent records with empty `packageName` must fail state reads.

## Impact

- Affected code: `src/package-manager/index.ts`, `src/state/index.ts`, lifecycle tests.
- User impact: safer update/uninstall behavior for incomplete managed state; fewer silent install/state mismatches after failed writes.
