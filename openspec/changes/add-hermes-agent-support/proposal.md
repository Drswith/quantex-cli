## Why

This request changes supported agent catalog metadata, install methods, update behavior, and product-facing supported-agent documentation, so it requires an OpenSpec-backed change before implementation. Hermes Agent (Nous Research) publishes a maintained `hermes` CLI with documented native installers for Linux/macOS/WSL2 and Windows PowerShell, a `hermes update` self-update entrypoint, and standard `--version` version probing, but Quantex cannot yet install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add a Hermes Agent definition with verified lifecycle metadata: canonical slug, display name, homepage, executable name, native script install methods, version probe, and self-update command.
- Register Hermes in the built-in agent catalog and root exports so existing lookup, install, ensure, inspect, resolve, exec, and update surfaces can use it.
- Extend the `agent-catalog` contract with a Hermes requirement that records the supported install methods, version probe, and update command.
- Refresh the product README supported-agent tables so the documented catalog matches the implemented CLI surface.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add Hermes Agent as a supported lifecycle agent with verified install, version-probe, and update metadata.

## Impact

- `src/agents/catalog/hermes.json` - new Hermes lifecycle catalog entry.
- `src/agents/generated/catalog-data.ts` and `src/agents/generated/catalog-agents.ts` - regenerated manifest exports.
- `src/agents/index.ts` - register and re-export Hermes through the agents module.
- `test/agents.test.ts` - verify Hermes metadata, lookup behavior, install methods, and root exports.
- `openspec/changes/add-hermes-agent-support/specs/agent-catalog/spec.md` - document the Hermes catalog delta.
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with the current catalog.
