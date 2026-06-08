## Why

`quantex exec` and shortcut `quantex <agent>` honor `--timeout` only after the agent process is spawned. When the agent is missing and install runs first, a hung managed installer can block forever even though management commands already cancel installer subprocesses on timeout.

## What Changes

- Apply the configured CLI timeout to the install phase in `runCommand`.
- Cancel managed installer subprocesses through the existing CLI cancellation handlers when the install deadline expires.
- Add regression coverage for install-phase timeout on exec/shortcut paths.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: exec and shortcut install flows must honor global `--timeout` during managed install work.

## Impact

- Affected code: `src/commands/run.ts`, `test/commands/run.test.ts`.
- Affected specs: `openspec/specs/agent-update/spec.md` through a change delta.
- No schema version, command catalog, or dependency changes are intended.
