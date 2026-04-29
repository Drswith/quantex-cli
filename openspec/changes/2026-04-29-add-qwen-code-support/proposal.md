## Why

Qwen Code (by QwenLM/Alibaba) is an open-source AI coding agent CLI that users want to manage through Quantex's lifecycle commands. It is actively maintained (npm v0.15.4, 9k+ Homebrew installs in 30 days) and has official install scripts, npm distribution, and Homebrew support. Adding it to the catalog lets users install, inspect, ensure, update, uninstall, resolve, and shortcut-launch Qwen Code with the same stable Quantex contract as existing agents.

## What Changes

- Add Qwen Code as a supported agent catalog entry.
- Expose Qwen Code through existing lookup, list, info, inspect, resolve, ensure, install, update, uninstall, and shortcut execution surfaces.
- Include Qwen Code's lifecycle metadata: canonical name, display name, lookup alias, homepage, npm package, binary name, and supported install methods (script, bun, npm, brew).
- Add tests covering the new catalog entry and registry export.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: the supported agent catalog includes Qwen Code as a lifecycle-managed agent.

## Impact

- Affected code: `src/agents/definitions/`, `src/agents/index.ts`, and agent registry tests.
- Affected contracts: supported agent catalog output and any CLI command that enumerates or resolves supported agents.
- Dependencies: no new runtime dependency.
