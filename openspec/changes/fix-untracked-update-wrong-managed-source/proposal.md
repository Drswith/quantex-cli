## Why

Explicit single-agent `quantex update` for an untracked PATH install can select the preferred package manager (default Bun) instead of the install source that actually owns the binary. Bun/npm `update` paths can also succeed for packages that are absent from that manager's global store — Bun installs the package as a side effect, and npm can report success without changing the user's real install — so Quantex can report a successful update while leaving the PATH binary unchanged and creating a duplicate global install.

## What Changes

- Prefer binary-path inference when choosing a managed installer for untracked single-agent updates, matching install/ensure adoption semantics.
- Refuse to guess among multiple managed methods when the binary path does not identify a source; fall through to self-update or manual-hint instead.
- Fail closed when a managed update targets a package that presence-probes as absent, so update must not install into the wrong package manager.
- Add regression tests for npm-path untracked updates and absent-package Bun/npm update probes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: untracked single-agent updates must not invent a preferred managed installer or treat absent-package managed updates as success.

## Impact

- Affected code: `src/agent-update/`, `src/planning/updates.ts`, `src/services/update.ts`, `src/package-manager/index.ts`, `src/utils/install.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
- Work-intake classification: observable lifecycle behavior change → OpenSpec required.
