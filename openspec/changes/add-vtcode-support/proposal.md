## Why

This request changes supported agent catalog metadata, install methods, update behavior, and product-facing supported-agent documentation, so it requires an OpenSpec-backed change before implementation. VTCode publishes a standalone `vtcode` CLI with documented native installers, Cargo/Homebrew install paths, version probing, and update behavior, but Quantex cannot yet install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add a VTCode agent definition with verified lifecycle metadata: canonical slug, display name, homepage, package metadata, executable name, install methods, version probe, and self-update command.
- Register VTCode in the built-in agent catalog and root exports so existing lookup, install, ensure, inspect, resolve, exec, and update surfaces can use it.
- Extend the `agent-catalog` contract with a VTCode requirement that records the supported install methods, version probe, and update command.
- Refresh the product README supported-agent tables so the documented catalog matches the implemented CLI surface.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add VTCode as a supported lifecycle agent with verified install, version-probe, and update metadata.

## Impact

- `src/agents/definitions/vtcode.ts` - new VTCode lifecycle metadata definition.
- `src/agents/index.ts` and `src/index.ts` - register and re-export VTCode.
- `test/agents.test.ts` and `test/index.test.ts` - verify VTCode metadata, lookup behavior, and root exports.
- `openspec/changes/add-vtcode-support/specs/agent-catalog/spec.md` - document the VTCode catalog delta.
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with the current catalog.
