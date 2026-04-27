## Why

Qoder CLI is another mainstream AI coding assistant that users may want to manage through Quantex's lifecycle commands. Adding it to the catalog lets users install, inspect, ensure, update, uninstall, resolve, and shortcut-launch Qoder with the same stable Quantex contract as existing agents.

## What Changes

- Add Qoder CLI as a supported agent catalog entry.
- Expose Qoder through existing lookup, list, info, inspect, resolve, ensure, install, update, uninstall, and shortcut execution surfaces.
- Include Qoder's lifecycle metadata: canonical name, display name, homepage, npm package, binary name, supported install methods, and self-update command.
- Add tests covering the new catalog entry and registry export.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: the supported agent catalog includes Qoder CLI as a lifecycle-managed agent.

## Impact

- Affected code: `src/agents/definitions/`, `src/agents/index.ts`, and agent registry tests.
- Affected contracts: supported agent catalog output and any CLI command that enumerates or resolves supported agents.
- Dependencies: no new runtime dependency.
