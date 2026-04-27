## Why

Quantex is a lifecycle CLI, not a localized agent directory. Keeping a free-form `description` field inside `AgentDefinition` pulls the catalog toward presentation copy and internationalization concerns that do not improve installation, inspection, resolution, or update reliability.

## What Changes

- Remove the required `description` field from `AgentDefinition`.
- Stop exposing agent description text through `quantex info` and `quantex inspect`.
- **BREAKING**: shrink the metadata contract returned by lifecycle surfaces so automation and contributors do not treat localized prose as stable agent metadata.
- Record the catalog boundary in OpenSpec so future agent additions stay focused on lifecycle-relevant metadata.

## Capabilities

### New Capabilities
- `agent-catalog`: Define the stable lifecycle-focused metadata Quantex stores and returns for supported agent entries.

### Modified Capabilities

## Impact

- Affected code: `src/agents/**`, `src/commands/info.ts`, `src/commands/inspect.ts`, and related tests under `test/**`.
- Affected contract: the structured metadata shape exposed by `info` and `inspect` no longer includes `description`.
- No new dependencies, installer changes, or release-flow changes.
