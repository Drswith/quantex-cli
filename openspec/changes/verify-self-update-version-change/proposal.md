## Why

Quantex currently reports `updated successfully` for self-updating agents such as Cursor CLI when the upstream update command exits successfully, even if the installed version does not change. That overstates what Quantex has actually verified and makes it impossible to distinguish "the update command ran" from "the agent really upgraded" when no upstream latest-version API is available.

## What Changes

- Change self-update result handling so Quantex compares the installed version before and after a self-update attempt whenever the agent exposes a version probe.
- Report self-update results as `up to date` when the update command succeeds but the installed version does not change.
- Keep the existing `updated successfully` outcome only when Quantex can verify that the installed version changed, or when no version probe is available at all.
- Add regression coverage for tracked script installs and explicit single-agent self-update flows.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: self-update outcomes must reflect verified version change instead of command success alone when Quantex can probe the installed version before and after the update.

## Impact

- Affected code: `src/commands/update.ts`, version utilities, and update command tests.
- Affected contracts: human and structured update results for self-updating agents such as Cursor CLI.
- Dependencies: no new runtime dependency.
