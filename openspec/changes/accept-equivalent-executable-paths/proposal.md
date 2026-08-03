## Why

Lifecycle receipts can preserve a package manager's stable shim or symbolic-link path while later live observation resolves that same executable to its canonical filesystem path. Quantex currently compares those strings directly, misclassifies valid managed installs as conflicting sources, and blocks `update` even though both paths identify the same executable.

## What Changes

- Compare executable-path evidence after resolving each path to its canonical filesystem identity.
- Preserve fail-closed behavior when distinct paths remain distinct after resolution.
- Add regression coverage for managed updates whose legacy receipt stores a symbolic-link path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lifecycle-reconciliation`: Treat canonical and symbolic-link paths to the same executable as consistent lifecycle evidence while retaining conflict detection for genuinely different executables.
- `agent-update`: Allow tracked managed agents with equivalent receipt and live executable paths to proceed through normal update planning.

## Impact

- Affects lifecycle observation, update planning inputs, and their tests.
- Does not change receipt schema, provider selection, install-source provenance, or public structured-output schemas.
