## Why

Dry-run mutating commands currently persist successful idempotency records even though no mutation occurred. A subsequent real invocation with the same `--idempotency-key` replays the dry-run payload and skips installation, upgrade, or uninstall work. Separately, batch `install` and `update --all` use agent targets without a distinguishing `name`, so unrelated requests with the same key replay the wrong batch result.

## What Changes

- Do not persist idempotency records for dry-run invocations.
- Do not replay stored dry-run results for non-dry-run retries.
- Require explicit agent-list targets for batch `install` idempotency matching.
- Treat agent targets without a `name` as non-replayable to prevent batch collisions.
- Add regression tests for dry-run and batch target matching.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cli-idempotency`: define dry-run exclusion and batch target matching rules.

## Impact

- Affected code: `src/command-runtime.ts`, `src/cli.ts`, `test/command-runtime.test.ts`, `openspec/specs/cli-idempotency/spec.md`.
- No CLI flags, schema version, or command catalog changes.
