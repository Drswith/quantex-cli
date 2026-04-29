## Why

Kimi Code CLI (by Moonshot AI) is a terminal-based AI coding agent with growing adoption, Homebrew support, and a stable release cadence (currently v1.40.0). Users expect `quantex install kimi` to work the same way it does for Claude Code, Codex, or Qwen Code. Adding it fills a gap in the supported agent catalog.

## What Changes

- Add a new `kimi` agent definition (`src/agents/definitions/kimi.ts`) with lifecycle-focused metadata
- Register the new definition in `src/agents/index.ts`
- Install methods: official curl/PowerShell install scripts only (no npm package; community Homebrew formula exists but is not officially supported and lags behind releases)
- Self-update command: `uv tool upgrade kimi-cli --no-cache`
- Binary name: `kimi`
- Version probe: `kimi --version`

## Capabilities

### New Capabilities

(none — this is a catalog addition, not a new capability)

### Modified Capabilities

- `agent-catalog`: add a requirement that Kimi Code CLI MUST be a supported lifecycle agent

## Impact

- `src/agents/definitions/kimi.ts` (new file — script install only, no bun/npm/brew)
- `src/agents/index.ts` (add import and array entry)
- `openspec/specs/agent-catalog/spec.md` (add Kimi Code requirement section)
