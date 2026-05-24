## Why

This request changes supported agent catalog metadata and user-facing install/probe/update behavior, so it requires an OpenSpec-backed change before implementation. Upstream DeepSeek TUI has rebranded to CodeWhale as of `v0.8.41`, while Quantex still points fresh installs and lifecycle commands at the legacy names.

## What Changes

- Rename the existing DeepSeek TUI catalog entry to the canonical CodeWhale entry with CodeWhale display, homepage, npm package, Cargo package, binary, version-probe, and self-update metadata.
- Remove `deepseek` and `deepseek-tui` lookup compatibility so the catalog follows upstream's new canonical command directly.
- Update README agent tables and automated tests so supported-agent documentation matches the implemented catalog.
- Extend the `agent-catalog` contract with the renamed CodeWhale lifecycle surface as a breaking canonical rename.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Replace the DeepSeek TUI lifecycle entry with the upstream CodeWhale catalog entry as a breaking canonical rename.

## Impact

- `src/agents/catalog/codewhale.json` - rename lifecycle metadata to CodeWhale names.
- `test/agents.test.ts` and `test/index.test.ts` - verify CodeWhale metadata and removed legacy aliases.
- `README.md` and `README.zh-CN.md` - sync supported-agent tables.
- `openspec/specs/agent-catalog/spec.md` via delta - record the renamed catalog contract.
