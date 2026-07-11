## Why

`quantex update <agent>` can return `ok: true` when the CLI context is cancelled during the update, because only `update --all` has an explicit post-execution cancel fail-closed guard. Automation that trusts structured success for a single-agent update can treat a cancelled mutation as completed.

## What Changes

- Return a non-success `CANCELLED` result from single-agent `update` when cancellation is observed after planned update execution.
- Add a regression test that mirrors the existing batch-update cancel coverage for the single-agent path.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: single-agent `update` must report cancellation failure instead of overall success when the CLI context is cancelled after update work runs.

## Impact

- Affected code: `src/commands/update.ts`, `test/commands/update.test.ts`.
- No CLI flags, schema version, or command catalog changes.
- Work-intake classification: observable CLI behavior / structured success contract → OpenSpec required.
