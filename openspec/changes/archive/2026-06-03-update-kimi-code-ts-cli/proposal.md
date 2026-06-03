## Why

Work intake classification: this changes supported agent catalog metadata, install methods, update planning, and the agent-catalog behavior contract, so it requires an OpenSpec-backed change.

Kimi Code CLI has completed a major upstream migration from the Python/uv-based `kimi-cli` distribution to a TypeScript CLI distributed through Node.js/npm and official native install scripts. Quantex still models Kimi as a uv-managed Python tool, which points new installs and update planning at the deprecated lifecycle source.

## What Changes

- Update the Kimi Code catalog entry to use the current official Kimi Code CLI homepage and install script URLs.
- Replace `kimi-cli` uv package metadata with the current npm package `@moonshot-ai/kimi-code`.
- Add npm-compatible managed install methods for supported platforms while keeping official script install methods available.
- Replace the old uv self-update command with the current `kimi upgrade` command.
- Update the agent-catalog spec requirement so Quantex's Kimi lifecycle contract matches the current upstream distribution.
- Do not change Quantex runtime support for uv-managed agents generally.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: update Kimi Code CLI's lifecycle metadata from the deprecated Python/uv distribution to the current TypeScript/npm and official script distribution.

## Impact

- Affected catalog file: `src/agents/catalog/kimi.json`.
- Affected specs: `openspec/specs/agent-catalog/spec.md` and the active change delta under `openspec/changes/update-kimi-code-ts-cli/specs/agent-catalog/spec.md`.
- Affected generated catalog outputs may change if catalog generation is required.
- Validation should include catalog/schema checks through `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
