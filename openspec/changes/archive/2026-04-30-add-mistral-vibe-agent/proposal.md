## Why

Quantex does not yet support Mistral Vibe even though Mistral now documents official terminal install paths and a standard `vibe` executable. Users should be able to install, inspect, resolve, and run Mistral Vibe through the same lifecycle surface they already use for other coding-agent CLIs.

This request is OpenSpec-scoped because it changes supported agent catalog metadata and updates product-facing supported-agent documentation.

## What Changes

- Add a supported Mistral Vibe catalog entry with canonical lookup, official install methods, and a version probe.
- Register the new agent in the runtime registry and add verification coverage for lookup and install metadata.
- Sync the product README supported-agent tables so they reflect the current catalog and include Mistral Vibe.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: Add Mistral Vibe as a supported lifecycle agent with official install methods, lookup alias, and version probing.

## Impact

- `src/agents/definitions/vibe.ts` — new Mistral Vibe agent definition
- `src/agents/index.ts` — register the new catalog entry
- `test/agents.test.ts`, `test/index.test.ts` — verify lookup and install metadata
- `README.md`, `README.zh-CN.md` — update supported-agent tables
- `openspec/changes/add-mistral-vibe-agent/specs/agent-catalog/spec.md` — record the catalog contract delta
