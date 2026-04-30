## Why

This request changes the supported agent catalog, install metadata, and update behavior, so it requires an OpenSpec-backed change before implementation. Devin for Terminal now has official installation, version, and update documentation, but Quantex cannot yet install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add a Devin for Terminal agent definition with verified lifecycle metadata: canonical slug, display name, homepage, executable name, install methods, version probe, and self-update command.
- Register Devin in the built-in agent catalog and root exports so existing lookup, install, ensure, inspect, resolve, exec, and update surfaces can use it.
- Extend the agent-catalog contract with a Devin requirement that records the supported install scripts, version probe, and self-update behavior.
- Refresh the product README supported-agent tables so the documented catalog matches the implemented CLI surface.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add Devin for Terminal as a supported lifecycle agent with verified install, version-probe, and update metadata.

## Impact

- `src/agents/definitions/devin.ts` - new Devin lifecycle metadata definition
- `src/agents/index.ts` and `src/index.ts` - register and re-export Devin
- `test/agents.test.ts` and `test/index.test.ts` - registry and export coverage
- `openspec/specs/agent-catalog/spec.md` - add the Devin requirement
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with the current catalog
