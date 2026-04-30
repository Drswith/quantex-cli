## Why

Tabnine CLI is a terminal-native AI coding agent by Tabnine (codota). It runs as a standalone CLI binary installed via a Node.js-based installer script, supports macOS, Linux, and Windows, and checks for updates automatically. Adding it as a supported lifecycle agent in Quantex allows users to install, inspect, update, and execute Tabnine CLI through the standard `quantex` workflow.

## What Changes

- Add a Tabnine CLI agent definition (`src/agents/definitions/tabnine.ts`) with lifecycle-focused metadata.
- Register the Tabnine agent in the catalog index (`src/agents/index.ts`).
- Add a spec delta to `openspec/specs/agent-catalog/spec.md` documenting the Tabnine lifecycle contract.
- Update product-facing README tables to include Tabnine.

## Capabilities

### New Capabilities

- `agent-catalog`: Tabnine CLI as a supported lifecycle agent with installation, inspection, version probing, and self-update metadata.

### Modified Capabilities

None.

## Impact

- Affected code: `src/agents/definitions/`, `src/agents/index.ts`, root README tables.
- Affected contract: `openspec/specs/agent-catalog/spec.md`.
