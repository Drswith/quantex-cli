## Why

Deep Code CLI (`lessweb/deepcode-cli`) is a documented terminal coding agent with a published npm package and stable `deepcode` executable, but Quantex cannot currently manage it through install, inspect, ensure, update planning, or uninstall flows.

This request requires OpenSpec because it changes supported agent catalog metadata and product-facing supported-agent documentation.

## What Changes

- Add a supported `deepcode` catalog entry with verified lifecycle metadata from the official Deep Code CLI docs and npm package metadata.
- Register Deep Code CLI in the runtime agent registry and root exports.
- Add tests covering Deep Code lookup, install metadata, and version probing.
- Update supported-agent documentation to include Deep Code CLI.
- Add an `agent-catalog` spec delta that records the new lifecycle contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: add Deep Code CLI as a supported lifecycle agent with verified install metadata, version probing, and stable identification

## Impact

- `src/agents/catalog/deepcode.json` - new Deep Code lifecycle metadata definition
- generated catalog exports and `src/index.ts` - register and re-export Deep Code
- `test/agents.test.ts` and `test/index.test.ts` - cover Deep Code lookup and metadata
- `README.md` and `README.zh-CN.md` - add Deep Code to supported-agent tables
- `openspec/changes/add-deep-code-cli-support/specs/agent-catalog/spec.md` - record the catalog contract delta
