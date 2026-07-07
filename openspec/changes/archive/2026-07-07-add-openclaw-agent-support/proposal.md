## Why

This request changes supported agent catalog metadata, install methods, update behavior, and product-facing supported-agent documentation, so it requires an OpenSpec-backed change before implementation. OpenClaw publishes a maintained `openclaw` CLI with documented install paths for Linux/macOS/WSL2 (curl installer), Windows (PowerShell installer), and npm/pnpm/bun for users who manage Node themselves, a `openclaw update` self-update entrypoint, and standard `openclaw --version` version probing, but Quantex cannot yet install, inspect, or launch it as a first-class lifecycle agent.

## What Changes

- Add an OpenClaw definition with verified lifecycle metadata: canonical slug, display name, homepage, executable name, native script install methods, npm and bun managed install methods, npm package metadata, version probe, and self-update command.
- Register OpenClaw in the built-in agent catalog and root exports so existing lookup, install, ensure, inspect, resolve, exec, and update surfaces can use it.
- Extend the `agent-catalog` contract with an OpenClaw requirement that records the supported install methods, version probe, and update command.
- Refresh the product README supported-agent tables so the documented catalog matches the implemented CLI surface.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add OpenClaw as a supported lifecycle agent with verified install, version-probe, and update metadata.

## Impact

- `src/agents/catalog/openclaw.json` - new OpenClaw lifecycle catalog entry.
- `src/agents/generated/catalog-data.ts` and `src/agents/generated/catalog-agents.ts` - regenerated manifest exports.
- `src/agents/index.ts` - register and re-export OpenClaw through the agents module.
- `src/index.ts` - re-export OpenClaw through the root module.
- `test/agents.test.ts` - verify OpenClaw metadata, lookup behavior, install methods, and exports.
- `test/index.test.ts` - verify OpenClaw root export and canonical-name lookup.
- `openspec/changes/add-openclaw-agent-support/specs/agent-catalog/spec.md` - document the OpenClaw catalog delta.
- `README.md` and `README.zh-CN.md` - sync supported-agent tables with the current catalog.
