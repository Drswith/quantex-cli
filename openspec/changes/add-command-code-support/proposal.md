## Why

Command Code is another agent-style coding CLI that Quantex users may want to install, inspect, resolve, execute, and update through the same lifecycle surface as other supported agents.

This is an OpenSpec-required change because it modifies supported agent catalog metadata and therefore observable CLI behavior.

## What Changes

- Add Command Code as a supported lifecycle agent in the catalog.
- Record the official npm package metadata and executable entrypoint metadata from the upstream quickstart.
- Expose npm-compatible managed install methods on Windows, macOS, and Linux.
- Expose the documented version probe and self-update command.
- Add catalog tests and regenerate generated catalog manifests.

No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: add Command Code as a supported lifecycle agent with installation, lookup, version-probe, and update-planning metadata.

## Impact

- `openspec/specs/agent-catalog/spec.md`
- `openspec/changes/add-command-code-support/specs/agent-catalog/spec.md`
- `src/agents/catalog/*.json`
- `src/agents/generated/catalog-agents.ts`
- `src/agents/generated/catalog-data.ts`
- `test/agents.test.ts`
