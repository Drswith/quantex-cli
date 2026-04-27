## Why

Quantex currently does not recognize Kilo Code CLI even though it is a mainstream terminal coding agent with a documented npm package, canonical binary name, and self-update command. Adding first-class support keeps Quantex's agent catalog aligned with the tools users actually install and automate today.

## What Changes

- Add Kilo Code CLI to the Quantex agent catalog with verified package metadata, binary name, homepage, install methods, and self-update command.
- Make Kilo discoverable through Quantex lifecycle commands such as `install`, `ensure`, `list`, `info`, `inspect`, `resolve`, `exec`, and `update`.
- Cover the new catalog entry with tests and update user-facing supported-agent documentation where needed.
- Do not change Quantex release automation, configuration shape, or lifecycle semantics.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Extend the agent catalog contract so newly supported agents like Kilo Code CLI expose verified install, lookup, and update metadata through the lifecycle surface.

## Impact

- Affected files: `src/agents/**`, relevant tests under `test/**`, and product docs that enumerate supported agents.
- No new runtime dependencies or release-flow changes.
