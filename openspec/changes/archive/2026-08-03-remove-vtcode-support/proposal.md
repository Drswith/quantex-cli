## Why

VTCode is no longer a Quantex-supported lifecycle agent. Keeping it in the catalog exposes install, inspection, update, shortcut, and structured-output paths that Quantex no longer intends to maintain.

## What Changes

- **BREAKING** Remove VTCode from the built-in agent catalog and its public root and compatibility exports.
- **BREAKING** Make `vtcode` unavailable to agent lookup and all catalog-derived CLI surfaces.
- Remove current product documentation, supported-agent matrices, and VTCode-specific test coverage while preserving historical changelog and archived OpenSpec records.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: Remove the requirement that VTCode is a supported lifecycle agent.

## Impact

- `src/agents/catalog/`, generated catalog artifacts, core catalog projections, public exports, and compatibility exports.
- Catalog-derived CLI commands and machine-readable outputs will no longer list or resolve `vtcode`.
- Current README, support-matrix, and agent skill reference lists; tests and compatibility export fixture.
