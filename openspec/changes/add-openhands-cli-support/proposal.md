## Why

OpenHands is a separate upstream project from the already supported Autohand CLI. Quantex should support `openhands` as its own lifecycle agent so users can install, inspect, resolve, and run it without colliding with the existing `autohand` catalog entry.

This request requires OpenSpec because it adds supported agent catalog metadata and updates product-facing supported-agent documentation.

## What Changes

- Add a supported `openhands` catalog entry with verified install methods, version probing, and update metadata from the official OpenHands CLI docs.
- Register the new agent in the runtime registry and root exports without changing the existing `autohand` entry.
- Add test coverage for OpenHands lookup, install metadata, and version probing.
- Update supported-agent documentation to list OpenHands separately from Autohand.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: add OpenHands CLI as a supported lifecycle agent with official install methods, version probing, and documented update guidance

## Impact

- `src/agents/definitions/openhands.ts` - new OpenHands lifecycle metadata definition
- `src/agents/index.ts` and `src/index.ts` - register and re-export OpenHands
- `test/agents.test.ts` and `test/index.test.ts` - cover OpenHands lookup and metadata
- `README.md` and `README.zh-CN.md` - add OpenHands to supported-agent tables
- `openspec/changes/add-openhands-cli-support/specs/agent-catalog/spec.md` - record the catalog contract delta
