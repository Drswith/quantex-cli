## Why

Amp by Sourcegraph is a frontier coding agent CLI with a growing user base. Quantex users should be able to install, inspect, update, and launch Amp through the standard `quantex` lifecycle commands.

## What Changes

- Add a new supported agent entry for Amp (`amp`) to the agent catalog.
- Register npm-compatible and bun-compatible install methods on all platforms (macOS, Linux, Windows).
- Register `amp version` as the version probe command.
- Register `amp update` as the self-update command.
- Update the agent-catalog spec to include Amp lifecycle requirements.

## Capabilities

### New Capabilities

- `agent-catalog`: Amp is a supported lifecycle agent with install, inspect, resolve, execute, update, and version-probe capabilities.

### Modified Capabilities

None.

## Impact

- Affected code: `src/agents/definitions/amp.ts`, `src/agents/index.ts`.
- Affected contract: `openspec/specs/agent-catalog/spec.md`.
