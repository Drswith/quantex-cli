## Why

This request changes supported agent catalog metadata and user-facing supported-agent documentation, so it requires an OpenSpec-backed change before implementation. Reasonix now publishes a maintained npm package and CLI with documented install, version, and self-update surfaces, but Quantex cannot currently install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add a Reasonix agent definition with verified lifecycle metadata: canonical slug, display name, homepage, npm package metadata, executable name, install method, version probe, and self-update command.
- Register Reasonix in the built-in agent catalog and root exports so lookup, inspection, resolution, execution, and update planning surfaces can use it.
- Extend the `agent-catalog` capability with a Reasonix requirement that records the supported lookup names, install path, version probe, and self-update command.
- Refresh product README agent tables so documented support matches the implemented catalog.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: add Reasonix as a supported lifecycle agent with verified install, version-probe, and self-update metadata

## Impact

- `src/agents/definitions/reasonix.ts` - new Reasonix catalog entry
- `src/agents/index.ts` and `src/index.ts` - register and re-export Reasonix
- `test/agents.test.ts` and `test/index.test.ts` - verify Reasonix metadata, lookup behavior, and root exports
- `openspec/changes/add-reasonix-support/specs/agent-catalog/spec.md` - document the Reasonix requirement
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with implemented support
