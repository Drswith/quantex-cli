## Why

Auggie CLI is Augment's terminal coding agent, and users expect `quantex install auggie`, `quantex info auggie`, and `quantex update auggie` to work like the rest of the supported agent catalog. Quantex does not currently recognize Auggie even though its install, version, and upgrade surfaces are documented upstream.

## What Changes

- Add an Auggie CLI agent definition with verified lifecycle metadata for install, version probing, and update planning
- Register Auggie in the supported agent catalog so lifecycle commands can resolve it
- Update product-facing supported-agent tables to include Auggie and reflect the current catalog
- Add an OpenSpec delta for the Auggie catalog contract

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add Auggie CLI as a supported lifecycle agent with install, version probe, and self-update requirements

## Impact

- `src/agents/definitions/auggie.ts` — new agent definition
- `src/agents/index.ts` — register Auggie in the catalog
- `test/agents.test.ts` and `test/utils/version.test.ts` — cover Auggie metadata and version parsing expectations
- `README.md` and `README.zh-CN.md` — include Auggie in supported-agent tables and sync the catalog list
- `openspec/changes/add-auggie-cli-support/specs/agent-catalog/spec.md` — define the Auggie contract
