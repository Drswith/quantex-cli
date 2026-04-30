## Why

This request requires OpenSpec because it changes supported agent catalog metadata and product-facing supported-agent documentation. Autohand Code CLI now publishes official cross-platform installer scripts, release binaries, and a stable `autohand` executable, but Quantex cannot currently install, inspect, or resolve it as a first-class lifecycle agent.

## What Changes

- Add an Autohand Code CLI agent definition with verified lifecycle metadata for lookup, installation, and version probing
- Register Autohand in the supported agent catalog so lifecycle commands can resolve `autohand`
- Update product-facing supported-agent tables to include Autohand and keep the catalog list in sync
- Add an OpenSpec delta for the Autohand agent-catalog contract

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: add Autohand Code CLI as a supported lifecycle agent with canonical lookup, script installer metadata, and version-probe requirements

## Impact

- `src/agents/definitions/autohand.ts` - new lifecycle metadata definition
- `src/agents/index.ts` and `src/index.ts` - register and re-export Autohand
- `test/agents.test.ts` and `test/index.test.ts` - cover lookup, exports, and installer metadata
- `README.md` and `README.zh-CN.md` - include Autohand in supported-agent tables
- `openspec/changes/add-autohand-code-cli-support/specs/agent-catalog/spec.md` - record the catalog contract delta
