## Why

This request changes the supported agent catalog, install metadata, and version-probe behavior, so it requires an OpenSpec-backed change before implementation. DeepSeek TUI is now distributed through an npm wrapper around upstream release artifacts, but Quantex cannot currently install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add a DeepSeek TUI agent definition with verified lifecycle metadata: canonical slug, lookup alias, display name, homepage, npm package metadata, executable name, install method, version probe, and self-update command.
- Register DeepSeek TUI in the runtime agent catalog and root exports so lookup, inspection, resolution, and execution surfaces can use it.
- Extend the agent-catalog contract with a DeepSeek TUI requirement that records the supported lookup names, npm install path, version probe, and self-update command.
- Refresh the product README agent tables so the documented supported-agent list matches the implemented catalog after adding DeepSeek TUI.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add DeepSeek TUI as a supported lifecycle agent with verified install, version-probe, and self-update metadata.

## Impact

- `src/agents/definitions/deepseek.ts` - new DeepSeek TUI catalog entry
- `src/agents/index.ts` and `src/index.ts` - register and re-export DeepSeek TUI
- `test/agents.test.ts` and `test/index.test.ts` - verify DeepSeek TUI metadata and exports
- `openspec/specs/agent-catalog/spec.md` - add the DeepSeek TUI requirement
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with the implemented catalog
