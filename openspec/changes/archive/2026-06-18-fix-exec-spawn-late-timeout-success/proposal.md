## Why

Exec and shortcut install timeout handling gained a late-success grace window in PR #368, but spawned agent execution still cancels immediately when `--timeout` expires. When the agent process exits successfully just after the deadline, automation receives exit code `10` instead of the agent's real exit code.

## What Changes

- Apply the same `min(timeoutMs, 250)` late-success grace window to exec and shortcut spawn timeout handling.
- Defer `cancelCliContextOperations()` for spawn timeouts until the grace window expires without a terminal exit code.
- Add a regression test for spawn late-timeout success.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: exec and shortcut spawn flows must return the agent exit code when the process completes successfully shortly after the timeout deadline.

## Impact

- Affected code: `src/commands/run.ts`, `test/commands/run.test.ts`, `openspec/specs/agent-update/spec.md`.
- No CLI flags, schema version, or command catalog changes.
