## Why

`executeCommandWithRuntime` returns `TIMEOUT` while batch lifecycle work such as `quantex install <a> <b>` and `quantex update --all` can keep running in the background. After the cancelled item finishes or fails, later agents may still install or update and persist state even though the caller already received a timeout result. That violates the managed cancellation contract and can surprise automation that treats exit code `10` as a hard stop.

## What Changes

- Stop batch install and batch update loops as soon as the CLI context is marked cancelled.
- Skip installed-agent state persistence when cancellation has already been emitted for the current command.
- Add regression tests for batch install timeout cancellation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: batch install and `update --all` must not continue lifecycle work or persist normal installed-agent state after timeout or signal cancellation.

## Impact

- Affected code: `src/commands/install.ts`, `src/commands/update.ts`, `src/package-manager/index.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
