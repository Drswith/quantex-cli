## Why

This request changes the supported agent catalog, install metadata, and version-probe behavior, so it requires an OpenSpec-backed change before implementation. Junie CLI is now publicly documented by JetBrains across terminal, IDE, and CI workflows, but Quantex cannot currently install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add a Junie CLI agent definition with verified lifecycle metadata: canonical slug, display name, homepage, npm package metadata, executable name, install methods, and version probe.
- Register Junie in the runtime agent catalog and root exports so lookup, inspection, resolution, and execution surfaces can use it.
- Extend the agent-catalog contract with a Junie requirement that records the supported install paths and the lack of a dedicated self-update command.
- Refresh the product README agent tables so the documented supported-agent list matches the actual catalog after adding Junie.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add Junie CLI as a supported lifecycle agent with verified install methods and version-probe behavior.

## Impact

- `src/agents/definitions/junie.ts` - new Junie catalog entry
- `src/agents/index.ts` and `src/index.ts` - register and re-export Junie
- `test/agents.test.ts` and `test/index.test.ts` - verify Junie metadata and exports
- `openspec/specs/agent-catalog/spec.md` - add the Junie requirement
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with the current catalog
