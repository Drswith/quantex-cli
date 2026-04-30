## Why

Goose (by Block) is an open-source, extensible AI agent with a growing user base (4,900+ Homebrew installs in 30 days). Users expect `quantex install goose`, `quantex info goose`, and `quantex update goose` to work, but Goose is not yet in the supported agent catalog.

## What Changes

- Add a Goose agent definition to `src/agents/definitions/goose.ts` with lifecycle metadata (install methods, version probe, self-update command)
- Register Goose in the agent catalog index
- Update the agent-catalog spec with a Goose requirement

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add Goose as a supported lifecycle agent with install, version probe, and self-update requirements

## Impact

- `src/agents/definitions/goose.ts` — new file
- `src/agents/index.ts` — register import, array entry, re-export
- `openspec/specs/agent-catalog/spec.md` — add Goose requirement section
