## Why

`src/agents/catalog.ts` currently combines catalog parsing/materialization with binding to the checked-in generated snapshot. Separating a pure loader from the snapshot adapter makes catalog validation and behavior extensions independently testable while preserving the current generated catalog contract.

## What Changes

- Add a pure agent catalog loader that parses supplied catalog data and builds indexed runtime definitions.
- Keep `catalog.ts` as the adapter that binds the generated `catalogData` snapshot to the loader.
- Preserve catalog JSON files, schema, generated manifests, named exports, ordering, lookup behavior, and runtime object identity.
- Add focused loader tests while retaining the existing catalog and manifest compatibility suite.
- Make no breaking changes.

## Capabilities

### New Capabilities

- `agent-catalog-loader`: Defines the internal loader/snapshot boundary and compatibility requirements.

### Modified Capabilities

None.

## Impact

- Code: a new `src/agents/catalog-loader.ts` and a smaller `src/agents/catalog.ts`.
- Tests: a new focused loader test and existing `test/agents.test.ts`.
- No changes to public commands, catalog entries, JSON Schema, generated files, install/update metadata, or release behavior.
