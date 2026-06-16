## Why

Management commands gained late-success grace after `--timeout` in the idempotency timeout fix, but `quantex exec` and shortcut `quantex <agent>` install paths still report `TIMEOUT` when managed install completes just after the deadline. This leaves the agent installed while automation sees exit code `10` and skips spawning the binary.

## What Changes

- Apply the same late-success grace window to exec and shortcut install timeout handling.
- Add a regression test mirroring the management-command late-timeout success case.
- Extend the agent-update spec with an exec install late-success scenario.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: exec and shortcut install flows must report success when install completes successfully shortly after the timeout deadline.

## Impact

- Affected code: `src/commands/run.ts`, `test/commands/run.test.ts`, `openspec/specs/agent-update/spec.md`.
- No CLI flags, schema version, or command catalog changes.
