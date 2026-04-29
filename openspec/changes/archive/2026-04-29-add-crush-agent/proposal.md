## Why

Charmbracelet's Crush is a prominent terminal-based AI coding agent with broad multi-platform support (Homebrew, npm, winget, scoop, apt, yum, Go install, binary downloads). It is not yet in the Quantex agent catalog, so users cannot install, inspect, update, or launch Crush through Quantex.

## What Changes

- Add Crush as a supported agent entry in the Quantex catalog
- Register canonical name `crush`, display name `Crush`, binary name `crush`
- Register npm package `@charmland/crush`
- Register install methods: Homebrew (macOS/Linux), npm/bun (all platforms), winget (Windows)
- Register self-update command `crush update`
- Register version probe command `crush --version`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agent-catalog`: Add Crush as a supported lifecycle agent with install, inspect, update, and execution metadata

## Impact

- `src/agents/definitions/crush.ts` (new file)
- `src/agents/index.ts` (import and register)
- `openspec/specs/agent-catalog/spec.md` (add Crush requirement)
